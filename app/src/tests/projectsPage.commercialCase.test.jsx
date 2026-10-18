/**
 * Test L1 — Commesse: selettore «Caso Riesame Requisiti» della stessa azienda.
 * L'auto-save non rimanda il caso se l'utente non ha toccato il selettore.
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
  },
}));

const CASES = [
  { id: 12, title: "Offerta ponte", status: "APPROVED", company_id: 49 },
  { id: 13, title: "Altra azienda", status: "DRAFT", company_id: 50 },
];

function project(extra = {}) {
  return {
    id: 7,
    project_code: "COMM-001",
    client_name: null,
    company_id: 49,
    end_customer_id: null,
    status: "offerta",
    start_date: null,
    end_date: null,
    applicable_wps_ids: [],
    description: "",
    notes: "",
    commercial_case_id: null,
    ...extra,
  };
}

async function openProject(extra) {
  const row = project(extra);
  mockGetProjects.mockResolvedValue({ data: [row], pagination: { total: 1 } });
  mockGetProject.mockResolvedValue({ data: row });
  const user = userEvent.setup();
  render(<ProjectsPage />);
  const tr = (await screen.findByText("COMM-001")).closest("tr");
  await user.click(tr);
  await screen.findByRole("heading", { name: "Modifica commessa" });
  await screen.findByLabelText("Caso Riesame Requisiti");
  return user;
}

beforeEach(() => {
  mockGetWPSList.mockReset().mockResolvedValue({ data: [] });
  mockUpdateProject.mockReset().mockResolvedValue({});
  mockGetContractReviews.mockReset().mockResolvedValue(CASES);
  mockGetCompanyCounterparties.mockReset().mockResolvedValue({ data: [] });
  mockGetProjects.mockReset();
  mockGetProject.mockReset();
});

describe("ProjectsPage — selettore Caso Riesame Requisiti", () => {
  it("mostra solo i casi della stessa azienda", async () => {
    await openProject();
    const select = await screen.findByLabelText("Caso Riesame Requisiti");
    await waitFor(() => expect(select).toHaveTextContent("Offerta ponte (Approvato)"));
    expect(select).not.toHaveTextContent("Altra azienda");
  });

  it("la scelta viene salvata", async () => {
    const user = await openProject();
    const select = await screen.findByLabelText("Caso Riesame Requisiti");
    await waitFor(() => expect(select).toHaveTextContent("Offerta ponte (Approvato)"));
    await user.selectOptions(select, "12");
    await waitFor(() => expect(mockUpdateProject).toHaveBeenCalled(), { timeout: 3000 });
    const [id, payload] = mockUpdateProject.mock.calls.at(-1);
    expect(id).toBe(7);
    expect(payload.commercial_case_id).toBe(12);
  });

  it("un salvataggio che non tocca il selettore non riscrive il collegamento", async () => {
    const user = await openProject({ commercial_case_id: 12 });
    const notes = screen.getByPlaceholderText("Nome cliente");
    await user.type(notes, "X");
    await waitFor(() => expect(mockUpdateProject).toHaveBeenCalled(), { timeout: 3000 });
    const payload = mockUpdateProject.mock.calls.at(-1)[1];
    expect(payload).not.toHaveProperty("commercial_case_id");
  });

  it("dopo la scelta, una modifica successiva non rimanda il caso", async () => {
    const user = await openProject();
    const select = await screen.findByLabelText("Caso Riesame Requisiti");
    await waitFor(() => expect(select).toHaveTextContent("Offerta ponte (Approvato)"));
    await user.selectOptions(select, "12");
    await waitFor(() => expect(mockUpdateProject).toHaveBeenCalled(), { timeout: 3000 });
    expect(mockUpdateProject.mock.calls.at(-1)[1].commercial_case_id).toBe(12);
    mockUpdateProject.mockClear();
    await user.type(screen.getByPlaceholderText("Nome cliente"), "Y");
    await waitFor(() => expect(mockUpdateProject).toHaveBeenCalled(), { timeout: 3000 });
    expect(mockUpdateProject.mock.calls.at(-1)[1]).not.toHaveProperty("commercial_case_id");
  });
});
