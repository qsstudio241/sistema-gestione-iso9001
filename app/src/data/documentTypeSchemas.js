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
        { value: "iis_isscert", label: "IIS - ISSCERT (Istituto Italiano di Saldatura)" },
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
      key: "product_type",
      label: "Tipo prodotto",
      type: "select",
      required: false,
      options: [
        { value: "P", label: "P - Piastra" },
        { value: "T", label: "T - Tubo" },
      ],
      hint: "Variabile essenziale ISO 9606-1 §11: solo P/T ammessi dalla norma. Un giunto di derivazione/branch/bocchello (tubo che si inserisce in una piastra) resta \u201CT\u201D — è un tipo di giunto (branch joint, §3.16), non una terza categoria di prodotto. Se il certificato lo indica esplicitamente, riportalo nel campo \u201CDettagli di giunto\u201D per non perdere l'informazione.",
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
      key: "thickness_max_unlimited",
      label: "Spessore massimo — nessun limite superiore",
      type: "boolean",
      required: false,
      hint: "true SOLO se il certificato dichiara esplicitamente un range aperto (es. \u201C\u2265 5\u201D, \u201C=> 5\u201D, \u201Csenza limite superiore\u201D) — NON selezionare solo perché il dato è assente dal documento: in quel caso lasciare vuoto/false, il campo resterà segnalato come da verificare manualmente.",
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
      hint: "Simbolo ISO 14175 (es. M21, I1, C1). Preferire il codice corto, non la designazione lunga. Vuoto se non applicabile (es. MMA/SAW). Catalogo: shieldingGases14175.js",
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
        { value: "ISO 9606-1:2017", label: "ISO 9606-1:2017 - Saldatura per fusione, acciai (edizione corrente)" },
        { value: "ISO 9606-1:2012", label: "ISO 9606-1:2012 - Saldatura per fusione, acciai (edizione storica, superata)" },
        { value: "ISO 9606-2",      label: "ISO 9606-2 - Alluminio e leghe di alluminio" },
        { value: "ISO 14732",       label: "ISO 14732 - Qualifica operatori saldatura automatica" },
        { value: "EN 287-1",        label: "EN 287-1 (sostituita da ISO 9606-1)" },
      ],
      hint: "Norma tecnica di riferimento della qualifica. Per i certificati nuovi usare l'edizione 2017 (corrente); l'edizione 2012 resta selezionabile solo per registrare certificati storici che la riportano esplicitamente.",
    },
    {
      key: "weld_details",
      label: "Dettagli di giunto",
      type: "text",
      required: false,
      hint: "Backing, mono/multistrato, saldatura sx/dx, oppure derivazione/branch/bocchello (giunto tubo-piastra) se dichiarati sul certificato (ISO 9606-1 §11/§3.16)",
    },
    {
      key: "transfer_mode",
      label: "Metodo di trasferimento",
      type: "select",
      required: false,
      options: [
        { value: "spray_arc",  label: "Spray arc (arco spray)" },
        { value: "pulsed_arc", label: "Pulsed arc (arco pulsato)" },
        { value: "short_arc",  label: "Short arc (arco corto / short-circuit)" },
        { value: "globular",   label: "Globular (transfer globulare)" },
      ],
      hint: "Solo per processi ad arco con filo continuo (131 MIG, 135 MAG, 136/138 filo animato) — ISO 9606-1 §5.2/§9.3 (colonna \u201CTransfer mode\u201D del certificato ufficiale). Non applicabile a MMA/TIG/SAW: lasciare vuoto.",
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
- product_type: variabile essenziale ISO 9606-1 §11: "P" (piastra/plate) o "T" (tubo/pipe); SOLO questi due valori, non esiste una terza categoria "tubo-piastra" (una derivazione/branch/bocchello è un tipo di giunto, resta "T" — vedi weld_details per non perdere il dettaglio); null se non specificato
- weld_details: dettagli di giunto se dichiarati (backing, mono/multistrato, saldatura sx/dx, derivazione/branch/bocchello tubo-piastra) o null
- material_group: gruppo materiale base ISO/TR 15608 (codice sottogruppo es. "1.1", "1.2", "8.1", "21"; mappa da S355→1.2, S235→1.1 se non esplicitato)
- filler_material_group: gruppo materiale d'apporto (FM1-FM6 o null)
- welding_positions: array di posizioni ISO 6947 (es. ["PA","PF","PC"])
- thickness_min_mm: numero: spessore minimo qualificato in mm
- thickness_max_mm: numero: spessore massimo qualificato in mm
- thickness_max_unlimited: booleano — true SOLO se il certificato dichiara esplicitamente un range aperto senza limite superiore (simboli "≥", "=>", "⩾", oppure testo "no restriction"/"senza limite superiore"). In questo caso lascia thickness_max_mm: null e imposta thickness_max_unlimited: true. Se il campo è semplicemente assente dal documento (non un range aperto dichiarato), lascia entrambi null/false — NON confondere le due situazioni
- pipe_diameter_mm: numero: diametro esterno tubi qualificato in mm (null se solo piastre)
- shielding_gas: codice gas ISO 14175 (es. "M21", "I1") o null
- exam_date: data esame in formato ISO 8601 (YYYY-MM-DD) o null
- expiry_date: data scadenza in formato ISO 8601 (YYYY-MM-DD) o null
- last_confirmation_date: data ultima conferma datore di lavoro in formato ISO 8601 o null
- next_confirmation_due: data prossima conferma in formato ISO 8601 o null
- standard_reference: norma con edizione, es. "ISO 9606-1:2017". Riporta ESATTAMENTE l'anno scritto sul certificato. Se il certificato NON specifica alcun anno, usa "ISO 9606-1:2017" (edizione corrente in vigore) come default, non "ISO 9606-1:2012" (edizione superata, valida solo se il certificato la cita esplicitamente). Se nessuna norma è indicata, usa null
- transfer_mode: metodo di trasferimento del metallo d'apporto (variabile essenziale ISO 9606-1 §5.2, colonna dedicata "Transfer mode" nel modulo certificato ufficiale §9.3). Valorizzalo SOLO se il processo è ad arco con filo continuo (131 MIG, 135 MAG, 136 filo animato, 138 filo animato metallico) e il certificato lo riporta esplicitamente: "spray_arc" (spray/getto), "pulsed_arc" (pulsato), "short_arc" (arco corto/short-circuit/dip), "globular" (globulare). Per altri processi (111, 121, 141, 145, 311) usa null: il parametro non si applica.`,

  aiExpectedSchema: {
    welder_name: "string|null",
    certificate_number: "string|null",
    issuing_body: "string|null",
    welding_process: "string|null",
    joint_type: "BW|FW|null",
    product_type: "P|T|null",
    weld_details: "string|null",
    material_group: "string|null",
    filler_material_group: "string|null",
    welding_positions: "string[]|null",
    thickness_min_mm: "number|null",
    thickness_max_mm: "number|null",
    thickness_max_unlimited: "boolean|null",
    pipe_diameter_mm: "number|null",
    shielding_gas: "string|null",
    exam_date: "YYYY-MM-DD|null",
    expiry_date: "YYYY-MM-DD|null",
    last_confirmation_date: "YYYY-MM-DD|null",
    next_confirmation_due: "YYYY-MM-DD|null",
    standard_reference: "string|null",
    transfer_mode: "spray_arc|pulsed_arc|short_arc|globular|null",
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
      hint: "Designazione (es. S355J2, AISI 316L) — ISO 15609 §4.3.1",
    },
    {
      key: "material_group",
      label: "Gruppo materiale (ISO/TR 15608)",
      type: "text",
      required: false,
      hint: "Es. 1.2, 8.1 — ISO 15609 §4.3.1",
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
      key: "pipe_outside_diameter_mm",
      label: "Diametro esterno tubo (mm)",
      type: "text",
      required: false,
      hint: "Range OD se WPS per tubo — ISO 15609 §4.3.2",
    },
    {
      key: "joint_type",
      label: "Tipo giunto",
      type: "text",
      required: false,
      hint: "BW/FW o descrizione da WPS — ISO 15609 §4.4.2",
    },
    {
      key: "welding_positions",
      label: "Posizioni di saldatura",
      type: "text",
      required: false,
      hint: "ISO 6947 (es. PA, PF) — ISO 15609 §4.4.3",
    },
    {
      key: "filler_material",
      label: "Consumabile / apporto",
      type: "text",
      required: false,
      hint: "Designazione ISO 14341 se filo MAG/MIG acciaio (es. G 42 4 M21 3Si1) + dimensione; ISO 15609 §4.4.8. Non confondere con gruppo FM (RC-4)",
    },
    {
      key: "wpqr_ref",
      label: "WPQR di riferimento",
      type: "text",
      required: false,
      hint: "Numero del WPQR che qualifica questa WPS",
    },
    {
      key: "shielding_gas",
      label: "Gas di protezione",
      type: "text",
      required: false,
      hint: "Simbolo ISO 14175 (es. M21, I1); null se senza gas o WPS gas (15609-2)",
    },
    {
      key: "preheat_temp",
      label: "Temperatura preriscaldo (Tp)",
      type: "text",
      required: false,
      hint: "ISO 13916 Tp — es. min 100 °C (ISO 15609 §4.4.11)",
    },
    {
      key: "interpass_temp",
      label: "Temperatura interpass (Ti)",
      type: "text",
      required: false,
      hint: "ISO 13916 Ti — es. max 250 °C (ISO 15609 §4.4.12)",
    },
    {
      key: "heat_input",
      label: "Heat input / arc energy",
      type: "text",
      required: false,
      hint: "Solo arco (15609-1 §4.4.17); null su WPS gas",
    },
    {
      key: "current_range",
      label: "Range corrente",
      type: "text",
      required: false,
      hint: "Solo arco (15609-1 §4.4.9)",
    },
    {
      key: "voltage_range",
      label: "Range tensione",
      type: "text",
      required: false,
      hint: "Solo arco (15609-1 §4.4.9)",
    },
    {
      key: "flame_type",
      label: "Tipo di fiamma",
      type: "text",
      required: false,
      hint: "Solo WPS gas (15609-2 §4.4.9)",
    },
    {
      key: "fuel_gas",
      label: "Gas combustibile",
      type: "text",
      required: false,
      hint: "Solo WPS gas (15609-2 §4.4.9)",
    },
  ],

  aiPrompt: `Stai analizzando una WPS secondo EN ISO 15609-1 (arco) o 15609-2 (gas), spesso con WPQR ISO 15614.
Estrai in type_specific_data: wps_number, wpqr_ref, welding_process (ISO 4063),
base_material, material_group (ISO/TR 15608), thickness_min_mm, thickness_max_mm,
pipe_outside_diameter_mm, joint_type, welding_positions (array ISO 6947),
filler_material (ISO 14341 se filo GMAW acciaio, es. "G 42 4 M21 3Si1"),
shielding_gas (ISO 14175 o null), preheat_temp (Tp), interpass_temp (Ti),
heat_input, current_range, voltage_range (solo arco), flame_type, fuel_gas (solo gas).
Usa null se assente. Non inventare range.`,

  aiExpectedSchema: {
    wps_number: "string|null",
    welding_process: "string|null",
    base_material: "string|null",
    material_group: "string|null",
    thickness_min_mm: "number|null",
    thickness_max_mm: "number|null",
    pipe_outside_diameter_mm: "string|number|null",
    joint_type: "string|null",
    welding_positions: "string[]|null",
    filler_material: "string|null",
    wpqr_ref: "string|null",
    shielding_gas: "string|null",
    preheat_temp: "string|null",
    interpass_temp: "string|null",
    heat_input: "string|null",
    current_range: "string|null",
    voltage_range: "string|null",
    flame_type: "string|null",
    fuel_gas: "string|null",
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

const material_certificate = {
  id: "material_certificate",
  label: "Certificato materiale EN 10204 (Material Compliance)",
  expiryField: null,
  rangeFields: ["steel_designation", "filler_designation", "thickness_mm"],
  fields: [
    { key: "material_role", label: "Ruolo", type: "select", required: true,
      options: [
        { value: "base", label: "Base (lamiera/profilo/tubo)" },
        { value: "filler", label: "Apporto (filo/elettrodo/flusso)" },
      ] },
    { key: "document_kind", label: "Tipo documento", type: "select", required: false,
      options: [
        { value: "mill_certificate", label: "Certificato 3.1 / mill" },
        { value: "delivery_note", label: "DDT / bolla" },
      ] },
    { key: "inspection_document_type", label: "Tipo EN 10204", type: "select", required: false,
      options: [
        { value: "2.1", label: "2.1" },
        { value: "2.2", label: "2.2" },
        { value: "3.1", label: "3.1" },
        { value: "3.2", label: "3.2" },
      ] },
    { key: "certificate_no", label: "N. certificato", type: "text", required: false },
    { key: "ddt_no", label: "N. DDT", type: "text", required: false },
    { key: "ddt_date", label: "Data DDT", type: "date", required: false },
    { key: "manufacturer_works", label: "Acciaieria / produttore", type: "text", required: false },
    { key: "steel_designation", label: "Designazione acciaio", type: "text", required: false },
    { key: "filler_designation", label: "Designazione apporto", type: "text", required: false },
    { key: "heat_or_lot_no", label: "Colata / lotto", type: "text", required: false },
    { key: "material_standard", label: "Norma", type: "text", required: false },
    { key: "thickness_mm", label: "Spessore (mm)", type: "number", required: false },
    { key: "ReH", label: "ReH", type: "number", required: false },
    { key: "Rm", label: "Rm", type: "number", required: false },
    { key: "CEV", label: "CEV", type: "number", required: false },
  ],
  aiPrompt: `Stai analizzando un PDF di Material Compliance: certificato EN 10204 / EN 10168 (base o apporto) OPPURE un DDT / bolla.
PRIMA classifica document_kind: "delivery_note" se DDT/bolla/documento di trasporto (anche se elenca acciaio e colata della merce); "mill_certificate" se certificato 3.1/EN 10168.
Se delivery_note: estrai SOLO ddt_no, ddt_date, purchaser; heat_or_lot_no, certificate_no, material_standard, chemistry, ReH = null. NON copiare colata/norma dalla merce.
Se mill_certificate: estrai in type_specific_data i campi del dizionario Material Compliance (material_role base|filler, inspection_document_type 2.1-3.2, certificate_no, manufacturer_works, steel_designation o filler_designation, heat_or_lot_no, material_standard, ddt_no, ddt_date, thickness_mm, ReH, Rm, CEV, chemistry). heat_or_lot_no (B07): copia la colata COME STAMPATA (es. 12174/2026; etichette Colata, Heat No, B07). ddt_no solo se stampato (DDT/bolla); NON copiare purchaser_order_no (A07). material_standard: norma prodotto stampata, non inventare. Se incerto su material_role usa base. NON dichiarare se il certificato è conforme.`,
  aiExpectedSchema: {
    document_kind: "mill_certificate|delivery_note|null",
    inspection_document_type: "2.1|2.2|3.1|3.2|null",
    certificate_no: "string|null",
    manufacturer_works: "string|null",
    purchaser: "string|null",
    purchaser_order_no: "string|null",
    material_role: "base|filler",
    product_form: "string|null",
    material_standard: "string|null",
    delivery_condition: "string|null",
    heat_or_lot_no: "string|null",
    ddt_no: "string|null",
    ddt_date: "YYYY-MM-DD|null",
    dimensions: "string|null",
    actual_mass: "number|string|null",
    thickness_mm: "number|null",
    ReH: "number|null",
    Rm: "number|null",
    A: "number|null",
    KV: "number|{minJ,tempC}|null",
    hardness: "number|string|null",
    chemistry: "object|null",
    CEV: "number|null",
    ndt: "string[]|null",
    validated_by: "string|null",
    compliance_statement: "string|null",
    steel_designation: "string|null",
    filler_designation: "string|null",
    filler_standard: "string|null",
    filler_diameter_mm: "number|null",
    hydrogen_class: "string|null",
  },
};

// --- cert_ndt (ISO 9712:2022) ---
// Campi orientati a: scadenziario qualifiche NDT + copertura personale per commessa
// (domanda riesame requisiti ISO 3834: "ho il personale NDT qualificato per questa commessa?")

const NDT_METHOD_OPTIONS = [
  { value: "VT",  label: "VT — Esame visivo" },
  { value: "MT",  label: "MT — Magnetoscopia" },
  { value: "PT",  label: "PT — Liquidi penetranti" },
  { value: "UT",  label: "UT — Ultrasuoni" },
  { value: "RT",  label: "RT — Radiografia" },
  { value: "ET",  label: "ET — Correnti indotte" },
  { value: "AE",  label: "AE — Emissione acustica" },
  { value: "TT",  label: "TT — Test tenuta" },
  { value: "ST",  label: "ST — Strain/Stress" },
  { value: "LT",  label: "LT — Leak testing" },
];

// Settori ISO 9712:2012 Annex A — prodotto (A.2) + industriale (A.3).
// Codici industriali m/s/r/a: convenzione operativa (la norma A.3 non assegna lettere).
// Preferire il settore industriale se il certificato riporta entrambi
// (es. TEC-Eurolab: prodotto plurisettoriale + industriale pre-servizio/in servizio → "s").
const NDT_SECTOR_OPTIONS = [
  { value: "_sep_product", label: "── Settore di prodotto (Annex A.2) ──", disabled: true },
  { value: "c",  label: "c — Getti (castings)" },
  { value: "f",  label: "f — Forgiati (forgings)" },
  { value: "w",  label: "w — Saldature (welds)" },
  { value: "t",  label: "t — Tubi e tubazioni (tubes/pipes)" },
  { value: "wp", label: "wp — Prodotti laminati (wrought, esclusi forgiati)" },
  { value: "p",  label: "p — Materiali compositi" },
  { value: "_sep_industrial", label: "── Settore industriale (Annex A.3) ──", disabled: true },
  { value: "m",  label: "m — Fabbricazione (manufacturing)" },
  { value: "s",  label: "s — Pre-servizio e in servizio (include fabbricazione)" },
  { value: "r",  label: "r — Manutenzione ferroviaria" },
  { value: "a",  label: "a — Aerospaziale" },
];

const NDT_SECTOR_CODES = "c|f|w|t|wp|p|m|s|r|a";

const cert_ndt = {
  id: "cert_ndt",
  label: "Certificato NDT (ISO 9712)",
  expiryField: "expiry_date",
  rangeFields: ["ndt_method", "certification_level"],
  fields: [
    // — PERSONA —
    { key: "operator_name",       label: "Nome operatore",       type: "text",   required: true,  hint: "Cognome e nome come sul certificato" },
    { key: "certificate_number",  label: "Numero certificato",   type: "text",   required: true,  hint: "Es. 1234/VT/2/CICPND/2022" },
    // — QUALIFICA —
    { key: "ndt_method",  label: "Metodo NDT",  type: "select", required: true,
      options: NDT_METHOD_OPTIONS,
      hint: "Obbligatorio per il riesame: «abbiamo il metodo NDT richiesto dalla commessa?» (ISO 9712 / ISO 3834 §8.2). Es. UT, MT, PT, RT." },
    { key: "certification_level", label: "Livello", type: "select", required: true,
      options: [
        { value: "1", label: "Livello 1" },
        { value: "2", label: "Livello 2" },
        { value: "3", label: "Livello 3" },
      ],
      hint: "Obbligatorio. ISO 9712 §5: 1=esecuzione guidata, 2=autonomia operativa (tipico per interpretare risultati in commessa), 3=responsabilità tecnica. Badge N/D = controlla sul PDF, non lasciare vuoto." },
    { key: "ndt_sector",  label: "Settore (ISO 9712 Annex A)", type: "select", required: false,
      options: NDT_SECTOR_OPTIONS,
      hint: "Per copertura commessa scegli il settore INDUSTRIALE se presente (A.3): «fabbricazione metalli» → m; «pre-servizio e in servizio…» → s. «Plurisettoriale» da solo non è un codice: non selezionarlo. Se sul PDF c'è l'industriale, non lasciare vuoto." },
    { key: "certification_scheme", label: "Schema certificazione", type: "text", required: false,
      hint: "Opzionale. Scrivi lo schema dell'ente (es. TEC Eurolab, CICPND, PCN), non inventare CICPND se non c'è. Se sul PDF non compare uno schema nazionale tipico, puoi mettere il nome dell'ente (es. «TEC Eurolab») oppure lasciare vuoto: vuoto = OK, non è un errore. Badge N/D non obbliga a compilare." },
    { key: "scope_detail", label: "Tecnica / ambito specifico", type: "text", required: false,
      hint: "Opzionale. Solo se il certificato indica una tecnica avanzata oltre al metodo base (es. PA phased array, TOFD, DR). Per UT/MT/PT/RT «standard» Livello 2 senza altre diciture: lascia vuoto — è corretto. Serve al riesame solo se la commessa richiede quella tecnica specifica." },
    { key: "issuing_body", label: "Ente certificatore", type: "text", required: false,
      hint: "Chi ha emesso il certificato (es. TEC Eurolab, Bureau Veritas, RINA). Diverso dallo «schema» (CICPND/PCN…): qui va l'organismo firmatario." },
    // — DATE (scadenziario) —
    { key: "exam_date",        label: "Data esame",         type: "date", required: false,
      hint: "Data esame o, se manca, data di emissione sul certificato. Opzionale se c'è già la scadenza." },
    { key: "expiry_date",      label: "Data scadenza",      type: "date", required: true,
      hint: "Obbligatoria per lo scadenziario e per il riesame («la qualifica è ancora valida alla data commessa?»). ISO 9712 §9.2: di norma 5 anni." },
    { key: "revalidation_date", label: "Revalidazione",     type: "date", required: false,
      hint: "Solo se il PDF riporta una data di rinnovo/rivalidazione esplicita. Se c'è solo la scadenza: lascia vuoto (non copiare la scadenza qui). Vuoto = OK." },
  ],
  aiPrompt: `Stai analizzando un certificato di qualifica operatore NDT secondo ISO 9712 (o versione precedente).
Estrai TUTTI i seguenti campi nell'oggetto "type_specific_data". Usa null se il campo non è presente.

Campi da estrarre:
- operator_name: cognome e nome del titolare (testo)
- certificate_number: numero certificato esatto come scritto (es. "1234/VT/2/CICPND/2022")
- ndt_method: SOLO uno tra VT | MT | PT | UT | RT | ET | AE | TT | ST | LT. Deduci dal titolo o dal testo italiano/inglese (es. "magnetoscopia"/"magnetic particle" → MT, "ultrasuoni"/"ultrasonic" → UT, "radiografico"/"radiographic" → RT, "liquidi penetranti"/"penetrant" → PT, "visivo"/"visual" → VT, "eddy current" → ET)
- certification_level: SOLO "1", "2" o "3" (non testo come "secondo" o "II")
- ndt_sector: codice ISO 9712 Annex A. Settori di PRODOTTO (A.2): c=castings/getti, f=forgings/forgiati, w=welds/saldature, t=tubes/tubi, wp=wrought products/laminati (esclusi forgiati), p=composites/compositi. Settori INDUSTRIALI (A.3): m=manufacturing/fabbricazione, s=pre-and in-service testing (prova pre-servizio e in servizio, include fabbricazione), r=railway maintenance/manutenzione ferroviaria, a=aerospace/aerospaziale. REGOLA: se il certificato indica sia settore di prodotto (anche "plurisettoriale") sia settore industriale, restituisci il codice INDUSTRIALE. Esempi: "Prova pre-servizio e in servizio di attrezzature, impianti e strutture" → s; "fabbricazione metalli" / manufacturing → m. "Plurisettoriale" da solo (senza industriale) → null. Restituisci solo il codice; null se assente.
- certification_scheme: nome dello schema (es. "CICPND", "PCN", "SNT-TC-1A", "ASNT", "COFREND", "NORDTEST"). Cerca nel numero certificato, nell'intestazione o nel logo dell'ente.
- scope_detail: tecnica specifica se presente (es. "PA" per phased array, "TOFD", "DR" per digital radiography, "MPI" per magnetic particle inspection). Null se non specificato o se è solo il metodo base.
- issuing_body: ente che ha emesso/firmato il certificato (es. "CICPND", "Bureau Veritas", "TÜV Rheinland", "RINA", "APAVE", "Accredia")
- exam_date: data esame qualifica (YYYY-MM-DD)
- expiry_date: data di scadenza validità certificato (YYYY-MM-DD). ISO 9712 §9.2: normalmente 5 anni dall'esame
- revalidation_date: data di rivalidazione/rinnovo se riportata (YYYY-MM-DD); null se non presente. NON copiare expiry_date qui se il documento non ha una data di rinnovo esplicita.

Nota su expiry_date: ISO 9712:2022 §9.2 — il certificato è valido 5 anni; può essere rinnovato per altri 5 se §9.3 soddisfatto (continuità impiego + visita medica). Se il documento riporta una "date of expiry" o "valid until" usala direttamente.`,
  aiExpectedSchema: {
    operator_name:        "string|null",
    certificate_number:   "string|null",
    ndt_method:           "VT|MT|PT|UT|RT|ET|AE|TT|ST|LT|null",
    certification_level:  "1|2|3|null",
    ndt_sector:           `${NDT_SECTOR_CODES}|null`,
    certification_scheme: "string|null",
    scope_detail:         "string|null",
    issuing_body:         "string|null",
    exam_date:            "YYYY-MM-DD|null",
    expiry_date:          "YYYY-MM-DD|null",
    revalidation_date:    "YYYY-MM-DD|null",
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
        { value: "iis_isscert", label: "IIS - ISSCERT (Istituto Italiano di Saldatura)" },
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
  rangeFields: [
    "welding_process",
    "material_group",
    "thickness_test_mm",
    "thickness_min",
    "thickness_max",
    "welding_positions",
    "qualification_level",
  ],
  fields: [
    // --- Copertura (pag.1 RANGE OF QUALIFICATION) ---
    {
      key: "wpqr_number",
      label: "Numero WPQR",
      type: "text",
      required: true,
      hint: "Accetta suffisso rivisione, es. \u201C24-03390-01\u201D",
    },
    {
      key: "qualification_level",
      label: "Livello qualifica",
      type: "select",
      required: false,
      options: [
        { value: "1", label: "Level 1" },
        { value: "2", label: "Level 2" },
      ],
      hint: "Solo se esplicitamente dichiarato sul verbale — non defaultare a 2 se assente",
    },
    {
      key: "standard_reference",
      label: "Norma riferimento",
      type: "text",
      required: false,
      hint: "Es. UNI EN ISO 15614-1:2019",
    },
    {
      key: "welding_process",
      label: "Processo saldatura",
      type: "select",
      required: true,
      options: WELDING_PROCESS_OPTIONS,
      hint: "Codice ISO 4063 (preferire il codice esplicito nel testo, es. 135)",
    },
    {
      key: "joint_type",
      label: "Tipo di giunto",
      type: "select",
      required: false,
      options: [
        { value: "BW", label: "BW - Giunto testa a testa (Butt Weld)" },
        { value: "FW", label: "FW - Giunto a T / angolare (Fillet Weld)" },
        { value: "BW+FW", label: "BW+FW - Entrambi" },
      ],
    },
    {
      key: "product_type",
      label: "Tipo prodotto testato",
      type: "select",
      required: false,
      options: [
        { value: "P", label: "P - Piastra" },
        { value: "T", label: "T - Tubo" },
      ],
      hint: "Piastra o tubo — variabile essenziale ISO 15614-1 §8.3.3 per il diametro. Se testato su PIASTRA, non serve compilare il diametro tubo sotto: il sistema applica automaticamente la regola \u201Cpiastra copre tubo >500mm (o >150mm in posizione ruotata)\u201D quando pertinente, usando le posizioni qualificate dichiarate sotto.",
    },
    {
      key: "material_group",
      label: "Gruppo materiale base (ISO/TR 15608)",
      type: "select",
      required: false,
      options: MATERIAL_GROUP_OPTIONS,
      hint: "Preferire il sottogruppo (es. 1.2) se presente sul verbale",
    },
    {
      key: "thickness_test_mm",
      label: "Spessore prova (mm)",
      type: "number",
      required: false,
      hint: "Spessore del provino usato per la prova (pag.2)",
    },
    {
      key: "thickness_min",
      label: "Spessore materiale base — minimo (mm)",
      type: "number",
      required: false,
      hint: "Range spessore MATERIALE BASE (parent material) dal range of qualification dichiarato sul verbale — non ricalcolare. Diverso dallo spessore prova (sopra) e dalla gola (sotto, solo giunti FW).",
    },
    {
      key: "thickness_max",
      label: "Spessore materiale base — massimo (mm)",
      type: "number",
      required: false,
      hint: "Range spessore MATERIALE BASE (parent material) dal range of qualification dichiarato sul verbale — non ricalcolare. Diverso dallo spessore prova (sopra) e dalla gola (sotto, solo giunti FW).",
    },
    {
      key: "thickness_max_unlimited",
      label: "Spessore massimo — nessun limite superiore",
      type: "boolean",
      required: false,
      hint: "true SOLO se il verbale dichiara esplicitamente un range aperto (es. \u201C\u2265 5\u201D, \u201C=> 5\u201D, \u201Cno restriction\u201D, \u201Csenza limite superiore\u201D) — frequente su giunti FW/angolo. Se il campo è semplicemente assente dal documento, lasciare null/false",
    },
    {
      key: "diameter_min",
      label: "Diametro tubo - minimo (mm)",
      type: "number",
      required: false,
      hint: "Solo se il verbale dichiara un NUMERO per il range di diametro tubo qualificato. Se invece il verbale riporta qui una regola testuale tipo \u201C> 500; > 150 for position PC, PF/PA rotated\u201D (tipico quando la prova è su PIASTRA, non tubo), NON trascriverla qui: lascia questi due campi vuoti e imposta \u201CTipo prodotto testato\u201D = Piastra — il sistema applica automaticamente quella regola (ISO 15614-1 §8.3.3) quando genera/verifica una WPS su tubo.",
    },
    {
      key: "diameter_max",
      label: "Diametro tubo - massimo (mm)",
      type: "number",
      required: false,
      hint: "Vedi nota sul campo minimo — non trascrivere qui la regola testuale piastra→tubo del verbale.",
    },
    {
      key: "throat_test_mm",
      label: "Spessore gola provino (mm) — solo giunti FW",
      type: "number",
      required: false,
      hint: "Tabella 8 ISO 15614-1 — spessore gola (throat) del provino testato, solo se dichiarato esplicitamente sul verbale per giunti d'angolo/FW. Lascia vuoto se non applicabile o non dichiarato.",
    },
    {
      key: "welding_positions",
      label: "Posizioni qualificate",
      type: "multiselect",
      required: false,
      options: WELDING_POSITION_OPTIONS,
      hint: "Posizioni secondo ISO 6947 dichiarate sul verbale (es. PA)",
    },
    {
      key: "rotated_position",
      label: "Posizione tubo ruotato (PF/PA ruotata)",
      type: "boolean",
      required: false,
      hint: "Spunta SOLO se il verbale dichiara esplicitamente che la posizione PF o PA è stata eseguita con il tubo ruotato durante la saldatura (es. \u201CPF rotated\u201D). Rilevante solo per Tipo prodotto = Piastra + posizione PF o PA: alza a >150mm (invece di >500mm) il diametro tubo automaticamente coperto (ISO 15614-1 §8.3.3). Non serve per la posizione PC, già coperta a >150mm senza bisogno di questo flag.",
    },
    {
      key: "filler_material",
      label: "Materiale d'apporto",
      type: "text",
      required: false,
      hint: "Designazione ISO 14341 se filo MAG/MIG acciaio (es. G 42 4 M21 3Si1 / 4Si1); altre norme se diverso consumabile",
    },
    {
      key: "pwht",
      label: "PWHT (trattamento termico post-saldatura)",
      type: "boolean",
      required: false,
    },
    {
      key: "wps_ref",
      label: "WPS di riferimento",
      type: "text",
      required: false,
      hint: "Es. \u201C002p_24 rev.0\u201D — solo testo, non collega automaticamente alla WPS registrata",
    },
    {
      key: "examiner_body",
      label: "Ente / esaminatore",
      type: "select",
      required: false,
      options: [
        { value: "tuv",         label: "TÜV" },
        { value: "bv",          label: "Bureau Veritas (BV)" },
        { value: "dnv",         label: "DNV GL" },
        { value: "rina",        label: "RINA" },
        { value: "imq",         label: "IMQ" },
        { value: "iqn",         label: "IQNet" },
        { value: "csq",         label: "CSQ / Certiquality" },
        { value: "iis_isscert", label: "IIS - ISSCERT (Istituto Italiano di Saldatura)" },
        { value: "tec_eurolab", label: "TEC Eurolab" },
        { value: "sideius",     label: "Sideius (Valor)" },
        { value: "altro",       label: "Altro" },
      ],
    },
    {
      key: "welder_name",
      label: "Saldatore",
      type: "text",
      required: false,
    },
    {
      key: "approval_date",
      label: "Data emissione / approvazione",
      type: "date",
      required: false,
      hint: "Preferire la data di emissione (\u201CRecord issued\u201D) del verbale",
    },

    // --- Parametri prova (pag.2, essenziali) ---
    {
      key: "base_material_spec",
      label: "Specifica materiale base",
      type: "text",
      required: false,
      hint: "Es. S355J2+N",
    },
    {
      key: "shielding_gas",
      label: "Gas di protezione",
      type: "text",
      required: false,
      hint: "Es. M20, Ar 92% CO2 8%",
    },
    {
      key: "current_type",
      label: "Tipo corrente",
      type: "text",
      required: false,
      hint: "Es. DC-EP",
    },
    {
      key: "metal_transfer",
      label: "Trasferimento metallo",
      type: "text",
      required: false,
      hint: "Es. Short arc, Spray arc",
    },
    {
      key: "mechanization",
      label: "Grado meccanizzazione",
      type: "select",
      required: false,
      options: [
        { value: "manual", label: "Manuale" },
        { value: "partly_mechanized", label: "Parzialmente meccanizzata" },
        { value: "mechanized", label: "Meccanizzata" },
        { value: "automatic", label: "Automatica" },
      ],
    },
    {
      key: "single_multi_run",
      label: "Tecnica passata",
      type: "select",
      required: false,
      options: [
        { value: "single", label: "Mono-passata" },
        { value: "multi", label: "Multi-passata" },
      ],
    },
    {
      key: "heat_input_note",
      label: "Note apporto termico",
      type: "text",
      required: false,
      hint: "Breve nota, es. \u201C\u00B125% rispetto al valore qualificato\u201D",
    },
    {
      key: "preheat_temp",
      label: "Temperatura preriscaldo (Tp)",
      type: "text",
      required: false,
      hint: "ISO 13916 Tp — es. min 100 °C",
    },
    {
      key: "interpass_temp",
      label: "Temperatura interpass (Ti)",
      type: "text",
      required: false,
      hint: "ISO 13916 Ti — es. max 250 °C",
    },
  ],
  aiPrompt: `Stai analizzando un WPQR (Welding Procedure Qualification Record) secondo ISO 15614.
Estrai TUTTI i seguenti campi in "type_specific_data". Se un campo non è presente, usa null.

Campi di copertura (pag.1 RANGE OF QUALIFICATION, priorità alta):
- wpqr_number: numero certificato/WPQR, accetta suffisso rivisione (es. "24-03390-01")
- qualification_level: "1" o "2" solo se dichiarato esplicitamente (Level 1/2) — non dedurre
- standard_reference: norma di riferimento (es. "UNI EN ISO 15614-1:2019")
- welding_process: codice ISO 4063 — preferire un codice numerico esplicito nel testo (es. "Welding process: 135") a un alias generico
- joint_type: "BW", "FW" o "BW+FW"
- product_type: "P" (piastra) o "T" (tubo) — variabile essenziale ISO 15614-1 §8.3.3 per il diametro. Se il documento non lo specifica esplicitamente ma il "Range of qualification" per il diametro contiene una regola testuale tipo "> 500; > 150 for position PC, PF/PA rotated" (invece di un numero), significa che il provino è stato testato su PIASTRA: imposta product_type: "P" e lascia diameter_min/diameter_max: null (NON trascrivere quella regola testuale come numero)
- material_group: gruppo materiale ISO/TR 15608, preferire il sottogruppo (es. "1.2") se presente
- thickness_test_mm: spessore del provino testato (numero)
- thickness_min / thickness_max: range di spessore DICHIARATO sul verbale (non calcolarlo)
- thickness_max_unlimited: booleano — true SOLO se il verbale dichiara esplicitamente un range aperto senza limite superiore (simboli "\u2265", "=>", "\u2a7e", oppure testo "no restriction"/"senza limite superiore"), tipico dei giunti ad angolo (Fillet Weld: es. "t1 = => 5 ; t2 => 5"). In questo caso lascia thickness_max: null e imposta thickness_max_unlimited: true. Se il campo è semplicemente assente dal documento (non un range aperto dichiarato), lascia entrambi null/false — NON confondere le due situazioni
- diameter_min / diameter_max: range diametro tubo se applicabile (SOLO se un numero è dichiarato — vedi nota su product_type sopra per il caso testo/piastra)
- throat_test_mm: spessore gola (throat) del provino testato, SOLO per giunti d'angolo/FW,
  se dichiarato esplicitamente sul verbale (Tabella 8) — numero, null se non applicabile o assente
- welding_positions: array posizioni ISO 6947 (es. ["PA"])
- rotated_position: booleano — true SOLO se il verbale dichiara esplicitamente che la posizione PF o PA
  è stata eseguita con il tubo ruotato ("rotated"/"ruotata"). Se non menzionato, lascia null/false
- filler_material: designazione materiale d'apporto (ISO 14341 se filo GMAW acciaio, es. "G 42 4 M21 3Si1")
- pwht: booleano, PWHT applicato
- wps_ref: identificativo testuale della WPS di riferimento
- examiner_body: ente/esaminatore (TÜV, Bureau Veritas, DNV, RINA, IMQ, TEC Eurolab, Sideius, ecc.)
- welder_name: saldatore che ha eseguito la prova
- approval_date: data di emissione/approvazione del verbale (YYYY-MM-DD), preferire "Record issued"

Parametri prova (pag.2, priorità media):
- base_material_spec: specifica materiale base (es. "S355J2+N")
- shielding_gas: gas di protezione (es. "M20", "Ar 92% CO2 8%")
- current_type: tipo di corrente (es. "DC-EP")
- metal_transfer: modalità di trasferimento metallo
- mechanization: "manual"|"partly_mechanized"|"mechanized"|"automatic"
- single_multi_run: "single" o "multi"
- heat_input_note: nota breve sull'apporto termico, se presente
- preheat_temp: temperatura di preriscaldo (Tp, ISO 13916), es. "min 100 °C"
- interpass_temp: temperatura interpass (Ti, ISO 13916), es. "max 250 °C"

IMPORTANTE: non ricalcolare i range con formule — estrarre solo i valori dichiarati sul verbale.`,
  aiExpectedSchema: {
    wpqr_number: "string|null",
    qualification_level: "1|2|null",
    standard_reference: "string|null",
    welding_process: "string|null",
    joint_type: "BW|FW|BW+FW|null",
    product_type: "P|T|null",
    material_group: "string|null",
    thickness_test_mm: "number|null",
    thickness_min: "number|null",
    thickness_max: "number|null",
    thickness_max_unlimited: "boolean|null",
    diameter_min: "number|null",
    diameter_max: "number|null",
    throat_test_mm: "number|null",
    welding_positions: "string[]|null",
    rotated_position: "boolean|null",
    filler_material: "string|null",
    pwht: "boolean|null",
    wps_ref: "string|null",
    examiner_body: "string|null",
    welder_name: "string|null",
    approval_date: "YYYY-MM-DD|null",
    base_material_spec: "string|null",
    shielding_gas: "string|null",
    current_type: "string|null",
    metal_transfer: "string|null",
    mechanization: "manual|partly_mechanized|mechanized|automatic|null",
    single_multi_run: "single|multi|null",
    heat_input_note: "string|null",
    preheat_temp: "string|null",
    interpass_temp: "string|null",
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
  material_certificate,
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

export { NDT_SECTOR_OPTIONS, NDT_METHOD_OPTIONS };

export default DOCUMENT_TYPE_SCHEMAS;
