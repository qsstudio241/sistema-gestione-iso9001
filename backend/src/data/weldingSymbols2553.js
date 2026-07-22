'use strict';

/**
 * Catalogo simboli di saldatura ISO 2553 — riferimento per l'estrazione AI da
 * disegni tecnici (drawingExtraction.service.js, req_type 'weld_symbol').
 *
 * Fonte: sintesi tecnica propria basata su ISO 2553 (rappresentazione simbolica
 * delle saldature sui disegni) e bibliografia di settore. Nessun testo normativo
 * copiato: solo mappatura simbolo -> significato, utile a un modello vision per
 * classificare correttamente ciò che vede su un disegno (stessa filosofia di
 * weldingProcesses4063.js e weldingPositions6947.js).
 *
 * Mantenere sincronizzato con docs/reference/ISO-2553-simboli-saldatura.md.
 */

/**
 * Simboli elementari (forma base posizionata sulla linea di riferimento).
 * `shapeHint` descrive la forma grafica per aiutare un modello vision a
 * riconoscerla anche quando il testo del disegno non la nomina esplicitamente.
 */
const BASIC_WELD_SYMBOLS = [
  { key: 'single_v_butt', labelIt: 'Saldatura di testa a V (single-V)', shapeHint: 'V rovesciata sulla linea di riferimento' },
  { key: 'square_butt', labelIt: 'Saldatura di testa a lembi retti (square butt)', shapeHint: 'due linee verticali parallele' },
  { key: 'single_bevel_butt', labelIt: 'Saldatura di testa a lembo unico smussato (single bevel)', shapeHint: 'mezza V, un solo lembo preparato' },
  { key: 'single_u_butt', labelIt: 'Saldatura di testa a U (single-U)', shapeHint: 'U con base arrotondata' },
  { key: 'single_j_butt', labelIt: 'Saldatura di testa a J (single-J)', shapeHint: 'mezza U, un solo lembo preparato' },
  { key: 'fillet', labelIt: 'Saldatura d\'angolo (fillet weld)', shapeHint: 'triangolo con cateto verticale sempre a sinistra' },
  { key: 'edge_weld', labelIt: 'Saldatura su lembi rialzati/di bordo (edge weld)', shapeHint: 'due linee verticali con base arrotondata verso l\'alto' },
  { key: 'backing_run', labelIt: 'Cordone/ripresa al rovescio (backing run)', shapeHint: 'semicerchio pieno, mai usato da solo' },
  { key: 'plug_slot', labelIt: 'Saldatura a tappo o cava (plug/slot weld)', shapeHint: 'rettangolo con linee laterali' },
  { key: 'resistance_spot', labelIt: 'Saldatura a punti per resistenza', shapeHint: 'cerchio pieno centrato sulla linea di riferimento' },
  { key: 'arc_spot', labelIt: 'Saldatura a punti ad arco', shapeHint: 'cerchio pieno su un solo lato della linea' },
  { key: 'resistance_seam', labelIt: 'Saldatura a rulli/continua per resistenza', shapeHint: 'cerchio allungato centrato sulla linea' },
  { key: 'arc_seam', labelIt: 'Saldatura continua ad arco', shapeHint: 'cerchio allungato su un solo lato della linea' },
  { key: 'surfacing', labelIt: 'Riporto/ricoprimento (surfacing)', shapeHint: 'semicerchio con freccia rivolta alla superficie da ricoprire' },
  { key: 'surface_joint', labelIt: 'Giunto di superficie (usato per saldature su prigionieri/stud)', shapeHint: 'due linee orizzontali parallele sopra la linea di riferimento' },
  { key: 'steep_flanked_single_v', labelIt: 'Saldatura di testa a V a lembi accostati (steep flanked)', shapeHint: 'come single-V ma con linea orizzontale alla base' },
];

/**
 * Simboli supplementari: si aggiungono al simbolo elementare per specificare
 * profilo/finitura o istruzioni particolari.
 */
const SUPPLEMENTARY_WELD_SYMBOLS = [
  { key: 'flat_flush', labelIt: 'Profilo piano/a raso (flat/flush)', shapeHint: 'linea orizzontale sopra il simbolo elementare' },
  { key: 'convex', labelIt: 'Profilo convesso', shapeHint: 'arco convesso sopra il simbolo elementare' },
  { key: 'concave', labelIt: 'Profilo concavo', shapeHint: 'arco concavo sopra il simbolo elementare' },
  { key: 'toes_blended', labelIt: 'Raccordo dei piedi del cordone (toes blended smoothly)', shapeHint: 'due piccole linee curve ai lati del simbolo' },
  { key: 'weld_all_round', labelIt: 'Saldatura perimetrale (weld all round)', shapeHint: 'cerchio pieno all\'incrocio tra freccia e linea di riferimento' },
  { key: 'field_site_weld', labelIt: 'Saldatura in cantiere/sul posto (field/site weld)', shapeHint: 'bandierina triangolare all\'incrocio freccia/linea' },
  { key: 'backing_strip', labelIt: 'Piattina di supporto (backing strip)', shapeHint: 'rettangolo pieno sul lato opposto al simbolo di saldatura; lettera R se removibile, M se il materiale è specificato in coda' },
  { key: 'spacer', labelIt: 'Distanziale (solo AWS, non ISO 2553)', shapeHint: 'rettangolo tra i due lembi del giunto a V doppia' },
];

/**
 * Notazione delle quote adiacenti al simbolo (posizione = significato).
 */
const DIMENSION_NOTATION = [
  { position: 'sinistra_del_simbolo', meaning: 'Dimensione principale della saldatura', detail: 'z = cateto (leg length); a = spessore di gola (throat thickness); s = spessore di gola effettivo per saldature a piena penetrazione profonda' },
  { position: 'destra_del_simbolo', meaning: 'Lunghezza / passo / numero elementi (saldature intermittenti)', detail: 'formato tipico n × l (e): n = numero di tratti, l = lunghezza di ciascun tratto, (e) = distanza tra i tratti (passo)' },
  { position: 'assente', meaning: 'Saldatura continua su tutta la lunghezza del giunto', detail: 'in ISO 2553, se non è indicata nessuna quota la saldatura di testa si intende a piena penetrazione e per tutta la lunghezza del giunto' },
  { position: 'coda_della_linea_riferimento', meaning: 'Processo di saldatura (numero ISO 4063), riferimenti a note del disegno o alla WPS', detail: 'la coda (fork) si omette quando non ci sono informazioni aggiuntive' },
];

/**
 * Regole sulla linea di riferimento e sulla linea di rimando (freccia), che
 * determinano su quale lato del giunto si trova la saldatura indicata.
 */
const REFERENCE_LINE_RULES = [
  'La linea di riferimento ISO è sempre orizzontale ed è doppia: una continua e una tratteggiata (parallele).',
  'Il simbolo sulla linea continua indica una saldatura sul lato freccia (arrow side).',
  'Il simbolo sulla linea tratteggiata indica una saldatura sul lato opposto (other side).',
  'Per saldature presenti su entrambi i lati (es. doppio cordone d\'angolo) la linea tratteggiata può essere omessa: i simboli compaiono su entrambi i lati della sola linea continua.',
  'La linea di rimando (freccia) punta al giunto e non è mai orizzontale, per non essere confusa con la linea di riferimento.',
];

const KEY_MAP = new Map([
  ...BASIC_WELD_SYMBOLS.map((s) => [s.key, s]),
  ...SUPPLEMENTARY_WELD_SYMBOLS.map((s) => [s.key, s]),
]);

function getWeldSymbolByKey(key) {
  if (!key) return null;
  return KEY_MAP.get(String(key).trim().toLowerCase()) || null;
}

/**
 * Sezione di prompt compatta per il modello vision che estrae i requisiti da
 * un disegno tecnico (drawingExtraction.service.js). Non è un elenco esaustivo
 * dell'intera norma: solo i simboli/regole più utili per etichettare
 * correttamente ciò che compare sul disegno con terminologia standard.
 */
function buildWeldingSymbolPromptSection(opts = {}) {
  const { maxBasic = 12, maxSupplementary = 8 } = opts;

  const basicLines = BASIC_WELD_SYMBOLS.slice(0, maxBasic).map(
    (s) => `- ${s.labelIt} — forma: ${s.shapeHint}`,
  );
  const supplLines = SUPPLEMENTARY_WELD_SYMBOLS.slice(0, maxSupplementary).map(
    (s) => `- ${s.labelIt} — forma: ${s.shapeHint}`,
  );

  return `
--- SIMBOLI DI SALDATURA ISO 2553 (per req_type: weld_symbol) ---
Regole generali:
${REFERENCE_LINE_RULES.map((r) => `- ${r}`).join('\n')}
Quote adiacenti al simbolo:
- A sinistra del simbolo = dimensione principale (z=cateto, a=spessore di gola, s=spessore di gola per piena penetrazione).
- A destra del simbolo = lunghezza/passo/numero tratti per saldature intermittenti (es. "n × l (e)").
- Nessuna quota su una saldatura di testa = piena penetrazione, per tutta la lunghezza del giunto.
- Un numero nella coda della linea di riferimento è spesso il codice processo ISO 4063 (es. "141" = TIG).
Simboli elementari più frequenti:
${basicLines.join('\n')}
Simboli supplementari più frequenti:
${supplLines.join('\n')}
Nel campo value_text riporta la designazione italiana standard (es. "saldatura d'angolo, cateto 5mm, perimetrale") invece di descrivere solo la forma grafica.
--- FINE SIMBOLI ISO 2553 ---`.trim();
}

module.exports = {
  BASIC_WELD_SYMBOLS,
  SUPPLEMENTARY_WELD_SYMBOLS,
  DIMENSION_NOTATION,
  REFERENCE_LINE_RULES,
  getWeldSymbolByKey,
  buildWeldingSymbolPromptSection,
};
