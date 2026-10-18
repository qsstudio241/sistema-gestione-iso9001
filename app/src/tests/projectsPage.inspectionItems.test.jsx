/**
 * Test L1 — Commesse: elenco Controlli previsti e bozze verbali.
 * Il salvataggio della commessa non rimanda il caso se il selettore non si tocca.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectsPage from "../pages/ProjectsPage";

const mockGetProjects = vi.fn();
const mockGetProject = vi.fn();
const mockGetWPSList = vi.fn();
const mockUpdateProject = vi.fn();
const mockGetContractReviews = vi.fn();
const mockGetCompanyCounterparties = vi.fn();
const mockGetItems = vi.fn();
const mockCreateItem = vi.fn();
const mockGenerate = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", company_access: [] } }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getProjects: (...a) => mockGetProjects(...a),
    getProject: (...a) => mockGetProject(...a),
    getWPSList: (...a) => mockGetWPSList(...a),
    getQualifications: vi.fn(),
    getCompanies: vi.fn(),
    getCompanyCounterparties: (...a) => mockGetCompanyCounterparties(...a),
    getContractReviews: (...a) => mockGetContractReviews(...a),
    deleteProject: vi.fn(),
    updateProject: (...a) => mockUpdateProject(...a),
    getQualificationsCoverage: vi.fn(),
    getProjectWelders: vi.fn(),
    getProjectInspectionItems: (...a) => mockGetItems(...a),
    createProjectInspectionItem: (...a) => mockCreateItem(...a),
    deleteProjectInspectionItem: vi.fn(),
    generateProjectInspectionDrafts: (...a) => mockGenerate(...a),
  },
}));

function project() {
  return {
    id: 7,
    project_code: "COMM-001",
    client_name: "",
    company_id: 49,
    end_customer_id: null,
    status: "offerta",
    start_date: null,
    end_date: null,
    applicable_wps_ids: [],
    description: "",
    notes: "",
    commercial_case_id: 12,
  };
}

async function openProject() {
  const row = project();
  mockGetProjects.mockResolvedValue({ data: [row], pagination: { total: 1 } });
  mockGetProject.mockResolvedValue({ data: row });
  const user = userEvent.setup();
  render(<ProjectsPage />);
  const tr = (await screen.findByText("COMM-001")).closest("tr");
  await user.click(tr);
  await screen.findByRole("heading", { name: "Modifica commessa" });
  await screen.findByRole("heading", { name: "Controlli previsti" });
  return user;
}

beforeEach(() => {
  mockGetWPSList.mockReset().mockResolvedValue({ data: [] });
  mockUpdateProject.mockReset().mockResolvedValue({});
  mockGetContractReviews.mockReset().mockResolvedValue([]);
  mockGetCompanyCounterparties.mockReset().mockResolvedValue({ data: [] });
  mockGetProjects.mockReset();
  mockGetProject.mockReset();
  mockGetItems.mockReset().mockResolvedValue({ data: [] });
  mockCreateItem.mockReset().mockResolvedValue({
    data: {
      id: 3,
      inspection_phase: "before",
      method: "VT",
      coverage_percent: 10,
      acceptance_standard: "testo utente",
    },
  });
  mockGenerate.mockReset().mockResolvedValue({
    data: { created: [{ id: 3, report_id: 44 }], already: [], skipped: [] },
  });
});

describe("ProjectsPage — controlli previsti", () => {
  it("aggiunge un controllo e chiede le bozze senza riscrivere il caso", async () => {
    const user = await openProject();
    expect(mockGetItems).toHaveBeenCalledWith(7);

    await user.selectOptions(screen.getByLabelText("Fase"), "before");
    await user.selectOptions(screen.getByLabelText("Metodo"), "VT");
    await user.type(screen.getByLabelText("Percentuale"), "10");
    await user.type(screen.getByLabelText("Norma di accettazione"), "testo utente");
    await user.click(screen.getByRole("button", { name: "Aggiungi" }));

    await waitFor(() => expect(mockCreateItem).toHaveBeenCalledWith(7, {
      inspection_phase: "before",
      method: "VT",
      coverage_percent: "10",
      acceptance_standard: "testo utente",
    }));
    expect(await screen.findByText("Prima della saldatura · VT · 10% · testo utente")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Crea bozze verbali" }));
    await waitFor(() => expect(mockGenerate).toHaveBeenCalledWith(7));
    expect(await screen.findByText(/Bozze create: 1/)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Nome cliente"), "Y");
    await waitFor(() => expect(mockUpdateProject).toHaveBeenCalled(), { timeout: 3000 });
    expect(mockUpdateProject.mock.calls.at(-1)[1]).not.toHaveProperty("commercial_case_id");
  });
});
