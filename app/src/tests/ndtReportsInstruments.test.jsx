/**
 * @vitest-environment jsdom
 * Sezione 2 verbale VT: nome strumento dentro la card, ruolo Calibro non "Altro".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
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

vi.mock("../hooks/useNdtAutoSave.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNdtAutoSave: () => ({ clearDraft: vi.fn(), loadDraft: () => null, draftKey: "sgq:ndt_draft:new" }),
    enqueueNdtReportSync: vi.fn(),
    isNdtNetworkSaveError: () => false,
    getOrCreateOfflineCreateUuid: () => "test-uuid",
    clearOfflineCreateUuid: vi.fn(),
  };
});

vi.mock("../components/NdtItemAttachments.jsx", () => ({
  default: () => null,
}));

vi.mock("../components/NcCreateModal.jsx", () => ({
  default: () => null,
}));

vi.mock("../services/apiService", () => ({
  default: {
    getStoredUser: () => ({ full_name: "PS_Admin", email: "admin@sgq.local" }),
    getNdtReportList: vi.fn().mockResolvedValue({ data: [] }),
    getNdtReportStats: vi.fn().mockResolvedValue({
      data: { total: 0, draft: 0, approved: 0, vt_count: 0, mt_count: 0, pt_count: 0, ut_count: 0 },
    }),
    getEquipmentForReport: vi.fn().mockResolvedValue({
      data: [
        { id: 11, name: "Calibro", model: "TWI", serial_number: "C-001", asset_subcategory: "calibro", status: "active", calibration_status: "ok" },
        { id: 12, name: "Luxmetro da campo", model: "LM-2", serial_number: "L-002", asset_subcategory: "", status: "active", calibration_status: "ok" },
      ],
    }),
    getSuppliers: vi.fn().mockResolvedValue({ data: [] }),
    getProjects: vi.fn().mockResolvedValue({ data: [] }),
    getWPSList: vi.fn().mockResolvedValue({ data: [] }),
    getNdtReport: vi.fn(),
    createNdtReport: vi.fn().mockResolvedValue({ data: {} }),
    updateNdtReport: vi.fn(),
    deleteNdtReport: vi.fn(),
    getNdtInspectorEligibility: vi.fn().mockResolvedValue({
      data: { ok: true, reasons: [], candidates: [], qualification: { ndt_method: "VT", ndt_level: 2 }, vision: { state: "ok" } },
    }),
  },
}));

import apiService from "../services/apiService";
import NdtReportsPage, {
  inferInstrumentRole,
  resolveInstrumentRole,
} from "../pages/NdtReportsPage.jsx";

describe("inferInstrumentRole", () => {
  it("riconosce Calibro, Luxmetro e Lampada dal nome o sottocategoria", () => {
    expect(inferInstrumentRole({ name: "Calibro", asset_subcategory: "" })).toBe("gauge");
    expect(inferInstrumentRole({ name: "Gauge saldature", asset_subcategory: "" })).toBe("gauge");
    expect(inferInstrumentRole({ name: "Strumento 1", asset_subcategory: "calibro" })).toBe("gauge");
    expect(inferInstrumentRole({ name: "Luxmetro da campo", asset_subcategory: "" })).toBe("luxmeter");
    expect(inferInstrumentRole({ name: "Lampada UV", asset_subcategory: "" })).toBe("lamp");
    expect(inferInstrumentRole({ name: "Termometro", asset_subcategory: "" })).toBe("other");
  });

  it("non sovrascrive un ruolo già scelto diverso da Altro", () => {
    expect(resolveInstrumentRole("luxmeter", { name: "Calibro" })).toBe("luxmeter");
    expect(resolveInstrumentRole("other", { name: "Calibro" })).toBe("gauge");
    expect(resolveInstrumentRole(null, { name: "Calibro" })).toBe("gauge");
  });
});

describe("NdtReportsPage — sezione strumenti", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1200 });
    apiService.getEquipmentForReport.mockResolvedValue({
      data: [
        { id: 11, name: "Calibro", model: "TWI", serial_number: "C-001", asset_subcategory: "calibro", status: "active", calibration_status: "ok" },
        { id: 12, name: "Luxmetro da campo", model: "LM-2", serial_number: "L-002", asset_subcategory: "", status: "active", calibration_status: "ok" },
      ],
    });
  });

  it("tiene il nome Calibro dentro la card e imposta il ruolo Calibro, non Altro", async () => {
    const user = userEvent.setup();
    render(<NdtReportsPage />);

    const nuovo = await screen.findByRole("button", { name: "+ Nuovo verbale" });
    await user.click(nuovo);

    expect(apiService.getEquipmentForReport).toBeDefined();
    await screen.findByRole("heading", { name: /Nuovo verbale CND|Bozza locale|Bozza in coda|Verbale/i });
    expect(apiService.getEquipmentForReport).toHaveBeenCalled();

    const sectionToggle = screen.getByRole("button", { name: /Strumentazione utilizzata/ });
    if (!screen.queryByText("Calibro") && !screen.queryByText(/Nessuno strumento/)) {
      await user.click(sectionToggle);
    }

    const card = await screen.findByText("Calibro");
    const cardRoot = card.closest(".ndt-instrument-card");
    expect(cardRoot).toBeTruthy();
    expect(card.className).toContain("ndt-inst-name");
    expect(within(cardRoot).getByText("Calibro")).toBeInTheDocument();

    const checkbox = within(cardRoot).getByRole("checkbox");
    expect(checkbox.closest(".ndt-inst-check-label")).toBeTruthy();
    await user.click(checkbox);

    const roleSelect = within(cardRoot).getByLabelText("Ruolo di Calibro");
    expect(roleSelect).toHaveValue("gauge");
    expect(within(cardRoot).getByText("Ruolo nel verbale")).toBeInTheDocument();
    expect(cardRoot.querySelector(".ndt-inst-role-wrap")).toBeTruthy();
  });
});
