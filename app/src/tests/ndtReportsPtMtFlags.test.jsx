/**
 * @vitest-environment jsdom
 * CND-3: sezioni metodo PT/MT visibili sul verbale giusto, salvate in method_params.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "fs";
import { resolve } from "path";

const scopeState = {
  companyId: "48",
  setCompanyId: () => {},
  companies: [{ id: 48, name: "Cliente PT SRL" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: false,
  scopeCompanyName: "Cliente PT SRL",
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

const createNdtReport = vi.fn();
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
    createNdtReport: (...args) => createNdtReport(...args),
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
  await screen.findByRole("heading", { name: /Nuovo verbale CND|Bozza locale|Bozza in coda|Verbale/i });
}

describe("NdtReportsPage — flag PT/MT CND-3", () => {
  beforeEach(() => {
    localStorage.clear();
    createNdtReport.mockReset();
    // CND-8: openNew crea bozza subito; senza id resta form "nuovo" (create, non update)
    createNdtReport.mockResolvedValue({ data: {} });
    eligibilityMock.mockReset();
    eligibilityMock.mockResolvedValue({
      data: { ok: true, reasons: [], candidates: [], qualification: { ndt_method: "PT", ndt_level: 2 }, vision: { state: "ok" } },
    });
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1200 });
  });

  it("VT mostra lux e non le sezioni PT/MT", async () => {
    const user = userEvent.setup();
    await openNewReport(user);
    expect(screen.getByText("Illuminamento min (lux)")).toBeInTheDocument();
    expect(screen.queryByTestId("ndt-pt-method")).toBeNull();
    expect(screen.queryByTestId("ndt-mt-method")).toBeNull();
    expect(screen.queryByText("Parametri metodo PT")).toBeNull();
  });

  it("PT mostra flag metodo, MT assente; L2 finisce in method_params.pt", async () => {
    const user = userEvent.setup();
    await openNewReport(user);
    createNdtReport.mockClear();
    await user.selectOptions(screen.getByLabelText("Tipo metodo"), "PT");
    const methodToggle = screen.getByRole("button", { name: /Parametri metodo PT/ });
    if (!document.querySelector("[data-testid='ndt-pt-method']")) {
      await user.click(methodToggle);
    }
    const pt = await screen.findByTestId("ndt-pt-method");
    expect(pt).toBeTruthy();
    expect(screen.queryByTestId("ndt-mt-method")).toBeNull();
    expect(screen.queryByText("Illuminamento min (lux)")).toBeNull();

    const l2 = screen.getByRole("button", { name: /L2 / });
    await user.click(l2);
    expect(l2).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Salva bozza" }));
    await waitFor(() => expect(createNdtReport).toHaveBeenCalled());
    const payload = createNdtReport.mock.calls[0][0];
    expect(payload.report_type).toBe("PT");
    expect(payload.method_params.pt.acc).toBe("l2");
    expect(payload.method_params.pt.application).toBe("spray");
    expect(payload.method_params.mt).toBeUndefined();
    expect(payload.method_params.illuminance_min).toBeUndefined();
  });

  it("MT mostra tracciante umido; cambio tipo non mescola PT", async () => {
    const src = readFileSync(resolve("src/pages/NdtReportsPage.jsx"), "utf8");
    expect(src).not.toMatch(/>Intensit\\u00e0</);
    expect(src).toMatch(/\{"Intensit\\u00e0"\}/);
    const user = userEvent.setup();
    await openNewReport(user);
    createNdtReport.mockClear();
    await user.selectOptions(screen.getByLabelText("Tipo metodo"), "MT");
    const methodToggle = screen.getByRole("button", { name: /Parametri metodo MT/ });
    if (!document.querySelector("[data-testid='ndt-mt-method']")) {
      await user.click(methodToggle);
    }
    expect(await screen.findByTestId("ndt-mt-method")).toBeTruthy();
    expect(screen.queryByTestId("ndt-pt-method")).toBeNull();
    expect(screen.getByLabelText("Intensità")).toBeInTheDocument();
    expect(screen.queryByText(/Intensit\\u00e0/)).toBeNull();
    const wet = screen.getByRole("button", { name: "Umido" });
    expect(wet).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Salva bozza" }));
    await waitFor(() => expect(createNdtReport).toHaveBeenCalled());
    const payload = createNdtReport.mock.calls[0][0];
    expect(payload.report_type).toBe("MT");
    expect(payload.method_params.mt.tracer).toBe("wet");
    expect(payload.method_params.pt).toBeUndefined();
  });
});
