/**
 * Se le passate non arrivano, l'anteprima non deve dichiarare «nessun avviso».
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const scopeState = { companyId: "1005", scopeCompanyName: "Studio 1005" };

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../services/apiService", () => ({
  default: {
    getWPSList: vi.fn(),
    getWPQRList: vi.fn(),
    getWPQRStats: vi.fn(),
    getWpqrTestRuns: vi.fn(),
    previewWpqrNotices: vi.fn(),
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

const FILLER = "Il materiale d'apporto della copertina (ISO 14343-A) non coincide con quello delle pagine interne (ISO 14341-A). Controlla sul PDF.";

const row = {
  id: 70,
  wpqr_code: "ZZ_AVVISO_20261023",
  reference_number: "ZZ_AVVISO_20261023",
  company_id: 1005,
  approval_status: "approvata",
  filler_material: "ISO 14343-A",
  discrepancy_notices: [{
    code: "WPQR.FILLER_COVER_INNER",
    field: "filler_material",
    fingerprint: "filler",
    status: "aperto",
    blocks_conformity: true,
    message_it: FILLER,
  }],
  open_notice_count: 1,
  effective_approval_status: "da_rivedere",
};

describe("anteprima WPQR se le passate non arrivano", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getWPSList.mockResolvedValue({ data: [], pagination: { total: 0 } });
    apiService.getWPQRList.mockResolvedValue({ data: [row], pagination: { total: 1 } });
    apiService.getWPQRStats.mockResolvedValue({
      data: { totale: 1, da_approvare: 0, da_rivedere: 1, rifiutate: 0, approvate: 0 },
    });
    apiService.getWpqrTestRuns.mockRejectedValue(new Error("rete"));
    apiService.previewWpqrNotices.mockResolvedValue({ data: { discrepancy_notices: [] } });
  });

  it("non sostituisce l'avviso sul materiale d'apporto con un elenco vuoto", async () => {
    render(<WeldingProceduresPage />);
    fireEvent.click(await screen.findByRole("button", { name: /WPQR/ }));
    fireEvent.click(await screen.findByText("ZZ_AVVISO_20261023"));
    expect(await screen.findByText(/pagine interne/)).toBeTruthy();
    await waitFor(() => {
      expect(apiService.getWpqrTestRuns).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(screen.getByText(/pagine interne/)).toBeTruthy();
    expect(screen.getByText(/controllo del materiale d'apporto non è stato fatto/i)).toBeTruthy();
    expect(apiService.previewWpqrNotices).not.toHaveBeenCalled();
  });
});
