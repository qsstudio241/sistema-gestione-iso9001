/**
 * Tabella RILIEVI_MARKER: colonne N.A. e NV distinte, riga AP.
 */
import { describe, it, expect } from "vitest";
import { buildRileviSummaryOoxml } from "../utils/wordExportHelpers.js";

describe("buildRileviSummaryOoxml", () => {
  it("espone intestazioni N.A. e NV come colonne separate", () => {
    const xml = buildRileviSummaryOoxml(
      {
        ISO_9001: {
          s1: {
            questions: [
              { status: "NA", clauseRef: "4.1", title: "Foo" },
              { status: "NV", clauseRef: "4.2", title: "Bar" },
            ],
          },
        },
      },
      []
    );
    expect(xml).toContain("N.A.");
    expect(xml).toContain(">NV</w:t>");
    expect(xml).toMatch(/w:fill="E5E7EB"/);
    expect(xml).toMatch(/w:fill="EDE9FE"/);
  });

  it("riga AP: con rilievi aperti → X su colonna NC", () => {
    // La riga AP va in rosso (NC) solo se il pending ha status 'persists'
    // (nuovo comportamento da T10: rilievi 'open' o 'in_progress' non ancora valutati non contano)
    const xml = buildRileviSummaryOoxml(
      {
        ISO_9001: {
          s1: { questions: [{ status: "C", clauseRef: "1", title: "x" }] },
        },
      },
      [{ status: "persists", description: "NC vecchia carry-forward" }]
    );
    expect(xml).toContain("AP");
    const ncOpen = xml.indexOf("Azioni pendenti");
    expect(ncOpen).toBeGreaterThan(-1);
    expect(xml).toMatch(/w:fill="FEE2E2"/);
  });

  it("riga AP: senza pending → X su CONF", () => {
    const xml = buildRileviSummaryOoxml(
      {
        ISO_9001: {
          s1: { questions: [{ status: "C", clauseRef: "1", title: "x" }] },
        },
      },
      []
    );
    expect(xml).toContain("AP");
    expect(xml).toMatch(/w:fill="D1FAE5"/);
  });
});
