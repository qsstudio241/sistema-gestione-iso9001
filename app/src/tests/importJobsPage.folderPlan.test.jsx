/**
 * @vitest-environment jsdom
 *
 * Piano di carico: picker cartella non uploada subito; conferma → lotti da 80.
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

describe("ImportJobsPage — piano di carico cartella", () => {
  beforeEach(() => {
    apiService.createImportJob.mockReset();
    apiService.uploadImportJobFiles.mockReset();
    apiService.getCompanies.mockResolvedValue({ data: [{ id: 11, name: "Mason Demo" }] });
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
              ? [{ id: 1, original_name: "a.pdf", status: "uploaded" }]
              : [{ id: 9, original_name: "b.pdf", status: "uploaded" }],
        },
      })
    );
    apiService.createImportJob.mockResolvedValue({ data: { id: 22 } });
    apiService.uploadImportJobFiles.mockResolvedValue({ data: {} });
  });

  async function openMasonJob() {
    const user = userEvent.setup();
    render(<ImportJobsPage />);
    await waitFor(() => expect(screen.getByText("Job Mason")).toBeInTheDocument());
    await user.click(screen.getByText("Job Mason"));
    await waitFor(() => expect(screen.getByText("Job #8")).toBeInTheDocument());
    return user;
  }

  it("dopo il picker mostra il piano e NON chiama upload", async () => {
    await openMasonJob();
    pickFolder([
      relFile("Documenti/Capitolati/rfq.pdf", 2 * 1024 * 1024),
      relFile("Documenti/Scan/pagina.jpg", 5 * 1024 * 1024),
    ]);
    expect(await screen.findByText("Piano di carico — Documenti")).toBeInTheDocument();
    expect(screen.getByText("Capitolati")).toBeInTheDocument();
    expect(screen.getByText("Probabile: capitolato (dal nome)")).toBeInTheDocument();
    expect(screen.getByText("Da classificare")).toBeInTheDocument();
    expect(screen.getByText(/Servono 2 lotti da 80/)).toBeInTheDocument();
    expect(apiService.uploadImportJobFiles).not.toHaveBeenCalled();
    expect(apiService.createImportJob).not.toHaveBeenCalled();
  });

  it("Annulla piano chiude senza upload", async () => {
    const user = await openMasonJob();
    pickFolder([relFile("Documenti/Capitolati/rfq.pdf")]);
    expect(await screen.findByText("Piano di carico — Documenti")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Annulla piano" }));
    expect(screen.queryByText(/Piano di carico/)).not.toBeInTheDocument();
    expect(apiService.uploadImportJobFiles).not.toHaveBeenCalled();
  });

  it("conferma carica i lotti in ordine (capitolato prima) e crea job nuovi", async () => {
    const user = await openMasonJob();
    pickFolder([
      relFile("Documenti/Scan/pagina.jpg"),
      relFile("Documenti/Capitolati/rfq.pdf"),
    ]);
    await screen.findByText("Piano di carico — Documenti");
    await user.click(screen.getByRole("button", { name: "Carica i lotti selezionati" }));
    await waitFor(() => {
      expect(apiService.createImportJob).toHaveBeenCalled();
      expect(apiService.uploadImportJobFiles).toHaveBeenCalled();
    });
    const titles = apiService.createImportJob.mock.calls.map((c) => c[0].title);
    expect(titles[0]).toMatch(/Capitolati/);
    expect(apiService.createImportJob.mock.calls[0][0].company_id).toBe(11);
    expect(apiService.createImportJob.mock.calls[0][0].document_type_hint).toBe("capitolato");
    const firstUploadFiles = apiService.uploadImportJobFiles.mock.calls[0][1];
    expect(firstUploadFiles[0].webkitRelativePath).toMatch(/Capitolati/);
  });

  it("job vuoto: il primo lotto crea comunque title + hint capitolato (stessa azienda)", async () => {
    apiService.getImportJobs.mockResolvedValue({
      data: [
        {
          id: 8,
          title: "Job Mason",
          status: "draft",
          file_count: 0,
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
            status: "draft",
            company_id: 11,
            company_name: "Mason Demo",
          },
          files: Number(id) === 8 ? [] : [{ id: 9, original_name: "b.pdf", status: "uploaded" }],
        },
      })
    );
    apiService.createImportJob
      .mockResolvedValueOnce({ data: { id: 31 } })
      .mockResolvedValueOnce({ data: { id: 32 } });

    const user = await openMasonJob();
    pickFolder([
      relFile("Documenti/Scan/pagina.jpg"),
      relFile("Documenti/Capitolati/rfq.pdf"),
    ]);
    await screen.findByText("Piano di carico — Documenti");
    await user.click(screen.getByRole("button", { name: "Carica i lotti selezionati" }));
    await waitFor(() => {
      expect(apiService.createImportJob).toHaveBeenCalled();
      expect(apiService.uploadImportJobFiles).toHaveBeenCalled();
    });
    expect(apiService.createImportJob.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        title: "Documenti / Capitolati",
        document_type_hint: "capitolato",
        company_id: 11,
      })
    );
    expect(apiService.uploadImportJobFiles.mock.calls[0][0]).toBe(31);
    const firstUploadFiles = apiService.uploadImportJobFiles.mock.calls[0][1];
    expect(firstUploadFiles[0].webkitRelativePath).toMatch(/Capitolati/);
  });

  it("cambio job: il piano sparisce e non carica sull'altra azienda", async () => {
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
          company_id: 22,
          company_name: "Camellini",
        },
      ],
    });
    apiService.getImportJob.mockImplementation((id) =>
      Promise.resolve({
        data: {
          job: {
            id: Number(id),
            status: "ready",
            company_id: Number(id) === 8 ? 11 : 22,
            company_name: Number(id) === 8 ? "Mason Demo" : "Camellini",
          },
          files: [{ id: Number(id), original_name: "x.pdf", status: "uploaded" }],
        },
      })
    );

    const user = userEvent.setup();
    render(<ImportJobsPage />);
    await waitFor(() => expect(screen.getByText("Job Mason")).toBeInTheDocument());
    await user.click(screen.getByText("Job Mason"));
    await waitFor(() => expect(screen.getByText("Job #8")).toBeInTheDocument());
    pickFolder([relFile("Documenti/Capitolati/rfq.pdf")]);
    expect(await screen.findByText("Piano di carico — Documenti")).toBeInTheDocument();

    await user.click(screen.getByText("Job Camellini"));
    await waitFor(() => expect(screen.getByText("Job #9")).toBeInTheDocument());
    expect(screen.queryByText(/Piano di carico/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carica i lotti selezionati" })).not.toBeInTheDocument();
    expect(apiService.createImportJob).not.toHaveBeenCalled();
    expect(apiService.uploadImportJobFiles).not.toHaveBeenCalled();
  });

  it("cambio job: picker disabled finché il dettaglio nuovo non è pronto (niente company di A)", async () => {
    let releaseB;
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
          company_id: 22,
          company_name: "Camellini",
        },
      ],
    });
    apiService.getImportJob.mockImplementation((id) => {
      if (Number(id) === 9) {
        return new Promise((resolve) => {
          releaseB = () =>
            resolve({
              data: {
                job: {
                  id: 9,
                  status: "ready",
                  company_id: 22,
                  company_name: "Camellini",
                },
                files: [{ id: 9, original_name: "x.pdf", status: "uploaded" }],
              },
            });
        });
      }
      return Promise.resolve({
        data: {
          job: {
            id: 8,
            status: "ready",
            company_id: 11,
            company_name: "Mason Demo",
          },
          files: [{ id: 1, original_name: "a.pdf", status: "uploaded" }],
        },
      });
    });

    const user = userEvent.setup();
    render(<ImportJobsPage />);
    await waitFor(() => expect(screen.getByText("Job Mason")).toBeInTheDocument());
    await user.click(screen.getByText("Job Mason"));
    await waitFor(() => expect(screen.getByText("Job #8")).toBeInTheDocument());

    await user.click(screen.getByText("Job Camellini"));
    expect(await screen.findByText("Caricamento dettaglio…")).toBeInTheDocument();
    expect(screen.queryByText("Job #8")).not.toBeInTheDocument();

    const folderLabel = screen.getByText("Carica cartella").closest("label");
    const folderInput = folderLabel.querySelector("input");
    expect(folderInput).toBeDisabled();
    expect(folderLabel).toHaveAttribute("title", "Attendi il dettaglio del job selezionato");
    expect(screen.getByRole("button", { name: "Estrai testo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Annulla caricamento" })).toBeDisabled();

    pickFolder([relFile("Documenti/Capitolati/rfq.pdf")]);
    expect(screen.queryByText(/Piano di carico/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carica i lotti selezionati" })).not.toBeInTheDocument();
    expect(apiService.createImportJob).not.toHaveBeenCalled();

    releaseB();
    await waitFor(() => expect(screen.getByText("Job #9")).toBeInTheDocument());
    await waitFor(() => {
      const readyInput = screen.getByText("Carica cartella").closest("label").querySelector("input");
      expect(readyInput).not.toBeDisabled();
    });

    pickFolder([relFile("Documenti/Capitolati/rfq.pdf")]);
    expect(await screen.findByText("Piano di carico — Documenti")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Carica i lotti selezionati" }));
    await waitFor(() => expect(apiService.createImportJob).toHaveBeenCalled());
    expect(apiService.createImportJob.mock.calls[0][0].company_id).toBe(22);
    expect(apiService.createImportJob.mock.calls[0][0].company_id).not.toBe(11);
  });

  it("Annulla durante l'upload ferma i lotti successivi", async () => {
    let releaseFirst;
    apiService.uploadImportJobFiles
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = () => resolve({ data: {} });
          })
      )
      .mockResolvedValue({ data: {} });
    const user = await openMasonJob();
    pickFolder([
      relFile("Documenti/Capitolati/rfq.pdf"),
      relFile("Documenti/Scan/pagina.jpg"),
    ]);
    await screen.findByText("Piano di carico — Documenti");
    await user.click(screen.getByRole("button", { name: "Carica i lotti selezionati" }));
    expect(await screen.findByText(/Lotto 1\/2 — Capitolati/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Annulla$/ }));
    releaseFirst();
    await waitFor(() => {
      expect(screen.getByText(/I file già caricati restano/)).toBeInTheDocument();
    });
    expect(apiService.uploadImportJobFiles).toHaveBeenCalledTimes(1);
  });
});
