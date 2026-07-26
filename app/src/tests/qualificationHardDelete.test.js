import { describe, it, expect } from "vitest";
import { canHardDeleteQualification } from "../utils/qualificationHardDelete.js";

describe("canHardDeleteQualification", () => {
    it("consente l'eliminazione per una bozza mai approvata", () => {
        expect(canHardDeleteQualification({ approval_status: "bozza", approved_at: null })).toBe(true);
    });

    it("consente l'eliminazione per una qualifica rifiutata mai approvata prima", () => {
        expect(canHardDeleteQualification({ approval_status: "rifiutata", approved_at: null })).toBe(true);
    });

    it("blocca l'eliminazione se la qualifica è approvata", () => {
        expect(canHardDeleteQualification({ approval_status: "approvata", approved_at: "2026-01-01" })).toBe(false);
    });

    it("blocca l'eliminazione se rifiutata ma con approved_at valorizzato (approvata in passato)", () => {
        expect(canHardDeleteQualification({ approval_status: "rifiutata", approved_at: "2026-01-01" })).toBe(false);
    });

    it("gestisce input nullo/vuoto in modo difensivo", () => {
        expect(canHardDeleteQualification(null)).toBe(false);
        expect(canHardDeleteQualification(undefined)).toBe(false);
    });
});
