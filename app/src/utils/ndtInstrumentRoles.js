/**
 * Ruoli strumento CND — etichette anagrafica (asset_subcategory) e allineabili
 * al selettore verbale (instrument_role). Valori stabili in inglese snake;
 * label in italiano. CND-5a: VT + MT/PT/UT senza parametri UT sul verbale.
 */

export const NDT_INSTRUMENT_ROLE_OPTIONS = [
    { value: "gauge",    label: "Calibro",  methods: ["VT"] },
    { value: "luxmeter", label: "Luxmetro", methods: ["VT"] },
    { value: "lamp",     label: "Lampada",  methods: ["VT", "MT", "PT"] },
    { value: "yoke",     label: "Giogo",    methods: ["MT"] },
    { value: "probe",    label: "Sonda",    methods: ["UT"] },
    { value: "pt_kit",   label: "Kit PT",   methods: ["PT"] },
    { value: "other",    label: "Altro",    methods: [] },
];

const ROLE_BY_VALUE = Object.fromEntries(
    NDT_INSTRUMENT_ROLE_OPTIONS.map((o) => [o.value, o])
);

/** Etichetta italiana per value noto; altrimenti il raw (legacy free-text). */
export function labelForInstrumentRole(value) {
    if (!value) return "";
    const known = ROLE_BY_VALUE[value];
    if (known) return known.label;
    return String(value);
}

/** True se value è un codice ruolo noto (non free-text legacy). */
export function isKnownInstrumentRole(value) {
    return Boolean(value && ROLE_BY_VALUE[value]);
}
