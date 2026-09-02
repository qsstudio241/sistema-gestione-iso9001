/**
 * Test L1 — merge template checklist Riesame (ING-4)
 */
import { describe, it, expect } from "vitest";
import {
  mergeTemplateWithDefaults,
  buildSeedItemsFromDefaults,
  PRELIMINARY_ITEMS,
  FINAL_ITEMS,
  isCoreRef,
} from "../data/commercialChecklistDefaults";

describe("commercialChecklistDefaults", () => {
  it("core preliminare sempre presente senza template", () => {
    const items = mergeTemplateWithDefaults("preliminary", []);
    expect(items).toHaveLength(PRELIMINARY_ITEMS.length);
    expect(items.every((i) => i.is_core)).toBe(true);
  });

  it("variante testo core non rimuove ref ISO", () => {
    const items = mergeTemplateWithDefaults("preliminary", [
      { item_ref: "P3", item_text: "Capacità (variante cliente X)", is_core: true },
    ]);
    expect(items.find((i) => i.ref === "P3")?.text).toMatch(/variante cliente X/);
    expect(items).toHaveLength(10);
  });

  it("aggiunge extra senza bypass core finale", () => {
    const items = mergeTemplateWithDefaults("final", [
      { item_ref: "F7", item_text: "Packaging brand cliente", is_core: false },
    ]);
    expect(items.filter((i) => i.is_core)).toHaveLength(FINAL_ITEMS.length);
    expect(items.some((i) => i.ref === "F7" && !i.is_core)).toBe(true);
  });

  it("seed e isCoreRef", () => {
    const seed = buildSeedItemsFromDefaults();
    expect(seed).toHaveLength(16);
    expect(isCoreRef("preliminary", "P10")).toBe(true);
    expect(isCoreRef("final", "F7")).toBe(false);
  });
});
