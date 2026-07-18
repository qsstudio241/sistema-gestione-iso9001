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
 * Estende documentTypes.js — i tipi devono essere già registrati lì.
 */

import { getMaterialGroupSelectOptions } from './materialGroups15608.js';
import { getWeldingProcessSelectOptions } from './weldingProcesses4063.js';
import { getWeldingPositionSelectOptions } from './weldingPositions6947.js';

const MATERIAL_GROUP_OPTIONS = getMaterialGroupSelectOptions({
  families: ['steel', 'aluminium', 'copper', 'nickel', 'titanium', 'zirconium', 'cast_iron'],
});
const WELDING_PROCESS_OPTIONS = getWeldingProcessSelectOptions();
const WELDING_POSITION_OPTIONS = getWeldingPositionSelectOptions();

// --- patentino_saldatore (ISO 9606-1) 

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
        { value: "tuv",         label: "TÜV" },
        { value: "bv",          label: "Bureau Veritas (BV)" },
        { value: "dnv",         label: "DNV GL" },
        { value: "rina",        label: "RINA" },
        { value: "imq",         label: "IMQ" },
        { value: "iqn",         label: "IQNet" },
        { value: "csq",         label: "CSQ / Certiquality" },
        { value: "tec_eurolab", label: "TEC Eurolab" },
        { value: "sideius",     label: "Sideius (Valor)" },
        { value: "altro",       label: "Altro" },
      ],
      hint: "Organismo terzo che ha rilasciato il certificato. Ente non in elenco? Seleziona \u201CAltro\u201D e specificalo nelle note.",
    },
    {
      key: "welding_process",
      label: "Processo di saldatura",
      type: "select",
      required: true,
      options: WELDING_PROCESS_OPTIONS,
      hint: "Codice processo secondo ISO 4063",
    },
    {
      key: "joint_type",
      label: "Tipo di giunto",
      type: "select",
      required: true,
      options: [
        { value: "BW", label: "BW - Giunto testa a testa (Butt Weld)" },
        { value: "FW", label: "FW - Giunto a T / angolare (Fillet Weld)" },
      ],
      hint: "BW = full penetration, FW = angolare",
    },
    {
      key: "material_group",
      label: "Gruppo materiale base (ISO/TR 15608)",
      type: "select",
      required: true,
      options: MATERIAL_GROUP_OPTIONS,
      hint: "Gruppo materiale della piastra / tubo qualificato (catalogo ISO/TR 15608:2013)",
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
      options: WELDING_POSITION_OPTIONS,
      hint: "Posizioni di saldatura secondo ISO 6947 (seleziona tutte quelle incluse)",
    },
    {
      key: "thickness_min_mm",
      label: "Spessore qualificato - minimo (mm)",
      type: "number",
      required: false,
      hint: "Spessore minimo del range qualificato dalla prova",
    },
    {
      key: "thickness_max_mm",
      label: "Spessore qualificato - massimo (mm)",
      type: "number",
      required: false,
      hint: "Spessore massimo del range qualificato (es. 2t per piastre). Lascia vuoto se non c'è limite superiore: verrà mostrato come \u201C\u2265 spessore minimo\u201D.",
    },
    {
      key: "pipe_diameter_mm",
      label: "Diametro tubi qualificato (mm)",
      type: "number",
      required: false,
      hint: "Diametro esterno del tubo di prova; lasciare vuoto se solo piastre. Se piastra in posizioni PA/PB/PC/PD, il campo copre tipicamente tubi \u2265500 mm (\u226575 mm se posizione rotante) \u2014 verificare sul certificato prima di riportarlo (proposta da feedback cliente, non ancora confermata su copia integrale norma).",
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
      label: "Data di scadenza",
      type: "date",
      required: true,
      hint: "Dipende dalla norma e dall'opzione di rivalidazione scelta sul certificato: ISO 9606-1 (saldatori manuali) — 3 anni con nuova prova, o ciclo 2 anni con controllo NDT; ISO 14732 (operatori saldatura automatica/meccanizzata) — 6 anni con nuova prova, o ciclo 3 anni con controllo NDT (valori diversi, non intercambiabili). Entrambe le norme richiedono comunque conferma ogni 6 mesi. Verificare sempre sul certificato, non assumere un valore fisso.",
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
        { value: "ISO 9606-1:2012", label: "ISO 9606-1:2012 - Saldatura per fusione, acciai" },
        { value: "ISO 9606-2",      label: "ISO 9606-2 - Alluminio e leghe di alluminio" },
        { value: "ISO 14732",       label: "ISO 14732 - Qualifica operatori saldatura automatica" },
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
- issuing_body: ente certificatore (TÜV, Bureau Veritas, DNV, RINA, IMQ, TEC Eurolab, Sideius, ecc.)
- welding_process: codice processo ISO 4063 (111, 135, 141, ecc.)
- joint_type: tipo giunto: "BW" (testa a testa) o "FW" (angolare)
- material_group: gruppo materiale base ISO/TR 15608 (codice sottogruppo es. "1.1", "1.2", "8.1", "21"; mappa da S355→1.2, S235→1.1 se non esplicitato)
- filler_material_group: gruppo materiale d'apporto (FM1-FM6 o null)
- welding_positions: array di posizioni ISO 6947 (es. ["PA","PF","PC"])
- thickness_min_mm: numero: spessore minimo qualificato in mm
- thickness_max_mm: numero: spessore massimo qualificato in mm
- pipe_diameter_mm: numero: diametro esterno tubi qualificato in mm (null se solo piastre)
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

// --- wps (schema minimo - da sviluppare) ?

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

// --- norma (Norma tecnica - schema completo) 

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
        { value: "da_verificare", label: "Da verificare" },
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
- is_harmonized: true se è una norma EN armonizzata
Usa null per i campi non trovati.`,

  aiExpectedSchema: {
    standard_code: "string|null",
    norm_title: "string|null",
    issuing_body: "string|null",
    edition_year: "number|null",
    supersedes: "string|null",
    validity_status: "vigente|superata|annullata|in_revisione|da_verificare|null",
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
        { value: "2.1", label: "2.1 - Dichiarazione di conformità " },
        { value: "2.2", label: "2.2 - Dichiarazione con ispezione campione" },
        { value: "3.1", label: "3.1 - Certificato di ispezione 3.1" },
        { value: "3.2", label: "3.2 - Certificato di ispezione 3.2" },
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
        { value: "UT", label: "UT - Ultrasoni" },
        { value: "RT", label: "RT - Raggi X" },
        { value: "MT", label: "MT - Magnetoscopia" },
        { value: "PT", label: "PT - Liquidi penetranti" },
        { value: "VT", label: "VT - Visivo" },
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

// --- qualifica_14732 (ISO 14732 - operatori/preparatori saldatura automatica e meccanizzata)

const qualifica_14732 = {
  id: "qualifica_14732",
  label: "Qualifica operatore (ISO 14732)",
  expiryField: "expiry_date",
  rangeFields: ["welding_process", "welding_positions", "welding_type"],
  fields: [
    { key: "operator_name", label: "Nome operatore/preparatore", type: "text", required: true },
    { key: "certificate_number", label: "Numero qualifica", type: "text", required: true },
    {
      key: "issuing_body",
      label: "Ente certificatore",
      type: "select",
      required: false,
      options: [
        { value: "tuv",         label: "TÜV" },
        { value: "bv",          label: "Bureau Veritas (BV)" },
        { value: "dnv",         label: "DNV GL" },
        { value: "rina",        label: "RINA" },
        { value: "imq",         label: "IMQ" },
        { value: "tec_eurolab", label: "TEC Eurolab" },
        { value: "sideius",     label: "Sideius (Valor)" },
        { value: "altro",       label: "Altro" },
      ],
      hint: "Esaminatore/organismo che ha rilasciato la qualifica",
    },
    {
      key: "welding_type",
      label: "Tipo di saldatura",
      type: "select",
      required: false,
      options: [
        { value: "automatic",   label: "Automatica (nessun intervento manuale)" },
        { value: "mechanized",  label: "Meccanizzata (variazione manuale possibile)" },
      ],
      hint: "Determina quali variabili essenziali si applicano (ISO 14732 §4.2.2 vs §4.2.3)",
    },
    {
      key: "welding_process",
      label: "Processo di saldatura",
      type: "select",
      required: false,
      options: WELDING_PROCESS_OPTIONS,
      hint: "Codice processo secondo ISO 4063",
    },
    { key: "equipment_type", label: "Tipo unità/macchina di saldatura", type: "text", required: false },
    {
      key: "welding_positions",
      label: "Posizioni qualificate",
      type: "multiselect",
      required: false,
      options: WELDING_POSITION_OPTIONS,
      hint: "Solo per saldatura meccanizzata è variabile essenziale esplicita (§4.2.3): una nuova posizione richiede nuova qualifica",
    },
    {
      key: "single_multi_run",
      label: "Tecnica passata",
      type: "select",
      required: false,
      options: [
        { value: "single", label: "Mono-passata per lato" },
        { value: "multi",  label: "Multi-passata per lato" },
      ],
      hint: "Da mono a multi-passata richiede nuova qualifica, non viceversa",
    },
    { key: "exam_date", label: "Data esame", type: "date", required: false },
    {
      key: "expiry_date",
      label: "Data di scadenza",
      type: "date",
      required: true,
      hint: "Dipende dal metodo di rivalidazione dichiarato sul certificato (ISO 14732 §5.3: a) nuova prova ogni 6 anni, b) ciclo 3 anni con controllo NDT, c) indefinita se conferma rispettata + fabbricante certificato ISO 3834). Non assumere un valore fisso: verificare sul certificato.",
    },
    {
      key: "last_confirmation_date",
      label: "Data ultima conferma semestrale",
      type: "date",
      required: false,
      hint: "Il responsabile saldature/esaminatore deve confermare ogni 6 mesi che l'operatore è attivo (identico a ISO 9606-1)",
    },
    {
      key: "next_confirmation_due",
      label: "Prossima conferma entro",
      type: "date",
      required: false,
      hint: "Calcolata: ultima conferma + 6 mesi",
    },
    {
      key: "qualification_method",
      label: "Metodo di qualificazione (§4.1)",
      type: "select",
      required: false,
      options: [
        { value: "iso_15614", label: "a) Prova procedura (ISO 15614)" },
        { value: "iso_15613", label: "b) Prova pre-produzione (ISO 15613)" },
        { value: "iso_9606",  label: "c) Provino standard (ISO 9606)" },
        { value: "production_test", label: "d) Prova/campione di produzione" },
      ],
    },
    {
      key: "notes",
      label: "Note",
      type: "textarea",
      required: false,
      hint: "Osservazioni aggiuntive, dettagli backing/inserto consumabile/sensori, ecc.",
    },
  ],
  aiPrompt: `Stai analizzando una qualifica operatore/preparatore di saldatura automatica o meccanizzata secondo ISO 14732.
Estrai TUTTI i seguenti campi in "type_specific_data". Se un campo non è presente, usa null.

Campi da estrarre:
- operator_name: nome e cognome dell'operatore o preparatore
- certificate_number: numero univoco della qualifica
- issuing_body: esaminatore/organismo di certificazione
- welding_type: "automatic" o "mechanized" solo se dichiarato esplicitamente
- welding_process: codice processo ISO 4063
- equipment_type: tipo di unità/macchina di saldatura
- welding_positions: array posizioni secondo ISO 6947, solo se dichiarate
- single_multi_run: "single" o "multi" se indicato
- exam_date, expiry_date, last_confirmation_date, next_confirmation_due (YYYY-MM-DD)
- qualification_method: quale metodo tra §4.1 a/b/c/d è stato usato, se indicato

IMPORTANTE: NON assumere un intervallo di validità fisso. ISO 14732 ha rivalidazione a 6 anni (opzione a) o 3 anni con controllo NDT (opzione b), diversi dai 3/2 anni di ISO 9606-1 per saldatori manuali — estrai solo ciò che è scritto sul certificato.`,
  aiExpectedSchema: {
    operator_name: "string|null",
    certificate_number: "string|null",
    issuing_body: "string|null",
    welding_type: "automatic|mechanized|null",
    welding_process: "string|null",
    equipment_type: "string|null",
    welding_positions: "string[]|null",
    single_multi_run: "single|multi|null",
    exam_date: "YYYY-MM-DD|null",
    expiry_date: "YYYY-MM-DD|null",
    last_confirmation_date: "YYYY-MM-DD|null",
    next_confirmation_due: "YYYY-MM-DD|null",
    qualification_method: "iso_15614|iso_15613|iso_9606|production_test|null",
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

// --- sal / rdp (roadmap - schemi base) ---

const sal = {
  id: "sal",
  label: "SAL - Stato avanzamento lavori",
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
  label: "RDP - Rapporto di prova",
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

// --- Registro schemi 

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
  sal,
  rdp,
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
