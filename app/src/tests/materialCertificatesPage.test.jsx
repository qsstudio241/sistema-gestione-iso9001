/**
 * @vitest-environment jsdom
 * L1 MC-5 — UI certificati materiale.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const scopeState = {
  companyId: "",
  scopeCompanyName: "Tutto lo studio",
};

const routerState = {
  path: "/saldatura/materiali",
  navigate: vi.fn(),
};

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../contexts/RouterContext", () => ({
  useRouter: () => routerState,
  useNavigate: () => routerState.navigate,
}));

vi.mock("../services/apiService", () => ({
  default: {
    baseUrl: "https://example.test/api/v1",
    getMaterialCertificates: vi.fn(),
    getMaterialCertificate: vi.fn(),
    createMaterialCertificate: vi.fn(),
    extractMaterialCertificate: vi.fn(),
    evaluateMaterialCertificate: vi.fn(),
    approveMaterialCertificate: vi.fn(),
    rejectMaterialCertificate: vi.fn(),
    archiveMaterialCertificate: vi.fn(),
    patchMaterialCertificate: vi.fn(),
  },
}));

import apiService from "../services/apiService";
import MaterialCertificatesPage from "../pages/MaterialCertificatesPage";

const ROW = {
  id: 11,
  ddt_no: "DDT-1",
  certificate_no: "MTC-11",
  material_role: "base",
  designation: "S355J2",
  workflow_status: "pending_review",
  checks: [],
};

describe("MaterialCertificatesPage (MC-5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeState.companyId = "";
    scopeState.scopeCompanyName = "Tutto lo studio";
    routerState.path = "/saldatura/materiali";
    apiService.getMaterialCertificates.mockResolvedValue({ data: [ROW] });
    apiService.getMaterialCertificate.mockResolvedValue({ data: ROW });
  });

  it("Carica certificato resta visibile ma disabled senza azienda in Ambito", async () => {
    render(<MaterialCertificatesPage />);
    const btn = await screen.findByRole("button", { name: "Carica certificato" });
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(btn).toHaveAttribute("title", "Seleziona un\u2019azienda in Ambito");
  });

  it("Approva conforme non parte da sola: serve il click", async () => {
    scopeState.companyId = "3";
    routerState.path = "/saldatura/materiali/11";
    render(<MaterialCertificatesPage />);
    const approve = await screen.findByTestId("mc-approve");
    expect(approve).toBeEnabled();
    expect(apiService.approveMaterialCertificate).not.toHaveBeenCalled();
    await userEvent.click(approve);
    await waitFor(() => {
      expect(apiService.approveMaterialCertificate).toHaveBeenCalledWith(11);
    });
  });

  it("upload di default invia materialRole base", async () => {
    scopeState.companyId = "3";
    apiService.createMaterialCertificate.mockResolvedValue({ data: { id: 12 } });
    const { container } = render(<MaterialCertificatesPage />);
    await screen.findByRole("button", { name: "Carica certificato" });
    const input = container.querySelector('input[type="file"]');
    const file = new File(["%PDF-1.4"], "lamiera.pdf", { type: "application/pdf" });
    await userEvent.upload(input, file);
    await waitFor(() => {
      expect(apiService.createMaterialCertificate).toHaveBeenCalledWith({
        companyId: "3",
        file,
        materialRole: "base",
      });
    });
  });

  it("scelta Apporto in header invia filler; il filtro KPI non cambia l'upload", async () => {
    scopeState.companyId = "3";
    apiService.createMaterialCertificate.mockResolvedValue({ data: { id: 13 } });
    const { container } = render(<MaterialCertificatesPage />);
    await screen.findByRole("button", { name: "Carica certificato" });

    const filterApporto = screen.getByRole("button", { name: /Apporto$/ });
    await userEvent.click(filterApporto);
    expect(screen.getByRole("radio", { name: "Base" })).toHaveAttribute("aria-checked", "true");

    await userEvent.click(screen.getByRole("radio", { name: "Apporto" }));
    expect(screen.getByRole("radio", { name: "Apporto" })).toHaveAttribute("aria-checked", "true");

    const input = container.querySelector('input[type="file"]');
    const file = new File(["%PDF-1.4"], "filo.pdf", { type: "application/pdf" });
    await userEvent.upload(input, file);
    await waitFor(() => {
      expect(apiService.createMaterialCertificate).toHaveBeenCalledWith({
        companyId: "3",
        file,
        materialRole: "filler",
      });
    });
  });

  it("Valuta resta visibile ma disabled su DDT", async () => {
    routerState.path = "/saldatura/materiali/11";
    apiService.getMaterialCertificate.mockResolvedValue({
      data: {
        ...ROW,
        workflow_status: "extracted",
        ddt_no: "000775RE",
        certificate_no: null,
        extracted_json: { document_kind: "delivery_note", ddt_no: "000775RE" },
      },
    });
    render(<MaterialCertificatesPage />);
    expect(await screen.findByRole("heading", { name: "DDT 000775RE" })).toBeInTheDocument();
    expect(screen.getByText(/Documento di trasporto \(DDT\)/)).toBeInTheDocument();
    const valuta = screen.getByRole("button", { name: "Valuta" });
    expect(valuta).toBeVisible();
    expect(valuta).toBeDisabled();
    expect(valuta).toHaveAttribute("title", expect.stringMatching(/DDT/));
  });

  it("anteprima PDF usa file_url web, non il path disco", async () => {
    routerState.path = "/saldatura/materiali/11";
    apiService.getMaterialCertificate.mockResolvedValue({
      data: {
        ...ROW,
        storage_path: "/var/www/sgq-backend/uploads/material-certificates/1001/a.pdf",
        file_url: "/uploads/material-certificates/1001/a.pdf",
      },
    });
    render(<MaterialCertificatesPage />);
    const iframe = await screen.findByTitle("Anteprima certificato");
    expect(iframe.getAttribute("src")).toBe(
      "https://example.test/uploads/material-certificates/1001/a.pdf"
    );
    expect(iframe.getAttribute("src")).not.toContain("/var/www");
  });
});
