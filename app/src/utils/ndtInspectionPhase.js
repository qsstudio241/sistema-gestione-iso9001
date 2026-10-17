/**
 * Fase del controllo sul verbale CND (ISO 3834-2 §14, parafrasi).
 * Valori stabili: before | during | after. Nessuna soglia ISO 17637.
 */

export const INSPECTION_PHASES = [
    { value: "before", label: "Prima della saldatura", short: "Prima" },
    { value: "during", label: "Durante la saldatura", short: "Durante" },
    { value: "after", label: "Dopo la saldatura", short: "Dopo" },
];

export const DEFAULT_INSPECTION_PHASE = "after";

export function inspectionPhaseOption(value) {
    return INSPECTION_PHASES.find((p) => p.value === value) || null;
}

export function inspectionPhaseLabel(value) {
    const row = inspectionPhaseOption(value);
    return row ? row.label : "";
}

export function inspectionPhaseShort(value) {
    const row = inspectionPhaseOption(value);
    return row ? row.short : "";
}

/** Riga in testa alle note del Word, solo se la fase è valorizzata. Non modifica il testo salvato. */
export function wordNotesWithInspectionPhase(report) {
    const label = inspectionPhaseLabel(report && report.inspection_phase);
    const raw = report && report.notes != null ? String(report.notes).trim() : "";
    if (!label) return raw || "N/D";
    const line = "Fase ispezione: " + label;
    if (!raw) return line;
    if (raw.indexOf(line) === 0) return raw;
    return line + "\n" + raw;
}
