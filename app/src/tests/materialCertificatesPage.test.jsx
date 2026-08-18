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
    expect(btn).toBeDisabled();
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
});
