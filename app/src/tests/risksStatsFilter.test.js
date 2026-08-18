import { describe, it, expect } from "vitest";
import {
  toggleRiskStatFilter,
  countForRiskStat,
} from "../utils/risksStatsFilter";

describe("risksStatsFilter", () => {
  it("toggle sulla card attiva torna a Totale", () => {
    expect(toggleRiskStatFilter("open", "open")).toBe("total");
    expect(toggleRiskStatFilter("total", "open")).toBe("open");
    expect(toggleRiskStatFilter("open", "total")).toBe("total");
  });

  it("Totale esclude i chiusi dal numero", () => {
    const stats = { total: 5, closed: 2, open: 2, in_treatment: 1, mitigated: 0, high_priority: 1 };
    expect(countForRiskStat(stats, "total")).toBe(3);
    expect(countForRiskStat(stats, "closed")).toBe(2);
    expect(countForRiskStat(stats, "open")).toBe(2);
  });
});
