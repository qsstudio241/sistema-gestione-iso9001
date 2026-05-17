/**
 * documentTypes.js  Fonte unica di verit per tipi e stati documento
 *
 * Importare SEMPRE da qui. Non dichiarare DOC_TYPE_LABELS o DOC_STATUS_LABELS
 * localmente nei componenti (causa divergenze tra form, catalogo e pannello dettaglio).
 *
 * Esteso da documentTypeSchemas.js (schemi per tipo con campi specifici, prompt AI, alert).
 */

// ??? Tipi documento ???????????????????????????????????????????????????????????

export const DOC_TYPE_OPTIONS = [
  { value: "procedura",          label: "Procedura" },
  { value: "istruzione",         label: "Istruzione operativa" },
  { value: "modulo",             label: "Modulo / Registrazione" },
  { value: "manuale",            label: "Manuale" },
  { value: "norma",              label: "Norma tecnica" },
  { value: "qualifica",          label: "Qualifica personale" },
  { value: "patentino_saldatore",label: "Patentino saldatore (ISO 9606-1)" },
  { value: "qualifica_14732",    label: "Qualifica operatore (ISO 14732)" },
  { value: "wps",                label: "WPS (Procedura saldatura)" },
  { value: "wpqr",               label: "WPQR (Qualifica procedura)" },
  { value: "cert_ndt",           label: "Certificato NDT (ISO 9712)" },
  { value: "cert_taratura",      label: "Certificato taratura" },
  { value: "dichiarazione_ce",   label: "Dichiarazione CE" },
  { value: "report_ndt",         label: "Rapporto di prova NDT" },
  { value: "piano_qualita",      label: "Piano qualit" },
  { value: "altro",              label: "Altro" },
];

/** Mappa value ? label. Usare per visualizzare il tipo in tabelle e pannelli. */
export const DOC_TYPE_LABELS = Object.fromEntries(
  DOC_TYPE_OPTIONS.map(({ value, label }) => [value, label])
);

/**
 * Raggruppa i tipi per area funzionale.
 * Usato nel form di selezione tipo (Step 1 del wizard).
 */
export const DOC_TYPE_GROUPS = [
  {
    group: "SGQ  Sistema Gestione Qualit",
    types: ["procedura", "istruzione", "modulo", "manuale", "norma", "piano_qualita", "altro"],
  },
  {
    group: "Personale e qualifiche",
    types: ["qualifica", "patentino_saldatore", "qualifica_14732", "cert_ndt"],
  },
  {
    group: "Saldatura ISO 3834",
    types: ["wps", "wpqr", "report_ndt"],
  },
  {
    group: "Attrezzature e conformit",
    types: ["cert_taratura", "dichiarazione_ce"],
  },
];

// ??? Stati documento ??????????????????????????????????????????????????????????

export const DOC_STATUS_OPTIONS = [
  { value: "vigente",          label: "Vigente" },
  { value: "rilasciato",       label: "Rilasciato" },
  { value: "bozza",            label: "Bozza" },
  { value: "in_revisione",     label: "In revisione" },
  { value: "in_approvazione",  label: "In approvazione" },
  { value: "obsoleto",         label: "Obsoleto" },
];

/** Mappa value ? label. Copre tutti i valori inclusi 'rilasciato' e 'vigente' (sinonimi). */
export const DOC_STATUS_LABELS = Object.fromEntries(
  DOC_STATUS_OPTIONS.map(({ value, label }) => [value, label])
);

/**
 * Classe CSS badge per stato documento nel DocumentDetailPanel.
 */
export const DOC_STATUS_BADGE_CLASS = {
  vigente:         "doc-detail__badge--green",
  rilasciato:      "doc-detail__badge--green",
  bozza:           "doc-detail__badge--blue",
  in_revisione:    "doc-detail__badge--yellow",
  in_approvazione: "doc-detail__badge--yellow",
  obsoleto:        "doc-detail__badge--grey",
};
