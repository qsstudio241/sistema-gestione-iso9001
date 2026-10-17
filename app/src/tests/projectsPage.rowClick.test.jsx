/**
 * Test L1 — ProjectsPage (Commesse): dettaglio apribile da mobile.
 *
 * Causa: `@media (max-width:700px)` nascondeva dalla 5a colonna in poi (compresa «Azioni», con la
 * matita «Modifica commessa») e la riga non era cliccabile: su telefono il dettaglio era
 * irraggiungibile. Fix: Azioni (ultima colonna) resta visibile e la riga apre lo stesso modal di
 * Modifica; i controlli interni non propagano il click alla riga. jsdom non valuta le media
 * query: la regola CSS si verifica leggendo il file.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectsPage from "../pages/ProjectsPage";

const mockGetProjects = vi.fn();
const mockGetProject = vi.fn();
const mockGetWPSList = vi.fn();
const mockGetQualifications = vi.fn();
const mockGetCompanies = vi.fn();
const mockGetCompanyCounterparties = vi.fn();
const mockDeleteProject = vi.fn();
const mockUpdateProject = vi.fn();
const mockGetCoverage = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", company_access: [] } }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getProjects: (...a) => mockGetProjects(...a),
    getProject: (...a) => mockGetProject(...a),
    getWPSList: (...a) => mockGetWPSList(...a),
    getQualifications: (...a) => mockGetQualifications(...a),
    getCompanies: (...a) => mockGetCompanies(...a),
    getCompanyCounterparties: (...a) => mockGetCompanyCounterparties(...a),
    deleteProject: (...a) => mockDeleteProject(...a),
    updateProject: (...a) => mockUpdateProject(...a),
    getQualificationsCoverage: (...a) => mockGetCoverage(...a),
    getProjectWelders: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

// Commessa senza azienda né cliente finale (caso reale: una sola commessa «aperta»).
const PROJECT = {
  id: 7,
  project_code: "COMM-001",
  client_name: null,
  company_id: null,
  end_customer_id: null,
  status: "aperta",
  start_date: null,
  end_date: null,
  applicable_wps_ids: "[]",
};

const MODAL_TITLE = "Modifica commessa";

function modalTitle() {
  return screen.queryByRole("heading", { name: MODAL_TITLE });
}

async function renderList() {
  const user = userEvent.setup();
  render(<ProjectsPage />);
  await screen.findByText("COMM-001");
  return { user, row: screen.getByText("COMM-001").closest("tr") };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProjects.mockResolvedValue({ data: [PROJECT], pagination: { total: 1 } });
  mockGetProject.mockResolvedValue({ data: PROJECT });
  mockGetWPSList.mockResolvedValue({ data: [] });
  mockGetQualifications.mockResolvedValue({ qualifications: [] });
  mockGetCompanies.mockResolvedValue({ data: [{ id: 11, name: "Azienda Demo" }] });
  mockGetCompanyCounterparties.mockResolvedValue({ data: [] });
  mockDeleteProject.mockResolvedValue({});
  mockUpdateProject.mockResolvedValue({});
  mockGetCoverage.mockResolvedValue({ data: { rows: [] } });
});

describe("ProjectsPage.css — colonna Azioni visibile su mobile", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../pages/ProjectsPage.css"), "utf8");
  const mobileBlock = css.slice(css.indexOf("@media (max-width:700px)"));

  it("la regola mobile che nasconde le colonne esclude l'ultima (th e td)", () => {
    expect(mobileBlock).toContain(".pj-table th:nth-child(n+5):not(:last-child)");
    expect(mobileBlock).toContain(".pj-table td:nth-child(n+5):not(:last-child)");
  });

  it("nessuna regola nasconde nth-child(n+5) senza :not(:last-child)", () => {
    expect(css.match(/nth-child\(n\+5\)(?!:not\(:last-child\))/g)).toBeNull();
  });
});

describe("ProjectsPage — riga commessa cliccabile e Azioni", () => {
  it("«Azioni» è l'ultima colonna e l'ultima cella contiene Modifica, Copertura, Elimina", async () => {
    const { row } = await renderList();
    const table = row.closest("table");
    const headers = within(table).getAllByRole("columnheader");
    expect(headers[headers.length - 1].textContent).toBe("Azioni");
    const cells = within(row).getAllByRole("cell");
    expect(cells).toHaveLength(headers.length);
    const last = within(cells[cells.length - 1]);
    expect(last.getByRole("button", { name: "Modifica commessa" })).toBeTruthy();
    expect(last.getByTitle("Verifica copertura saldatori")).toBeTruthy();
    expect(last.getByRole("button", { name: "Elimina commessa" })).toBeTruthy();
  });

  it("il click sulla riga apre il modal «Modifica commessa»", async () => {
    const { user, row } = await renderList();
    expect(modalTitle()).toBeNull();
    await user.click(row);
    await waitFor(() => expect(mockGetProject).toHaveBeenCalledWith(7));
    expect(await screen.findByRole("heading", { name: MODAL_TITLE })).toBeTruthy();
  });

  it("il click su Modifica apre il modal una sola volta", async () => {
    const { user } = await renderList();
    await user.click(screen.getByRole("button", { name: "Modifica commessa" }));
    await screen.findByRole("heading", { name: MODAL_TITLE });
    expect(mockGetProject).toHaveBeenCalledTimes(1);
  });

  it("commessa senza azienda né cliente: il modal si apre, nessun salvataggio automatico, select azienda vuota", async () => {
    const { user, row } = await renderList();
    await user.click(row);
    await screen.findByRole("heading", { name: MODAL_TITLE });
    expect(screen.getByText(/Seleziona un.azienda per usare l.anagrafica clienti/)).toBeTruthy();
    const select = screen.getByText("Azienda (ambito)").closest(".pj-form-group").querySelector("select");
    expect(select.value).toBe("");
    expect(mockGetCompanyCounterparties).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 900));
    expect(mockUpdateProject).not.toHaveBeenCalled();
  });

  it("Copertura saldatori apre solo il suo modal, non quello di modifica", async () => {
    const { user, row } = await renderList();
    await user.click(within(row).getByTitle("Verifica copertura saldatori"));
    await waitFor(() => expect(mockGetCoverage).toHaveBeenCalledWith(7));
    expect(modalTitle()).toBeNull();
    expect(mockGetProject).not.toHaveBeenCalled();
  });

  it("Elimina mostra la conferma e deleteProject non apre il modal", async () => {
    const { user, row } = await renderList();
    await user.click(within(row).getByRole("button", { name: "Elimina commessa" }));
    expect(modalTitle()).toBeNull();
    expect(mockGetProject).not.toHaveBeenCalled();
    expect(screen.getByText("Il record va nel cestino. Non è una cancellazione definitiva.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /^S\s*-/ }));
    await waitFor(() => expect(mockDeleteProject).toHaveBeenCalledWith(7));
    expect(modalTitle()).toBeNull();
    expect(mockGetProject).not.toHaveBeenCalled();
  });

  it("«No» nella conferma di eliminazione non apre il modal", async () => {
    const { user, row } = await renderList();
    await user.click(within(row).getByRole("button", { name: "Elimina commessa" }));
    await user.click(screen.getByRole("button", { name: "No" }));
    expect(modalTitle()).toBeNull();
    expect(mockGetProject).not.toHaveBeenCalled();
  });
});
