/**
 * Test L1 — QualificationsPage: Modifica apre la finestra e non la
 * richiude dopo l'auto-save (onSaved ricarica la lista, non chiude).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const scopeState = {
  companyId: "10",
  setCompanyId: () => {},
  companies: [{ id: 10, name: "Mason Demo" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: false,
  isStudioPatrimonio: false,
  scopeReady: true,
  scopeCompanyName: "Mason Demo",
};

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../components/QualificationUploadButton", () => ({
  default: () => null,
}));
vi.mock("../components/ReprocessQueueBanner", () => ({
  default: () => null,
}));
vi.mock("../components/AskAiButton", () => ({
  default: () => null,
}));

vi.mock("../services/apiService", () => ({
  default: {
    getQualifications: vi.fn(),
    getQualificationsStats: vi.fn(),
    getCompanies: vi.fn(),
    getCompanyPersonnel: vi.fn(),
    getQualificationConfirmations: vi.fn(),
    updateQualification: vi.fn(),
    createQualification: vi.fn(),
    baseUrl: "https://example.test",
  },
}));

import apiService from "../services/apiService";
import QualificationsPage from "../pages/QualificationsPage";

const WELDER = {
  id: 7,
  person_name: "Mario Rossi",
  person_code: "MAT-001",
  company_id: 10,
  company_name: "Mason Demo",
  qualification_type: "Saldatore ISO 9606-1",
  certificate_number: "ISO-001",
  expiry_date: "2027-01-15",
  semaforo: "verde",
  approval_status: "bozza",
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  apiService.getQualifications.mockResolvedValue({
    qualifications: [WELDER],
    total: 1,
  });
  apiService.getQualificationsStats.mockResolvedValue({
    total: 1,
    valide: 1,
    in_scadenza_60: 0,
    in_scadenza_30: 0,
    scadute: 0,
    non_attive: 0,
  });
  apiService.getCompanies.mockResolvedValue({ data: [{ id: 10, name: "Mason Demo" }] });
  apiService.getCompanyPersonnel.mockResolvedValue({ data: [] });
  apiService.getQualificationConfirmations.mockResolvedValue({
    confirmations: [],
    can_confirm: false,
  });
  apiService.updateQualification.mockResolvedValue({ id: 7 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("QualificationsPage — finestra modifica resta aperta", () => {
  it("clic Modifica: la finestra resta visibile oltre il debounce auto-save", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await act(async () => {
      render(<QualificationsPage />);
    });

    const editBtn = await screen.findByTitle("Modifica");
    await user.click(editBtn);
    expect(screen.getByText(/Modifica qualifica/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText(/Modifica qualifica/)).toBeInTheDocument();
    expect(apiService.updateQualification).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Chiudi" })).toBeInTheDocument();
  });
});
