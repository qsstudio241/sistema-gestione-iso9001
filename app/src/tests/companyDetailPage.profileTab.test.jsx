import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyDetailPage from "../pages/CompanyDetailPage";

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("../contexts/RouterContext", () => ({
  useRouter: () => ({ path: "/companies/42" }),
  useNavigate: () => mockNavigate,
  Link: ({ to, children, className, ...props }) => (
    <a href={to} className={className} {...props}>{children}</a>
  ),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../components/CompanyPersonnelPanel", () => ({
  default: () => <div data-testid="personnel-panel">Personale mock</div>,
}));

vi.mock("../components/CompanyCounterpartiesPanel", () => ({
  default: () => <div data-testid="counterparties-panel">Controparti mock</div>,
}));

const mockGetCompany = vi.fn();
const mockGetCompanyProfile = vi.fn();
const mockUpdateCompanyProfile = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getCompany: (...args) => mockGetCompany(...args),
    getCompanyLogoUrl: (id) => `https://api.test/companies/${id}/logo`,
    updateCompany: vi.fn(),
    uploadCompanyLogo: vi.fn(),
    getCompanyProfile: (...args) => mockGetCompanyProfile(...args),
    updateCompanyProfile: (...args) => mockUpdateCompanyProfile(...args),
    detectCompanyProfileImport: vi.fn(),
    importCompanyProfile: vi.fn(),
    downloadCompanyProfileTemplate: vi.fn(),
    lookupCompanyProfile: vi.fn(),
  },
}));

function companyPayload() {
  return {
    data: {
      id: 42,
      name: "Acme Srl",
      vat_number: "IT123",
      sector: "Metal",
      address: "Via Roma 1",
    },
  };
}

describe("CompanyDetailPage tab Profilo conformita", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetCompany.mockReset();
    mockGetCompanyProfile.mockReset();
    mockUpdateCompanyProfile.mockReset();
    mockGetCompany.mockResolvedValue(companyPayload());
    mockGetCompanyProfile.mockResolvedValue({
      data: {
        exists: false,
        legal_name: "Acme Srl",
        vat_number: "IT123",
        ateco_primary: null,
        seededFromAnagrafica: ["legal_name", "vat_number"],
        address_anagrafica: "Via Roma 1",
      },
    });
  });

  it("nasconde la tab se capability OFF (niente ai_norms)", async () => {
    mockUseAuth.mockReturnValue({
      user: { role: "auditor", auditor_org_id: 1, licensed_modules: ["audit"] },
    });
    render(<CompanyDetailPage />);
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Acme Srl" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("tab", { name: /Profilo conformit/i })).not.toBeInTheDocument();
    expect(mockGetCompanyProfile).not.toHaveBeenCalled();
  });

  it("mostra la tab e i dati seed se capability ON", async () => {
    mockUseAuth.mockReturnValue({
      user: { role: "auditor", auditor_org_id: 1, licensed_modules: ["audit", "ai_norms"] },
    });
    render(<CompanyDetailPage />);
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Profilo conformit/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("tab", { name: /Profilo conformit/i }));
    await waitFor(() => {
      expect(mockGetCompanyProfile).toHaveBeenCalledWith(42, { auditor_org_id: 1 });
    });
    expect(screen.getByDisplayValue("Acme Srl")).toBeInTheDocument();
    expect(screen.getByText(/copiati dall/i)).toBeInTheDocument();
  });

  it("nasconde la tab se GET profilo torna 403", async () => {
    mockUseAuth.mockReturnValue({
      user: { role: "auditor", auditor_org_id: 1, licensed_modules: ["ai_norms"] },
    });
    const err = new Error("Funzionalita non abilitata");
    err.status = 403;
    mockGetCompanyProfile.mockRejectedValue(err);
    render(<CompanyDetailPage />);
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Profilo conformit/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("tab", { name: /Profilo conformit/i }));
    await waitFor(() => {
      expect(screen.queryByRole("tab", { name: /Profilo conformit/i })).not.toBeInTheDocument();
    });
  });
});
