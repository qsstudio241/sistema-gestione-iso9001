/**
 * Contatori tab WPS/WPQR veri anche col tab non attivo.
 * company_id di lista solo se l'Ambito è un id numerico.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const scopeState = { companyId: "", scopeCompanyName: "Tutto lo studio" };

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../services/apiService", () => ({
  default: {
    getWPSList: vi.fn(),
    getWPQRList: vi.fn(),
    getWPQRStats: vi.fn(),
    getWpqrTestRuns: vi.fn(),
    getWpqrSketches: vi.fn().mockResolvedValue({ sketches: [] }),
    baseUrl: "",
  },
}));

vi.mock("../components/AskAiButton", () => ({ default: () => null }));
vi.mock("../components/WpsUploadButton", () => ({ default: () => null }));
vi.mock("../components/WpqrUploadButton", () => ({ default: () => null }));
vi.mock("../components/ReprocessQueueBanner", () => ({ default: () => null }));

import apiService from "../services/apiService";
import WeldingProceduresPage from "../pages/WeldingProceduresPage";

function listsWithoutCompanyId() {
  const calls = [
    ...apiService.getWPSList.mock.calls,
    ...apiService.getWPQRList.mock.calls,
    ...apiService.getWPQRStats.mock.calls,
  ];
  return calls.every(([params]) => !params || params.company_id == null);
}

describe("WeldingProceduresPage — contatori e Ambito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeState.companyId = "";
    scopeState.scopeCompanyName = "Tutto lo studio";
    apiService.getWPSList.mockResolvedValue({ data: [], pagination: { total: 0 } });
    apiService.getWPQRList.mockResolvedValue({ data: [], pagination: { total: 11 } });
    apiService.getWPQRStats.mockResolvedValue({
      data: { totale: 11, da_approvare: 1, rifiutate: 0, approvate: 10 },
    });
  });

  it("sul tab WPS mostra già WPQR (11), senza aprire il tab", async () => {
    render(<WeldingProceduresPage />);
    expect(await screen.findByRole("button", { name: "WPS (0)" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "WPQR (11)" })).toBeTruthy();
    expect(apiService.getWPQRList).toHaveBeenCalled();
    expect(screen.queryByText("Da approvare")).toBeNull();
  });

  it("Tutto lo studio non manda company_id", async () => {
    render(<WeldingProceduresPage />);
    await screen.findByRole("button", { name: "WPQR (11)" });
    expect(apiService.getWPQRList).toHaveBeenCalled();
    expect(listsWithoutCompanyId()).toBe(true);
  });

  it("Patrimonio non manda company_id", async () => {
    scopeState.companyId = "studio";
    scopeState.scopeCompanyName = "Patrimonio dello studio";
    render(<WeldingProceduresPage />);
    await screen.findByRole("button", { name: "WPQR (11)" });
    expect(apiService.getWPSList).toHaveBeenCalled();
    expect(apiService.getWPQRList).toHaveBeenCalled();
    expect(listsWithoutCompanyId()).toBe(true);
  });

  it("Ambito numerico passa company_id alle liste", async () => {
    scopeState.companyId = "91";
    scopeState.scopeCompanyName = "DEFINITIVE INNOVATION SRL";
    render(<WeldingProceduresPage />);
    await screen.findByRole("button", { name: "WPQR (11)" });
    expect(apiService.getWPSList).toHaveBeenCalledWith(expect.objectContaining({ company_id: "91" }));
    expect(apiService.getWPQRList).toHaveBeenCalledWith(expect.objectContaining({ company_id: "91" }));
    expect(apiService.getWPQRStats).toHaveBeenCalledWith(expect.objectContaining({ company_id: "91" }));
  });
});
