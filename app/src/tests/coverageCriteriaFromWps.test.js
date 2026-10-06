import { describe, it, expect } from "vitest";
import {
  MAX_WPS_VERIFY,
  VERIFY_BATCH_SIZE,
  bestMatch,
  hasUsableCriteria,
  wpsRowToWpqrCriteria,
} from "../utils/coverageCriteriaFromWps";

describe("wpsRowToWpqrCriteria", () => {
  it("mappa processo, materiale e range di spessore (min e max)", () => {
    const { criteria, verified } = wpsRowToWpqrCriteria({
      welding_process: "135",
      material_group: "1.1",
      thickness_range_min: 3,
      thickness_range_max: 12,
    });
    expect(criteria).toEqual({
      welding_process: "135",
      thickness_mm: 3,
      thickness_b_mm: 12,
      material_group: "1.1",
    });
    expect(verified).toEqual(["Processo 135", "Spessore 3\u201312 mm", "Materiale 1.1"]);
  });

  it("non invia thickness_b_mm quando min = max", () => {
    const { criteria, verified } = wpsRowToWpqrCriteria({
      welding_process: "141",
      thickness_range_min: 6,
      thickness_range_max: 6,
    });
    expect(criteria).toEqual({ welding_process: "141", thickness_mm: 6 });
    expect(verified).toContain("Spessore 6 mm");
  });

  it("valorizza thickness_mm con l'unico estremo disponibile", () => {
    expect(wpsRowToWpqrCriteria({ thickness_range_min: 4 }).criteria).toEqual({ thickness_mm: 4 });
    expect(wpsRowToWpqrCriteria({ thickness_range_max: 20 }).criteria).toEqual({ thickness_mm: 20 });
  });

  it("accetta stringhe numeriche (anche con virgola)", () => {
    const { criteria } = wpsRowToWpqrCriteria({
      thickness_range_min: "2,5",
      thickness_range_max: "10",
    });
    expect(criteria).toEqual({ thickness_mm: 2.5, thickness_b_mm: 10 });
  });

  it("omette nulli, vuoti, zero e valori non numerici", () => {
    const { criteria, verified } = wpsRowToWpqrCriteria({
      welding_process: "  ",
      material_group: null,
      thickness_range_min: "abc",
      thickness_range_max: 0,
    });
    expect(criteria).toEqual({});
    expect(verified).toEqual([]);
    expect(wpsRowToWpqrCriteria(null).criteria).toEqual({});
    expect(wpsRowToWpqrCriteria(undefined).verified).toEqual([]);
  });

  it("non include mai joint_type", () => {
    const { criteria } = wpsRowToWpqrCriteria({
      welding_process: "135",
      joint_type: "BW",
      thickness_range_min: 3,
    });
    expect(criteria).not.toHaveProperty("joint_type");
  });

  it("usa base_material_group come fallback del gruppo materiale", () => {
    expect(wpsRowToWpqrCriteria({ base_material_group: "8.1" }).criteria).toEqual({
      material_group: "8.1",
    });
  });
});

describe("hasUsableCriteria", () => {
  it("è falso per criteri vuoti o non oggetto", () => {
    expect(hasUsableCriteria({})).toBe(false);
    expect(hasUsableCriteria(null)).toBe(false);
    expect(hasUsableCriteria(undefined)).toBe(false);
    expect(hasUsableCriteria({ welding_process: "", material_group: null })).toBe(false);
  });

  it("è vero con almeno un criterio valorizzato", () => {
    expect(hasUsableCriteria({ thickness_mm: 3 })).toBe(true);
    expect(hasUsableCriteria({ welding_process: "135" })).toBe(true);
  });
});

describe("bestMatch", () => {
  it("privilegia match > partial > no_match", () => {
    const list = [
      { status: "no_match", capability_id: 1 },
      { status: "partial", capability_id: 2 },
      { status: "match", capability_id: 3 },
    ];
    expect(bestMatch(list).capability_id).toBe(3);
    expect(bestMatch(list.slice(0, 2)).capability_id).toBe(2);
  });

  it("a parità resta il primo", () => {
    const list = [
      { status: "partial", capability_id: 10 },
      { status: "partial", capability_id: 11 },
    ];
    expect(bestMatch(list).capability_id).toBe(10);
  });

  it("restituisce null senza match valutabili", () => {
    expect(bestMatch([])).toBeNull();
    expect(bestMatch(null)).toBeNull();
    expect(bestMatch([{ status: "not_implemented" }])).toBeNull();
  });
});

describe("costanti", () => {
  it("tetto e batch come da brief", () => {
    expect(MAX_WPS_VERIFY).toBe(20);
    expect(VERIFY_BATCH_SIZE).toBe(4);
  });
});
