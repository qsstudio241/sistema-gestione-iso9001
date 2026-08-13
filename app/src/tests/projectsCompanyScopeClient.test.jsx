/**
 * Test L1 — ProjectsPage: Ambito azienda + Cliente da anagrafica aziende
 *
 * Copre:
 *  - il selettore "Ambito" appare quando ci sono aziende e filtra la lista per company_id
 *  - il form "Nuova commessa" propone la lista clienti (company_counterparties, ruolo end_customer)
 *    invece del solo testo libero, quando è selezionata un'azienda
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import ProjectsPage from "../pages/ProjectsPage";
import { withCompanyScope } from "./helpers/withCompanyScope";

const mockGetProjects = vi.fn();
const mockGetWPSList = vi.fn();
const mockGetQualifications = vi.fn();
const mockGetCompanies = vi.fn();
const mockGetCompanyCounterparties = vi.fn();
const mockCreateProject = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", company_access: [] } }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getProjects: (...args) => mockGetProjects(...args),
    getWPSList: (...args) => mockGetWPSList(...args),
    getQualifications: (...args) => mockGetQualifications(...args),
    getCompanies: (...args) => mockGetCompanies(...args),
    getCompanyCounterparties: (...args) => mockGetCompanyCounterparties(...args),
    createProject: (...args) => mockCreateProject(...args),
  },
}));

const COMPANIES = [
  { id: 11, name: "Manitou" },
  { id: 47, name: "ACME Spa" },
];

const CUSTOMERS_47 = [
  { id: 3, name: "PT.MAIDO", external_ref: "PT001" },
];

beforeEach(() => {
  mockGetProjects.mockReset().mockResolvedValue({ data: [], pagination: { total: 0 } });
  mockGetWPSList.mockReset().mockResolvedValue({ data: [] });
  mockGetQualifications.mockReset().mockResolvedValue({ qualifications: [] });
  mockGetCompanies.mockReset().mockResolvedValue({ data: COMPANIES });
  mockGetCompanyCounterparties.mockReset().mockImplementation((companyId) => {
    if (String(companyId) === "47") return Promise.resolve({ data: CUSTOMERS_47 });
    return Promise.resolve({ data: [] });
  });
  mockCreateProject.mockReset().mockResolvedValue({ data: { id: 99 } });
  window.localStorage.clear();
});

describe("ProjectsPage — Ambito azienda", () => {
  it("filtra la lista per company_id dell'Ambito globale", async () => {
    render(withCompanyScope(<ProjectsPage />, "47"));

    await waitFor(() => {
      const lastCall = mockGetProjects.mock.calls.at(-1)?.[0];
      expect(lastCall?.company_id).toBe("47");
    });
    expect(await screen.findByText("Ambito attivo: ACME Spa")).toBeInTheDocument();
  });
});

/** Trova l'<input>/<select> del gruppo .pj-form-group la cui label inizia con `labelPrefix`. */
function getFieldByLabel(container, labelPrefix) {
  const groups = container.querySelectorAll(".pj-form-group");
  for (const group of groups) {
    const label = group.querySelector(".pj-form-label");
    if (label && label.textContent.trim().startsWith(labelPrefix)) {
      return group.querySelector("input, select, textarea");
    }
  }
  throw new Error(`Campo con label "${labelPrefix}" non trovato`);
}

describe("ProjectsPage — Cliente dall'anagrafica aziende", () => {
  it("propone i clienti (company_counterparties) dell'azienda selezionata nel form", async () => {
    const { container } = render(withCompanyScope(<ProjectsPage />));

    fireEvent.click(await screen.findByText("+ Nuova commessa"));
    await screen.findByText("Nuova commessa");

    const companySelect = getFieldByLabel(container, "Azienda");
    fireEvent.change(companySelect, { target: { value: "47" } });

    await waitFor(() => expect(mockGetCompanyCounterparties).toHaveBeenCalledWith("47", { role: "end_customer", is_active: "true" }));

    expect(await screen.findByText("PT.MAIDO")).toBeInTheDocument();
  });

  it("collega il cliente selezionato (end_customer_id) e lo sincronizza nel payload di creazione", async () => {
    const { container } = render(withCompanyScope(<ProjectsPage />));

    fireEvent.click(await screen.findByText("+ Nuova commessa"));
    await screen.findByText("Nuova commessa");

    fireEvent.change(getFieldByLabel(container, "Codice commessa"), { target: { value: "J26-0200" } });

    const companySelect = getFieldByLabel(container, "Azienda");
    fireEvent.change(companySelect, { target: { value: "47" } });

    await screen.findByText("PT.MAIDO");
    const clientSelect = getFieldByLabel(container, "Cliente");
    fireEvent.change(clientSelect, { target: { value: "3" } });

    fireEvent.click(screen.getByText("Salva"));

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalled());
    const payload = mockCreateProject.mock.calls[0][0];
    expect(payload.end_customer_id).toBe("3");
    expect(payload.client_name).toBe("PT.MAIDO");
    expect(payload.company_id).toBe("47");
  });
});
