/**
 * @vitest-environment jsdom
 * CND-7: messaggio posa Registro visibile sulla lista dopo Completa.
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

vi.mock("../hooks/useNdtAutoSave.js", () => ({
  useNdtAutoSave: () => ({ clearDraft: vi.fn(), loadDraft: () => null }),
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

describe("CND-7 posa flash sulla lista", () => {
  beforeEach(() => {
    localStorage.clear();
    eligibilityMock.mockReset();
    createNdtReport.mockReset();
    eligibilityMock.mockResolvedValue({
      data: {
        ok: true,
        reasons: [],
        candidates: [],
        qualification: { ndt_method: "VT", ndt_level: 2, person_name: "PS_Admin" },
        vision: { state: "ok" },
      },
    });
    createNdtReport.mockResolvedValue({
      success: true,
      data: { id: 9, report_number: "VT-2026-009", status: "completed" },
      registry_pose: {
        document_id: 501,
        folder_missing: true,
        message: "Cartella mancante: il verbale \u00e8 nel Registro ma senza cartella 9.3. Inizializza l'albero documentale dell'azienda.",
      },
    });
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1200 });
  });

  it("dopo Completa mostra il messaggio registry_pose sulla lista", async () => {
    const user = userEvent.setup();
    render(<NdtReportsPage />);
    await user.click(await screen.findByRole("button", { name: "+ Nuovo verbale" }));
    await screen.findByRole("heading", { name: "Nuovo verbale CND" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Completa verbale" })).not.toBeDisabled();
    }, { timeout: 2000 });

    await user.click(screen.getByRole("button", { name: "Completa verbale" }));

    await waitFor(() => {
      expect(createNdtReport).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Cartella mancante/i);
    });
    expect(screen.getByText("Verbali CND")).toBeInTheDocument();
  });
});
