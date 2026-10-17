import { describe, it, expect } from "vitest";
import { buildVtTemplateData } from "../utils/vtWordExport.js";
import {
    DEFAULT_INSPECTION_PHASE,
    inspectionPhaseLabel,
    inspectionPhaseShort,
    wordNotesWithInspectionPhase,
} from "../utils/ndtInspectionPhase.js";

describe("fase ispezione verbale CND", () => {
    it("tre etichette e default dopo la saldatura", () => {
        expect(DEFAULT_INSPECTION_PHASE).toBe("after");
        expect(inspectionPhaseLabel("before")).toBe("Prima della saldatura");
        expect(inspectionPhaseLabel("during")).toBe("Durante la saldatura");
        expect(inspectionPhaseLabel("after")).toBe("Dopo la saldatura");
        expect(inspectionPhaseShort("before")).toBe("Prima");
        expect(inspectionPhaseLabel("lux")).toBe("");
    });

    it("il Word mette la fase in testa alle note e non inventa una fase vuota", () => {
        const withPhase = wordNotesWithInspectionPhase({
            inspection_phase: "during",
            notes: "NULLA DA SEGNALARE",
        });
        expect(withPhase.startsWith("Fase ispezione: Durante la saldatura\n")).toBe(true);
        expect(withPhase).toContain("NULLA DA SEGNALARE");

        expect(wordNotesWithInspectionPhase({ notes: "solo note" })).toBe("solo note");

        const data = buildVtTemplateData({
            report_type: "VT",
            report_number: "VT-1",
            inspection_phase: "before",
            notes: "ok",
            items: [],
            instruments: [],
        });
        expect(data.inspectionPhase).toBe("Prima della saldatura");
        expect(data.notes.startsWith("Fase ispezione: Prima della saldatura")).toBe(true);
    });
});
