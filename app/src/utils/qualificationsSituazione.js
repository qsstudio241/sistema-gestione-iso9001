/**
 * Filtro unificato "Situazione" — allineato a GET /qualifications/stats e param ?situazione=
 *
 * Un solo punto di controllo (le card statistiche): rimosso il menu a tendina
 * "Filtra per situazione" (09/08/2026, richiesta committente) — era ridondante
 * con le card per valide/in_scadenza_60/urgenti_30/scadute, e le sole due opzioni
 * che offriva in esclusiva (Sospese/Revocate) non erano distinguibili in
 * tabella comunque: la colonna "Stato" mostra entrambe come "Non attiva"
 * (semaforo grigio, v. QualificationsPage.jsx). Consolidate in un unico bucket
 * "non_attive", allineato alla card mancante e a getStats() lato backend.
 */
export const QUALIFICATION_SITUAZIONI = [
    { value: "valide", label: "Valide" },
    { value: "in_scadenza_60", label: "In scadenza (60 gg)" },
    { value: "urgenti_30", label: "Urgenti (30 gg)" },
    { value: "scadute", label: "Scadute" },
    { value: "non_attive", label: "Non attiva" },
];

/** Mappa chiavi stats bar → valore filtro situazione */
export const STATS_TO_SITUAZIONE = {
    total: "",
    valide: "valide",
    in_scadenza_60: "in_scadenza_60",
    in_scadenza_30: "urgenti_30",
    scadute: "scadute",
    non_attive: "non_attive",
};

export function toggleSituazione(current, next) {
    if (!next) return "";
    return current === next ? "" : next;
}

export function situazioneLabel(value) {
    if (!value) return null;
    return QUALIFICATION_SITUAZIONI.find((o) => o.value === value)?.label || value;
}
