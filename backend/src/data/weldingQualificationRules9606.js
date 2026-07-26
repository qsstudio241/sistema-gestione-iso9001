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
 * ATTENZIONE — fonte non verificata in questo catalogo: la Tabella 7 completa (incl. note
 * su piastra/posizione rotante) e' risultata GAP nell'estrazione automatica del PDF (vedi
 * docs/reference/ISO-9606-1-range-validita-patentino.md). Questa regola e' stata comunicata
 * come feedback operativo dal cliente reale Studio Mason (16/07/2026, riscontro su patentini
 * saldatori in campo) e NON da verifica diretta del testo normativo integrale. Va trattata
 * come proposta da confermare, non come dato normativo certo — non usarla per popolare
 * automaticamente record del registro senza revisione umana.
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
        ? 'Diametro tubo coperto: \u226575 mm (posizione di prova rotante su piastra — nota non verificata su copia integrale norma, da confermare; fonte: feedback cliente Studio Mason)'
        : 'Diametro tubo coperto: \u2265500 mm (saldatura su piastra, posizioni PA/PB/PC/PD — nota non verificata su copia integrale norma, da confermare; fonte: feedback cliente Studio Mason)';
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
    describePlateOnlyRotatingPositionDiameterNote,
    buildWelderQualificationRulesPromptSection,
};
