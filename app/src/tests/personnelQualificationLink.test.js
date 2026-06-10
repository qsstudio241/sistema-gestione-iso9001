import { describe, it, expect } from "vitest";
import { normalizePersonKey } from "../utils/personnelQualificationLink";
import { isOccupationalQualificationType, OCCUPATIONAL_QUALIFICATION_TYPES } from "../data/occupationalQualificationTypes";

describe("normalizePersonKey", () => {
  it("preferisce il codice matricola se presente", () => {
    expect(normalizePersonKey("Mario Rossi", "MAT-001")).toBe("code:mat-001");
  });

  it("normalizza spazi e maiuscole nel nome", () => {
    expect(normalizePersonKey("  Mario   ROSSI  ", "")).toBe("name:mario rossi");
  });

  it("due nomi equivalenti producono la stessa chiave", () => {
    const a = normalizePersonKey("Luigi Bianchi", null);
    const b = normalizePersonKey("luigi  bianchi", undefined);
    expect(a).toBe(b);
  });
});

describe("occupationalQualificationTypes", () => {
  it("include i quattro documenti salute mansione ISO 3834", () => {
    expect(OCCUPATIONAL_QUALIFICATION_TYPES).toHaveLength(4);
    expect(isOccupationalQualificationType("Certificato acuit\u00e0 visiva")).toBe(true);
    expect(isOccupationalQualificationType("Certificato visione cromatica (Ishihara)")).toBe(true);
    expect(isOccupationalQualificationType("Idoneit\u00e0 medica alla mansione")).toBe(true);
    expect(isOccupationalQualificationType("Sorveglianza sanitaria periodica")).toBe(true);
    expect(isOccupationalQualificationType("Saldatore ISO 9606-1")).toBe(false);
  });
});
