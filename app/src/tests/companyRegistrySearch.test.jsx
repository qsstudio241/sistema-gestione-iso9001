import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyRegistrySearch, { toAnagrafica, formatAddress } from "../components/CompanyRegistrySearch";

const mockSearch = vi.fn();

vi.mock("../services/apiService", () => ({
  default: {
    searchCompanyRegistry: (...args) => mockSearch(...args),
  },
}));

describe("toAnagrafica / formatAddress", () => {
  it("compone indirizzo da via CAP citta provincia", () => {
    expect(formatAddress({
      street: "VIA ROMA 1",
      cap: "42017",
      city: "NOVELLARA",
      province: "RE",
    })).toBe("VIA ROMA 1, 42017 NOVELLARA, RE");
    expect(toAnagrafica({
      legal_name: "TECNOVE S.P.A.",
      vat_number: "01548970357",
      city: "NOVELLARA",
      province: "RE",
    })).toEqual({
      name: "TECNOVE S.P.A.",
      vat_number: "01548970357",
      address: "NOVELLARA, RE",
    });
  });
});

describe("CompanyRegistrySearch", () => {
  beforeEach(() => {
    mockSearch.mockReset();
  });

  it("cerca per nome e applica il risultato scelto", async () => {
    mockSearch.mockResolvedValue({
      data: {
        results: [
          { legal_name: "TECNOVE S.P.A.", vat_number: "01548970357", city: "NOVELLARA", status: "ATTIVA" },
          { legal_name: "TECNOVE SRL", vat_number: "000", city: "MODENA" },
        ],
      },
    });
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(<CompanyRegistrySearch name="TECNOVE" vatNumber="" onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: "Cerca nel registro" }));
    await waitFor(() => expect(screen.getByTestId("crs-results")).toBeInTheDocument());
    expect(mockSearch).toHaveBeenCalledWith(
      { company_name: "TECNOVE", vat_number: "" },
      {}
    );
    await user.click(screen.getByRole("button", { name: "Usa questa" }));
    expect(onPick).toHaveBeenCalledWith({
      name: "TECNOVE S.P.A.",
      vat_number: "01548970357",
      address: "NOVELLARA",
    });
  });
});
