/**
 * @vitest-environment jsdom
 * CND-1: marche VT a scheda (stesso verbale/API, niente tabella da 720px).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
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
      ],
    }),
    getSuppliers: vi.fn().mockResolvedValue({ data: [] }),
    getProjects: vi.fn().mockResolvedValue({ data: [] }),
    getWPSList: vi.fn().mockResolvedValue({ data: [] }),
    getNdtReport: vi.fn(),
    createNdtReport: vi.fn(),
    updateNdtReport: vi.fn(),
    deleteNdtReport: vi.fn(),
    getNdtInspectorEligibility: vi.fn().mockResolvedValue({
      data: { ok: true, reasons: [], candidates: [], qualification: { ndt_method: "VT", ndt_level: 2 }, vision: { state: "ok" } },
    }),
  },
}));

import NdtReportsPage from "../pages/NdtReportsPage.jsx";

async function openNewVtReport(user) {
  render(<NdtReportsPage />);
  const nuovo = await screen.findByRole("button", { name: "+ Nuovo verbale" });
  await user.click(nuovo);
  await screen.findByRole("heading", { name: "Nuovo verbale CND" });
  const marksToggle = screen.getByRole("button", { name: /Elenco Marche/ });
  if (!document.querySelector(".ndt-marks-table")) {
    await user.click(marksToggle);
  }
  const table = document.querySelector(".ndt-marks-table");
  expect(table).toBeTruthy();
  return table;
}

describe("NdtReportsPage — marche CND-1", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1200 });
  });

  it("in desktop resta tabella (thead) e ogni marca è un tbody.ndt-mark-card", async () => {
    const user = userEvent.setup();
    const table = await openNewVtReport(user);
    expect(within(table).getByText("Pos. / Codice")).toBeInTheDocument();
    expect(within(table).getByText("Giudizio")).toBeInTheDocument();
    const card = table.querySelector("tbody.ndt-mark-card");
    expect(card).toBeTruthy();
    expect(card.querySelector('td[data-label="Pos. / Codice"]')).toBeTruthy();
    expect(card.querySelector('td[data-label="Giudizio"]')).toBeTruthy();
    expect(document.querySelector(".ndt-mobile-scroll-hint")).toBeNull();
  });

  it("giudizio A/R/S usa status-btn; R mostra notes-textarea; c'è il controllo foto", async () => {
    const user = userEvent.setup();
    await openNewVtReport(user);
    const card = document.querySelector("tbody.ndt-mark-card");
    expect(card).toBeTruthy();
    const evalBtns = card.querySelectorAll(".status-btn");
    expect(evalBtns).toHaveLength(3);
    expect([...evalBtns].map((b) => b.textContent.trim())).toEqual(["A", "R", "S"]);
    expect(card.querySelector(".notes-textarea")).toBeNull();
    await user.click(evalBtns[1]);
    expect(card.querySelector(".notes-textarea")).toBeTruthy();
    expect(card.querySelector(".ndt-photo-row-btn")).toBeTruthy();
  });

  it("il CSS sotto 768px non impone min-width 720px sulla tabella marche", () => {
    const css = readFileSync(resolve("src/pages/NdtReportsPage.css"), "utf8");
    expect(css).toContain(".ndt-mark-card");
    expect(css).not.toMatch(/\.ndt-marks-table\s*\{[^}]*min-width:\s*720px/);
    expect(css).toMatch(/@media \(max-width:\s*767px\)/);
  });
});
