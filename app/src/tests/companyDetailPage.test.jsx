import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyDetailPage, { parseCompanyId, TABS } from "../pages/CompanyDetailPage";

const mockNavigate = vi.fn();

vi.mock("../contexts/RouterContext", () => ({
  useRouter: () => ({ path: "/companies/42" }),
  useNavigate: () => mockNavigate,
  Link: ({ to, children, className, ...props }) => (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        mockNavigate(to);
      }}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { role: "auditor", auditor_org_id: 1 },
  }),
}));

vi.mock("../components/CompanyPersonnelPanel", () => ({
  default: () => <div data-testid="personnel-panel">Personale mock</div>,
}));

const mockGetCompany = vi.fn();
const mockUpdateCompany = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getCompany: (...args) => mockGetCompany(...args),
    getCompanyLogoUrl: (id) => `https://api.test/companies/${id}/logo`,
    updateCompany: (...args) => mockUpdateCompany(...args),
    uploadCompanyLogo: vi.fn(),
  },
}));

describe("parseCompanyId", () => {
  it("estrae id numerico dal path", () => {
    expect(parseCompanyId("/companies/7")).toBe(7);
    expect(parseCompanyId("/companies/7/")).toBe(7);
    expect(parseCompanyId("/companies")).toBeNull();
  });
});

describe("CompanyDetailPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUpdateCompany.mockReset();
    mockUpdateCompany.mockResolvedValue({ data: { id: 42 } });
    mockGetCompany.mockResolvedValue({
      data: {
        id: 42,
        name: "Acme Srl",
        vat_number: "IT123",
        sector: "Metal",
        address: "Via Roma 1",
      },
    });
  });

  it("espone tab Anagrafica e Personale", () => {
    expect(TABS.map((t) => t.id)).toEqual(["anagrafica", "personale"]);
  });

  it("renderizza scheda con tab e passa al tab Personale", async () => {
    render(<CompanyDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Acme Srl" })).toBeInTheDocument();
    });

    expect(screen.getByRole("tab", { name: "Anagrafica" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Personale" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Srl")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: "Personale" }));
    expect(screen.getByTestId("personnel-panel")).toBeInTheDocument();
  });

  it('"Elenco aziende" naviga a /companies', async () => {
    render(<CompanyDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Acme Srl" })).toBeInTheDocument();
    });

    const backLink = screen.getByRole("link", { name: /Elenco aziende/i });
    expect(backLink).toHaveAttribute("href", "/companies");

    await userEvent.click(backLink);
    expect(mockNavigate).toHaveBeenCalledWith("/companies");
  });

  it("dopo Salva anagrafica torna all'elenco aziende", async () => {
    render(<CompanyDetailPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Srl")).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue("Acme Srl");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Acme Aggiornata");
    await userEvent.click(screen.getByRole("button", { name: "Salva anagrafica" }));

    await waitFor(() => {
      expect(mockUpdateCompany).toHaveBeenCalledWith(42, expect.objectContaining({ name: "Acme Aggiornata" }));
      expect(mockNavigate).toHaveBeenCalledWith("/companies");
    });
  });
});
