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
        expect(STATS_TO_SITUAZIONE.da_approvare).toBe("da_approvare");
        expect(STATS_TO_SITUAZIONE.total).toBe("");
    });

    it("situazioneLabel restituisce etichetta italiana", () => {
        expect(situazioneLabel("urgenti_30")).toBe("Urgenti (30 gg)");
        expect(situazioneLabel("")).toBeNull();
    });

    it("QUALIFICATION_SITUAZIONI copre opzioni dropdown", () => {
        const values = QUALIFICATION_SITUAZIONI.map((o) => o.value);
        expect(values).toContain("da_approvare");
        expect(values).toContain("revocata");
    });
});
