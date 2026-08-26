/**
 * @vitest-environment jsdom
 * CND-9: Salva bozza offline → enqueue + banner coda (senza toccare flag/gate).
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

const enqueueNdtReportSync = vi.fn();
const clearDraft = vi.fn();

vi.mock("../hooks/useNdtAutoSave.js", () => ({
  useNdtAutoSave: () => ({
    clearDraft,
    loadDraft: () => null,
    draftKey: "sgq:ndt_draft:new",
  }),
  enqueueNdtReportSync: (...args) => enqueueNdtReportSync(...args),
  isNdtNetworkSaveError: (err) =>
    err?.code === "OFFLINE" ||
    err?.code === "NETWORK_ERROR" ||
    err?.status === 0 ||
    (typeof navigator !== "undefined" && navigator.onLine === false),
  ndtDraftKey: (id) => "sgq:ndt_draft:" + (id || "new"),
  clearNdtDraftByKey: vi.fn(),
}));

vi.mock("../components/NdtItemAttachments.jsx", () => ({
  default: () => null,
}));

vi.mock("../components/NcCreateModal.jsx", () => ({
  default: () => null,
}));

const eligibilityMock = vi.fn();
const createNdtReport = vi.fn();

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
    createNdtReport: (...args) => createNdtReport(...args),
    updateNdtReport: vi.fn(),
    deleteNdtReport: vi.fn(),
    getNdtInspectorEligibility: (...args) => eligibilityMock(...args),
  },
}));

import NdtReportsPage from "../pages/NdtReportsPage.jsx";

describe("CND-9 save offline → coda sync", () => {
  beforeEach(() => {
    localStorage.clear();
    eligibilityMock.mockReset();
    createNdtReport.mockReset();
    enqueueNdtReportSync.mockReset();
    clearDraft.mockReset();
    eligibilityMock.mockResolvedValue({
      data: {
        ok: true,
        reasons: [],
        candidates: [],
        qualification: { ndt_method: "VT", ndt_level: 2, person_name: "PS_Admin" },
        vision: { state: "ok" },
      },
    });
    createNdtReport.mockRejectedValue({
      code: "OFFLINE",
      status: 0,
      message: "Connessione assente",
    });
    enqueueNdtReportSync.mockResolvedValue("q-ndt-1");
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1200 });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });
  });

  it("Salva bozza offline accoda create_ndt_report e mostra banner", async () => {
    const user = userEvent.setup();
    render(<NdtReportsPage />);
    await user.click(await screen.findByRole("button", { name: "+ Nuovo verbale" }));
    await screen.findByRole("heading", { name: "Nuovo verbale CND" });

    await user.click(screen.getByRole("button", { name: "Salva bozza" }));

    await waitFor(() => {
      expect(createNdtReport).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(enqueueNdtReportSync).toHaveBeenCalled();
    });

    const [type, payload] = enqueueNdtReportSync.mock.calls[0];
    expect(type).toBe("create_ndt_report");
    expect(payload.draftKey).toBe("sgq:ndt_draft:new");
    expect(payload.uuid).toBeTruthy();
    expect(payload.status).toBe("draft");
    expect(clearDraft).not.toHaveBeenCalled();

    expect(
      await screen.findByText(/Senza rete: verbale in coda/i)
    ).toBeInTheDocument();
  });

  it("dopo sgq:ndtReportSynced toglie il banner e chiama clearDraft", async () => {
    const user = userEvent.setup();
    render(<NdtReportsPage />);
    await user.click(await screen.findByRole("button", { name: "+ Nuovo verbale" }));
    await user.click(screen.getByRole("button", { name: "Salva bozza" }));
    await waitFor(() => expect(enqueueNdtReportSync).toHaveBeenCalled());

    expect(screen.getByText(/Senza rete: verbale in coda/i)).toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("sgq:ndtReportSynced", {
          detail: { type: "create_ndt_report", draftKey: "sgq:ndt_draft:new" },
        })
      );
    });

    await waitFor(() => {
      expect(clearDraft).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText(/Senza rete: verbale in coda/i)).not.toBeInTheDocument();
    });
  });
});
