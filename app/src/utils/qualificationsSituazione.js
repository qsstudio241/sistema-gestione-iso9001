/**
 * Filtro unificato "Situazione" — allineato a GET /qualifications/stats e param ?situazione=
 */

export const QUALIFICATION_SITUAZIONI = [
    { value: "valide", label: "Valide" },
    { value: "in_scadenza_60", label: "In scadenza (60 gg)" },
    { value: "urgenti_30", label: "Urgenti (30 gg)" },
    { value: "scadute", label: "Scadute" },
    { value: "sospesa", label: "Sospese" },
    { value: "revocata", label: "Revocate" },
];

/** Mappa chiavi stats bar → valore filtro situazione */
export const STATS_TO_SITUAZIONE = {
    total: "",
    valide: "valide",
    in_scadenza_60: "in_scadenza_60",
    in_scadenza_30: "urgenti_30",
    scadute: "scadute",
};

export function toggleSituazione(current, next) {
    if (!next) return "";
    return current === next ? "" : next;
}

export function situazioneLabel(value) {
    if (!value) return null;
    return QUALIFICATION_SITUAZIONI.find((o) => o.value === value)?.label || value;
}
