import { describe, it, expect } from "vitest";
import { riskScore, riskScoreLevel, scoreColor, displayFurtherActions, residualScoreFromRisk } from "../utils/riskScore";

describe("riskScore — R = P × G (scala 1-3)", () => {
  const matrix = [];
  for (let p = 1; p <= 3; p += 1) {
    for (let g = 1; g <= 3; g += 1) {
      matrix.push([p, g, p * g]);
    }
  }

  it.each(matrix)("P=%i × G=%i → R=%i", (p, g, expected) => {
    expect(riskScore(p, g)).toBe(expected);
  });

  it("copre la matrice 3×3 (R da 1 a 9)", () => {
    const scores = matrix.map(([, , r]) => r);
    expect(new Set(scores).size).toBe(6);
    expect(Math.min(...scores)).toBe(1);
    expect(Math.max(...scores)).toBe(9);
  });
});

describe("riskScoreLevel / scoreColor — soglie UI attuali", () => {
  it("1-3 basso, 4-6 medio, 7-9 alto", () => {
    expect(riskScoreLevel(1)).toBe("basso");
    expect(riskScoreLevel(3)).toBe("basso");
    expect(riskScoreLevel(4)).toBe("medio");
    expect(riskScoreLevel(6)).toBe("medio");
    expect(riskScoreLevel(7)).toBe("alto");
    expect(riskScoreLevel(9)).toBe("alto");
    expect(scoreColor(3)).toBe("risk-low");
    expect(scoreColor(6)).toBe("risk-medium");
    expect(scoreColor(9)).toBe("risk-high");
  });
});

describe("displayFurtherActions", () => {
  it("usa further_actions se presente, altrimenti treatment_desc", () => {
    expect(displayFurtherActions({ further_actions: "piano", treatment_desc: "vecchio" })).toBe("piano");
    expect(displayFurtherActions({ further_actions: "  ", treatment_desc: "vecchio" })).toBe("vecchio");
    expect(displayFurtherActions({ treatment_desc: "solo legacy" })).toBe("solo legacy");
  });
});

describe("residualScoreFromRisk", () => {
  it("calcola R residuo solo se entrambi i fattori ci sono", () => {
    expect(residualScoreFromRisk({ residual_probability: 2, residual_impact: 3 })).toBe(6);
    expect(residualScoreFromRisk({ residual_probability: 2 })).toBeNull();
    expect(residualScoreFromRisk({ residual_probability: "", residual_impact: 2 })).toBeNull();
    expect(residualScoreFromRisk({})).toBeNull();
  });
});
