/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

const scopeState = {
  companyId: "",
  setCompanyId: () => {},
  companies: [{ id: 48, name: "Smoke Ingest Test SRL" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: true,
  scopeCompanyName: "Tutto lo studio",
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
    downloadRisksM03Template: vi.fn(),
  },
}));

import RisksPage from "../pages/RisksPage.jsx";

describe("RisksPage — create/import richiedono Ambito azienda", () => {
  beforeEach(() => {
    scopeState.companyId = "";
    scopeState.isStudioWide = true;
    scopeState.scopeCompanyName = "Tutto lo studio";
  });

  it("con Tutto lo studio disabilita Nuovo e Importa Excel", async () => {
    render(<RisksPage />);
    const nuovo = await screen.findByRole("button", { name: "+ Nuovo rischio" });
    const importa = screen.getByRole("button", { name: "Importa Excel" });
    expect(nuovo).toBeDisabled();
    expect(importa).toBeDisabled();
    expect(nuovo).toHaveAttribute("title", "Seleziona un'azienda nell'Ambito in alto");
    await waitFor(() => {
      expect(screen.getByText(/Seleziona un'azienda nell'Ambito in alto per creare/)).toBeInTheDocument();
    });
  });

  it("con azienda in Ambito abilita Nuovo e Importa Excel", async () => {
    scopeState.companyId = "48";
    scopeState.isStudioWide = false;
    scopeState.scopeCompanyName = "Smoke Ingest Test SRL";
    render(<RisksPage />);
    const nuovo = await screen.findByRole("button", { name: "+ Nuovo rischio" });
    const importa = screen.getByRole("button", { name: "Importa Excel" });
    expect(nuovo).not.toBeDisabled();
    expect(importa).not.toBeDisabled();
  });
});
