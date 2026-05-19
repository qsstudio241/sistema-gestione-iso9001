import { describe, it, expect } from "vitest";
import { formatAuditPeriodIt } from "../utils/auditDatePeriod";

describe("wordExport auditPeriod placeholder data", () => {
  it("periodo multi-giorno in formato italiano", () => {
    const audit = {
      metadata: {
        auditDate: "2026-05-10",
        auditDateEnd: "2026-05-12",
        generalData: {},
      },
    };
    const meta = audit.metadata;
    const gd = meta.generalData || {};
    const auditPeriod =
      formatAuditPeriodIt(meta.auditDate || gd.auditDate, meta.auditDateEnd || gd.auditDateEnd);
    expect(auditPeriod).toMatch(/10\/05\/2026/);
    expect(auditPeriod).toMatch(/12\/05\/2026/);
  });
});
