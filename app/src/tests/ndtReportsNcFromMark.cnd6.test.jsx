/**
 * @vitest-environment jsdom
 * CND-6: hint NC da marca R/S + pulsante touch (precompila NcCreateModal)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "fs";
import { resolve } from "path";

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

const ncModalProps = vi.fn();
vi.mock("../components/NcCreateModal.jsx", () => ({
  default: (props) => {
    ncModalProps(props);
    if (!props.open) return null;
    return (
      <div data-testid="nc-create-modal-open">
        <pre data-testid="nc-initial-desc">{props.initialDescription || ""}</pre>
      </div>
    );
  },
}));

const eligibilityMock = vi.fn();

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
      ],
    }),
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

const ELIGIBLE = {
  data: {
    ok: true,
    reasons: [],
    candidates: [],
    qualification: { ndt_method: "VT", ndt_level: 2 },
    vision: { state: "ok" },
  },
};

async function openNewVtReport(user) {
  render(<NdtReportsPage />);
  const nuovo = await screen.findByRole("button", { name: "+ Nuovo verbale" });
  await user.click(nuovo);
  await screen.findByRole("heading", { name: "Nuovo verbale CND" });
  // Attendi debounce gate 9712 (300ms) prima di interagire — evita .then su mock resettato
  await act(async () => {
    await new Promise((r) => setTimeout(r, 350));
  });
  await waitFor(() => expect(eligibilityMock).toHaveBeenCalled());
  const marksToggle = screen.getByRole("button", { name: /Elenco Marche/ });
  if (!document.querySelector(".ndt-marks-table")) {
    await user.click(marksToggle);
  }
  return document.querySelector(".ndt-marks-table");
}

describe("NdtReportsPage — CND-6 NC da marca", () => {
  beforeEach(() => {
    localStorage.clear();
    ncModalProps.mockClear();
    eligibilityMock.mockReset();
    eligibilityMock.mockResolvedValue(ELIGIBLE);
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 390 });
  });

  afterEach(() => {
    cleanup();
  });

  it("con giudizio R mostra hint + Registra NC e apre modal precompilato", async () => {
    const user = userEvent.setup();
    await openNewVtReport(user);
    const card = document.querySelector("tbody.ndt-mark-card");
    const evalBtns = card.querySelectorAll(".status-btn");
    await user.click(evalBtns[1]); // R

    const hint = await screen.findByTestId("ndt-defect-nc-hint");
    expect(hint.textContent).toMatch(/Giudizio R\/S/);
    const ncBtn = screen.getByRole("button", { name: "Registra NC" });
    expect(ncBtn).toHaveClass("ndt-defect-nc-btn");

    await user.click(ncBtn);
    expect(screen.getByTestId("nc-create-modal-open")).toBeInTheDocument();
    const desc = screen.getByTestId("nc-initial-desc").textContent;
    expect(desc).toMatch(/Esito:/);
    expect(desc).toMatch(/Marca:/);
  });

  it("CSS touch: Registra NC e foto >= 44px sotto 768", () => {
    const css = readFileSync(resolve("src/pages/NdtReportsPage.css"), "utf8");
    expect(css).toMatch(/\.ndt-defect-nc-btn/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/ndt-photo-row-btn-error/);
  });
});
