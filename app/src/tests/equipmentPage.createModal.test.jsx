/**
 * @vitest-environment jsdom
 * Click su "+ Nuovo strumento" non deve crashare (companies dal CompanyScope).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const scopeState = {
  companyId: "48",
  setCompanyId: () => {},
  companies: [{ id: 48, name: "Smoke Ingest Test SRL" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: false,
  scopeCompanyName: "Smoke Ingest Test SRL",
};

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../services/apiService", () => ({
  default: {
    getEquipmentList: vi.fn().mockResolvedValue({ data: [] }),
    getEquipmentStats: vi.fn().mockResolvedValue({
      data: { total: 0, active: 0, expiring_30d: 0, expired: 0, calibrating: 0 },
    }),
    createEquipment: vi.fn(),
    updateEquipment: vi.fn(),
    deleteEquipment: vi.fn(),
  },
}));

import EquipmentPage from "../pages/EquipmentPage.jsx";

describe("EquipmentPage — Nuovo strumento", () => {
  beforeEach(() => {
    scopeState.companies = [{ id: 48, name: "Smoke Ingest Test SRL" }];
  });

  it("apre il form senza errore e elenca le aziende dell'Ambito", async () => {
    const user = userEvent.setup();
    render(<EquipmentPage />);

    const nuovo = await screen.findByRole("button", { name: "+ Nuovo strumento" });
    await user.click(nuovo);

    expect(screen.getByRole("heading", { name: "Nuovo strumento" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Studio (condiviso con tutte le aziende)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Smoke Ingest Test SRL" })).toBeInTheDocument();
  });
});
