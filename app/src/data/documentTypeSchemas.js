/**
 * documentTypeSchemas.js � Schemi tipo-specifici per la gestione documentale
 *
 * Ogni schema definisce:
 *   - fields: campi UI da mostrare nel form (oltre ai campi base)
 *   - aiPrompt: istruzioni specializzate per l'estrazione AI
 *   - aiExpectedSchema: struttura JSON attesa dall'AI (per validazione)
 *   - expiryField: chiave del campo che contiene la data di scadenza (semaforo)
 *   - rangeFields: campi che descrivono il range di qualifica (per future verifiche idoneit�)
 *
 * Importare SEMPRE da qui. Non dichiarare schemi localmente nei componenti.
 * Estende documentTypes.js � i tipi devono essere gi� registrati l�.
 */

// ??? patentino_saldatore (ISO 9606-1) ????????????????????????????????????????

const patentino_saldatore = {
  id: "patentino_saldatore",
  label: "Patentino saldatore (ISO 9606-1)",

  expiryField: "expiry_date",
  rangeFields: [
    "welding_process",
    "joint_type",
    "product_type",
    "material_group",
    "filler_material_group",
    "welding_positions",
    "thickness_min_mm",
    "thickness_max_mm",
    "pipe_diameter_min_mm",
    "pipe_diameter_max_mm",
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
      hint: "Es. T�V-IT-9606-2024-00123",
    },
    {
      key: "issuing_body",
      label: "Ente certificatore",
      type: "select",
      required: true,
      options: [
        { value: "tuv",   label: "T�V" },
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
      key: "examiner_body",
      label: "Organismo esaminatore",
      type: "text",
      required: false,
      hint: "Esaminatore/organismo che ha condotto la prova, se diverso dall'ente emittente",
    },
    {
      key: "welding_process",
      label: "Processo di saldatura",
      type: "select",
      required: true,
      options: [
        { value: "111",  label: "111 � Elettrodo rivestito (MMA)" },
        { value: "121",  label: "121 � Arco sommerso (SAW) filo" },
        { value: "131",  label: "131 � MIG (GMAW) filo solido" },
        { value: "135",  label: "135 � MAG (GMAW) filo solido" },
        { value: "136",  label: "136 � MAG filo animato (FCAW)" },
        { value: "138",  label: "138 � MAG filo animato metallo (MCAW)" },
        { value: "141",  label: "141 � TIG (GTAW) elettrodo tungsteno" },
        { value: "145",  label: "145 � TIG + filo freddo (GTAW-CW)" },
        { value: "15",   label: "15 � Plasma (PAW)" },
        { value: "311",  label: "311 � Ossiacetilenica (OAW)" },
        { value: "altro", label: "Altro" },
      ],
      hint: "Codice processo secondo ISO 4063",
    },
    {
      key: "joint_type",
      label: "Tipo di giunto",
      type: "select",
      required: true,
      options: [
        { value: "BW", label: "BW � Giunto testa a testa (Butt Weld)" },
        { value: "FW", label: "FW � Giunto a T / angolare (Fillet Weld)" },
      ],
      hint: "BW = full penetration, FW = angolare",
    },
    {
      key: "product_type",
      label: "Tipo prodotto",
      type: "select",
      required: false,
      options: [
        { value: "P", label: "P � Lamiera / piastra" },
        { value: "T", label: "T � Tubo" },
      ],
      hint: "P se la prova \u00e8 su lamiera, T se su tubo (ISO 9606-1)",
    },
    {
      key: "weld_details",
      label: "Dettagli giunto",
      type: "text",
      required: false,
      hint: "Es. ss nb (single side, no backing), bs (both sides), sl/ml (single/multi layer)",
    },
    {
      key: "material_group",
      label: "Gruppo materiale base (ISO/TR 15608)",
      type: "select",
      required: true,
      options: [
        { value: "1.1", label: "1.1 � Acciai con Re ? 275 MPa" },
        { value: "1.2", label: "1.2 � Acciai con Re 275�360 MPa" },
        { value: "1.3", label: "1.3 � Acciai con Re > 360 MPa" },
        { value: "2",   label: "2 � Acciai a grani fini termotrattati" },
        { value: "3",   label: "3 � Acciai per alte temperature" },
        { value: "4",   label: "4 � Acciai bassolegati Cr-Mo" },
        { value: "5",   label: "5 � Acciai inossidabili martensitici/ferritici" },
        { value: "6",   label: "6 � Acciai inossidabili austenitici" },
        { value: "7",   label: "7 � Acciai inossidabili duplex" },
        { value: "8",   label: "8 � Acciai inossidabili austenitici ad alto Ni" },
        { value: "9",   label: "9 � Nichel e leghe di nichel" },
        { value: "10",  label: "10 � Rame e leghe di rame" },
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
        { value: "PA",     label: "PA � Piana / sotto testa" },
        { value: "PB",     label: "PB � Orizzontale su verticale" },
        { value: "PC",     label: "PC � Orizzontale" },
        { value: "PD",     label: "PD � Sopratesta orizzontale" },
        { value: "PE",     label: "PE � Sopratesta" },
        { value: "PF",     label: "PF � Verticale ascendente" },
        { value: "PG",     label: "PG � Verticale discendente" },
        { value: "H-L045", label: "H-L045 � Tubo inclinato 45�" },
        { value: "J-L045", label: "J-L045 � Tubo inclinato 45� discendente" },
      ],
      hint: "Posizioni di saldatura secondo ISO 6947 (seleziona tutte quelle incluse)",
    },
    {
      key: "thickness_min_mm",
      label: "Spessore qualificato � minimo (mm)",
      type: "number",
      required: false,
      hint: "Spessore minimo del range qualificato dalla prova",
    },
    {
      key: "thickness_max_mm",
      label: "Spessore qualificato � massimo (mm)",
      type: "number",
      required: false,
      hint: "Spessore massimo del range qualificato (es. 2t per piastre)",
    },
    {
      key: "pipe_diameter_min_mm",
      label: "Diametro tubi qualificato � minimo (mm)",
      type: "number",
      required: false,
      hint: "Diametro esterno minimo qualificato; lasciare vuoto se solo lamiera",
    },
    {
      key: "pipe_diameter_max_mm",
      label: "Diametro tubi qualificato � massimo (mm)",
      type: "number",
      required: false,
      hint: "Diametro esterno massimo qualificato; lasciare vuoto se solo lamiera",
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
      hint: "Data in cui si � svolta la prova di qualifica",
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
      hint: "Il datore di lavoro deve confermare ogni 6 mesi che il saldatore � attivo",
    },
    {
      key: "next_confirmation_due",
      label: "Prossima conferma entro",
      type: "date",
      required: false,
      hint: "Calcolata: ultima conferma + 6 mesi. Aggiornare dopo ogni conferma del DL.",
    },
    {
      key: "revalidation_date",
      label: "Data revalidazione",
      type: "date",
      required: false,
      hint: "Revalidazione della qualifica (validit\u00e0 estesa, di norma 3 anni).",
    },
    {
      key: "standard_reference",
      label: "Norma di riferimento",
      type: "select",
      required: false,
      options: [
        { value: "ISO 9606-1:2012", label: "ISO 9606-1:2012 � Saldatura per fusione, acciai" },
        { value: "ISO 9606-2",      label: "ISO 9606-2 � Alluminio e leghe di alluminio" },
        { value: "ISO 14732",       label: "ISO 14732 � Qualifica operatori saldatura automatica" },
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
Se un campo non � presente nel documento, usa null.

Campi da estrarre:
- welder_name: nome e cognome del saldatore
- certificate_number: numero univoco del certificato
- issuing_body: ente che emette/certifica il patentino (T�V, Bureau Veritas, DNV, RINA, IIS, IMQ, ecc.)
- examiner_body: organismo/esaminatore che ha condotto la prova, se diverso dall'ente emittente (altrimenti null)
- welding_process: codice processo ISO 4063 (111, 121, 131, 135, 136, 138, 141, 145, 15, 311, ecc.)
- joint_type: tipo giunto � "BW" (testa a testa) o "FW" (angolare)
- product_type: "P" se la prova � su lamiera/piastra, "T" se su tubo
- weld_details: dettagli giunto/condizioni (es. "ss nb", "bs", "sl", "ml")
- material_group: gruppo materiale base ISO/TR 15608 (es. "1.1", "6", "8")
- filler_material_group: gruppo materiale d'apporto (FM1-FM6 o null)
- welding_positions: array di posizioni ISO 6947 (es. ["PA","PF","PC"])
- thickness_min_mm: numero � spessore minimo qualificato in mm
- thickness_max_mm: numero � spessore massimo qualificato in mm
- pipe_diameter_min_mm: numero � diametro esterno tubi minimo in mm (null se solo lamiera)
- pipe_diameter_max_mm: numero � diametro esterno tubi massimo in mm (null se solo lamiera)
- shielding_gas: codice gas ISO 14175 (es. "M21", "I1") o null
- exam_date: data esame in formato ISO 8601 (YYYY-MM-DD) o null
- expiry_date: data scadenza in formato ISO 8601 (YYYY-MM-DD) o null
- last_confirmation_date: data ultima conferma datore di lavoro in formato ISO 8601 o null
- next_confirmation_due: data prossima conferma in formato ISO 8601 o null
- revalidation_date: data revalidazione (validit� estesa, di norma 3 anni) in formato ISO 8601 o null
- standard_reference: norma (es. "ISO 9606-1:2012") o null`,

  aiExpectedSchema: {
    welder_name: "string|null",
    certificate_number: "string|null",
    issuing_body: "string|null",
    examiner_body: "string|null",
    welding_process: "string|null",
    joint_type: "BW|FW|null",
    product_type: "P|T|null",
    weld_details: "string|null",
    material_group: "string|null",
    filler_material_group: "string|null",
    welding_positions: "string[]|null",
    thickness_min_mm: "number|null",
    thickness_max_mm: "number|null",
    pipe_diameter_min_mm: "number|null",
    pipe_diameter_max_mm: "number|null",
    shielding_gas: "string|null",
    exam_date: "YYYY-MM-DD|null",
    expiry_date: "YYYY-MM-DD|null",
    last_confirmation_date: "YYYY-MM-DD|null",
    next_confirmation_due: "YYYY-MM-DD|null",
    revalidation_date: "YYYY-MM-DD|null",
    standard_reference: "string|null",
  },
};

// ??? wps (schema minimo � da sviluppare) ?????????????????????????????????????

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

// ??? norma (Norma tecnica � schema completo) ?????????????????????????????????

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
      placeholder: "es. BS EN ISO 9606-1:2017",
    },
    {
      key: "norm_title",
      label: "Titolo ufficiale",
      type: "text",
      required: false,
      placeholder: "es. Qualification testing of welders...",
    },
    {
      key: "issuing_body",
      label: "Ente emittente",
      type: "select",
      required: false,
      options: [
        { value: "ISO",   label: "ISO" },
        { value: "CEN",   label: "CEN" },
        { value: "BSI",   label: "BSI" },
        { value: "UNI",   label: "UNI" },
        { value: "DIN",   label: "DIN" },
        { value: "AFNOR", label: "AFNOR" },
        { value: "ANSI",  label: "ANSI" },
        { value: "AWS",   label: "AWS" },
        { value: "ASME",  label: "ASME" },
        { value: "altro", label: "Altro" },
      ],
    },
    {
      key: "edition_year",
      label: "Anno edizione",
      type: "number",
      required: false,
    },
    {
      key: "supersedes",
      label: "Sostituisce",
      type: "text",
      required: false,
      placeholder: "es. ISO 9606-1:2013",
    },
    {
      key: "validity_status",
      label: "Stato",
      type: "select",
      required: false,
      options: [
        { value: "vigente",      label: "Vigente" },
        { value: "superata",     label: "Superata" },
        { value: "annullata",    label: "Annullata" },
        { value: "in_revisione", label: "In revisione" },
      ],
    },
    {
      key: "language",
      label: "Lingua",
      type: "select",
      required: false,
      options: [
        { value: "it",    label: "Italiano" },
        { value: "en",    label: "Inglese" },
        { value: "de",    label: "Tedesco" },
        { value: "fr",    label: "Francese" },
        { value: "es",    label: "Spagnolo" },
        { value: "multi", label: "Multilingua" },
      ],
    },
    {
      key: "scope_summary",
      label: "Oggetto/Scopo",
      type: "textarea",
      required: false,
      placeholder: "Breve descrizione dell'ambito della norma",
    },
    {
      key: "ics_code",
      label: "Codice ICS",
      type: "text",
      required: false,
      placeholder: "es. 25.160.01",
    },
    {
      key: "technical_committee",
      label: "Comitato tecnico",
      type: "text",
      required: false,
      placeholder: "es. ISO/TC 44",
    },
    {
      key: "is_harmonized",
      label: "Norma armonizzata EN",
      type: "boolean",
      required: false,
    },
  ],

  aiPrompt: `Stai analizzando una norma tecnica (ISO, EN, UNI, DIN, ecc.).
Estrai nell'oggetto "type_specific_data":
- standard_code: il codice completo (es. "BS EN ISO 9606-1:2017")
- norm_title: il titolo ufficiale senza il codice
- issuing_body: l'ente emittente principale (ISO, CEN, BSI, UNI, DIN, ecc.)
- edition_year: anno di pubblicazione/edizione
- supersedes: norma sostituita (se indicato)
- validity_status: "vigente" (default se non specificato)
- language: codice lingua del documento (it, en, de, fr)
- scope_summary: oggetto/scopo dalla Sezione 1 (max 200 caratteri)
- ics_code: codice ICS se presente
- technical_committee: comitato tecnico responsabile
- is_harmonized: true se � una norma EN armonizzata
Usa null per i campi non trovati.`,

  aiExpectedSchema: {
    standard_code: "string|null",
    norm_title: "string|null",
    issuing_body: "string|null",
    edition_year: "number|null",
    supersedes: "string|null",
    validity_status: "vigente|superata|annullata|in_revisione|null",
    language: "it|en|de|fr|es|multi|null",
    scope_summary: "string|null",
    ics_code: "string|null",
    technical_committee: "string|null",
    is_harmonized: "boolean|null",
  },
};

// --- certificato_materiale (EN 10204) ---

const certificato_materiale = {
  id: "certificato_materiale",
  label: "Certificato materiale (EN 10204)",
  expiryField: null,
  rangeFields: ["material_grade", "heat_number"],
  fields: [
    { key: "certificate_type", label: "Tipo certificato EN 10204", type: "select", required: true,
      options: [
        { value: "2.1", label: "2.1 � Dichiarazione di conformit�" },
        { value: "2.2", label: "2.2 � Dichiarazione con ispezione campione" },
        { value: "3.1", label: "3.1 � Certificato di ispezione 3.1" },
        { value: "3.2", label: "3.2 � Certificato di ispezione 3.2" },
      ] },
    { key: "material_grade", label: "Grado / designazione materiale", type: "text", required: true },
    { key: "heat_number", label: "Colata / heat number", type: "text", required: false },
    { key: "supplier_name", label: "Fornitore materiale", type: "text", required: false },
    { key: "issue_date", label: "Data emissione", type: "date", required: false },
  ],
  aiPrompt: `Stai analizzando un certificato materiale EN 10204 (mill certificate).
Estrai in type_specific_data: certificate_type (2.1|2.2|3.1|3.2), material_grade, heat_number,
supplier_name, issue_date (YYYY-MM-DD). Usa null se assente.`,
  aiExpectedSchema: {
    certificate_type: "2.1|2.2|3.1|3.2|null",
    material_grade: "string|null",
    heat_number: "string|null",
    supplier_name: "string|null",
    issue_date: "YYYY-MM-DD|null",
  },
};

// --- cert_ndt (ISO 9712) ---

const cert_ndt = {
  id: "cert_ndt",
  label: "Certificato NDT (ISO 9712)",
  expiryField: "expiry_date",
  rangeFields: ["ndt_method", "certification_level"],
  fields: [
    { key: "operator_name", label: "Nome operatore", type: "text", required: true },
    { key: "certificate_number", label: "Numero certificato", type: "text", required: true },
    { key: "ndt_method", label: "Metodo NDT", type: "select", required: true,
      options: [
        { value: "UT", label: "UT � Ultrasoni" },
        { value: "RT", label: "RT � Raggi X" },
        { value: "MT", label: "MT � Magnetoscopia" },
        { value: "PT", label: "PT � Liquidi penetranti" },
        { value: "VT", label: "VT � Visivo" },
      ] },
    { key: "certification_level", label: "Livello", type: "select", required: false,
      options: [
        { value: "1", label: "Livello 1" },
        { value: "2", label: "Livello 2" },
        { value: "3", label: "Livello 3" },
      ] },
    { key: "issuing_body", label: "Ente certificatore", type: "text", required: false },
    { key: "exam_date", label: "Data esame", type: "date", required: false },
    { key: "expiry_date", label: "Data scadenza", type: "date", required: true },
  ],
  aiPrompt: `Stai analizzando un certificato di qualifica operatore NDT secondo ISO 9712.
Estrai in type_specific_data: operator_name, certificate_number, ndt_method (UT|RT|MT|PT|VT),
certification_level (1|2|3), issuing_body, exam_date, expiry_date (YYYY-MM-DD). Usa null se assente.`,
  aiExpectedSchema: {
    operator_name: "string|null",
    certificate_number: "string|null",
    ndt_method: "UT|RT|MT|PT|VT|null",
    certification_level: "1|2|3|null",
    issuing_body: "string|null",
    exam_date: "YYYY-MM-DD|null",
    expiry_date: "YYYY-MM-DD|null",
  },
};

// --- cert_taratura ---

const cert_taratura = {
  id: "cert_taratura",
  label: "Certificato taratura",
  expiryField: "expiry_date",
  rangeFields: ["instrument_type"],
  fields: [
    { key: "instrument_id", label: "Identificativo strumento", type: "text", required: true },
    { key: "instrument_type", label: "Tipo strumento", type: "text", required: false },
    { key: "calibration_lab", label: "Laboratorio taratura", type: "text", required: false },
    { key: "certificate_number", label: "Numero certificato", type: "text", required: false },
    { key: "calibration_date", label: "Data taratura", type: "date", required: true },
    { key: "expiry_date", label: "Scadenza taratura", type: "date", required: true },
  ],
  aiPrompt: `Stai analizzando un certificato di taratura/calibrazione strumento di misura.
Estrai in type_specific_data: instrument_id, instrument_type, calibration_lab, certificate_number,
calibration_date, expiry_date (YYYY-MM-DD). Usa null se assente.`,
  aiExpectedSchema: {
    instrument_id: "string|null",
    instrument_type: "string|null",
    calibration_lab: "string|null",
    certificate_number: "string|null",
    calibration_date: "YYYY-MM-DD|null",
    expiry_date: "YYYY-MM-DD|null",
  },
};

// --- qualifica_14732 ---

const qualifica_14732 = {
  id: "qualifica_14732",
  label: "Qualifica operatore (ISO 14732)",
  expiryField: "expiry_date",
  rangeFields: ["welding_process", "equipment_type"],
  fields: [
    { key: "operator_name", label: "Nome operatore", type: "text", required: true },
    { key: "certificate_number", label: "Numero qualifica", type: "text", required: true },
    { key: "welding_process", label: "Processo / equipaggiamento", type: "text", required: false },
    { key: "equipment_type", label: "Tipo macchina saldatura", type: "text", required: false },
    { key: "exam_date", label: "Data esame", type: "date", required: false },
    { key: "expiry_date", label: "Data scadenza", type: "date", required: true },
  ],
  aiPrompt: `Stai analizzando una qualifica operatore saldatura automatica ISO 14732.
Estrai in type_specific_data: operator_name, certificate_number, welding_process, equipment_type,
exam_date, expiry_date (YYYY-MM-DD). Usa null se assente.`,
  aiExpectedSchema: {
    operator_name: "string|null",
    certificate_number: "string|null",
    welding_process: "string|null",
    equipment_type: "string|null",
    exam_date: "YYYY-MM-DD|null",
    expiry_date: "YYYY-MM-DD|null",
  },
};

// --- qualifica_14731 (Coordinatore saldatura ISO 14731) ---

const qualifica_14731 = {
  id: "qualifica_14731",
  label: "Coordinatore saldatura (ISO 14731)",
  expiryField: "cpd_valid_until",
  rangeFields: ["coordinator_title"],
  fields: [
    { key: "person_name", label: "Nome e cognome", type: "text", required: true },
    { key: "certificate_number", label: "Numero certificato", type: "text", required: false },
    { key: "coordinator_title", label: "Titolo", type: "select", required: false,
      options: [
        { value: "IWE", label: "IWE \u2014 International Welding Engineer" },
        { value: "IWT", label: "IWT \u2014 International Welding Technologist" },
        { value: "IWS", label: "IWS \u2014 International Welding Specialist" },
        { value: "IWP", label: "IWP \u2014 International Welding Practitioner" },
      ] },
    { key: "diploma_number", label: "Numero diploma", type: "text", required: false },
    { key: "issuing_body", label: "Ente certificatore", type: "text", required: false },
    { key: "issue_date", label: "Data emissione", type: "date", required: false },
    { key: "cpd_valid_until", label: "CPD valida fino a", type: "date", required: false },
  ],
  aiPrompt: `Diploma/certificato coordinatore di saldatura ISO 14731 (IWE, IWT, IWS, IWP).
Estrai in type_specific_data: person_name, certificate_number, coordinator_title (IWE|IWT|IWS|IWP),
diploma_number, issuing_body, issue_date, cpd_valid_until (YYYY-MM-DD). Usa null se assente.`,
  aiExpectedSchema: {
    person_name: "string|null",
    certificate_number: "string|null",
    coordinator_title: "IWE|IWT|IWS|IWP|null",
    diploma_number: "string|null",
    issuing_body: "string|null",
    issue_date: "YYYY-MM-DD|null",
    cpd_valid_until: "YYYY-MM-DD|null",
  },
};

// --- pes_pav (Abilitazione PES/PAV CEI 11-27) ---

const pes_pav = {
  id: "pes_pav",
  label: "Abilitazione PES/PAV (CEI 11-27)",
  expiryField: "expiry_date",
  rangeFields: ["patent_type"],
  fields: [
    { key: "person_name", label: "Nome e cognome", type: "text", required: true },
    { key: "patent_type", label: "Tipo abilitazione", type: "select", required: false,
      options: [
        { value: "PES", label: "PES" },
        { value: "PAV", label: "PAV" },
        { value: "PES+PAV", label: "PES+PAV" },
      ] },
    { key: "training_body", label: "Ente formatore", type: "text", required: false },
    { key: "certificate_number", label: "Numero attestato", type: "text", required: false },
    { key: "issue_date", label: "Data emissione", type: "date", required: false },
    { key: "expiry_date", label: "Data scadenza", type: "date", required: false },
  ],
  aiPrompt: `Attestato PES/PAV addetti ai lavori elettrici CEI 11-27.
Estrai in type_specific_data: person_name, patent_type (PES|PAV|PES+PAV), training_body,
certificate_number, issue_date, expiry_date (YYYY-MM-DD). Usa null se assente.`,
  aiExpectedSchema: {
    person_name: "string|null",
    patent_type: "PES|PAV|PES+PAV|null",
    training_body: "string|null",
    certificate_number: "string|null",
    issue_date: "YYYY-MM-DD|null",
    expiry_date: "YYYY-MM-DD|null",
  },
};

// --- wpqr ---

const wpqr = {
  id: "wpqr",
  label: "WPQR (Qualifica procedura)",
  expiryField: null,
  rangeFields: ["welding_process", "material_group", "thickness_test_mm"],
  fields: [
    { key: "wpqr_number", label: "Numero WPQR", type: "text", required: true },
    { key: "welding_process", label: "Processo ISO 4063", type: "text", required: true },
    { key: "material_group", label: "Gruppo materiale", type: "text", required: false },
    { key: "thickness_test_mm", label: "Spessore prova (mm)", type: "number", required: false },
    { key: "approval_date", label: "Data approvazione", type: "date", required: false },
    { key: "standard_reference", label: "Norma riferimento", type: "text", required: false },
  ],
  aiPrompt: `Stai analizzando un WPQR (Welding Procedure Qualification Record) ISO 15614.
Estrai in type_specific_data: wpqr_number, welding_process, material_group, thickness_test_mm,
approval_date (YYYY-MM-DD), standard_reference. Usa null se assente.`,
  aiExpectedSchema: {
    wpqr_number: "string|null",
    welding_process: "string|null",
    material_group: "string|null",
    thickness_test_mm: "number|null",
    approval_date: "YYYY-MM-DD|null",
    standard_reference: "string|null",
  },
};

// --- sal / rdp (roadmap � schemi base) ---

const sal = {
  id: "sal",
  label: "SAL � Stato avanzamento lavori",
  expiryField: null,
  rangeFields: [],
  fields: [
    { key: "client_name", label: "Cliente", type: "text", required: false },
    { key: "standards_tracked", label: "Standard monitorati", type: "text", required: false,
      hint: "Es. ISO 9001, ISO 14001" },
    { key: "period_label", label: "Periodo / revisione", type: "text", required: false },
  ],
  aiPrompt: `Documento SAL (Stato Avanzamento Lavori consulenza SGQ).
Estrai in type_specific_data: client_name, standards_tracked, period_label. Usa null se assente.`,
  aiExpectedSchema: {
    client_name: "string|null",
    standards_tracked: "string|null",
    period_label: "string|null",
  },
};

const rdp = {
  id: "rdp",
  label: "RDP � Rapporto di prova",
  expiryField: null,
  rangeFields: ["test_type"],
  fields: [
    { key: "report_number", label: "Numero rapporto", type: "text", required: true },
    { key: "test_type", label: "Tipo prova", type: "text", required: false },
    { key: "component_ref", label: "Riferimento componente", type: "text", required: false },
    { key: "test_date", label: "Data prova", type: "date", required: false },
  ],
  aiPrompt: `Rapporto di prova (RDP) saldatura / collaudo.
Estrai in type_specific_data: report_number, test_type, component_ref, test_date (YYYY-MM-DD). Usa null se assente.`,
  aiExpectedSchema: {
    report_number: "string|null",
    test_type: "string|null",
    component_ref: "string|null",
    test_date: "YYYY-MM-DD|null",
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
  wpqr,
  norma,
  certificato_materiale,
  cert_ndt,
  cert_taratura,
  qualifica_14732,
  qualifica_14731,
  pes_pav,
  sal,
  rdp,
};

// Alias tipo documento -> chiave schema canonica (coerenza document_type_guess FE/BE).
const DOC_TYPE_ALIASES = {
  qualifica_operatore: "qualifica_14732",
};

/**
 * Restituisce lo schema per il tipo documento dato, o null se non esiste.
 * @param {string|null|undefined} docType
 * @returns {object|null}
 */
export function getSchemaForDocType(docType) {
  const key = String(docType || "").trim();
  return DOCUMENT_TYPE_SCHEMAS[DOC_TYPE_ALIASES[key] || key] || null;
}

export default DOCUMENT_TYPE_SCHEMAS;
