/**
 * Test L1  CompaniesPage azioni di riga a icone
 *
 * Verifica che ogni riga azienda esponga i due pulsanti icona
 * (matita = apri scheda, cestino = elimina), che il "Modifica" testuale
 * sia stato rimosso, e che gli handler di navigazione/eliminazione
 * vengano invocati correttamente.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CompaniesPage from "../components/CompaniesPage";

const mockNavigate = vi.fn();

vi.mock("../contexts/RouterContext", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { role: "auditor", auditor_org_id: 1 },
  }),
}));

vi.mock("../utils/companyAccess", () => ({
  hasCompanyAccess: () => false,
  canEditCompany: () => true,
}));

vi.mock("../hooks/useCompanyLogoUrl", () => ({
  useCompanyLogoUrl: () => null,
}));

const mockGetCompanies = vi.fn();
const mockGetAuditorOrgs = vi.fn();
const mockDeleteCompany = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getCompanies: (...args) => mockGetCompanies(...args),
    getAuditorOrgs: (...args) => mockGetAuditorOrgs(...args),
    deleteCompany: (...args) => mockDeleteCompany(...args),
    getCompanyLogoUrl: (id) => `https://api.test/companies/${id}/logo`,
  },
}));

describe("CompaniesPage  azioni di riga a icone", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockDeleteCompany.mockReset().mockResolvedValue({});
    mockGetAuditorOrgs.mockResolvedValue({ data: [] });
    mockGetCompanies.mockResolvedValue({
      data: [{ id: 42, name: "Acme Srl", vat_number: "IT123", sector: "Metal" }],
    });
  });

  it("mostra i pulsanti icona matita ed elimina, senza il testuale Modifica", async () => {
    render(<CompaniesPage onBack={() => {}} />);

    await screen.findByRole("button", { name: "Apri scheda azienda" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Apri scheda azienda" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Elimina" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Apri scheda azienda" }).querySelector("svg")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Modifica" })).toBeNull();
  });

  it("il pulsante matita naviga alla scheda /companies/:id", async () => {
    render(<CompaniesPage onBack={() => {}} />);

    await screen.findByRole("button", { name: "Apri scheda azienda" });
    fireEvent.click(screen.getByRole("button", { name: "Apri scheda azienda" }));

    expect(mockNavigate).toHaveBeenCalledWith("/companies/42");
  });

  it("il pulsante cestino innesca il flusso di eliminazione", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<CompaniesPage onBack={() => {}} />);

    await screen.findByRole("button", { name: "Elimina" });
    fireEvent.click(screen.getByRole("button", { name: "Elimina" }));

    await waitFor(() => {
      expect(mockDeleteCompany).toHaveBeenCalledWith(42);
    });
    confirmSpy.mockRestore();
  });
});
