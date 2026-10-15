/**
 * Test L1 — QualificationsPage: le card statistiche usano lo stesso scope della lista
 * (Ambito azienda + tab attivo); search e situazione restringono solo la lista.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const scopeState = {
  companyId: "10",
  setCompanyId: () => {},
  companies: [{ id: 10, name: "Azienda Demo" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: false,
  isStudioPatrimonio: false,
  scopeReady: true,
  scopeCompanyName: "Azienda Demo",
};

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));
vi.mock("../components/QualificationUploadButton", () => ({ default: () => null }));
vi.mock("../components/ReprocessQueueBanner", () => ({ default: () => null }));
vi.mock("../components/AskAiButton", () => ({ default: () => null }));

vi.mock("../services/apiService", () => ({
  default: {
    getQualifications: vi.fn(),
    getQualificationsStats: vi.fn(),
    getCompanies: vi.fn(),
    getCompanyPersonnel: vi.fn(),
    getQualificationConfirmations: vi.fn(),
    baseUrl: "https://example.test",
  },
}));

import apiService from "../services/apiService";
import QualificationsPage from "../pages/QualificationsPage";

beforeEach(() => {
  vi.clearAllMocks();
  apiService.getQualifications.mockResolvedValue({ qualifications: [], total: 0 });
  apiService.getQualificationsStats.mockResolvedValue({
    total: 0, valide: 0, in_scadenza_60: 0, in_scadenza_30: 0, scadute: 0, non_attive: 0,
  });
  apiService.getCompanies.mockResolvedValue({ data: [{ id: 10, name: "Azienda Demo" }] });
  apiService.getCompanyPersonnel.mockResolvedValue({ data: [] });
});

describe("QualificationsPage — card con lo stesso scope della lista", () => {
  it("tab Tutti: le card ricevono solo l'Ambito azienda", async () => {
    await act(async () => { render(<QualificationsPage />); });
    const last = apiService.getQualificationsStats.mock.calls.at(-1)[0];
    expect(last).toEqual({ company_id: "10" });
  });

  it("cambio tab: lista e card ricevono lo stesso qualification_type", async () => {
    const user = userEvent.setup();
    await act(async () => { render(<QualificationsPage />); });
    await user.click(screen.getByRole("button", { name: "Saldatori 9606-1" }));

    const statsArgs = apiService.getQualificationsStats.mock.calls.at(-1)[0];
    const listArgs = apiService.getQualifications.mock.calls.at(-1)[0];
    expect(statsArgs).toEqual({ company_id: "10", qualification_type: "iso9606_1" });
    expect(listArgs.qualification_type).toBe("iso9606_1");
    expect(listArgs.company_id).toBe("10");
  });

  it("clic su una card: la lista riceve la situazione, le card no (restano sul totale del tab)", async () => {
    const user = userEvent.setup();
    await act(async () => { render(<QualificationsPage />); });
    await user.click(screen.getByRole("button", { name: /Scadute/ }));

    expect(apiService.getQualifications.mock.calls.at(-1)[0].situazione).toBe("scadute");
    expect(apiService.getQualificationsStats.mock.calls.at(-1)[0]).not.toHaveProperty("situazione");
  });
});
