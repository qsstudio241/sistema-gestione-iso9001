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

vi.mock("../hooks/useNdtAutoSave.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
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
    getOrCreateOfflineCreateUuid: () => "fixed-offline-uuid",
    clearOfflineCreateUuid: vi.fn(),
  };
});

vi.mock("../components/NdtItemAttachments.jsx", () => ({
  default: () => null,
}));

vi.mock("../components/NcCreateModal.jsx", () => ({
  default: () => null,
}));

const eligibilityMock = vi.fn();
const createNdtReport = vi.fn();
const updateNdtReport = vi.fn();

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
    updateNdtReport: (...args) => updateNdtReport(...args),
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
    updateNdtReport.mockReset();
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
    const offlineErr = { code: "OFFLINE", status: 0, message: "Connessione assente" };
    createNdtReport.mockRejectedValue(offlineErr);
    updateNdtReport.mockRejectedValue(offlineErr);
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
    // CND-8: offline → già enqueue alla creazione bozza
    await screen.findByRole("heading", { name: /Bozza in coda|Bozza locale|Nuovo verbale/i });
    await waitFor(() => expect(enqueueNdtReportSync).toHaveBeenCalled());
    enqueueNdtReportSync.mockClear();
    createNdtReport.mockClear();

    await user.click(screen.getByRole("button", { name: "Salva bozza" }));

    await waitFor(() => {
      expect(createNdtReport).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(enqueueNdtReportSync).toHaveBeenCalled();
    });

    const [type, payload] = enqueueNdtReportSync.mock.calls[0];
    expect(type).toBe("create_ndt_report");
    expect(payload.draftKey).toBeTruthy();
    expect(payload.uuid).toBeTruthy();
    expect(payload.status).toBe("draft");
    expect(clearDraft).not.toHaveBeenCalled();

    expect(
      await screen.findByText(/Senza rete: verbale in coda/i)
    ).toBeInTheDocument();
  });

  it("dopo sgq:ndtReportSynced con id server, il secondo Salva offline fa update", async () => {
    const user = userEvent.setup();
    render(<NdtReportsPage />);
    await user.click(await screen.findByRole("button", { name: "+ Nuovo verbale" }));
    await waitFor(() => expect(enqueueNdtReportSync).toHaveBeenCalled());
    expect(enqueueNdtReportSync.mock.calls[0][0]).toBe("create_ndt_report");
    const draftKeyFromCreate = enqueueNdtReportSync.mock.calls[0][1].draftKey;

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("sgq:ndtReportSynced", {
          detail: {
            type: "create_ndt_report",
            draftKey: draftKeyFromCreate || "sgq:ndt_draft:new",
            result: { created: true, id: 99 },
          },
        })
      );
    });
    await waitFor(() => expect(clearDraft).toHaveBeenCalled());

    enqueueNdtReportSync.mockClear();
    await user.click(screen.getByRole("button", { name: "Salva bozza" }));
    await waitFor(() => expect(enqueueNdtReportSync).toHaveBeenCalled());
    expect(enqueueNdtReportSync.mock.calls[0][0]).toBe("update_ndt_report");
    expect(enqueueNdtReportSync.mock.calls[0][1].id).toBe(99);
  });
});
