/**
 * L1 MC-5 — filtri KPI certificati materiale (stessa fonte card/riga).
 */
import { describe, it, expect } from "vitest";
import {
  outcomeBucket,
  countByOutcome,
  countByRole,
  filterCertificates,
  canHitl,
  isDeliveryNote,
  hitlTitle,
} from "../utils/materialCertificateFilters";

const rows = [
  { id: 1, workflow_status: "pending_review", material_role: "base" },
  { id: 2, workflow_status: "received", material_role: "filler" },
  { id: 3, workflow_status: "compliant", material_role: "base" },
  { id: 4, workflow_status: "non_compliant", material_role: "filler" },
  { id: 5, workflow_status: "archived", material_role: "base" },
];

describe("materialCertificateFilters", () => {
  it("raggruppa received/extracted in In revisione", () => {
    expect(outcomeBucket("received")).toBe("in_review");
    expect(outcomeBucket("extracted")).toBe("in_review");
    expect(outcomeBucket("pending_review")).toBe("in_review");
    expect(outcomeBucket("compliant")).toBe("compliant");
  });

  it("conteggio card = stessa funzione del filtro riga", () => {
    const counts = countByOutcome(rows);
    expect(counts.in_review).toBe(2);
    expect(counts.compliant).toBe(1);
    expect(counts.non_compliant).toBe(1);
    expect(counts.archived).toBe(1);
    expect(filterCertificates(rows, { outcome: "in_review" }).map((r) => r.id)).toEqual([1, 2]);
  });

  it("ruolo Base/Apporto si combina con esito", () => {
    expect(countByRole(rows)).toEqual({ base: 3, filler: 2 });
    expect(filterCertificates(rows, { outcome: "compliant", role: "base" }).map((r) => r.id)).toEqual([3]);
  });

  it("HITL: approve solo pending_review/non_compliant; reject solo pending_review", () => {
    expect(canHitl("approve", "pending_review")).toBe(true);
    expect(canHitl("approve", "extracted")).toBe(false);
    expect(canHitl("reject", "compliant")).toBe(false);
    expect(canHitl("archive", "compliant")).toBe(true);
  });

  it("MC-I3 isDeliveryNote legge JSON; Valuta ha titolo ma canHitl resta sullo stato", () => {
    expect(isDeliveryNote({ extracted_json: { document_kind: "delivery_note" } })).toBe(true);
    expect(isDeliveryNote({
      extracted_json: { document_kind: "delivery_note" },
      corrected_json: { document_kind: "mill_certificate" },
    })).toBe(false);
    expect(isDeliveryNote({ extracted_json: { document_kind: "mill_certificate" } })).toBe(false);
    expect(canHitl("evaluate", "extracted")).toBe(true);
    expect(hitlTitle("evaluate", "extracted", { deliveryNote: true })).toMatch(/DDT/);
  });
});
