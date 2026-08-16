import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AmbitoFactsBar from "../components/AmbitoFactsBar";

const mockGetAmbitoFacts = vi.fn();
const scopeState = { companyId: "11", scopeCompanyName: "Mason" };

vi.mock("../services/apiService", () => ({
  default: {
    getAmbitoFacts: (...args) => mockGetAmbitoFacts(...args),
  },
}));

vi.mock("../contexts/CompanyScopeContext", () => ({
  useCompanyScope: () => scopeState,
}));

describe("AmbitoFactsBar", () => {
  beforeEach(() => {
    mockGetAmbitoFacts.mockReset();
    scopeState.companyId = "11";
    scopeState.scopeCompanyName = "Mason";
  });

  it("mostra i tre numeri dallo snapshot API", async () => {
    mockGetAmbitoFacts.mockResolvedValue({
      data: {
        ready: true,
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

  it("senza azienda in Ambito mostra il messaggio, senza chiamare API", () => {
    scopeState.companyId = "";
    render(<AmbitoFactsBar />);
    expect(screen.getByText(/Seleziona un'azienda nell'Ambito/)).toBeTruthy();
    expect(mockGetAmbitoFacts).not.toHaveBeenCalled();
  });
});
