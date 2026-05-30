import { describe, it, expect } from "vitest";
import {
  filterStandardsForUser,
  resolveAutoStandardFromAudit,
} from "../utils/aiAssistantContext";

describe("aiAssistantContext", () => {
  it("filterStandardsForUser returns all when allowed is null", () => {
    const all = filterStandardsForUser(null);
    expect(all.length).toBeGreaterThan(0);
    expect(all.some((e) => e.key === "ISO_9001")).toBe(true);
  });

  it("filterStandardsForUser respects allowed_standard_ids", () => {
    const filtered = filterStandardsForUser([1, 2]);
    expect(filtered.every((e) => [1, 2].includes(e.standardId))).toBe(true);
    expect(filtered.some((e) => e.key === "ISO_45001")).toBe(false);
  });

  it("resolveAutoStandardFromAudit picks first selected standard", () => {
    const auto = resolveAutoStandardFromAudit(["ISO_14001_2015", "ISO_9001"]);
    expect(auto).toEqual({
      standardId: 2,
      key: "ISO_14001",
      label: "14001",
    });
  });

  it("resolveAutoStandardFromAudit returns null for empty selection", () => {
    expect(resolveAutoStandardFromAudit([])).toBeNull();
    expect(resolveAutoStandardFromAudit(undefined)).toBeNull();
  });
});
