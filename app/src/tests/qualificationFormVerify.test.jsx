/**
 * Test L1 — QualificationForm: verifica qualifica vs norma (VQ-9).
 * La verifica parte solo al blur (dopo una modifica) o a pulsante, mai a ogni tasto, e non
 * blocca ne' sostituisce il salvataggio / l'auto-save del form.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: vi.fn(),
    getCompanyPersonnel: vi.fn(),
    getQualificationConfirmations: vi.fn(),
    updateQualification: vi.fn(),
    createQualification: vi.fn(),
    renewQualification: vi.fn(),
    verifyQualification: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import QualificationForm from "../pages/QualificationForm";

const WARN_MSG = "Spessore massimo 40 mm oltre il campo qualificato (\u00a75.7 Tab. 6).";
const VERIFICATION = {
  profile: "9606-1:BW",
  standard: { family: "9606-1", edition: "2017" },
  findings: [{
    code: "WQ9606_1.CORR.THK_BW",
    family: "correttezza",
    severity: "warn",
    status: "verificabile",
    field: "thickness_max_mm",
    direction: "over_claim",
    read_value: 40,
    expected_value: { min: 3, max: 24 },
    source: { norm: "ISO 9606-1", edition: "2017", clause: "\u00a75.7 Tab. 6", text_status: "md_integrale" },
    message_it: WARN_MSG,
  }],
  summary: { warn: 1, info: 0, verificabili: 1, non_verificabili: 0 },
  engine_version: "1",
  mode: "review",
};

const WELDER = {
  id: 7,
  person_name: "Mario Rossi",
  qualification_type: "Saldatore ISO 9606-1",
  company_id: 10,
  company_name: "Mason Demo",
  certificate_number: "ISO-001",
  joint_type: "BW",
  thickness_max_mm: 40,
  expiry_date: "2027-01-15",
  notes: "",
  approval_status: "bozza",
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  apiService.getCompanies.mockResolvedValue({ data: [{ id: 10, name: "Mason Demo" }] });
  apiService.getCompanyPersonnel.mockResolvedValue({ data: [] });
  apiService.getQualificationConfirmations.mockResolvedValue({ confirmations: [], can_confirm: false });
  apiService.updateQualification.mockResolvedValue({ id: 7 });
  apiService.createQualification.mockResolvedValue({ id: 99 });
  apiService.verifyQualification.mockResolvedValue({ verification: VERIFICATION });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function openForm(qualification = WELDER, props = {}) {
  await act(async () => {
    render(<QualificationForm qualification={qualification} onSaved={vi.fn()} onClose={vi.fn()} {...props} />);
  });
}

async function advance(ms) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe("QualificationForm — verifica vs norma (VQ-9)", () => {
  it("aprire il form non chiama la verifica; il pulsante Verifica e' sempre visibile", async () => {
    await openForm();
    await advance(2000);
    expect(apiService.verifyQualification).not.toHaveBeenCalled();
    expect(screen.getByTestId("qf-verify-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("vfy-panel")).toBeNull();
  });

  it("pulsante Verifica: chiama l'endpoint con i campi rilevanti e mostra il pannello, senza salvare", async () => {
    await openForm();
    await act(async () => { fireEvent.click(screen.getByTestId("qf-verify-btn")); });
    await advance(0);

    expect(apiService.verifyQualification).toHaveBeenCalledTimes(1);
    const [fields, opts] = apiService.verifyQualification.mock.calls[0];
    expect(fields).toEqual(expect.objectContaining({
      qualification_type: "Saldatore ISO 9606-1",
      joint_type: "BW",
      thickness_max_mm: 40,
    }));
    expect(fields.person_name).toBeUndefined();
    expect(opts).toEqual({ qualificationType: "Saldatore ISO 9606-1" });
    expect(screen.getByTestId("vfy-panel")).toBeInTheDocument();
    expect(screen.getAllByText(WARN_MSG).length).toBeGreaterThan(0);

    await advance(2000);
    expect(apiService.updateQualification).not.toHaveBeenCalled();
    expect(apiService.createQualification).not.toHaveBeenCalled();
  });

  it("digitare non chiama la verifica; il blur dopo la modifica la chiama una volta (debounce)", async () => {
    await openForm();
    const gas = screen.getByPlaceholderText(/M21, I1/);

    fireEvent.change(gas, { target: { value: "M" } });
    fireEvent.change(gas, { target: { value: "M2" } });
    fireEvent.change(gas, { target: { value: "M21" } });
    await advance(700);
    expect(apiService.verifyQualification).not.toHaveBeenCalled();

    fireEvent.blur(gas);
    await advance(100);
    expect(apiService.verifyQualification).not.toHaveBeenCalled();
    await advance(700);
    expect(apiService.verifyQualification).toHaveBeenCalledTimes(1);
    expect(apiService.verifyQualification.mock.calls[0][0].shielding_gas).toBe("M21");

    fireEvent.blur(gas);
    await advance(1500);
    expect(apiService.verifyQualification).toHaveBeenCalledTimes(1);
  });

  it("blur su un campo non rilevante (note) non rilancia la verifica", async () => {
    await openForm();
    await act(async () => { fireEvent.click(screen.getByTestId("qf-verify-btn")); });
    await advance(0);
    const notes = screen.getByPlaceholderText("Note aggiuntive...");
    fireEvent.change(notes, { target: { value: "x" } });
    fireEvent.blur(notes);
    await advance(1500);
    expect(apiService.verifyQualification).toHaveBeenCalledTimes(1);
  });

  it("verifica in errore: il pannello mostra l'errore e l'auto-save funziona comunque", async () => {
    apiService.verifyQualification.mockRejectedValue(new Error("Verifica non disponibile. Riprovare."));
    const onSaved = vi.fn();
    await openForm(WELDER, { onSaved });

    await act(async () => { fireEvent.click(screen.getByTestId("qf-verify-btn")); });
    await advance(0);
    expect(screen.getByTestId("vfy-error")).toHaveTextContent("Verifica non disponibile");

    fireEvent.change(screen.getByPlaceholderText("Note aggiuntive..."), { target: { value: "Nota" } });
    await advance(1600);
    expect(apiService.updateQualification).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("offline: nessuna chiamata, messaggio del pannello, il form resta usabile", async () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    try {
      await openForm();
      await act(async () => { fireEvent.click(screen.getByTestId("qf-verify-btn")); });
      await advance(0);
      expect(apiService.verifyQualification).not.toHaveBeenCalled();
      expect(screen.getByTestId("vfy-offline")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Chiudi/ })).not.toBeDisabled();
    } finally {
      Object.defineProperty(window.navigator, "onLine", { value: true, configurable: true });
    }
  });

  it("l'esito della verifica non cambia il record: nessun campo riscritto con il valore atteso", async () => {
    await openForm();
    await act(async () => { fireEvent.click(screen.getByTestId("qf-verify-btn")); });
    await advance(0);
    expect(screen.getByDisplayValue("40")).toBeInTheDocument();
  });

  it("tipi non verificabili (es. corso antincendio): nessuna sezione di verifica", async () => {
    await openForm({ ...WELDER, qualification_type: "Corso antincendio", joint_type: "" });
    expect(screen.queryByTestId("qf-verify-section")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("Note aggiuntive..."), { target: { value: "x" } });
    fireEvent.blur(screen.getByPlaceholderText("Note aggiuntive..."));
    await advance(2000);
    expect(apiService.verifyQualification).not.toHaveBeenCalled();
  });

  it("senza verifyQualification disponibile (mock vecchi/API assente) il form non si rompe", async () => {
    delete apiService.verifyQualification;
    try {
      await openForm();
      await act(async () => { fireEvent.click(screen.getByTestId("qf-verify-btn")); });
      await advance(0);
      expect(screen.getByTestId("vfy-error")).toBeInTheDocument();
      expect(screen.getByText(/Modifica qualifica/)).toBeInTheDocument();
    } finally {
      apiService.verifyQualification = vi.fn();
    }
  });
});
