/**
 * documentTypeSchemas.js — Schemi tipo-specifici per la gestione documentale
 *
 * Ogni schema definisce:
 *   - fields: campi UI da mostrare nel form (oltre ai campi base)
 *   - aiPrompt: istruzioni specializzate per l'estrazione AI
 *   - aiExpectedSchema: struttura JSON attesa dall'AI (per validazione)
 *   - expiryField: chiave del campo che contiene la data di scadenza (semaforo)
 *   - rangeFields: campi che descrivono il range di qualifica (per future verifiche idoneità)
 *
 * Importare SEMPRE da qui. Non dichiarare schemi localmente nei componenti.
 * Estende documentTypes.js — i tipi devono essere già registrati là.
 */

// ??? patentino_saldatore (ISO 9606-1) ????????????????????????????????????????

const patentino_saldatore = {
  id: "patentino_saldatore",
  label: "Patentino saldatore (ISO 9606-1)",

  expiryField: "expiry_date",
  rangeFields: [
    "welding_process",
    "joint_type",
    "material_group",
    "filler_material_group",
    "welding_positions",
    "thickness_min_mm",
    "thickness_max_mm",
    "pipe_diameter_mm",
  ],

  fields: [
    {
      key: "welder_name",
      label: "Nome e cognome saldatore",
      type: "text",
      required: true,
      hint: "Es. Mario Rossi",
    },
    {
      key: "certificate_number",
      label: "Numero certificato",
      type: "text",
      required: true,
      hint: "Es. TÜV-IT-9606-2024-00123",
    },
    {
      key: "issuing_body",
      label: "Ente certificatore",
      type: "select",
      required: true,
      options: [
        { value: "tuv",   label: "TÜV" },
        { value: "bv",    label: "Bureau Veritas (BV)" },
        { value: "dnv",   label: "DNV GL" },
        { value: "rina",  label: "RINA" },
        { value: "imq",   label: "IMQ" },
        { value: "iqn",   label: "IQNet" },
        { value: "csq",   label: "CSQ / Certiquality" },
        { value: "altro", label: "Altro" },
      ],
      hint: "Organismo terzo che ha rilasciato il certificato",
    },
    {
      key: "welding_process",
      label: "Processo di saldatura",
      type: "select",
      required: true,
      options: [
        { value: "111",  label: "111 – Elettrodo rivestito (MMA)" },
        { value: "121",  label: "121 – Arco sommerso (SAW) filo" },
        { value: "131",  label: "131 – MIG (GMAW) filo solido" },
        { value: "135",  label: "135 – MAG (GMAW) filo solido" },
        { value: "136",  label: "136 – MAG filo animato (FCAW)" },
        { value: "138",  label: "138 – MAG filo animato metallo (MCAW)" },
        { value: "141",  label: "141 – TIG (GTAW) elettrodo tungsteno" },
        { value: "145",  label: "145 – TIG + filo freddo (GTAW-CW)" },
        { value: "311",  label: "311 – Ossiacetilenica (OAW)" },
        { value: "outro", label: "Altro" },
      ],
      hint: "Codice processo secondo ISO 4063",
    },
    {
      key: "joint_type",
      label: "Tipo di giunto",
      type: "select",
      required: true,
      options: [
        { value: "BW", label: "BW – Giunto testa a testa (Butt Weld)" },
        { value: "FW", label: "FW – Giunto a T / angolare (Fillet Weld)" },
      ],
      hint: "BW = full penetration, FW = angolare",
    },
    {
      key: "material_group",
      label: "Gruppo materiale base (ISO/TR 15608)",
      type: "select",
      required: true,
      options: [
        { value: "1.1", label: "1.1 – Acciai con Re ? 275 MPa" },
        { value: "1.2", label: "1.2 – Acciai con Re 275–360 MPa" },
        { value: "1.3", label: "1.3 – Acciai con Re > 360 MPa" },
        { value: "2",   label: "2 – Acciai a grani fini termotrattati" },
        { value: "3",   label: "3 – Acciai per alte temperature" },
        { value: "4",   label: "4 – Acciai bassolegati Cr-Mo" },
        { value: "5",   label: "5 – Acciai inossidabili martensitici/ferritici" },
        { value: "6",   label: "6 – Acciai inossidabili austenitici" },
        { value: "7",   label: "7 – Acciai inossidabili duplex" },
        { value: "8",   label: "8 – Acciai inossidabili austenitici ad alto Ni" },
        { value: "9",   label: "9 – Nichel e leghe di nichel" },
        { value: "10",  label: "10 – Rame e leghe di rame" },
        { value: "altro", label: "Altro" },
      ],
      hint: "Gruppo materiale della piastra / tubo qualificato",
    },
    {
      key: "filler_material_group",
      label: "Gruppo materiale d'apporto",
      type: "select",
      required: false,
      options: [
        { value: "FM1", label: "FM1" },
        { value: "FM2", label: "FM2" },
        { value: "FM3", label: "FM3" },
        { value: "FM4", label: "FM4" },
        { value: "FM5", label: "FM5" },
        { value: "FM6", label: "FM6" },
        { value: "nessuno", label: "Nessuno (TIG senza apporto)" },
      ],
      hint: "Classificazione ISO 14343 / 18274",
    },
    {
      key: "welding_positions",
      label: "Posizioni qualificate",
      type: "multiselect",
      required: false,
      options: [
        { value: "PA",     label: "PA – Piana / sotto testa" },
        { value: "PB",     label: "PB – Orizzontale su verticale" },
        { value: "PC",     label: "PC – Orizzontale" },
        { value: "PD",     label: "PD – Sopratesta orizzontale" },
        { value: "PE",     label: "PE – Sopratesta" },
        { value: "PF",     label: "PF – Verticale ascendente" },
        { value: "PG",     label: "PG – Verticale discendente" },
        { value: "H-L045", label: "H-L045 – Tubo inclinato 45°" },
        { value: "J-L045", label: "J-L045 – Tubo inclinato 45° discendente" },
      ],
      hint: "Posizioni di saldatura secondo ISO 6947 (seleziona tutte quelle incluse)",
    },
    {
      key: "thickness_min_mm",
      label: "Spessore qualificato — minimo (mm)",
      type: "number",
      required: false,
      hint: "Spessore minimo del range qualificato dalla prova",
    },
    {
      key: "thickness_max_mm",
      label: "Spessore qualificato — massimo (mm)",
      type: "number",
      required: false,
      hint: "Spessore massimo del range qualificato (es. 2t per piastre)",
    },
    {
      key: "pipe_diameter_mm",
      label: "Diametro tubi qualificato (mm)",
      type: "number",
      required: false,
      hint: "Diametro esterno del tubo di prova; lasciare vuoto se solo piastre",
    },
    {
      key: "shielding_gas",
      label: "Gas di protezione",
      type: "text",
      required: false,
      hint: "Es. M21, I1, C1 secondo ISO 14175; lasciare vuoto se non applicabile",
    },
    {
      key: "exam_date",
      label: "Data esame",
      type: "date",
      required: true,
      hint: "Data in cui si è svolta la prova di qualifica",
    },
    {
      key: "expiry_date",
      label: "Data scadenza (2 anni da esame)",
      type: "date",
      required: true,
      hint: "Calcolata automaticamente: data esame + 24 mesi. Modificabile se rinnovo anticipato.",
    },
    {
      key: "last_confirmation_date",
      label: "Data ultima conferma semestrale",
      type: "date",
      required: false,
      hint: "Il datore di lavoro deve confermare ogni 6 mesi che il saldatore è attivo",
    },
    {
      key: "next_confirmation_due",
      label: "Prossima conferma entro",
      type: "date",
      required: false,
      hint: "Calcolata: ultima conferma + 6 mesi. Aggiornare dopo ogni conferma del DL.",
    },
    {
      key: "standard_reference",
      label: "Norma di riferimento",
      type: "select",
      required: false,
      options: [
        { value: "ISO 9606-1:2012", label: "ISO 9606-1:2012 – Saldatura per fusione, acciai" },
        { value: "ISO 9606-2",      label: "ISO 9606-2 – Alluminio e leghe di alluminio" },
        { value: "ISO 14732",       label: "ISO 14732 – Qualifica operatori saldatura automatica" },
        { value: "EN 287-1",        label: "EN 287-1 (sostituita da ISO 9606-1)" },
      ],
      hint: "Norma tecnica di riferimento della qualifica",
    },
    {
      key: "notes",
      label: "Note",
      type: "textarea",
      required: false,
      hint: "Osservazioni aggiuntive, limitazioni particolari, ecc.",
    },
  ],

  aiPrompt: `Stai analizzando un certificato di qualifica saldatore secondo ISO 9606-1 (o norma equivalente).
Estrai TUTTI i seguenti campi e restituiscili nell'oggetto "type_specific_data" del JSON.
Se un campo non è presente nel documento, usa null.

Campi da estrarre:
- welder_name: nome e cognome del saldatore
- certificate_number: numero univoco del certificato
- issuing_body: ente certificatore (TÜV, Bureau Veritas, DNV, RINA, IMQ, ecc.)
- welding_process: codice processo ISO 4063 (111, 135, 141, ecc.)
- joint_type: tipo giunto — "BW" (testa a testa) o "FW" (angolare)
- material_group: gruppo materiale base ISO/TR 15608 (es. "1.1", "6", "8")
- filler_material_group: gruppo materiale d'apporto (FM1-FM6 o null)
- welding_positions: array di posizioni ISO 6947 (es. ["PA","PF","PC"])
- thickness_min_mm: numero — spessore minimo qualificato in mm
- thickness_max_mm: numero — spessore massimo qualificato in mm
- pipe_diameter_mm: numero — diametro esterno tubi qualificato in mm (null se solo piastre)
- shielding_gas: codice gas ISO 14175 (es. "M21", "I1") o null
- exam_date: data esame in formato ISO 8601 (YYYY-MM-DD) o null
- expiry_date: data scadenza in formato ISO 8601 (YYYY-MM-DD) o null
- last_confirmation_date: data ultima conferma datore di lavoro in formato ISO 8601 o null
- next_confirmation_due: data prossima conferma in formato ISO 8601 o null
- standard_reference: norma (es. "ISO 9606-1:2012") o null`,

  aiExpectedSchema: {
    welder_name: "string|null",
    certificate_number: "string|null",
    issuing_body: "string|null",
    welding_process: "string|null",
    joint_type: "BW|FW|null",
    material_group: "string|null",
    filler_material_group: "string|null",
    welding_positions: "string[]|null",
    thickness_min_mm: "number|null",
    thickness_max_mm: "number|null",
    pipe_diameter_mm: "number|null",
    shielding_gas: "string|null",
    exam_date: "YYYY-MM-DD|null",
    expiry_date: "YYYY-MM-DD|null",
    last_confirmation_date: "YYYY-MM-DD|null",
    next_confirmation_due: "YYYY-MM-DD|null",
    standard_reference: "string|null",
  },
};

// ??? wps (schema minimo — da sviluppare) ?????????????????????????????????????

const wps = {
  id: "wps",
  label: "WPS (Procedura di saldatura)",
  expiryField: null,
  rangeFields: ["welding_process", "material_group", "thickness_min_mm", "thickness_max_mm"],

  fields: [
    {
      key: "wps_number",
      label: "Numero WPS",
      type: "text",
      required: true,
      hint: "Es. WPS-141-001",
    },
    {
      key: "welding_process",
      label: "Processo di saldatura (ISO 4063)",
      type: "text",
      required: true,
      hint: "Es. 141, 135",
    },
    {
      key: "base_material",
      label: "Materiale base",
      type: "text",
      required: false,
      hint: "Es. S355J2, AISI 316L",
    },
    {
      key: "thickness_min_mm",
      label: "Spessore min (mm)",
      type: "number",
      required: false,
    },
    {
      key: "thickness_max_mm",
      label: "Spessore max (mm)",
      type: "number",
      required: false,
    },
    {
      key: "wpqr_ref",
      label: "WPQR di riferimento",
      type: "text",
      required: false,
      hint: "Numero del WPQR che qualifica questa WPS",
    },
  ],

  aiPrompt: `Stai analizzando una WPS (Welding Procedure Specification) secondo ISO 15614.
Estrai nell'oggetto "type_specific_data": wps_number, welding_process, base_material,
thickness_min_mm, thickness_max_mm, wpqr_ref. Usa null per i campi non trovati.`,

  aiExpectedSchema: {
    wps_number: "string|null",
    welding_process: "string|null",
    base_material: "string|null",
    thickness_min_mm: "number|null",
    thickness_max_mm: "number|null",
    wpqr_ref: "string|null",
  },
};

// ??? norma (schema minimo — da sviluppare) ????????????????????????????????????

const norma = {
  id: "norma",
  label: "Norma tecnica",
  expiryField: null,
  rangeFields: [],

  fields: [
    {
      key: "standard_code",
      label: "Codice norma",
      type: "text",
      required: true,
      hint: "Es. ISO 9606-1:2012, EN 15085-2",
    },
    {
      key: "issuing_body",
      label: "Ente emittente",
      type: "text",
      required: false,
      hint: "Es. ISO, CEN, UNI, DIN",
    },
    {
      key: "edition_year",
      label: "Anno edizione",
      type: "number",
      required: false,
      hint: "Anno di pubblicazione dell'edizione acquistata",
    },
    {
      key: "supersedes",
      label: "Sostituisce",
      type: "text",
      required: false,
      hint: "Norma precedente sostituita da questa edizione",
    },
  ],

  aiPrompt: `Stai analizzando una norma tecnica (ISO, EN, UNI, DIN, ecc.).
Estrai nell'oggetto "type_specific_data": standard_code, issuing_body, edition_year, supersedes.
Usa null per i campi non trovati.`,

  aiExpectedSchema: {
    standard_code: "string|null",
    issuing_body: "string|null",
    edition_year: "number|null",
    supersedes: "string|null",
  },
};

// ??? Registro schemi ??????????????????????????????????????????????????????????

/**
 * Mappa doc_type ? schema.
 * Usare getSchemaForDocType(docType) per accesso sicuro.
 */
const DOCUMENT_TYPE_SCHEMAS = {
  patentino_saldatore,
  wps,
  norma,
};

/**
 * Restituisce lo schema per il tipo documento dato, o null se non esiste.
 * @param {string|null|undefined} docType
 * @returns {object|null}
 */
export function getSchemaForDocType(docType) {
  return DOCUMENT_TYPE_SCHEMAS[docType] || null;
}

export default DOCUMENT_TYPE_SCHEMAS;
