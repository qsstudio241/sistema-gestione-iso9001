/**
 * @vitest-environment jsdom
 * CND-8: Nuovo verbale → bozza UUID subito (come createAudit); lista onesta offline/coda.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../hooks/useNdtAutoSave.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    enqueueNdtReportSync: (...args) => enqueueNdtReportSync(...args),
  };
});

vi.mock("../components/NdtItemAttachments.jsx", () => ({
  default: () => null,
}));

vi.mock("../components/NcCreateModal.jsx", () => ({
  default: () => null,
}));

const createNdtReport = vi.fn();
const getNdtReportList = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getStoredUser: () => ({ full_name: "PS_Admin", email: "admin@sgq.local" }),
    getNdtReportList: (...args) => getNdtReportList(...args),
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
    getNdtInspectorEligibility: vi.fn().mockResolvedValue({
      data: {
        ok: true,
        reasons: [],
        candidates: [],
        qualification: { ndt_method: "VT", ndt_level: 2 },
        vision: { state: "ok" },
      },
    }),
  },
}));

import NdtReportsPage from "../pages/NdtReportsPage.jsx";
import {
  seedNdtLocalDraft,
  listNdtDrafts,
  markNdtDraftQueued,
  ndtDraftKey,
} from "../hooks/useNdtAutoSave.js";

describe("CND-8 seedNdtLocalDraft helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("seed crea UUID e bozza in localStorage", () => {
    const seeded = seedNdtLocalDraft({ inspector: "PS_Admin", companyId: "48" });
    expect(seeded.uuid).toBeTruthy();
    expect(seeded.draftKey).toBe(ndtDraftKey(seeded.uuid));
    expect(seeded.formData.status).toBe("draft");
    expect(seeded.formData.inspector).toBe("PS_Admin");
    const drafts = listNdtDrafts();
    expect(drafts.length).toBe(1);
    expect(drafts[0].client_uuid).toBe(seeded.uuid);
    expect(drafts[0]._serverIdHint).toBeNull();
  });

  it("markNdtDraftQueued aggiorna flag per lista onesta", () => {
    const seeded = seedNdtLocalDraft({ inspector: "X" });
    markNdtDraftQueued(seeded.draftKey, true);
    const drafts = listNdtDrafts();
    expect(drafts[0].queued).toBe(true);
  });
});

describe("CND-8 Nuovo verbale → bozza UUID", () => {
  beforeEach(() => {
    localStorage.clear();
    enqueueNdtReportSync.mockReset();
    createNdtReport.mockReset();
    getNdtReportList.mockReset();
    getNdtReportList.mockResolvedValue({ data: [] });
    enqueueNdtReportSync.mockResolvedValue("q-cnd8");
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1200 });
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: true,
    });
  });

  it("online: create API subito e apre form con id server", async () => {
    createNdtReport.mockResolvedValue({
      data: { id: 77, report_number: "VT-2026-001", status: "draft", report_type: "VT", items: [] },
    });
    const user = userEvent.setup();
    render(<NdtReportsPage />);
    await user.click(await screen.findByRole("button", { name: "+ Nuovo verbale" }));

    await waitFor(() => expect(createNdtReport).toHaveBeenCalled());
    const payload = createNdtReport.mock.calls[0][0];
    expect(payload.uuid).toBeTruthy();
    expect(payload.status).toBe("draft");
    expect(enqueueNdtReportSync).not.toHaveBeenCalled();

    expect(
      await screen.findByRole("heading", { name: /Verbale VT-2026-001/i })
    ).toBeInTheDocument();
  });

  it("offline: enqueue CND-9 e mostra bozza in coda in lista", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });
    // lista: fallisce rete ma dopo bozza locale deve comunque mostrare la riga
    getNdtReportList.mockRejectedValue({ code: "OFFLINE", status: 0 });

    const user = userEvent.setup();
    render(<NdtReportsPage />);
    await user.click(await screen.findByRole("button", { name: "+ Nuovo verbale" }));

    await waitFor(() => expect(enqueueNdtReportSync).toHaveBeenCalled());
    expect(enqueueNdtReportSync.mock.calls[0][0]).toBe("create_ndt_report");
    expect(enqueueNdtReportSync.mock.calls[0][1].uuid).toBeTruthy();
    expect(createNdtReport).not.toHaveBeenCalled();

    expect(
      await screen.findByRole("heading", { name: /Bozza in coda/i })
    ).toBeInTheDocument();

    // Verifica indice bozza prima di Chiudi (lista onesta)
    const draftsBefore = listNdtDrafts();
    expect(draftsBefore.length).toBeGreaterThan(0);
    expect(draftsBefore.some((d) => d.queued)).toBe(true);

    await user.click(screen.getByRole("button", { name: "Chiudi" }));

    await waitFor(() => {
      expect(screen.getAllByText(/In coda|bozza locale/i).length).toBeGreaterThan(0);
    });
  });
});
