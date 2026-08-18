import { describe, it, expect } from "vitest";
import {
  isoDayLocal,
  defaultReviewFromDay,
  defaultReviewToDay,
  buildRiskReviewsScopeParams,
} from "./riskReviewsScopeParams";

describe("riskReviewsScopeParams", () => {
  const now = new Date(2026, 7, 17);

  it("default da 1 gennaio all'oggi locale", () => {
    expect(defaultReviewFromDay(now)).toBe("2026-01-01");
    expect(defaultReviewToDay(now)).toBe("2026-08-17");
    expect(isoDayLocal(now)).toBe("2026-08-17");
  });

  it("build query company_id + from + to", () => {
    expect(buildRiskReviewsScopeParams({
      companyId: 48,
      fromDay: "2026-01-01",
      toDay: "2026-08-17",
    })).toEqual({
      company_id: "48",
      from: "2026-01-01",
      to: "2026-08-17",
    });
  });
});
