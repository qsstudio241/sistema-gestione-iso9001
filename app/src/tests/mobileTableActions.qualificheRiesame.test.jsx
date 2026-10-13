/**
 * Test L1 — Qualifiche e Riesame di Direzione: colonna Azioni raggiungibile da mobile.
 *
 * Audit tabelle mobile (come #774 WPS/WPQR): in queste due pagine «Azioni» non è nascosta, ma su 390px
 * restava fuori schermo (scroll orizzontale) e, in Qualifiche, l'intestazione «Certificato» restava
 * visibile mentre la cella era nascosta (intestazioni spostate di una colonna rispetto ai dati).
 * Fix: ultima colonna sticky a destra dentro la media query e `sq-col-cert` anche sul <th>.
 * jsdom non valuta le media query: le regole CSS si verificano leggendo i file.
 */
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

const scopeState = {
  companyId: "10",
  setCompanyId: () => {},
  companies: [{ id: 10, name: "Azienda Demo" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: false,
  isStudioPatrimonio: false,
  scopeReady: true,
  scopeCompanyName: "Azienda Demo",
};
vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", company_access: [] } }),
}));
vi.mock("../components/QualificationUploadButton", () => ({ default: () => null }));
vi.mock("../components/ReprocessQueueBanner", () => ({ default: () => null }));
vi.mock("../components/AskAiButton", () => ({ default: () => null }));

vi.mock("../services/apiService", () => ({
  default: {
    getQualifications: vi.fn(),
    getQualificationsStats: vi.fn(),
    getCompanies: vi.fn(),
    getCompanyPersonnel: vi.fn(),
    get: vi.fn(),
    baseUrl: "https://example.test",
  },
}));

import apiService from "../services/apiService";
import QualificationsPage from "../pages/QualificationsPage";
import ManagementReviewsPage from "../pages/ManagementReviewsPage";

const css = (rel) => fs.readFileSync(path.resolve(__dirname, rel), "utf8");

function mobileBlock(source, marker) {
  const start = source.indexOf(marker);
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf("\n}\n", start));
}

beforeEach(() => {
  vi.clearAllMocks();
  apiService.getQualifications.mockResolvedValue({
    qualifications: [{
      id: 7, person_name: "Persona Demo", qualification_type: "Saldatore ISO 9606-1",
      certificate_number: "ISO-001", expiry_date: "2027-01-15", semaforo: "verde",
    }],
    total: 1,
  });
  apiService.getQualificationsStats.mockResolvedValue({ total: 1, valide: 1 });
  apiService.getCompanies.mockResolvedValue({ data: [] });
  apiService.getCompanyPersonnel.mockResolvedValue({ data: [] });
  apiService.get.mockResolvedValue({
    data: [{ id: 3, review_number: "RD-1", review_date: "2026-03-01", chairperson: "Demo", status: "draft" }],
    pagination: { total: 1, page: 1, limit: 20 },
  });
});

describe("QualificationsPage — mobile", () => {
  it("regola CSS mobile: ultima colonna sticky (th e td) e colonna certificato nascosta", () => {
    const block = mobileBlock(css("../pages/QualificationsPage.css"), "@media (max-width:700px)");
    expect(block).toContain(".sq-col-cert, .sq-col-cert th { display:none; }");
    expect(block).toContain(".sq-table th:last-child, .sq-table td:last-child { position:sticky; right:0;");
  });

  it("«Azioni» è l'ultima colonna e le intestazioni nascoste su mobile corrispondono alle celle nascoste", async () => {
    render(<QualificationsPage />);
    const row = (await screen.findByText("Persona Demo")).closest("tr");
    const table = row.closest("table");
    const headers = within(table).getAllByRole("columnheader");
    const cells = within(row).getAllByRole("cell");
    expect(headers).toHaveLength(cells.length);
    expect(headers[headers.length - 1].textContent).toBe("Azioni");
    const hiddenHeaders = headers.map((h) => h.classList.contains("sq-col-cert"));
    const hiddenCells = cells.map((c) => c.classList.contains("sq-col-cert"));
    expect(hiddenHeaders).toEqual(hiddenCells);
    expect(hiddenHeaders.some(Boolean)).toBe(true);
    expect(within(cells[cells.length - 1]).getByTitle("Modifica")).toBeTruthy();
  });
});

describe("ManagementReviewsPage — mobile", () => {
  it("regola CSS mobile: ultima colonna sticky (th e td)", () => {
    const block = mobileBlock(css("../pages/ManagementReviewsPage.css"), "@media (max-width: 600px)");
    expect(block).toContain(".mr-table th:last-child, .mr-table td:last-child { position: sticky; right: 0;");
  });

  it("«Azioni» è l'ultima colonna e l'ultima cella contiene Modifica", async () => {
    render(<ManagementReviewsPage />);
    const row = (await screen.findByText("RD-1")).closest("tr");
    await waitFor(() => expect(row).toBeTruthy());
    const headers = within(row.closest("table")).getAllByRole("columnheader");
    const cells = within(row).getAllByRole("cell");
    expect(headers).toHaveLength(cells.length);
    expect(headers[headers.length - 1].textContent).toBe("Azioni");
    expect(within(cells[cells.length - 1]).getByTitle("Modifica")).toBeTruthy();
  });
});
