/**
 * Test L1 — ProjectsPage: applicable_wps_ids inviato come ARRAY di id (mai JSON.stringify) e letto
 * anche quando il valore in DB è già annidato (bug storico: ogni auto-save annidava un livello).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectsPage from "../pages/ProjectsPage";
import { normalizeApplicableWpsIds } from "../utils/applicableWpsIds";

const mockGetProjects = vi.fn();
const mockGetProject = vi.fn();
const mockGetWPSList = vi.fn();
const mockUpdateProject = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", company_access: [] } }),
}));

vi.mock("../services/apiService", () => ({
  default: {
    getProjects: (...a) => mockGetProjects(...a),
    getProject: (...a) => mockGetProject(...a),
    getWPSList: (...a) => mockGetWPSList(...a),
    getQualifications: vi.fn().mockResolvedValue({ qualifications: [] }),
    getCompanies: vi.fn().mockResolvedValue({ data: [] }),
    getCompanyCounterparties: vi.fn().mockResolvedValue({ data: [] }),
    deleteProject: vi.fn().mockResolvedValue({}),
    updateProject: (...a) => mockUpdateProject(...a),
    getQualificationsCoverage: vi.fn().mockResolvedValue({ data: { rows: [] } }),
    getProjectWelders: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

const WPS = [
  { id: 1, wps_code: "WPS-A", revision: "0", welding_process: "135" },
  { id: 2, wps_code: "WPS-B", revision: "0", welding_process: "111" },
  { id: 3, wps_code: "WPS-C", revision: "0", welding_process: "141" },
];

function projectWith(applicable_wps_ids) {
  return {
    id: 7,
    project_code: "COMM-001",
    client_name: null,
    company_id: null,
    end_customer_id: null,
    status: "aperta",
    start_date: null,
    end_date: null,
    applicable_wps_ids,
  };
}

async function openProject(rawIds) {
  const project = projectWith(rawIds);
  mockGetProjects.mockResolvedValue({ data: [project], pagination: { total: 1 } });
  mockGetProject.mockResolvedValue({ data: project });
  const user = userEvent.setup();
  render(<ProjectsPage />);
  const row = (await screen.findByText("COMM-001")).closest("tr");
  await user.click(row);
  await screen.findByRole("heading", { name: "Modifica commessa" });
  await screen.findByText(/^WPS-A/);
  return user;
}

function wpsCheckbox(code) {
  return screen.getByText(new RegExp(`^${code}`)).closest("label").querySelector("input");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWPSList.mockResolvedValue({ data: WPS });
  mockUpdateProject.mockResolvedValue({});
});

describe("normalizeApplicableWpsIds (client)", () => {
  it("legge array, JSON, annidamenti, CSV e scarta valori non validi", () => {
    expect(normalizeApplicableWpsIds([1, 2])).toEqual([1, 2]);
    expect(normalizeApplicableWpsIds("[1,2]")).toEqual([1, 2]);
    expect(normalizeApplicableWpsIds('["[1,2]"]')).toEqual([1, 2]);
    expect(normalizeApplicableWpsIds(JSON.stringify(JSON.stringify([4, 5])))).toEqual([4, 5]);
    expect(normalizeApplicableWpsIds("1, 2;3")).toEqual([1, 2, 3]);
    expect(normalizeApplicableWpsIds('["[\\"x\\"]"]')).toEqual([]);
    expect(normalizeApplicableWpsIds([1, "1", -2, 1.5, "abc", null, 3])).toEqual([1, 3]);
    expect(normalizeApplicableWpsIds(null)).toEqual([]);
    expect(normalizeApplicableWpsIds("")).toEqual([]);
  });
});

describe("ProjectsPage — applicable_wps_ids", () => {
  it("valore già annidato in DB: le WPS risultano selezionate", async () => {
    await openProject('["[1,2]"]');
    expect(wpsCheckbox("WPS-A").checked).toBe(true);
    expect(wpsCheckbox("WPS-B").checked).toBe(true);
    expect(wpsCheckbox("WPS-C").checked).toBe(false);
  });

  it("l'auto-save invia un array di numeri, non una stringa JSON, e non annida", async () => {
    const user = await openProject('["[1,2]"]');
    await user.click(wpsCheckbox("WPS-C"));
    await waitFor(() => expect(mockUpdateProject).toHaveBeenCalledTimes(1), { timeout: 3000 });
    const [id, payload] = mockUpdateProject.mock.calls[0];
    expect(id).toBe(7);
    expect(Array.isArray(payload.applicable_wps_ids)).toBe(true);
    expect(payload.applicable_wps_ids).toEqual([1, 2, 3]);
  });

  it("apertura senza modifiche: nessun salvataggio automatico", async () => {
    await openProject("[1,2]");
    await new Promise((r) => setTimeout(r, 900));
    expect(mockUpdateProject).not.toHaveBeenCalled();
  });
});
