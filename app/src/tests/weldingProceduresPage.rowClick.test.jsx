/**
 * Test L1 — WeldingProceduresPage: dettaglio WPQR/WPS apribile da mobile.
 *
 * Causa: la regola `@media (max-width:700px)` nascondeva dalla 6a colonna in poi
 * (compresa «Azioni», con il bottone Modifica), e le righe non erano cliccabili.
 * Fix: la colonna Azioni (ultima) resta visibile e la riga apre lo stesso modal di Modifica;
 * i controlli interni alla riga non propagano il click alla riga.
 * jsdom non valuta le media query: la regola CSS si verifica leggendo il file.
 */
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: vi.fn(),
    getWPSList: vi.fn(),
    getWPQRList: vi.fn(),
    getWPQRStats: vi.fn(),
    approveWPQR: vi.fn(),
    rejectWPQR: vi.fn(),
    deleteWPQR: vi.fn(),
    deleteWPS: vi.fn(),
    updateWPQR: vi.fn(),
    updateWPS: vi.fn(),
    getWPS: vi.fn(),
    getWpqrTestRuns: vi.fn(),
    saveWpqrTestRuns: vi.fn(),
    fetchProtectedFileBlob: vi.fn(),
    baseUrl: "",
  },
}));

vi.mock("../utils/wordExportWps", () => ({
  exportWpsAnnexADocx: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../components/AskAiButton", () => ({ default: () => null }));
vi.mock("../components/WpsUploadButton", () => ({ default: () => null }));
vi.mock("../components/WpqrUploadButton", () => ({ default: () => null }));
vi.mock("../components/ReprocessQueueBanner", () => ({ default: () => null }));

import apiService from "../services/apiService";
import { exportWpsAnnexADocx } from "../utils/wordExportWps";
import WeldingProceduresPage from "../pages/WeldingProceduresPage";

const WPS_ROW = { id: 7, wps_code: "WPS-TEST-01", status: "approvata", wpqr_count: 2 };
const WPQR_BOZZA = {
  id: 1, wpqr_code: "WPQR-BOZ", reference_number: "WPQR-BOZ",
  approval_status: "bozza", certificate_file_url: "/uploads/wpqr/c.pdf",
};
const WPQR_APPROVATA = {
  id: 2, wpqr_code: "WPQR-APP", reference_number: "WPQR-APP", approval_status: "approvata",
};

function rowOf(text) {
  return screen.getByText(text).closest("tr");
}

async function renderOnTab(tab) {
  const user = userEvent.setup();
  render(<WeldingProceduresPage />);
  await waitFor(() => expect(apiService.getWPQRStats).toHaveBeenCalled());
  if (tab === "wpqr") {
    await user.click(screen.getByRole("button", { name: /^WPQR/i }));
    await waitFor(() => expect(screen.getByText("WPQR-BOZ")).toBeTruthy());
  } else {
    await waitFor(() => expect(screen.getByText("WPS-TEST-01")).toBeTruthy());
  }
  return user;
}

describe("WeldingProceduresPage.css — colonna Azioni visibile su mobile", () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, "../pages/WeldingProceduresPage.css"),
    "utf8",
  );
  const mobileBlock = css.slice(css.indexOf("@media (max-width:700px)"));

  it("la regola mobile che nasconde le colonne esclude l'ultima (th e td)", () => {
    expect(mobileBlock).toContain(".wp-table th:nth-child(n+6):not(:last-child)");
    expect(mobileBlock).toContain(".wp-table td:nth-child(n+6):not(:last-child)");
  });

  it("nessuna regola nasconde nth-child(n+6) senza :not(:last-child)", () => {
    const hits = css.match(/nth-child\(n\+6\)(?!:not\(:last-child\))/g);
    expect(hits).toBeNull();
  });
});

describe("WeldingProceduresPage — tab WPQR: riga cliccabile e Azioni", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCompanies.mockResolvedValue({ data: [] });
    apiService.getWPSList.mockResolvedValue({ data: [WPS_ROW], pagination: { total: 1 } });
    apiService.getWPQRList.mockResolvedValue({
      data: [WPQR_BOZZA, WPQR_APPROVATA],
      pagination: { total: 2 },
    });
    apiService.getWPQRStats.mockResolvedValue({ data: { totale: 2, da_approvare: 1, rifiutate: 0, approvate: 1 } });
    apiService.approveWPQR.mockResolvedValue({});
    apiService.rejectWPQR.mockResolvedValue({});
    apiService.deleteWPQR.mockResolvedValue({});
    apiService.getWpqrTestRuns.mockResolvedValue({ runs: [], available: true });
  });

  it("«Azioni» è l'ultima colonna e ogni riga ha il bottone Modifica nell'ultima cella", async () => {
    await renderOnTab("wpqr");
    const table = screen.getByText("WPQR-BOZ").closest("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers[headers.length - 1].textContent).toBe("Azioni");
    for (const code of ["WPQR-BOZ", "WPQR-APP"]) {
      const cells = within(rowOf(code)).getAllByRole("cell");
      expect(cells).toHaveLength(headers.length);
      expect(within(cells[cells.length - 1]).getByTitle("Modifica")).toBeTruthy();
    }
  });

  it("il click sulla riga apre il modal «Modifica WPQR»", async () => {
    const user = await renderOnTab("wpqr");
    expect(screen.queryByText("Modifica WPQR")).toBeNull();
    await user.click(rowOf("WPQR-BOZ"));
    expect(screen.getAllByText("Modifica WPQR")).toHaveLength(1);
  });

  it("il modal Modifica WPQR monta la sezione passate e carica quelle della WPQR", async () => {
    const user = await renderOnTab("wpqr");
    await user.click(rowOf("WPQR-BOZ"));
    expect(screen.getByText(/Passate di prova/)).toBeTruthy();
    await waitFor(() => expect(apiService.getWpqrTestRuns).toHaveBeenCalledWith(1));
    expect(screen.getByTestId("wtr-editor")).toBeTruthy();
  });

  it("il click su Modifica apre il modal una sola volta", async () => {
    const user = await renderOnTab("wpqr");
    await user.click(within(rowOf("WPQR-BOZ")).getByTitle("Modifica"));
    expect(screen.getAllByText("Modifica WPQR")).toHaveLength(1);
  });

  it("Approva invoca approveWPQR e non apre il modal", async () => {
    const user = await renderOnTab("wpqr");
    await user.click(within(rowOf("WPQR-BOZ")).getByTitle("Approva"));
    await waitFor(() => expect(apiService.approveWPQR).toHaveBeenCalledWith(1));
    expect(screen.queryByText("Modifica WPQR")).toBeNull();
  });

  it("Rifiuta apre il modal di rifiuto, non quello di modifica", async () => {
    const user = await renderOnTab("wpqr");
    await user.click(within(rowOf("WPQR-APP")).getByTitle("Rifiuta"));
    expect(screen.getByText("Rifiuta WPQR")).toBeTruthy();
    expect(screen.queryByText("Modifica WPQR")).toBeNull();
  });

  it("Elimina e conferma invocano deleteWPQR senza aprire il modal", async () => {
    const user = await renderOnTab("wpqr");
    await user.click(within(rowOf("WPQR-BOZ")).getByTitle("Elimina"));
    expect(screen.queryByText("Modifica WPQR")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^S[iì]$/ }));
    await waitFor(() => expect(apiService.deleteWPQR).toHaveBeenCalledWith(1));
    expect(screen.queryByText("Modifica WPQR")).toBeNull();
  });

  it("il link certificato PDF non apre il modal e scarica il file con fetch autenticato (nessun href pubblico)", async () => {
    apiService.fetchProtectedFileBlob.mockResolvedValue(new Blob(["%PDF"], { type: "application/pdf" }));
    const user = await renderOnTab("wpqr");
    const link = within(rowOf("WPQR-BOZ")).getByTitle("Apri certificato PDF");
    expect(link.tagName).toBe("BUTTON");
    expect(link.getAttribute("href")).toBeNull();
    await user.click(link);
    await waitFor(() => expect(apiService.fetchProtectedFileBlob).toHaveBeenCalledWith("/uploads/wpqr/c.pdf"));
    expect(screen.queryByText("Modifica WPQR")).toBeNull();
  });
});

describe("WeldingProceduresPage — tab WPS: riga cliccabile e Azioni", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCompanies.mockResolvedValue({ data: [] });
    apiService.getWPSList.mockResolvedValue({ data: [WPS_ROW], pagination: { total: 1 } });
    apiService.getWPQRList.mockResolvedValue({ data: [WPQR_BOZZA], pagination: { total: 1 } });
    apiService.getWPQRStats.mockResolvedValue({ data: { totale: 1, da_approvare: 1, rifiutate: 0, approvate: 0 } });
    apiService.deleteWPS.mockResolvedValue({});
    apiService.getWPS.mockResolvedValue({ data: { ...WPS_ROW, wpqr_records: [{ id: 1, wpqr_code: "WPQR-BOZ" }] } });
    apiService.getWpqrTestRuns.mockResolvedValue({ runs: [{ run_label: "1", current_a: 190 }], available: true });
  });

  it("«Azioni» è l'ultima colonna e la riga ha Word/Modifica/Elimina nell'ultima cella", async () => {
    await renderOnTab("wps");
    const table = screen.getByText("WPS-TEST-01").closest("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers[headers.length - 1].textContent).toBe("Azioni");
    const cells = within(rowOf("WPS-TEST-01")).getAllByRole("cell");
    expect(cells).toHaveLength(headers.length);
    const last = within(cells[cells.length - 1]);
    expect(last.getByTitle("Esporta Word")).toBeTruthy();
    expect(last.getByTitle("Modifica")).toBeTruthy();
    expect(last.getByTitle("Elimina")).toBeTruthy();
  });

  it("il click sulla riga apre il modal «Modifica WPS»", async () => {
    const user = await renderOnTab("wps");
    expect(screen.queryByText("Modifica WPS")).toBeNull();
    await user.click(rowOf("WPS-TEST-01"));
    expect(screen.getAllByText("Modifica WPS")).toHaveLength(1);
  });

  it("il click su Modifica apre il modal una sola volta", async () => {
    const user = await renderOnTab("wps");
    await user.click(within(rowOf("WPS-TEST-01")).getByTitle("Modifica"));
    expect(screen.getAllByText("Modifica WPS")).toHaveLength(1);
  });

  it("Word esporta senza aprire il modal", async () => {
    const user = await renderOnTab("wps");
    await user.click(within(rowOf("WPS-TEST-01")).getByTitle("Esporta Word"));
    await waitFor(() => expect(exportWpsAnnexADocx).toHaveBeenCalledTimes(1));
    expect(apiService.getWPS).toHaveBeenCalledWith(7);
    expect(apiService.getWpqrTestRuns).toHaveBeenCalledWith(1);
    expect(exportWpsAnnexADocx.mock.calls[0][1].wpqrCode).toBe("WPQR-BOZ");
    expect(exportWpsAnnexADocx.mock.calls[0][1].testRuns).toEqual([{ run_label: "1", current_a: 190 }]);
    expect(screen.queryByText("Modifica WPS")).toBeNull();
  });

  it("Elimina e conferma invocano deleteWPS senza aprire il modal", async () => {
    const user = await renderOnTab("wps");
    await user.click(within(rowOf("WPS-TEST-01")).getByTitle("Elimina"));
    expect(screen.queryByText("Modifica WPS")).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Si$/ }));
    await waitFor(() => expect(apiService.deleteWPS).toHaveBeenCalledWith(7));
    expect(screen.queryByText("Modifica WPS")).toBeNull();
  });

  it("il contatore «N WPQR» passa al tab WPQR senza aprire il modal WPS", async () => {
    const user = await renderOnTab("wps");
    await user.click(screen.getByTitle("Vedi WPQR collegati"));
    await waitFor(() => expect(apiService.getWPQRList).toHaveBeenCalled());
    expect(screen.queryByText("Modifica WPS")).toBeNull();
  });
});
