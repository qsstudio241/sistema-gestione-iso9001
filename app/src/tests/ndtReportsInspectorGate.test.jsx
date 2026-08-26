/**
 * @vitest-environment jsdom
 * CND-2: gate ispettore ISO 9712 + idoneità visiva sul verbale.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const scopeState = {
  companyId: "48",
  setCompanyId: () => {},
  companies: [{ id: 48, name: "Cliente VT SRL" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: false,
  scopeCompanyName: "Cliente VT SRL",
};

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../utils/vtWordExport.js", () => ({
  exportVtToWord: vi.fn(),
}));

vi.mock("../hooks/useNdtAutoSave.js", () => ({
  useNdtAutoSave: () => ({ clearDraft: vi.fn(), loadDraft: () => null, draftKey: "sgq:ndt_draft:new" }),
  enqueueNdtReportSync: vi.fn(),
  isNdtNetworkSaveError: () => false,
  ndtDraftKey: (id) => "sgq:ndt_draft:" + (id || "new"),
  getOrCreateOfflineCreateUuid: () => "test-uuid",
  clearOfflineCreateUuid: vi.fn(),
}));

vi.mock("../components/NdtItemAttachments.jsx", () => ({
  default: () => null,
}));

vi.mock("../components/NcCreateModal.jsx", () => ({
  default: () => null,
}));

const eligibilityMock = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getStoredUser: () => ({ full_name: "PS_Admin", email: "admin@sgq.local" }),
    getNdtReportList: vi.fn().mockResolvedValue({ data: [] }),
    getNdtReportStats: vi.fn().mockResolvedValue({
      data: { total: 0, draft: 0, approved: 0, vt_count: 0, mt_count: 0, pt_count: 0, ut_count: 0 },
    }),
    getEquipmentForReport: vi.fn().mockResolvedValue({ data: [] }),
    getSuppliers: vi.fn().mockResolvedValue({ data: [] }),
    getProjects: vi.fn().mockResolvedValue({ data: [] }),
    getWPSList: vi.fn().mockResolvedValue({ data: [] }),
    getNdtReport: vi.fn(),
    createNdtReport: vi.fn(),
    updateNdtReport: vi.fn(),
    deleteNdtReport: vi.fn(),
    getNdtInspectorEligibility: (...args) => eligibilityMock(...args),
  },
}));

import NdtReportsPage from "../pages/NdtReportsPage.jsx";

async function openNewReport(user) {
  render(<NdtReportsPage />);
  const nuovo = await screen.findByRole("button", { name: "+ Nuovo verbale" });
  await user.click(nuovo);
  await screen.findByRole("heading", { name: "Nuovo verbale CND" });
}

describe("NdtReportsPage — gate ispettore CND-2", () => {
  beforeEach(() => {
    localStorage.clear();
    eligibilityMock.mockReset();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1200 });
  });

  it("Completa e giudizio restano visibili ma disabilitati se manca il 9712", async () => {
    eligibilityMock.mockResolvedValue({
      data: {
        ok: false,
        reasons: ["Nessun patentino ISO 9712 in anagrafica per PS_Admin."],
        candidates: [{ person_name: "Mario Rossi", ndt_method: "VT", ndt_level: 2 }],
        qualification: null,
        vision: { state: "missing" },
      },
    });
    const user = userEvent.setup();
    await openNewReport(user);

    const alert = await screen.findByRole("alert", {}, { timeout: 2000 });
    expect(alert.textContent).toMatch(/9712/);

    const completa = screen.getByRole("button", { name: "Completa verbale" });
    expect(completa).toBeVisible();
    expect(completa).toBeDisabled();
    expect(completa).toHaveAttribute("title", expect.stringContaining("9712"));

    const inspector = screen.getByPlaceholderText(/Nome ispettore/);
    expect(inspector).toBeVisible();
    expect(screen.getAllByText(/Nessun patentino ISO 9712/).length).toBeGreaterThanOrEqual(1);

    const evalA = screen.getAllByRole("button", { name: /A — Accettabile/ })[0];
    expect(evalA).toBeVisible();
    expect(evalA).toBeDisabled();
    expect(evalA).toHaveAttribute("title", expect.stringContaining("9712"));
  });

  it("Completa è abilitato se patentino e visione sono ok", async () => {
    eligibilityMock.mockResolvedValue({
      data: {
        ok: true,
        reasons: [],
        candidates: [],
        qualification: { ndt_method: "VT", ndt_level: 2, person_name: "PS_Admin" },
        vision: { state: "ok" },
      },
    });
    const user = userEvent.setup();
    await openNewReport(user);

    await waitFor(() => {
      expect(screen.getByText(/Patentino ISO 9712 VT liv\.2 valido/)).toBeTruthy();
    }, { timeout: 2000 });

    const completa = screen.getByRole("button", { name: "Completa verbale" });
    expect(completa).not.toBeDisabled();
    const evalA = screen.getAllByRole("button", { name: /A — Accettabile/ })[0];
    expect(evalA).not.toBeDisabled();
  });

  it("errore rete: Completa disabilitato, A/R/S usabili; retry all'evento online", async () => {
    eligibilityMock
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        data: {
          ok: true,
          reasons: [],
          candidates: [],
          qualification: { ndt_method: "VT", ndt_level: 2, person_name: "PS_Admin" },
          vision: { state: "ok" },
        },
      });
    const user = userEvent.setup();
    await openNewReport(user);

    await waitFor(() => {
      expect(screen.getByText(/Impossibile verificare il patentino/)).toBeTruthy();
    }, { timeout: 2000 });

    expect(screen.getByRole("button", { name: "Completa verbale" })).toBeDisabled();
    const evalA = screen.getAllByRole("button", { name: /A — Accettabile/ })[0];
    expect(evalA).toBeVisible();
    expect(evalA).not.toBeDisabled();

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(screen.getByText(/Patentino ISO 9712 VT liv\.2 valido/)).toBeTruthy();
    }, { timeout: 2000 });
    expect(screen.getByRole("button", { name: "Completa verbale" })).not.toBeDisabled();
    expect(eligibilityMock).toHaveBeenCalledTimes(2);
  });
});
