/**
 * @vitest-environment jsdom
 *
 * Import PDF: banner busy P0 immediato + progresso per file (stesso folderUpload).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const scopeState = {
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

function relFile(rel, bytes = 1024) {
  const name = String(rel).split("/").pop();
  const file = new File([new Uint8Array(Math.min(bytes, 8))], name);
  Object.defineProperty(file, "webkitRelativePath", { value: rel });
  Object.defineProperty(file, "size", { value: bytes });
  return file;
}

function pickFolder(files) {
  const folderLabel = screen.getByText("Carica cartella").closest("label");
  const input = folderLabel.querySelector("input");
  fireEvent.change(input, { target: { files } });
}

describe("ImportJobsPage — busy P0 + progresso per file", () => {
  beforeEach(() => {
    scopeState.companyId = "11";
    scopeState.isStudioWide = false;
    scopeState.isStudioPatrimonio = false;
    scopeState.companyScoped = true;
    scopeState.scopeCompanyName = "Mason Demo";
    apiService.createImportJob.mockReset();
    apiService.uploadImportJobFiles.mockReset();
    apiService.processImportJob.mockReset();
    apiService.getCompanies.mockResolvedValue({
      data: [{ id: 11, name: "Mason Demo" }],
    });
    apiService.getImportJobs.mockResolvedValue({
      data: [
        {
          id: 8,
          title: "Job Mason",
          status: "ready",
          file_count: 2,
          company_id: 11,
          company_name: "Mason Demo",
        },
        {
          id: 9,
          title: "Job Camellini",
          status: "ready",
          file_count: 1,
          company_id: 11,
          company_name: "Mason Demo",
        },
      ],
    });
    apiService.getImportJob.mockImplementation((id) =>
      Promise.resolve({
        data: {
          job: {
            id: Number(id) || 8,
            status: "ready",
            company_id: 11,
            company_name: "Mason Demo",
          },
          files:
            Number(id) === 8
              ? [
                  { id: 1, original_name: "a.pdf", status: "uploaded" },
                  { id: 2, original_name: "b.pdf", status: "uploaded" },
                ]
              : [{ id: 9, original_name: "c.pdf", status: "uploaded" }],
        },
      })
    );
    apiService.createImportJob.mockResolvedValue({ data: { id: 22 } });
    apiService.uploadImportJobFiles.mockResolvedValue({ data: {} });
    apiService.processImportJob.mockResolvedValue({ data: {} });
  });

  async function openMasonJob() {
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    await waitFor(() => expect(screen.getByText("Job Mason")).toBeInTheDocument());
    await user.click(screen.getByText("Job Mason"));
    await waitFor(() => expect(screen.getByText("Job #8")).toBeInTheDocument());
    return user;
  }

  it("Estrai testo: banner busy immediato, lista file, job non cliccabile", async () => {
    let releaseProcess;
    apiService.processImportJob.mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseProcess = () => resolve({ data: {} });
        })
    );

    const user = await openMasonJob();
    await user.click(screen.getByRole("button", { name: "Estrai testo" }));

    expect(
      await screen.findByRole("status", { name: /Operazione in corso: il job non è modificabile/ })
    ).toBeInTheDocument();
    expect(screen.getByText("Estrazione testo in corso…")).toBeInTheDocument();
    const progress = screen.getByRole("region", { name: "Progresso per file" });
    expect(progress).toHaveTextContent("a.pdf");
    expect(progress).toHaveTextContent("b.pdf");
    expect(progress).toHaveTextContent("In corso");
    expect(screen.getByRole("button", { name: /Job Mason/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Job Camellini/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Estrai testo" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Titolo (opzionale)")).toBeDisabled();

    releaseProcess();
    await waitFor(() => {
      expect(screen.queryByRole("status", { name: /Operazione in corso/ })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Job Camellini/ })).not.toBeDisabled();
  });

  it("carica cartella: durante i lotti mostra ogni file (fatto / in corso / in attesa)", async () => {
    let releaseFirst;
    apiService.uploadImportJobFiles.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = () => resolve({ data: {} });
        })
    );

    const user = await openMasonJob();
    pickFolder([
      relFile("Documenti/Capitolati/rfq.pdf"),
      relFile("Documenti/Scan/pagina.jpg"),
    ]);
    await screen.findByText("Piano di carico — Documenti");
    await user.click(screen.getByRole("button", { name: "Carica i lotti selezionati" }));

    expect(
      await screen.findByRole("status", { name: /Operazione in corso: il job non è modificabile/ })
    ).toBeInTheDocument();
    expect(await screen.findByText(/Lotto 1\/2 — Capitolati/)).toBeInTheDocument();
    const progress = screen.getByRole("region", { name: "Progresso per file" });
    expect(progress).toBeInTheDocument();
    expect(progress).toHaveTextContent("Documenti/Capitolati/rfq.pdf");
    expect(progress).toHaveTextContent("Documenti/Scan/pagina.jpg");
    expect(progress).toHaveTextContent("In corso");
    expect(progress).toHaveTextContent("In attesa");
    expect(screen.getByRole("button", { name: /Job Camellini/ })).toBeDisabled();

    releaseFirst();
    await waitFor(() => {
      expect(apiService.uploadImportJobFiles).toHaveBeenCalled();
    });
  });

  it("upload PDF multi-file: primo fatto, secondo in corso", async () => {
    let releaseFirst;
    apiService.uploadImportJobFiles
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = () => resolve({ data: {} });
          })
      )
      .mockResolvedValue({ data: {} });

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await openMasonJob();
    const dropzone = screen.getByRole("button", { name: "Carica PDF" });
    const input = dropzone.querySelector("input[type='file']");
    const f1 = new File([new Uint8Array(4)], "uno.pdf", { type: "application/pdf" });
    const f2 = new File([new Uint8Array(4)], "due.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [f1, f2] } });

    expect(
      await screen.findByRole("status", { name: /Operazione in corso: il job non è modificabile/ })
    ).toBeInTheDocument();
    const progress = await screen.findByRole("region", { name: "Progresso per file" });
    expect(progress).toHaveTextContent("uno.pdf");
    expect(progress).toHaveTextContent("due.pdf");
    expect(progress).toHaveTextContent("In corso");
    expect(progress).toHaveTextContent("In attesa");
    expect(screen.getByRole("button", { name: /Job Camellini/ })).toBeDisabled();

    releaseFirst();
    await waitFor(() => {
      expect(apiService.uploadImportJobFiles).toHaveBeenCalledTimes(2);
    });
    expect(apiService.uploadImportJobFiles.mock.calls[0][1]).toHaveLength(1);
    expect(apiService.uploadImportJobFiles.mock.calls[1][1]).toHaveLength(1);
    window.confirm.mockRestore();
  });
});
