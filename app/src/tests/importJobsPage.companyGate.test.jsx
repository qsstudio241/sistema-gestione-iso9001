/**
 * @vitest-environment jsdom
 *
 * Import PDF: un solo controllo azienda (Ambito). Senza cliente i pulsanti
 * restano visibili ma disabled. Nessuna tendina «Azienda cliente» sul job.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  COMPANY_REQUIRED_UPLOAD_TITLE,
  AMBITO_JOB_MISMATCH_TITLE,
} from "../utils/importFolderUpload";

const scopeState = {
  companyId: "",
  setCompanyId: () => {},
  companies: [{ id: 11, name: "Mason Demo" }, { id: 22, name: "Camellini" }],
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

function expectNoJobCompanySelect() {
  expect(screen.queryByRole("option", { name: "Azienda cliente (obbligatoria)" })).toBeNull();
  expect(screen.queryByText("Azienda cliente (obbligatoria)")).toBeNull();
}

describe("ImportJobsPage — gate azienda cliente", () => {
  beforeEach(() => {
    scopeState.companyId = "";
    scopeState.isStudioWide = true;
    scopeState.isStudioPatrimonio = false;
    scopeState.companyScoped = false;
    scopeState.scopeCompanyName = "Tutto lo studio";
    apiService.createImportJob.mockReset();
    apiService.uploadImportJobFiles.mockReset();
    apiService.deleteImportJob.mockReset();
    apiService.getCompanies.mockResolvedValue({
      data: [
        { id: 11, name: "Mason Demo" },
        { id: 22, name: "Camellini" },
      ],
    });
    apiService.getImportJobs.mockResolvedValue({
      data: [
        { id: 7, title: "Job senza azienda", status: "draft", file_count: 0, company_id: null },
        { id: 8, title: "Job Mason", status: "ready", file_count: 2, company_id: 11, company_name: "Mason Demo" },
        { id: 9, title: "Job Camellini", status: "ready", file_count: 1, company_id: 22, company_name: "Camellini" },
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
      if (Number(id) === 9) {
        return Promise.resolve({
          data: {
            job: { id: 9, status: "ready", company_id: 22, company_name: "Camellini" },
            files: [{ id: 2, original_name: "b.pdf", status: "uploaded" }],
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

    const pdfZone = screen.getByRole("button", { name: "Carica PDF" });
    const folderLabel = screen.getByText("Carica cartella").closest("label");
    expect(pdfZone).toHaveAttribute("title", COMPANY_REQUIRED_UPLOAD_TITLE);
    expect(folderLabel).toHaveAttribute("title", COMPANY_REQUIRED_UPLOAD_TITLE);
    expect(pdfZone.querySelector("input")).toBeDisabled();
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
    expectNoJobCompanySelect();
  });

  it("Ambito azienda + stessa company sul job abilita carica / estrai / screening", async () => {
    scopeState.companyId = "11";
    scopeState.isStudioWide = false;
    scopeState.isStudioPatrimonio = false;
    scopeState.companyScoped = true;
    scopeState.scopeCompanyName = "Mason Demo";
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    await waitFor(() => expect(screen.getByText("Job Mason")).toBeInTheDocument());
    await user.click(screen.getByText("Job Mason"));
    await waitFor(() => expect(screen.getByText("Job #8")).toBeInTheDocument());

    const pdfZone = screen.getByRole("button", { name: "Carica PDF" });
    expect(pdfZone.querySelector("input")).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Estrai testo" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Screening e posa" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Annulla caricamento" })).toBeInTheDocument();
    expectNoJobCompanySelect();
  });

  it("Ambito Tutto lo studio: + Nuovo job e upload disabled, alert visibile, nessun create", async () => {
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    const createBtn = await screen.findByRole("button", { name: "+ Nuovo job" });
    expect(createBtn).toBeDisabled();
    expect(createBtn).toHaveAttribute("title", COMPANY_REQUIRED_UPLOAD_TITLE);
    expect(screen.getAllByText(COMPANY_REQUIRED_UPLOAD_TITLE).length).toBeGreaterThanOrEqual(1);
    expectNoJobCompanySelect();

    await waitFor(() => expect(screen.getByText("Job Mason")).toBeInTheDocument());
    await user.click(screen.getByText("Job Mason"));
    await waitFor(() => expect(screen.getByText("Job #8")).toBeInTheDocument());
    const pdfZone = screen.getByRole("button", { name: "Carica PDF" });
    expect(pdfZone.querySelector("input")).toBeDisabled();
    expect(pdfZone).toHaveAttribute("title", COMPANY_REQUIRED_UPLOAD_TITLE);
    expect(screen.getByText("Carica cartella").closest("label").querySelector("input")).toBeDisabled();

    await user.click(createBtn);
    expect(apiService.createImportJob).not.toHaveBeenCalled();
    expect(apiService.uploadImportJobFiles).not.toHaveBeenCalled();
  });

  it("Ambito Patrimonio: + Nuovo job e upload disabled, alert visibile, nessun create", async () => {
    scopeState.companyId = "studio";
    scopeState.isStudioWide = false;
    scopeState.isStudioPatrimonio = true;
    scopeState.scopeCompanyName = "Patrimonio dello studio";
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    const createBtn = await screen.findByRole("button", { name: "+ Nuovo job" });
    expect(createBtn).toBeDisabled();
    expect(createBtn).toHaveAttribute("title", COMPANY_REQUIRED_UPLOAD_TITLE);
    expect(screen.getAllByText(COMPANY_REQUIRED_UPLOAD_TITLE).length).toBeGreaterThanOrEqual(1);
    expectNoJobCompanySelect();

    await waitFor(() => expect(screen.getByText("Job Mason")).toBeInTheDocument());
    await user.click(screen.getByText("Job Mason"));
    await waitFor(() => expect(screen.getByText("Job #8")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Carica PDF" }).querySelector("input")).toBeDisabled();
    await user.click(createBtn);
    expect(apiService.createImportJob).not.toHaveBeenCalled();
  });

  it("Ambito company 11: create usa company_id 11 e nessuna tendina Azienda cliente", async () => {
    scopeState.companyId = "11";
    scopeState.isStudioWide = false;
    scopeState.isStudioPatrimonio = false;
    scopeState.companyScoped = true;
    scopeState.scopeCompanyName = "Mason Demo";
    apiService.createImportJob.mockResolvedValue({ data: { id: 99 } });
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    const createBtn = await screen.findByRole("button", { name: "+ Nuovo job" });
    expect(createBtn).not.toBeDisabled();
    expectNoJobCompanySelect();
    await user.click(createBtn);
    await waitFor(() => {
      expect(apiService.createImportJob).toHaveBeenCalled();
    });
    expect(apiService.createImportJob.mock.calls[0][0].company_id).toBe(11);
    expect(screen.getByRole("button", { name: "+ Nuovo job" })).not.toBeDisabled();
    expectNoJobCompanySelect();
  });

  it("Ambito diverso dalla company del job: upload disabled e alert mismatch", async () => {
    scopeState.companyId = "11";
    scopeState.isStudioWide = false;
    scopeState.isStudioPatrimonio = false;
    scopeState.companyScoped = true;
    scopeState.scopeCompanyName = "Mason Demo";
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    await waitFor(() => expect(screen.getByText("Job Camellini")).toBeInTheDocument());
    await user.click(screen.getByText("Job Camellini"));
    await waitFor(() => expect(screen.getByText("Job #9")).toBeInTheDocument());

    expect(screen.getByText(AMBITO_JOB_MISMATCH_TITLE)).toBeInTheDocument();
    const pdfZone = screen.getByRole("button", { name: "Carica PDF" });
    expect(pdfZone.querySelector("input")).toBeDisabled();
    expect(pdfZone).toHaveAttribute("title", AMBITO_JOB_MISMATCH_TITLE);
    expect(screen.getByText("Carica cartella").closest("label").querySelector("input")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Estrai testo" })).not.toBeDisabled();
    expectNoJobCompanySelect();
  });

  it("Annulla caricamento avvisa che i file già posati restano", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    await waitFor(() => expect(screen.getByText("Job Mason")).toBeInTheDocument());
    await user.click(screen.getByText("Job Mason"));
    await waitFor(() => expect(screen.getByText("Job #8")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Annulla caricamento" }));
    expect(confirmSpy).toHaveBeenCalled();
    const msg = String(confirmSpy.mock.calls[0][0]);
    expect(msg).toMatch(/già posati nello scaffale restano/i);
    expect(msg).toMatch(/file non ancora posati/i);
    expect(apiService.deleteImportJob).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
