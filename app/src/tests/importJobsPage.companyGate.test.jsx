/**
 * @vitest-environment jsdom
 *
 * Import PDF: senza azienda cliente i pulsanti restano visibili ma disabled.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { COMPANY_REQUIRED_UPLOAD_TITLE } from "../utils/importFolderUpload";

const scopeState = {
  companyId: "",
  setCompanyId: () => {},
  companies: [{ id: 11, name: "Mason Demo" }],
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioWide: true,
  isStudioPatrimonio: false,
  scopeReady: true,
  scopeCompanyName: "Tutto lo studio",
};

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "admin", organization_id: 1001 } }),
}));

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../contexts/RouterContext", () => ({
  useNavigate: () => vi.fn(),
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

describe("ImportJobsPage — gate azienda cliente", () => {
  beforeEach(() => {
    scopeState.companyId = "";
    scopeState.isStudioWide = true;
    scopeState.isStudioPatrimonio = false;
    apiService.getCompanies.mockResolvedValue({ data: [{ id: 11, name: "Mason Demo" }] });
    apiService.getImportJobs.mockResolvedValue({
      data: [
        { id: 7, title: "Job senza azienda", status: "draft", file_count: 0, company_id: null },
        { id: 8, title: "Job Mason", status: "ready", file_count: 2, company_id: 11, company_name: "Mason Demo" },
      ],
    });
    apiService.getImportJob.mockImplementation((id) => {
      if (Number(id) === 8) {
        return Promise.resolve({
          data: {
            job: { id: 8, status: "ready", company_id: 11, company_name: "Mason Demo" },
            files: [{ id: 1, original_name: "a.pdf", status: "uploaded" }],
          },
        });
      }
      return Promise.resolve({
        data: {
          job: { id: 7, status: "draft", company_id: null },
          files: [],
        },
      });
    });
  });

  it("senza azienda sul job disabilita carica / estrai / screening e lascia Annulla visibile", async () => {
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    await waitFor(() => expect(screen.getByText("Job senza azienda")).toBeInTheDocument());
    await user.click(screen.getByText("Job senza azienda"));
    await waitFor(() => expect(screen.getByText("Job #7")).toBeInTheDocument());

    const pdfLabel = screen.getByText("Carica PDF").closest("label");
    const folderLabel = screen.getByText("Carica cartella").closest("label");
    expect(pdfLabel).toHaveAttribute("title", COMPANY_REQUIRED_UPLOAD_TITLE);
    expect(folderLabel).toHaveAttribute("title", COMPANY_REQUIRED_UPLOAD_TITLE);
    expect(pdfLabel.querySelector("input")).toBeDisabled();
    expect(folderLabel.querySelector("input")).toBeDisabled();

    const estrai = screen.getByRole("button", { name: "Estrai testo" });
    const screening = screen.getByRole("button", { name: "Screening e posa" });
    expect(estrai).toBeDisabled();
    expect(screening).toBeDisabled();
    expect(estrai).toHaveAttribute("title", COMPANY_REQUIRED_UPLOAD_TITLE);
    expect(screening).toHaveAttribute("title", COMPANY_REQUIRED_UPLOAD_TITLE);

    const annulla = screen.getByRole("button", { name: "Annulla caricamento" });
    expect(annulla).toBeInTheDocument();
    expect(annulla).not.toBeDisabled();
  });

  it("con azienda sul job abilita carica / estrai / screening", async () => {
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    await waitFor(() => expect(screen.getByText("Job Mason")).toBeInTheDocument());
    await user.click(screen.getByText("Job Mason"));
    await waitFor(() => expect(screen.getByText("Job #8")).toBeInTheDocument());

    const pdfLabel = screen.getByText("Carica PDF").closest("label");
    expect(pdfLabel.querySelector("input")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Estrai testo" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Screening e posa" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Annulla caricamento" })).toBeInTheDocument();
  });

  it("Ambito Tutto lo studio non precompila e blocca + Nuovo job", async () => {
    render(<ImportJobsPage />);
    const createBtn = await screen.findByRole("button", { name: "+ Nuovo job" });
    expect(createBtn).toBeDisabled();
    expect(createBtn).toHaveAttribute("title", COMPANY_REQUIRED_UPLOAD_TITLE);
    expect(screen.getByRole("option", { name: "Azienda cliente (obbligatoria)" }).selected).toBe(true);
  });

  it("precompila l'azienda dal CompanyScope se è un cliente (non studio)", async () => {
    scopeState.companyId = "11";
    scopeState.isStudioWide = false;
    scopeState.scopeCompanyName = "Mason Demo";
    render(<ImportJobsPage />);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Mason Demo" }).selected).toBe(true);
    });
    expect(screen.getByRole("button", { name: "+ Nuovo job" })).not.toBeDisabled();
  });

  it("Ambito Patrimonio (studio) non precompila l'id omonimo", async () => {
    scopeState.companyId = "studio";
    scopeState.isStudioWide = false;
    scopeState.isStudioPatrimonio = true;
    scopeState.scopeCompanyName = "Patrimonio dello studio";
    render(<ImportJobsPage />);
    const createBtn = await screen.findByRole("button", { name: "+ Nuovo job" });
    expect(createBtn).toBeDisabled();
    expect(screen.getByRole("option", { name: "Azienda cliente (obbligatoria)" }).selected).toBe(true);
  });
});
