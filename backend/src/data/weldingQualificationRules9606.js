'use strict';

/**
 * Regole di calcolo range di qualificazione ISO 9606-1:2017 — fonte unica per
 * UI, ingest e assistente AI su patentini saldatori.
 * Mantenere sincronizzato con app/src/data/weldingQualificationRules9606.js
 *
 * Estratto operativo: docs/reference/ISO-9606-1-range-validita-patentino.md
 * Codifica le regole verificate con certezza nell'estrazione del testo
 * normativo: Tabella 6 (spessore giunti testa a testa), Tabella 7 (diametro
 * tubo), Tabella 8 (spessore giunti d'angolo, entrambe le righe), Tabelle 9/10
 * (matrice posizioni qualificate).
 *
 * Nota tecnica (26/07/2026): il PDF fonte (BS/UNI EN ISO 9606-1:2017) usa un
 * font "SymbolMT" per i simboli matematici (\u2264 \u2265 <) e per il segno
 * "\u00d7" che nella norma indica "posizione per cui il saldatore e' qualificato"
 * nelle Tabelle 9/10 — questi glifi sono mappati su codepoint Private Use Area
 * (U+F020-U+F0FF) che pdfplumber/pymupdf non traducono in testo Unicode
 * standard e appaiono quindi come spazi vuoti nell'estrazione automatica
 * (motivo del GAP nelle sessioni precedenti). Risolto rileggendo i caratteri
 * a livello di glifo con PyMuPDF `rawdict` e verificando visivamente il
 * render di ogni codepoint speciale (script diagnostico non incluso nel
 * repository, solo temporaneo). Risultato: tutte le celle vuote nelle Tabelle
 * 9/10 corrispondono al simbolo "\u00d7" (qualificato); "\u2014" resta "non
 * qualificato" (gia' leggibile prima del fix).
 */

const CONFIRMATION_INTERVAL_MONTHS = 6;

/**
 * @param {{ testDiameterMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number|null } | null}
 */
function computeQualifiedPipeDiameterRange({ testDiameterMm } = {}) {
    const d = Number(testDiameterMm);
    if (!Number.isFinite(d) || d <= 0) return null;

    if (d <= 25) {
        return { minMm: d, maxMm: d * 2 };
    }
    return { minMm: Math.max(d * 0.5, 25), maxMm: null };
}

/**
 * Range di qualificazione spessore per giunti d'angolo (ISO 9606-1 Tabella 8),
 * entrambe le righe.
 * - t < 3 mm  -> da t a 2t, o 3 mm, il maggiore dei due
 * - t >= 3 mm -> da 3 mm, nessun limite superiore
 *
 * La riga t>=3 era GAP nelle sessioni precedenti (glifo "\u2265" non estratto,
 * vedi nota tecnica in testa al file) — risolta il 26/07/2026 rileggendo il
 * PDF a livello di glifo (pagina 22 dell'edizione BS EN ISO 9606-1:2017).
 *
 * @param {{ testThicknessMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number|null } | null}
 */
function computeQualifiedFilletThicknessRange({ testThicknessMm } = {}) {
    const t = Number(testThicknessMm);
    if (!Number.isFinite(t) || t <= 0) return null;

    if (t < 3) {
        return { minMm: t, maxMm: Math.max(t * 2, 3) };
    }
    return { minMm: 3, maxMm: null };
}

/**
 * Range di qualificazione dello spessore depositato per giunti testa a testa
 * (ISO 9606-1 Tabella 6 — §5.7, la tabella piu' usata in pratica).
 * - s < 3 mm        -> da s a max(3, 2s) [nota c: per 311 (ossiacetilenica) max(3, 1,5s)]
 * - 3 <= s < 12 mm  -> da 3 a 2s [nota d: per 311 3 a 1,5s]
 * - s >= 12 mm      -> da 3 mm, nessun limite superiore (nota e: provino saldato in almeno 3 passate)
 *
 * Era GAP totale nelle sessioni precedenti (glifi "<", "\u2264", "\u2265" non
 * estratti dal font SymbolMT, vedi nota tecnica in testa al file) — risolta il
 * 26/07/2026 rileggendo il PDF a livello di glifo (pagina 21 dell'edizione BS
 * EN ISO 9606-1:2017).
 *
 * @param {{ testThicknessMm: number|string|null|undefined, weldingProcessCode?: string|number|null }} params
 * @returns {{ minMm: number, maxMm: number|null } | null}
 */
function computeQualifiedThicknessRangeButtWeld({ testThicknessMm, weldingProcessCode = null } = {}) {
    const s = Number(testThicknessMm);
    if (!Number.isFinite(s) || s <= 0) return null;
    const isOxyacetylene = String(weldingProcessCode || '').trim() === '311';

    if (s < 3) {
        return isOxyacetylene
            ? { minMm: s, maxMm: s * 1.5 }
            : { minMm: s, maxMm: Math.max(s * 2, 3) };
    }
    if (s < 12) {
        return isOxyacetylene
            ? { minMm: 3, maxMm: s * 1.5 }
            : { minMm: 3, maxMm: s * 2 };
    }
    return { minMm: 3, maxMm: null };
}

/**
 * Matrice posizioni qualificate per giunti testa a testa (ISO 9606-1 Tabella 9
 * — §5.8). Chiave = posizione del provino testato, valore = elenco posizioni
 * ISO 6947 per cui il saldatore risulta qualificato.
 */
const BUTT_WELD_POSITION_QUALIFICATION_MATRIX = {
    PA: ['PA'],
    PC: ['PA', 'PC'],
    PE: ['PA', 'PC', 'PE'],
    PF: ['PA', 'PF'],
    PH: ['PA', 'PE', 'PF'],
    PG: ['PG'],
    PJ: ['PA', 'PE', 'PG'],
    'H-L045': ['PA', 'PC', 'PE', 'PF'],
    'J-L045': ['PA', 'PC', 'PE', 'PG'],
};

/**
 * Matrice posizioni qualificate per giunti d'angolo (ISO 9606-1 Tabella 10 —
 * §5.8). Stessa struttura della matrice giunti testa a testa.
 */
const FILLET_WELD_POSITION_QUALIFICATION_MATRIX = {
    PA: ['PA'],
    PB: ['PA', 'PB'],
    PC: ['PA', 'PB', 'PC'],
    PD: ['PA', 'PB', 'PC', 'PD', 'PE'],
    PE: ['PA', 'PB', 'PC', 'PD', 'PE'],
    PF: ['PA', 'PB', 'PF'],
    PH: ['PA', 'PB', 'PC', 'PD', 'PE', 'PF'],
    PG: ['PG'],
    PJ: ['PA', 'PB', 'PD', 'PE', 'PG'],
};

/**
 * Elenco delle posizioni di saldatura (ISO 6947) per cui il saldatore risulta
 * qualificato, dato il provino effettivamente testato (Tabelle 9/10 — §5.8).
 *
 * @param {{ testPosition: string|null|undefined, jointType?: 'BW'|'FW' }} params
 * @returns {string[] | null} null se la posizione testata non e' riconosciuta
 */
function computeQualifiedWeldingPositions({ testPosition, jointType = 'BW' } = {}) {
    const key = String(testPosition || '').toUpperCase().trim();
    if (!key) return null;
    const matrix = String(jointType || '').toUpperCase() === 'FW'
        ? FILLET_WELD_POSITION_QUALIFICATION_MATRIX
        : BUTT_WELD_POSITION_QUALIFICATION_MATRIX;
    const qualified = matrix[key];
    return qualified ? [...qualified] : null;
}

/**
 * Vero se una posizione target risulta coperta dalla qualifica ottenuta con
 * il provino testato (Tabelle 9/10). Ritorna null (nessun giudizio) se la
 * posizione testata non e' riconosciuta nella matrice.
 *
 * @param {{ testPosition: string|null|undefined, targetPosition: string|null|undefined, jointType?: 'BW'|'FW' }} params
 * @returns {boolean|null}
 */
function isWeldingPositionQualified({ testPosition, targetPosition, jointType = 'BW' } = {}) {
    const qualified = computeQualifiedWeldingPositions({ testPosition, jointType });
    if (!qualified) return null;
    return qualified.includes(String(targetPosition || '').toUpperCase().trim());
}

/**
 * Nota aggiuntiva diametro tubo per provini SOLO piastra (nessun tubo testato), saldati
 * in posizione con rotazione del pezzo (es. PA/PB/PC/PD "in posizione rotante").
 *
 * Verificata testualmente il 27/07/2026 (ISO 9606-1 §5.3 "Product type", criteri b/c):
 * "test piece welds in plates cover welds in fixed pipe of outside pipe diameter D >= 500 mm"
 * (criterio b) e "... rotating pipes of outside pipe diameter D >= 75 mm for welding positions
 * PA, PB, PC and PD" (criterio c). Coincide con il feedback operativo del cliente reale Studio
 * Mason (16/07/2026, riscontro su patentini saldatori in campo) — non era un dato inventato,
 * solo mancante nell'estratto sintetico di questo catalogo. Resta comunque un suggerimento/hint
 * per la revisione umana in fase di ingest, non usata per popolare automaticamente record del
 * registro qualifiche senza revisione umana.
 *
 * @param {{ hasPipeDiameter?: boolean, weldingPositions?: string[]|string|null, rotatingPosition?: boolean }} params
 * @returns {string|null}
 */
function describePlateOnlyRotatingPositionDiameterNote({
    hasPipeDiameter = false,
    weldingPositions = null,
    rotatingPosition = false,
} = {}) {
    if (hasPipeDiameter) return null;

    const positions = Array.isArray(weldingPositions)
        ? weldingPositions
        : String(weldingPositions || '').split(/[,;/\s]+/).filter(Boolean);
    const hasRelevantPosition = positions.some((p) => ['PA', 'PB', 'PC', 'PD'].includes(String(p).toUpperCase()));
    if (!hasRelevantPosition) return null;

    return rotatingPosition
        ? 'Diametro tubo coperto: \u226575 mm (posizione di prova rotante su piastra — ISO 9606-1 §5.3 criterio c, verificato 27/07/2026)'
        : 'Diametro tubo coperto: \u2265500 mm (saldatura su piastra, posizioni PA/PB/PC/PD — ISO 9606-1 §5.3 criterio b, verificato 27/07/2026)';
}

/**
 * Codici ISO 4063 dei processi ad arco con filo continuo per cui esiste il
 * concetto di "metodo di trasferimento" del metallo d'apporto. Vedi commento
 * gemello in app/src/data/weldingQualificationRules9606.js — mantenere
 * sincronizzato. Fonte: ISO 9606-1 §5.2 (eccezione "dip (short-circuit)
 * transfer mode (131, 135 and 138)"); 136 incluso per coerenza (stessa
 * famiglia GMAW/FCAW a filo continuo).
 */
const CONTINUOUS_WIRE_ARC_PROCESSES = ['131', '135', '136', '138'];

/**
 * Determina quali campi opzionali del patentino ISO 9606-1 sono pertinenti in
 * base al tipo di prodotto testato (variabile essenziale §11: piastra/tubo) e
 * al processo di saldatura scelto (metodo di trasferimento, §5.2).
 * Vedi commento gemello in app/src/data/weldingQualificationRules9606.js —
 * mantenere sincronizzato.
 *
 * Nota "tubo-piastra"/branch (verificata 27/07/2026, §3.16/§5.4c): un giunto di
 * derivazione (bocchello tubo che si inserisce in un tubo o in una piastra) e' un
 * TIPO DI GIUNTO (branch joint, variante del giunto d'angolo FW), non una terza
 * categoria di product_type — la norma definisce solo "plate (P), pipe (T)" (§11).
 * Per una derivazione il diametro tubo resta applicabile (il ramo qualificato e'
 * sempre tubolare) — non serve e non e' corretto introdurre un terzo valore.
 *
 * @param {{ productType?: 'P'|'T'|string|null, weldingProcessCode?: string|number|null }} [params]
 * @returns {{ pipeDiameterApplicable: boolean, transferModeApplicable: boolean }}
 */
function getApplicableWelderFields({ productType, weldingProcessCode } = {}) {
    const pt = String(productType || '').toUpperCase().trim();
    const proc = String(weldingProcessCode || '').trim();
    return {
        pipeDiameterApplicable: pt !== 'P',
        transferModeApplicable: CONTINUOUS_WIRE_ARC_PROCESSES.includes(proc),
    };
}

function buildWelderQualificationRulesPromptSection() {
    return `
--- REGOLE QUALIFICA SALDATORE ISO 9606-1 ---
- Conferma periodica obbligatoria ogni ${CONFIRMATION_INTERVAL_MONTHS} mesi (non e' la scadenza finale del certificato).
- Diametro tubo (Tabella 7): se il certificato riporta un diametro provino D, il campo di validita' e' [D, 2D] se D<=25 mm, oppure [0,5*D (min 25 mm), nessun limite] se D>25 mm.
- Spessore giunti testa a testa (Tabella 6): con spessore provino s, il campo e' [s, max(3,2s)] se s<3 mm, [3, 2s] se 3<=s<12 mm, [3, nessun limite] se s>=12 mm.
- Spessore giunti d'angolo (Tabella 8): con spessore provino t, il campo e' [t, max(3,2t)] se t<3 mm, [3, nessun limite] se t>=3 mm.
- Estrai comunque il valore/range esplicito riportato sul certificato quando presente: non sovrascriverlo con il calcolo se i due dati non coincidono, segnala solo la discrepanza.
- Un cambio di processo di saldatura richiede nuova qualifica, salvo equivalenze note: 135<->138, 121<->125, 141/143/145 tra loro (142 solo 142).
- Giunto di derivazione/branch/bocchello (es. "tubo-piastra", tubo che si inserisce in una piastra o in un altro tubo): il "tipo prodotto" ufficiale ISO 9606-1 ha solo due valori, "P" (piastra) o "T" (tubo) - NON esiste una terza categoria "tubo-piastra" (norma §11: product type plate(P)/pipe(T)). Se il certificato indica esplicitamente una derivazione/branch/bocchello, mantieni product_type="T" ma NON perdere l'informazione originale: riportala testualmente in weld_details (es. "derivazione/branch tubo-piastra") cosi' l'operatore in revisione la vede e puo' correggere consapevolmente.
- Metodo di trasferimento (transfer mode, §5.2/§9.3): estrai solo per processi ad arco con filo continuo (131, 135, 136, 138) - valori: spray_arc, pulsed_arc, short_arc, globular. Per altri processi (111, 121, 141, 145, 311) non esiste, lascia null. Nota normativa: qualificare con transfer mode "dip"/short-circuit (131/135/138) qualifica anche gli altri transfer mode dello stesso processo, non viceversa.
--- FINE REGOLE ISO 9606-1 ---`.trim();
}

module.exports = {
    CONFIRMATION_INTERVAL_MONTHS,
    computeQualifiedPipeDiameterRange,
    computeQualifiedFilletThicknessRange,
    computeQualifiedThicknessRangeButtWeld,
    computeQualifiedWeldingPositions,
    isWeldingPositionQualified,
    BUTT_WELD_POSITION_QUALIFICATION_MATRIX,
    FILLET_WELD_POSITION_QUALIFICATION_MATRIX,
    CONTINUOUS_WIRE_ARC_PROCESSES,
    describePlateOnlyRotatingPositionDiameterNote,
    getApplicableWelderFields,
    buildWelderQualificationRulesPromptSection,
};
