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
        expect(STATS_TO_SITUAZIONE.non_attive).toBe("non_attive");
    });

    it("situazioneLabel restituisce etichetta italiana", () => {
        expect(situazioneLabel("urgenti_30")).toBe("Urgenti (30 gg)");
        expect(situazioneLabel("non_attive")).toBe("Non attiva");
        expect(situazioneLabel("")).toBeNull();
    });

    // Decisione di prodotto 28/07/2026: rimosso il gate di approvazione interna
    // (Approva/Rifiuta) — "da_approvare" non esiste più come situazione filtrabile,
    // v. header qualifications.controller.js.
    //
    // Decisione di prodotto 10/08/2026: rimosso il menu a tendina "Filtra per
    // situazione" (ridondante con le card statistiche) — sospesa/revocata,
    // indistinguibili in tabella (entrambe "Non attiva"), sono state
    // consolidate in un unico valore filtrabile "non_attive", allineato alla
    // nuova card e a getStats().non_attive lato backend.
    it("QUALIFICATION_SITUAZIONI copre le card statistiche, senza più da_approvare o sospesa/revocata separate", () => {
        const values = QUALIFICATION_SITUAZIONI.map((o) => o.value);
        expect(values).not.toContain("da_approvare");
        expect(values).not.toContain("sospesa");
        expect(values).not.toContain("revocata");
        expect(values).toContain("non_attive");
    });
});
