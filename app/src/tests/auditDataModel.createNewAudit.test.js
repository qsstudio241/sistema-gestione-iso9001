import { describe, expect, it } from "vitest";
import { createNewAudit } from "../data/auditDataModel";

describe("createNewAudit", () => {
  it("mantiene auditDate e auditorName anche nei dati generali", () => {
    const audit = createNewAudit({
      clientName: "MANITOU ITALIA SRL",
      auditNumber: "MSN-260420-01",
      auditDate: "2026-04-20",
      auditorName: "Ispettore Principale",
      selectedStandards: ["ISO_3834_2"],
    });

    expect(audit.metadata.auditDate).toBe("2026-04-20");
    expect(audit.metadata.auditorName).toBe("Ispettore Principale");
    expect(audit.metadata.generalData.auditDate).toBe("2026-04-20");
    expect(audit.metadata.generalData.auditors).toEqual(["Ispettore Principale"]);
  });
});
