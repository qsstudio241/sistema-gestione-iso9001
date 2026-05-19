import { describe, it, expect } from "vitest";
import {
  formatAuditPeriodIt,
  isMultiDayAudit,
  normalizeAuditDateEndForStorage,
  validateAuditDateRangeClient,
} from "../utils/auditDatePeriod";

describe("auditDatePeriod", () => {
  it("formatAuditPeriodIt: singola data se fine assente o uguale", () => {
    expect(formatAuditPeriodIt("2026-05-10", null)).toBe("10/05/2026");
    expect(formatAuditPeriodIt("2026-05-10", "2026-05-10")).toBe("10/05/2026");
  });

  it("formatAuditPeriodIt: intervallo con en-dash", () => {
    const period = formatAuditPeriodIt("2026-05-10", "2026-05-12");
    expect(period).toContain("10/05/2026");
    expect(period).toContain("12/05/2026");
    expect(period).toMatch(/\u2013/);
    expect(isMultiDayAudit("2026-05-10", "2026-05-12")).toBe(true);
  });

  it("normalizeAuditDateEndForStorage", () => {
    expect(normalizeAuditDateEndForStorage("2026-05-10", "2026-05-12")).toBe("2026-05-12");
    expect(normalizeAuditDateEndForStorage("2026-05-10", "2026-05-10")).toBeNull();
    expect(normalizeAuditDateEndForStorage("2026-05-10", "")).toBeNull();
  });

  it("validateAuditDateRangeClient rifiuta fine prima di inizio", () => {
    const r = validateAuditDateRangeClient("2026-05-12", "2026-05-10");
    expect(r.valid).toBe(false);
  });
});
