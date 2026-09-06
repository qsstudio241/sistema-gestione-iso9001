import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AmbitoFactsBar from "../components/AmbitoFactsBar";

const mockGetAmbitoFacts = vi.fn();
const mockNavigate = vi.fn();
const scopeState = { companyId: "11", scopeCompanyName: "Mason" };

vi.mock("../services/apiService", () => ({
  default: {
    getAmbitoFacts: (...args) => mockGetAmbitoFacts(...args),
  },
}));

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock("../contexts/RouterContext", () => ({
  useNavigate: () => mockNavigate,
}));

describe("AmbitoFactsBar", () => {
  beforeEach(() => {
    mockGetAmbitoFacts.mockReset();
    mockNavigate.mockReset();
    scopeState.companyId = "11";
    scopeState.scopeCompanyName = "Mason";
  });

  it("mostra i tre numeri dallo snapshot API", async () => {
    mockGetAmbitoFacts.mockResolvedValue({
      data: {
        ready: true,
        scope: "company",
        companyId: 11,
        companyName: "Mason",
        counts: { ncOpen: 3, qualsExpiring30: 1, docsExpiring30: 4 },
      },
    });
    render(<AmbitoFactsBar />);
    await waitFor(() => {
      expect(screen.getByText("3")).toBeTruthy();
    });
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("NC aperte")).toBeTruthy();
    expect(mockGetAmbitoFacts).toHaveBeenCalledWith(11);
  });

  it("SB-4: senza azienda mostra aggregati studio e top aziende", async () => {
    scopeState.companyId = "";
    mockGetAmbitoFacts.mockResolvedValue({
      data: {
        ready: true,
        scope: "studio",
        companyId: null,
        counts: { ncOpen: 7, qualsExpiring30: 2, docsExpiring30: 1 },
        topCompanies: [
          { companyId: 11, companyName: "Mason", ncOpen: 4, qualsExpiring30: 0, docsExpiring30: 1 },
          { companyId: 22, companyName: "Camellini", ncOpen: 3, qualsExpiring30: 2, docsExpiring30: 0 },
        ],
      },
    });
    render(<AmbitoFactsBar />);
    await waitFor(() => expect(screen.getByText("7")).toBeTruthy());
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText(/Aggregati studio/)).toBeTruthy();
    expect(screen.getByText("Mason")).toBeTruthy();
    expect(screen.getByText("Camellini")).toBeTruthy();
    expect(mockGetAmbitoFacts).toHaveBeenCalledWith(null);
  });

  it("SB-5: in caricamento i pulsanti restano disabled", () => {
    scopeState.companyId = "";
    mockGetAmbitoFacts.mockReturnValue(new Promise(() => {}));
    render(<AmbitoFactsBar />);
    const ncBtn = screen.getByRole("button", { name: "Apri NC" });
    expect(ncBtn.disabled).toBe(true);
    expect(ncBtn.getAttribute("title")).toMatch(/Seleziona un'azienda/);
    fireEvent.click(ncBtn);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("SB-4: studio ready → nav deep-link liste filtrate studio-safe", async () => {
    scopeState.companyId = "";
    mockGetAmbitoFacts.mockResolvedValue({
      data: {
        ready: true,
        scope: "studio",
        companyId: null,
        counts: { ncOpen: 1, qualsExpiring30: 0, docsExpiring30: 0 },
        topCompanies: [],
      },
    });
    render(<AmbitoFactsBar />);
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());
    const ncBtn = screen.getByRole("button", { name: "Apri NC" });
    expect(ncBtn.disabled).toBe(false);
    fireEvent.click(ncBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/nc?status=open");
  });

  it("SB-5: con Ambito naviga ai moduli con query filtro", async () => {
    mockGetAmbitoFacts.mockResolvedValue({
      data: {
        ready: true,
        scope: "company",
        companyId: 11,
        companyName: "Mason",
        counts: { ncOpen: 1, qualsExpiring30: 0, docsExpiring30: 0 },
      },
    });
    render(<AmbitoFactsBar />);
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Apri NC" }));
    expect(mockNavigate).toHaveBeenCalledWith("/nc?status=open");

    fireEvent.click(screen.getByRole("button", { name: "Qualifiche 30gg" }));
    expect(mockNavigate).toHaveBeenCalledWith("/qualifiche?situazione=urgenti_30");

    fireEvent.click(screen.getByRole("button", { name: "Scadenze 30gg" }));
    expect(mockNavigate).toHaveBeenCalledWith("/deadlines?due=soon");
  });
});
