import { describe, it, expect } from "vitest";
import {
    QUALIFICATION_SITUAZIONI,
    STATS_TO_SITUAZIONE,
    toggleSituazione,
    situazioneLabel,
} from "../utils/qualificationsSituazione.js";

describe("qualificationsSituazione", () => {
    it("toggleSituazione attiva e disattiva lo stesso valore", () => {
        expect(toggleSituazione("", "scadute")).toBe("scadute");
        expect(toggleSituazione("scadute", "scadute")).toBe("");
        expect(toggleSituazione("valide", "scadute")).toBe("scadute");
    });

    it("STATS_TO_SITUAZIONE allinea stats bar al filtro API", () => {
        expect(STATS_TO_SITUAZIONE.in_scadenza_30).toBe("urgenti_30");
        expect(STATS_TO_SITUAZIONE.total).toBe("");
    });

    it("situazioneLabel restituisce etichetta italiana", () => {
        expect(situazioneLabel("urgenti_30")).toBe("Urgenti (30 gg)");
        expect(situazioneLabel("")).toBeNull();
    });

    // Decisione di prodotto 28/07/2026: rimosso il gate di approvazione interna
    // (Approva/Rifiuta) — "da_approvare" non esiste più come situazione filtrabile,
    // v. header qualifications.controller.js.
    it("QUALIFICATION_SITUAZIONI copre opzioni dropdown, senza più da_approvare", () => {
        const values = QUALIFICATION_SITUAZIONI.map((o) => o.value);
        expect(values).not.toContain("da_approvare");
        expect(values).toContain("revocata");
    });
});
