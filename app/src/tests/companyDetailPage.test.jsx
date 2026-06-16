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

vi.mock("../components/CompanyCounterpartiesPanel", () => ({
  default: () => <div data-testid="counterparties-panel">Controparti mock</div>,
}));

const mockGetCompany = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    getCompany: (...args) => mockGetCompany(...args),
    getCompanyLogoUrl: (id) => `https://api.test/companies/${id}/logo`,
    updateCompany: vi.fn(),
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

  it("espone tab Anagrafica, Personale e Controparti", () => {
    expect(TABS.map((t) => t.id)).toEqual(["anagrafica", "personale", "controparti"]);
  });

  it("renderizza scheda con tab e passa al tab Personale", async () => {
    render(<CompanyDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Acme Srl" })).toBeInTheDocument();
    });

    expect(screen.getByRole("tab", { name: "Anagrafica" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Personale" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Controparti" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Srl")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("tab", { name: "Personale" }));
    expect(screen.getByTestId("personnel-panel")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: "Controparti" }));
    expect(screen.getByTestId("counterparties-panel")).toBeInTheDocument();
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
});
