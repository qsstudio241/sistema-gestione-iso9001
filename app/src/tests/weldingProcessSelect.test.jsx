/**
 * Test L1 — select processi saldatura da catalogo ISO 4063 (non più lista fissa a 8 voci).
 * Evidenza PROD: in WPS/WPQR/Qualifiche mancavano 783-786 (stud welding) pur presenti nel catalogo.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: vi.fn(),
    getCompanyPersonnel: vi.fn(),
    getQualificationConfirmations: vi.fn(),
    updateQualification: vi.fn(),
    createQualification: vi.fn(),
    renewQualification: vi.fn(),
    getWPSList: vi.fn(),
    getWPQRList: vi.fn(),
    getWPQRStats: vi.fn(),
    updateWPQR: vi.fn(),
    updateWPS: vi.fn(),
    getWpqrTestRuns: vi.fn(),
    getWpqrSketches: vi.fn().mockResolvedValue({ sketches: [] }),
    saveWpqrTestRuns: vi.fn(),
    baseUrl: "",
  },
}));
vi.mock("../utils/wordExportWps", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, exportWpsAnnexADocx: vi.fn() };
});
vi.mock("../components/AskAiButton", () => ({ default: () => null }));
vi.mock("../components/WpsUploadButton", () => ({ default: () => null }));
vi.mock("../components/WpqrUploadButton", () => ({ default: () => null }));
vi.mock("../components/ReprocessQueueBanner", () => ({ default: () => null }));

import apiService from "../services/apiService";
import WeldingProceduresPage from "../pages/WeldingProceduresPage";
import QualificationForm from "../pages/QualificationForm";
import { getProcessSelectOptions, getProcessLabel, canonicalizeProcessValue } from "../utils/weldingProcessSelect";

const HISTORICAL = ["111", "121", "131", "135", "136", "141", "311", "15"];
const STUD = ["783", "784", "785", "786"];

function optionValues(select) {
  return within(select).getAllByRole("option").map((o) => o.value);
}

describe("getProcessSelectOptions / getProcessLabel", () => {
  it("contiene voci storiche e stud 783-786, senza «altro» di default", () => {
    const values = getProcessSelectOptions("").map((o) => o.value);
    for (const c of [...HISTORICAL, ...STUD]) expect(values).toContain(c);
    expect(values).not.toContain("altro");
  });

  it("valore legacy fuori catalogo: opzione extra «(non in elenco)»", () => {
    const opts = getProcessSelectOptions("999-LEGACY");
    expect(opts[opts.length - 1]).toEqual({ value: "999-LEGACY", label: "999-LEGACY (non in elenco)" });
  });

  it("valore in catalogo: nessuna opzione extra", () => {
    expect(getProcessSelectOptions("783")).toEqual(getProcessSelectOptions(""));
  });

  it("canonicalizeProcessValue: «783-STUD WELDING» -> 783; elenchi e testi senza codice invariati", () => {
    expect(canonicalizeProcessValue("783-STUD WELDING")).toBe("783");
    expect(canonicalizeProcessValue("135, 138")).toBe("135, 138");
    expect(canonicalizeProcessValue("boh")).toBe("boh");
    expect(canonicalizeProcessValue("altro")).toBe("altro");
    expect(canonicalizeProcessValue("")).toBe("");
    expect(canonicalizeProcessValue(null)).toBe(null);
  });

  it("legacy «783-STUD WELDING»: select senza opzione extra; tabella col valore grezzo (filtro server a match esatto)", () => {
    expect(getProcessSelectOptions("783-STUD WELDING")).toEqual(getProcessSelectOptions(""));
    expect(getProcessLabel("783-STUD WELDING")).toBe("783-STUD WELDING");
  });

  it("etichetta tabella: codice + nome IT, fallback sul valore grezzo", () => {
    expect(getProcessLabel("783")).toMatch(/^783 — Stud/);
    expect(getProcessLabel("XYZ")).toBe("XYZ");
    expect(getProcessLabel("")).toBe("");
  });
});

describe("WeldingProceduresPage — select processo da catalogo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCompanies.mockResolvedValue({ data: [] });
    apiService.getWPSList.mockResolvedValue({
      data: [{ id: 7, wps_code: "WPS-STUD", status: "attiva", welding_process: "783" }],
      pagination: { total: 1 },
    });
    apiService.getWPQRList.mockResolvedValue({
      data: [
        { id: 1, wpqr_code: "WPQR-LEG", reference_number: "WPQR-LEG", approval_status: "bozza", welding_process: "999-LEGACY" },
        { id: 2, wpqr_code: "WPQR-STUD", reference_number: "WPQR-STUD", approval_status: "bozza", welding_process: "783-STUD WELDING" },
      ],
      pagination: { total: 2 },
    });
    apiService.getWPQRStats.mockResolvedValue({ data: { totale: 1, da_approvare: 1, rifiutate: 0, approvate: 0 } });
    apiService.getWpqrTestRuns.mockResolvedValue({ runs: [], available: true });
  });

  it("WPS: filtro processo, tabella e modal «Nuova WPS» usano il catalogo", async () => {
    const user = userEvent.setup();
    render(<WeldingProceduresPage />);
    await waitFor(() => expect(screen.getByText("WPS-STUD")).toBeTruthy());

    const filter = screen.getByRole("option", { name: "Tutti i processi" }).closest("select");
    for (const c of [...HISTORICAL, ...STUD]) expect(optionValues(filter)).toContain(c);
    expect(screen.getByText(/^783 — Stud/, { selector: "td" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Nuova WPS/ }));
    const select = screen.getByText("Processo di saldatura").closest(".wp-form-group").querySelector("select");
    for (const c of [...HISTORICAL, ...STUD]) expect(optionValues(select)).toContain(c);
  });

  it("WPQR: modal modifica mostra 783-786 e il valore legacy fuori elenco resta selezionato", async () => {
    const user = userEvent.setup();
    render(<WeldingProceduresPage />);
    await waitFor(() => expect(apiService.getWPQRStats).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /^WPQR/i }));
    await waitFor(() => expect(screen.getByText("WPQR-LEG")).toBeTruthy());
    await user.click(screen.getByText("WPQR-LEG").closest("tr"));

    const select = screen.getByText("Processo saldatura (ISO 4063)").closest(".wp-form-group").querySelector("select");
    const values = optionValues(select);
    for (const c of [...HISTORICAL, ...STUD]) expect(values).toContain(c);
    expect(select.value).toBe("999-LEGACY");
    expect(within(select).getByRole("option", { name: "999-LEGACY (non in elenco)" })).toBeTruthy();
  });
});

describe("WeldingProceduresPage — WPQR con «783-STUD WELDING» legacy", () => {
  it("la select mostra 783 selezionato (senza opzione extra) e non modifica il dato", async () => {
    apiService.getCompanies.mockResolvedValue({ data: [] });
    apiService.getWPSList.mockResolvedValue({ data: [], pagination: { total: 0 } });
    apiService.getWPQRList.mockResolvedValue({
      data: [{ id: 2, wpqr_code: "WPQR-STUD", reference_number: "WPQR-STUD", approval_status: "bozza", welding_process: "783-STUD WELDING" }],
      pagination: { total: 1 },
    });
    apiService.getWPQRStats.mockResolvedValue({ data: { totale: 1, da_approvare: 1, rifiutate: 0, approvate: 0 } });
    apiService.getWpqrTestRuns.mockResolvedValue({ runs: [], available: true });
    const user = userEvent.setup();
    render(<WeldingProceduresPage />);
    await waitFor(() => expect(apiService.getWPQRStats).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /^WPQR/i }));
    await waitFor(() => expect(screen.getByText("WPQR-STUD")).toBeTruthy());
    await user.click(screen.getByText("WPQR-STUD").closest("tr"));
    const select = screen.getByText("Processo saldatura (ISO 4063)").closest(".wp-form-group").querySelector("select");
    expect(select.value).toBe("783");
    expect(optionValues(select)).not.toContain("783-STUD WELDING");
    expect(apiService.updateWPQR).not.toHaveBeenCalled();
  });
});

describe("QualificationForm — processo prova da catalogo e normalizzazione", () => {
  const STUD_QUAL = {
    id: 21,
    person_name: "Mario Rossi",
    qualification_type: "Saldatore ISO 9606-1",
    company_id: 10,
    company_name: "Mason Demo",
    welding_process: "783-STUD WELDING",
    welding_process_test: "783-STUD WELDING",
    approval_status: "bozza",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    apiService.getCompanies.mockResolvedValue({ data: [{ id: 10, name: "Mason Demo" }] });
    apiService.getCompanyPersonnel.mockResolvedValue({ data: [] });
    apiService.getQualificationConfirmations.mockResolvedValue({ confirmations: [], can_confirm: false });
    apiService.updateQualification.mockResolvedValue({ id: 21 });
  });
  afterEach(() => vi.useRealTimers());

  async function open(qualification) {
    await act(async () => {
      render(<QualificationForm qualification={qualification} onSaved={vi.fn()} onClose={vi.fn()} />);
    });
    return screen.getByTestId("qf-welding-process-test");
  }

  it("mostra 783-786 e le voci storiche", async () => {
    const select = await open({ ...STUD_QUAL, welding_process: "", welding_process_test: "" });
    for (const c of [...HISTORICAL, ...STUD, "138", "145", "altro"]) expect(optionValues(select)).toContain(c);
  });

  it("«783-STUD WELDING» è mostrato come 783 senza scrivere sul DB all'apertura", async () => {
    const select = await open(STUD_QUAL);
    expect(select.value).toBe("783");
    expect(optionValues(select)).not.toContain("783-STUD WELDING");
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(apiService.updateQualification).not.toHaveBeenCalled();
  });

  it("al salvataggio invia il codice normalizzato 783", async () => {
    await open(STUD_QUAL);
    fireEvent.change(screen.getByPlaceholderText("Note aggiuntive..."), { target: { value: "n" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(apiService.updateQualification).toHaveBeenCalledTimes(1);
    expect(apiService.updateQualification.mock.calls[0][1]).toEqual(
      expect.objectContaining({ welding_process: "783", welding_process_test: "783" }),
    );
  });

  it("valore non riconoscibile resta visibile come «(non in elenco)» e non viene alterato", async () => {
    const select = await open({ ...STUD_QUAL, welding_process: "boh", welding_process_test: "boh" });
    expect(select.value).toBe("boh");
    expect(within(select).getByRole("option", { name: "boh (non in elenco)" })).toBeTruthy();
  });

  it("elenco «135, 138» non viene ridotto al primo codice al salvataggio", async () => {
    await open({ ...STUD_QUAL, welding_process: "135, 138", welding_process_test: "135" });
    fireEvent.change(screen.getByPlaceholderText("Note aggiuntive..."), { target: { value: "n" } });
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(apiService.updateQualification.mock.calls[0][1]).toEqual(
      expect.objectContaining({ welding_process: "135, 138", welding_process_test: "135" }),
    );
  });

  it("«altro» resta «altro»", async () => {
    const select = await open({ ...STUD_QUAL, welding_process: "altro", welding_process_test: "altro" });
    expect(select.value).toBe("altro");
  });
});
