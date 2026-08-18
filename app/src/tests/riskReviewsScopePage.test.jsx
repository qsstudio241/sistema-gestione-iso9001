/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { defaultReviewFromDay, defaultReviewToDay } from "../utils/riskReviewsScopeParams";

const scopeState = {
  companyId: "48",
  setCompanyId: () => {},
  companies: [{ id: 48, name: "Smoke Ingest Test SRL", risk_pg_max: 3 }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: true,
  isStudioWide: false,
  scopeCompanyName: "Smoke Ingest Test SRL",
};

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../services/apiService", () => ({
  default: {
    getRisks: vi.fn().mockResolvedValue({ data: [] }),
    getRisksStats: vi.fn().mockResolvedValue({
      data: { total: 0, open: 0, in_treatment: 0, high_priority: 0 },
    }),
    getContextFactors: vi.fn().mockResolvedValue({ data: [] }),
    getInterestedParties: vi.fn().mockResolvedValue({ data: [] }),
    getRiskReviews: vi.fn().mockResolvedValue({ data: [] }),
    getRiskReviewsScope: vi.fn().mockResolvedValue({ data: [] }),
    getRisk: vi.fn(),
    downloadRisksM03Template: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import RisksPage from "../pages/RisksPage.jsx";

describe("RisksPage — ROO-17 riesami ambito", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getRisks.mockResolvedValue({ data: [] });
    apiService.getRisksStats.mockResolvedValue({
      data: { total: 0, open: 0, in_treatment: 0, high_priority: 0 },
    });
    apiService.getRiskReviewsScope.mockResolvedValue({
      data: [{
        id: 4,
        risk_id: 1004,
        title: "Fornitore unico",
        probability: 2,
        impact: 2,
        recorded_at: "2026-03-02T10:00:00.000Z",
      }],
    });
  });

  it("toggle Storico riesami chiama GET /risks/reviews con azienda e date", async () => {
    render(<RisksPage />);
    await screen.findByRole("button", { name: "Storico riesami" });
    fireEvent.click(screen.getByRole("button", { name: "Storico riesami" }));
    await waitFor(() => {
      expect(apiService.getRiskReviewsScope).toHaveBeenCalledWith({
        company_id: "48",
        from: defaultReviewFromDay(),
        to: defaultReviewToDay(),
      });
    });
    expect(screen.getByLabelText("Riesami dal")).toBeInTheDocument();
    expect(screen.getByLabelText("Riesami al")).toBeInTheDocument();
    expect(screen.queryByText("Mostra rischi chiusi")).not.toBeInTheDocument();
    expect(screen.queryByText("Tutti gli stati")).not.toBeInTheDocument();
  });

  it("click banner Aperti chiama GET /risks con status=open e non usa la tendina", async () => {
    render(<RisksPage />);
    const aperti = await screen.findByRole("button", { name: /Aperti/i });
    fireEvent.click(aperti);
    await waitFor(() => {
      expect(apiService.getRisks).toHaveBeenCalledWith({
        company_id: "48",
        status: "open",
      });
    });
    expect(screen.queryByText("Tutti gli stati")).not.toBeInTheDocument();
  });
});
