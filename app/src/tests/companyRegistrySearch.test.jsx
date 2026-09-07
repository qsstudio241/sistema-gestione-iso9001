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

describe("CompanyRegistrySearch CTX-3 HITL", () => {
  beforeEach(() => {
    mockSearch.mockReset();
  });

  it("cerca, mostra proposte citate e applica solo campi selezionati", async () => {
    mockSearch.mockResolvedValue({
      data: {
        source: "IT-search",
        results: [
          {
            legal_name: "TECNOVE S.P.A.",
            vat_number: "01548970357",
            city: "NOVELLARA",
            status: "ATTIVA",
            sector: "Strutture metalliche",
            source: "IT-search",
            source_url: "https://www.registroimprese.it/ricerca-libera?q=01548970357",
          },
          { legal_name: "TECNOVE SRL", vat_number: "000", city: "MODENA" },
        ],
      },
    });
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <CompanyRegistrySearch
        name="TECNOVE"
        vatNumber=""
        currentValues={{ name: "Vecchio", vat_number: "", address: "", sector: "" }}
        onPick={onPick}
      />
    );
    await user.click(screen.getByRole("button", { name: "Cerca nel registro" }));
    await waitFor(() => expect(screen.getByTestId("crs-results")).toBeInTheDocument());
    expect(mockSearch).toHaveBeenCalledWith(
      { company_name: "TECNOVE", vat_number: "" },
      {}
    );
    await user.click(screen.getByRole("button", { name: "Usa questa" }));
    await waitFor(() => expect(screen.getByTestId("crs-proposals")).toBeInTheDocument());
    expect(screen.getByTestId("crs-source-url")).toHaveAttribute(
      "href",
      expect.stringContaining("registroimprese.it")
    );
    // nome in conflitto: unchecked by default — non deve entrare nel patch
    const nameBox = screen.getByTestId("crs-proposal-name").querySelector("input");
    expect(nameBox.checked).toBe(false);
    const vatBox = screen.getByTestId("crs-proposal-vat_number").querySelector("input");
    expect(vatBox.checked).toBe(true);
    await user.click(screen.getByTestId("crs-apply-selected"));
    expect(onPick).toHaveBeenCalledTimes(1);
    const patch = onPick.mock.calls[0][0];
    expect(patch.name).toBeUndefined();
    expect(patch.vat_number).toBe("01548970357");
    expect(patch.sector).toBe("Strutture metalliche");
  });

  it("con conferma esplicita sul conflitto sovrascrive il nome", async () => {
    mockSearch.mockResolvedValue({
      data: {
        results: [
          {
            legal_name: "NUOVO SPA",
            vat_number: "111",
            city: "RE",
            source_url: "https://www.registroimprese.it/ricerca-libera?q=111",
          },
        ],
      },
    });
    const onPick = vi.fn();
    const user = userEvent.setup();
    render(
      <CompanyRegistrySearch
        name="OLD"
        vatNumber=""
        currentValues={{ name: "OLD", vat_number: "", address: "", sector: "" }}
        onPick={onPick}
      />
    );
    await user.click(screen.getByRole("button", { name: "Cerca nel registro" }));
    await waitFor(() => expect(screen.getByTestId("crs-results")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Usa questa" }));
    await waitFor(() => expect(screen.getByTestId("crs-proposals")).toBeInTheDocument());
    await user.click(screen.getByTestId("crs-proposal-name").querySelector("input"));
    await user.click(screen.getByTestId("crs-apply-selected"));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ name: "NUOVO SPA", vat_number: "111" })
    );
  });
});
