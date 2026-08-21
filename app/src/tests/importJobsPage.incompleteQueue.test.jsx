/**
 * @vitest-environment jsdom
 *
 * IA-5b: dopo Screening, link alla coda Documenti «da completare».
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const navigate = vi.fn();

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", organization_id: 1001 } }),
}));

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => ({
    companyId: "11",
    setCompanyId: () => {},
    companies: [{ id: 11, name: "Mason Demo" }],
    reloadCompanies: vi.fn(),
    locked: false,
    companyScoped: true,
    isStudioWide: false,
    isStudioPatrimonio: false,
    scopeReady: true,
    scopeCompanyName: "Mason Demo",
  }),
}));

vi.mock("../contexts/RouterContext", () => ({
  useNavigate: () => navigate,
}));

vi.mock("../services/apiService", () => ({
  default: {
    getImportJobs: vi.fn(),
    getImportJob: vi.fn(),
    getCompanies: vi.fn(),
    createImportJob: vi.fn(),
    uploadImportJobFiles: vi.fn(),
    processImportJob: vi.fn(),
    screenAndPlaceImportJob: vi.fn(),
    deleteImportJob: vi.fn(),
  },
  ApiError: class ApiError extends Error {},
}));

import apiService from "../services/apiService";
import ImportJobsPage from "../pages/ImportJobsPage.jsx";
import { buildIncompleteQueuePath } from "../utils/documentRegistryUrl";

describe("ImportJobsPage — coda da completare (IA-5b)", () => {
  beforeEach(() => {
    navigate.mockReset();
    apiService.getCompanies.mockResolvedValue({ data: [{ id: 11, name: "Mason Demo" }] });
    apiService.getImportJobs.mockResolvedValue({
      data: [{ id: 8, title: "Job Mason", status: "ready", file_count: 2, company_id: 11, company_name: "Mason Demo" }],
    });
    apiService.getImportJob.mockResolvedValue({
      data: {
        job: { id: 8, status: "ready", company_id: 11, company_name: "Mason Demo" },
        files: [{ id: 1, original_name: "a.pdf", status: "extracted" }],
      },
    });
    apiService.screenAndPlaceImportJob.mockResolvedValue({
      data: { screened: 2, placed: 1, results: [] },
    });
  });

  it("dopo Screening mostra il link alla coda e naviga a Documenti filtrati", async () => {
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    await waitFor(() => expect(screen.getByText("Job Mason")).toBeInTheDocument());
    await user.click(screen.getByText("Job Mason"));
    await waitFor(() => expect(screen.getByText("Job #8")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Screening e posa" }));
    const coda = await screen.findByRole("button", { name: "Apri coda da completare" });
    expect(screen.getByText(/file letti/i)).toBeInTheDocument();

    await user.click(coda);
    expect(navigate).toHaveBeenCalledWith(
      "/documents?tab=catalog&company_id=11&incomplete=1"
    );
  });

  it("job senza azienda cliente non mette company_id spurio nell URL coda", () => {
    expect(buildIncompleteQueuePath({ companyId: null })).toBe(
      "/documents?tab=catalog&incomplete=1"
    );
    expect(buildIncompleteQueuePath({ companyId: "" })).toBe(
      "/documents?tab=catalog&incomplete=1"
    );
    expect(buildIncompleteQueuePath({ companyId: "studio" })).toBe(
      "/documents?tab=catalog&incomplete=1"
    );
  });
});
