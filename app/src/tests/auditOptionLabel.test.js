import { describe, expect, it } from "vitest";
import { getStatusConfigLabel } from "../components/StatusBadge";
import {
  AUDIT_OPTION_COMPANY_MISSING,
  AUDIT_OPTION_DATE_MISSING,
  AUDIT_OPTION_STATUS_MISSING,
  auditOptionStatusLabel,
  formatAuditOptionLabel,
} from "../utils/auditOptionLabel";

describe("auditOptionStatusLabel", () => {
  it("usa le etichette già del badge audit", () => {
    expect(auditOptionStatusLabel("draft")).toBe("Bozza");
    expect(auditOptionStatusLabel("in_progress")).toBe("In corso");
    expect(auditOptionStatusLabel("IN_PROGRESS")).toBe("In corso");
    expect(auditOptionStatusLabel("suspended")).toBe("Sospeso");
    expect(auditOptionStatusLabel("completed")).toBe("Completato");
    expect(auditOptionStatusLabel("approved")).toBe("Approvato");
    expect(auditOptionStatusLabel("archived")).toBe("Archiviato");
    expect(getStatusConfigLabel("audit", "in_progress")).toBe("In corso");
  });

  it("non inventa un'etichetta per uno stato sconosciuto", () => {
    expect(auditOptionStatusLabel("custom_state")).toBe("custom_state");
    expect(auditOptionStatusLabel("")).toBe(AUDIT_OPTION_STATUS_MISSING);
    expect(auditOptionStatusLabel(null)).toBe(AUDIT_OPTION_STATUS_MISSING);
  });
});

describe("formatAuditOptionLabel", () => {
  it("mette azienda, periodo, codice vecchio e stato italiano", () => {
    expect(formatAuditOptionLabel({
      clientName: "ZZ_TEST_LOCK",
      auditNumber: "LOCK-PUB-1774111423756",
      auditDate: "2026-03-21",
      status: "in_progress",
    })).toBe("ZZ_TEST_LOCK · 21/03/2026 · LOCK-PUB-1774111423756 · In corso");

    expect(formatAuditOptionLabel({
      clientName: "TEST-SYNC-MOBILE",
      auditNumber: "2026-08",
      auditDate: "2026-03-21",
      status: "draft",
    })).toBe("TEST-SYNC-MOBILE · 21/03/2026 · 2026-08 · Bozza");
  });

  it("tiene il periodo su più giorni e il codice AUD-", () => {
    expect(formatAuditOptionLabel({
      clientName: "ADA",
      auditNumber: "AUD-260819-01",
      auditDate: "2026-08-19",
      auditDateEnd: "2026-08-20",
      status: "in_progress",
    })).toBe("ADA · 19/08/2026 – 20/08/2026 · AUD-260819-01 · In corso");
  });

  it("se manca l'azienda usa un testo neutro", () => {
    expect(formatAuditOptionLabel({
      clientName: "  ",
      auditNumber: "2026-08",
      auditDate: "2026-03-21",
      status: "draft",
    })).toBe(`${AUDIT_OPTION_COMPANY_MISSING} · 21/03/2026 · 2026-08 · Bozza`);
    expect(formatAuditOptionLabel({
      clientName: "-",
      auditNumber: "LOCK-1",
      status: "completed",
    })).toBe(`${AUDIT_OPTION_COMPANY_MISSING} · ${AUDIT_OPTION_DATE_MISSING} · LOCK-1 · Completato`);
  });

  it("marca fuori filtro senza cambiare il resto della voce", () => {
    expect(formatAuditOptionLabel({
      clientName: "ADA",
      auditNumber: "AUD-260819-01",
      auditDate: "2026-08-19",
      status: "completed",
    }, { outsideFilter: true })).toBe(
      "\u26a0 ADA · 19/08/2026 · AUD-260819-01 · Completato - fuori filtro"
    );
  });
});
