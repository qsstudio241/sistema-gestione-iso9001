/**
 * Form WPQR: solo la pWPS di riferimento, nessun campo WPS.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const scopeState = { companyId: "49", scopeCompanyName: "Azienda 49" };

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../services/apiService", () => ({
  default: {
    getWPSList: vi.fn(),
    getWPQRList: vi.fn(),
    getWPQRStats: vi.fn(),
    getWpqrTestRuns: vi.fn().mockResolvedValue({ runs: [], available: true }),
    getWpqrSketches: vi.fn().mockResolvedValue({ sketches: [] }),
    createWPQR: vi.fn(),
    updateWPQR: vi.fn(),
    baseUrl: "",
  },
}));

vi.mock("../components/AskAiButton", () => ({ default: () => null }));
vi.mock("../components/WpsUploadButton", () => ({ default: () => null }));
vi.mock("../components/WpqrUploadButton", () => ({ default: () => null }));
vi.mock("../components/ReprocessQueueBanner", () => ({ default: () => null }));

import apiService from "../services/apiService";
import WeldingProceduresPage, { buildWpqrSavePayload } from "../pages/WeldingProceduresPage";

const row = {
  id: 70,
  wpqr_code: "PWPS-TEST",
  reference_number: "PWPS-TEST",
  wps_ref: "002p_24 rev.0",
  wps_id: 4,
  wps_code: "WPS-VECCHIA",
  company_id: 49,
  approval_status: "bozza",
};

describe("buildWpqrSavePayload", () => {
  it("tiene la pWPS e toglie ogni wps_id", () => {
    const payload = buildWpqrSavePayload({
      wpqr_code: "PWPS-TEST",
      wps_ref: " 002p_24 rev.0 ",
      wps_id: 4,
      wps_code: "WPS-VECCHIA",
      company_id: 49,
    }, "");
    expect(payload.wps_ref).toBe("002p_24 rev.0");
    expect(payload.company_id).toBe(49);
    expect(payload.wps_id).toBeUndefined();
    expect(payload.wps_code).toBeUndefined();
  });

  it("non manda studio né stringa vuota come azienda", () => {
    expect(buildWpqrSavePayload({ wpqr_code: "X", company_id: "studio" }, "studio").company_id).toBeNull();
    expect(buildWpqrSavePayload({ wpqr_code: "X" }, "").company_id).toBeNull();
  });
});

describe("WeldingProceduresPage — form WPQR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeState.companyId = "49";
    apiService.getWPSList.mockResolvedValue({
      data: [{ id: 4, wps_code: "WPS-VECCHIA", revision: "0" }],
      pagination: { total: 1 },
    });
    apiService.getWPQRList.mockResolvedValue({ data: [row], pagination: { total: 1 } });
    apiService.getWPQRStats.mockResolvedValue({
      data: { totale: 1, da_approvare: 1, rifiutate: 0, approvate: 0 },
    });
    apiService.getWpqrTestRuns.mockResolvedValue({ runs: [], available: true });
    apiService.createWPQR.mockResolvedValue({ data: { id: 80 } });
    apiService.updateWPQR.mockResolvedValue({ success: true });
  });

  async function openWpqrTab() {
    render(<WeldingProceduresPage />);
    fireEvent.click(await screen.findByRole("button", { name: "WPQR (1)" }));
  }

  it("nuova WPQR: solo pWPS, nessun campo WPS", async () => {
    await openWpqrTab();
    fireEvent.click(screen.getByRole("button", { name: "+ Nuovo WPQR" }));
    expect(await screen.findByText("pWPS di riferimento")).toBeTruthy();
    expect(screen.queryByText("WPS di riferimento *")).toBeNull();
    expect(screen.queryByText("WPS collegata")).toBeNull();
    expect(screen.queryByText("WPS di riferimento (testo)")).toBeNull();
    expect(screen.queryByText("-- Seleziona WPS --")).toBeNull();
  });

  it("modifica: mostra la pWPS salvata e non la WPS collegata", async () => {
    await openWpqrTab();
    fireEvent.click(await screen.findByText("PWPS-TEST"));
    const input = await screen.findByDisplayValue("002p_24 rev.0");
    expect(input).toBeTruthy();
    expect(screen.queryByText("-- Seleziona WPS --")).toBeNull();
    expect(screen.queryByText("WPS di riferimento *")).toBeNull();
  });
});
