/**
 * @vitest-environment jsdom
 *
 * COV-5 — montaggio del blocco «Fattibilità multi-dominio» nella modale «Copertura Commessa»
 * di Progetti: semaforo e tabella esistenti invariati, ambito = azienda della commessa.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import ProjectsPage from "../pages/ProjectsPage";

const mockGetProjects = vi.fn();
const mockGetWPSList = vi.fn();
const mockGetQualifications = vi.fn();
const mockGetCompanies = vi.fn();
const mockGetCompanyCounterparties = vi.fn();
const mockGetQualificationsCoverage = vi.fn();
const mockGetCoverageDomains = vi.fn();
const mockVerify = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", company_access: [] } }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getProjects: (...a) => mockGetProjects(...a),
    getWPSList: (...a) => mockGetWPSList(...a),
    getQualifications: (...a) => mockGetQualifications(...a),
    getCompanies: (...a) => mockGetCompanies(...a),
    getCompanyCounterparties: (...a) => mockGetCompanyCounterparties(...a),
    getQualificationsCoverage: (...a) => mockGetQualificationsCoverage(...a),
    getCoverageDomains: (...a) => mockGetCoverageDomains(...a),
    verifyCoverageRequirement: (...a) => mockVerify(...a),
  },
}));

const PROJECT = {
  id: 7,
  project_code: "COMM-001",
  client_name: "Cliente Test",
  company_id: 47,
  company_name: "ACME Spa",
  status: "aperta",
  applicable_wps_ids: "[1]",
};

const COVERAGE = {
  project_id: 7,
  project_code: "COMM-001",
  has_wps: true,
  summary: { total: 1, covered: 0, partial: 1, uncovered: 0 },
  coverage: [{
    wps_id: 1, wps_code: "WPS-001", welding_process: "135", material_group: "1.1",
    thickness_range_min: 3, thickness_range_max: 12, qualifiers: [], esito: "giallo",
  }],
};

const DOMAINS = {
  domains: [
    { domain: "welder_9606", implemented: true, requirementFields: [] },
    { domain: "wpqr_procedure", implemented: true, requirementFields: [] },
    { domain: "cnd_9712", implemented: true, requirementFields: [] },
  ],
};

async function openCoverage() {
  render(<ProjectsPage />);
  fireEvent.click(await screen.findByTitle("Verifica copertura saldatori"));
}

describe("ProjectsPage — blocco Fattibilità multi-dominio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjects.mockResolvedValue({ data: [PROJECT], pagination: { total: 1 } });
    mockGetWPSList.mockResolvedValue({ data: [] });
    mockGetQualifications.mockResolvedValue({ qualifications: [] });
    mockGetCompanies.mockResolvedValue({ data: [] });
    mockGetCompanyCounterparties.mockResolvedValue({ data: [] });
    mockGetQualificationsCoverage.mockResolvedValue(COVERAGE);
    mockGetCoverageDomains.mockResolvedValue(DOMAINS);
    mockVerify.mockResolvedValue({
      domain: "wpqr_procedure",
      matches: [{ status: "match", capability_id: 3, capability: { wpqr_code: "WPQR-9" }, reasons: ["ok"] }],
    });
  });

  it("monta il blocco dopo la tabella esistente, senza alterare semaforo e riepilogo", async () => {
    await openCoverage();
    const toggle = await screen.findByRole("button", { name: /Fattibilità multi-dominio/ });
    expect(toggle).toBeTruthy();
    expect(screen.getByText("Totale WPS: 1")).toBeTruthy();
    expect(screen.getByText(/Coperte: 0/)).toBeTruthy();
    const table = screen.getByText("WPS-001").closest("table");
    expect(table.classList.contains("pj-table")).toBe(true);
    expect(within(table).getByText("\u26A0\uFE0F")).toBeTruthy();
    expect(table.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("verifica procedure con company_id della commessa", async () => {
    await openCoverage();
    fireEvent.click(await screen.findByRole("button", { name: /Fattibilità multi-dominio/ }));
    fireEvent.click(await screen.findByTestId("cov-verify-procedures"));
    await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));
    expect(mockVerify).toHaveBeenCalledWith({
      domain: "wpqr_procedure",
      company_id: 47,
      criteria: { welding_process: "135", thickness_mm: 3, thickness_b_mm: 12, material_group: "1.1" },
    });
    expect(screen.getAllByText(/ACME Spa/).length).toBeGreaterThan(0);
  });

  it("senza WPS mostra il blocco con pulsante disabled e title", async () => {
    mockGetQualificationsCoverage.mockResolvedValue({
      project_id: 7, project_code: "COMM-001", has_wps: false, coverage: [],
      summary: { total: 0, covered: 0, partial: 0, uncovered: 0 },
    });
    await openCoverage();
    fireEvent.click(await screen.findByRole("button", { name: /Fattibilità multi-dominio/ }));
    const btn = await screen.findByTestId("cov-verify-procedures");
    expect(btn.disabled).toBe(true);
    expect(btn.title).toMatch(/Nessuna WPS associata/);
  });
});
