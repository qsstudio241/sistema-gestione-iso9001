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

  it("propaga auditDateEnd in metadata e generalData", () => {
    const audit = createNewAudit({
      clientName: "Cliente",
      auditDate: "2026-05-10",
      auditDateEnd: "2026-05-12",
    });
    expect(audit.metadata.auditDateEnd).toBe("2026-05-12");
    expect(audit.metadata.generalData.auditDateEnd).toBe("2026-05-12");
  });

  it("createNewAudit con fornitoreCompanyId → preservato in metadata", () => {
    const audit = createNewAudit({
      auditPartyType: "second_party",
      fornitoreName: "Acme Srl",
      fornitoreCompanyId: 42,
      clientName: "Committente SpA",
      auditNumber: "2026-TEST",
    });
    expect(audit.metadata.fornitoreCompanyId).toBe(42);
    expect(audit.metadata.fornitoreName).toBe("Acme Srl");
  });

  it("createNewAudit senza fornitoreCompanyId → default null", () => {
    const audit = createNewAudit({
      clientName: "Acme Srl",
      auditNumber: "2026-01",
    });
    expect(audit.metadata.fornitoreCompanyId).toBeNull();
  });
});
