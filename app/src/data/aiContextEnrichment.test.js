import { describe, it, expect } from "vitest";
import {
  buildCitedProposals,
  applySelectedProposals,
  buildPublicSourceUrl,
  mapCandidateToAnagrafica,
} from "./aiContextEnrichment";

describe("aiContextEnrichment FE (CTX-3)", () => {
  it("cita registro imprese per P.IVA", () => {
    expect(buildPublicSourceUrl({ vat_number: "01548970357" })).toContain("01548970357");
  });

  it("mappa candidato con settore", () => {
    expect(
      mapCandidateToAnagrafica({
        legal_name: "ACME",
        vat_number: "1",
        city: "RE",
        sector: "Metal",
      })
    ).toMatchObject({ name: "ACME", sector: "Metal", address: "RE" });
  });

  it("conflitto → defaultSelected false", () => {
    const { proposals } = buildCitedProposals(
      { name: "Old", vat_number: "", address: "", sector: "" },
      { legal_name: "New", vat_number: "9", city: "MI", source: "IT-search" }
    );
    const name = proposals.find((p) => p.field === "name");
    expect(name.conflict).toBe(true);
    expect(name.defaultSelected).toBe(false);
    expect(name.source_url).toContain("registroimprese.it");
  });

  it("applySelectedProposals solo campi scelti", () => {
    const next = applySelectedProposals(
      { name: "A", vat_number: "1", address: "x", sector: "" },
      [
        { field: "name", proposed: "B" },
        { field: "sector", proposed: "Saldatura" },
      ],
      ["sector"]
    );
    expect(next.name).toBe("A");
    expect(next.sector).toBe("Saldatura");
  });
});
