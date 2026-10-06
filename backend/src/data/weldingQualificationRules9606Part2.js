'use strict';

/**
 * Regole di calcolo range di qualificazione ISO 9606-2:2004 (saldatori, alluminio e leghe) come
 * funzioni pure. Edizione unica (2004): nessuna altra edizione da coprire.
 *
 * Fonte: NORMA_00032 (docs/Normative) + estratto operativo
 * docs/reference/ISO-9606-2-range-validita-patentino.md (VQ-3). Valori letti cella per cella
 * (font non anti-copia) e verificati con gli esempi di Annex B.
 *
 * Riuso (nessuna tabella ricopiata): il diametro del tubo (Tab. 4) coincide con la Tab. 7 di ISO 9606-1
 * ed è delegato a `weldingQualificationRules9606.js`; l'intervallo di conferma (§9.2) è la stessa costante.
 *
 * Differenze da 9606-1 che qui contano:
 * - lo spessore di prova è `t` del MATERIALE anche per i giunti testa a testa (Tab. 3), non `s` depositato;
 * - nessuna equivalenza tra processi (§4.2, §5.2: solo 131, 141, 15), corrente DC/AC del 141 essenziale;
 * - posizioni: matrice unica 10 colonne (Tab. 6) con colonne piastra/tubo per PF e PG.
 *
 * NON codificato (GAP G1-G4 dell'estratto): Tab. 1 multi-processo, gruppi Al 21-26 / gruppo 26
 * (CR ISO 15608), corrispondenza simboli tubo PF/PG (9606-2) <-> PH/PJ (9606-1): serve ISO 6947 integrale.
 */

const {
    CONFIRMATION_INTERVAL_MONTHS,
    computeQualifiedPipeDiameterRange: computeQualifiedPipeDiameterRange9606,
} = require('./weldingQualificationRules9606');

const EDITION = '2004';
/** §4.2: unici processi qualificati dalla norma (ISO 4063:1998; `15` è la famiglia plasma). */
const QUALIFIED_PROCESSES = Object.freeze(['131', '141', '15']);
/** §9.2: validità del certificato. */
const VALIDITY_PERIOD_MONTHS = 24;
/** §9.3: il prolungamento avviene ogni 2 anni. */
const PROLONGATION_INTERVAL_MONTHS = 24;

/**
 * Tab. 3 — BW, spessore del materiale `t` del provino (§5.7).
 * - t ≤ 6 mm -> da 0,5 t a 2 t
 * - t > 6 mm -> ≥ 6 mm, nessun limite superiore
 * Al confine t = 6 vale la riga superiore (3–12 mm): discontinuità come scritta nella norma.
 *
 * @param {{ testThicknessMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number|null } | null}
 */
function computeQualifiedThicknessRangeButtWeld({ testThicknessMm } = {}) {
    const t = Number(testThicknessMm);
    if (testThicknessMm == null || testThicknessMm === '' || !Number.isFinite(t) || t <= 0) return null;
    if (t <= 6) return { minMm: t * 0.5, maxMm: t * 2 };
    return { minMm: 6, maxMm: null };
}

/**
 * Tab. 5 — FW, spessore del materiale `t` del provino (§5.7).
 * - t < 3 mm -> da t a 3 mm
 * - t ≥ 3 mm -> ≥ 3 mm, nessun limite superiore
 * Diverso da 9606-1 Tab. 8 (t < 3: da t a 2t o 3 mm, il maggiore).
 *
 * @param {{ testThicknessMm: number|string|null|undefined }} params
 * @returns {{ minMm: number, maxMm: number|null } | null}
 */
function computeQualifiedFilletThicknessRange({ testThicknessMm } = {}) {
    const t = Number(testThicknessMm);
    if (testThicknessMm == null || testThicknessMm === '' || !Number.isFinite(t) || t <= 0) return null;
    if (t < 3) return { minMm: t, maxMm: 3 };
    return { minMm: 3, maxMm: null };
}

/**
 * Tab. 4 — diametro esterno del tubo `D` (§5.7): D ≤ 25 -> da D a 2D; D > 25 -> ≥ 0,5 D (min 25).
 * Stesso criterio di ISO 9606-1 Tab. 7 (verificato con Annex B: D150 -> 75, D200 -> 100, D100 -> 50, D30 -> 25).
 */
function computeQualifiedPipeDiameterRange({ testDiameterMm } = {}) {
    return computeQualifiedPipeDiameterRange9606({ testDiameterMm });
}

/**
 * §5.3 b): una prova su PIASTRA qualifica tubi con D ≥ 150 mm nelle posizioni PA, PB, PC;
 * D ≥ 500 mm in tutte le altre.
 * @param {{ testPosition?: string|null }} params
 * @returns {{ minMm: number, positionKnown: boolean }}
 */
function computePlateToPipeMinDiameter({ testPosition } = {}) {
    const pos = String(testPosition || '').trim().toUpperCase();
    if (!pos) return { minMm: 150, positionKnown: false };
    return { minMm: ['PA', 'PB', 'PC'].includes(pos) ? 150 : 500, positionKnown: true };
}

/**
 * Tab. 6 — posizioni qualificate (§5.8), matrice 10 x 10. Gli identificatori distinguono piastra e tubo
 * dove la tabella ha due colonne: `PF:P` / `PF:T` e `PG:P` / `PG:T`. Ordine colonne confermato da Annex B.
 * Note: PB e PD si usano solo per giunti d'angolo e qualificano solo giunti d'angolo nelle altre posizioni.
 */
const WELDING_POSITION_COLUMNS = Object.freeze(['PA', 'PB', 'PC', 'PD', 'PE', 'PF:P', 'PF:T', 'PG:P', 'PG:T', 'H-L045']);

const POSITION_QUALIFICATION_MATRIX = Object.freeze({
    PA: ['PA', 'PB'],
    PB: ['PA', 'PB'],
    PC: ['PA', 'PB', 'PC'],
    PD: ['PA', 'PB', 'PC', 'PD', 'PE', 'PF:P'],
    PE: ['PA', 'PB', 'PC', 'PD', 'PE', 'PF:P'],
    'PF:P': ['PA', 'PB', 'PF:P'],
    'PF:T': ['PA', 'PB', 'PD', 'PE', 'PF:P', 'PF:T'],
    'PG:P': ['PG:P'],
    'PG:T': ['PA', 'PB', 'PD', 'PE', 'PG:P', 'PG:T'],
    'H-L045': ['PA', 'PB', 'PC', 'PD', 'PE', 'PF:P', 'PF:T', 'H-L045'],
});

/** Simboli della Tab. 6 senza distinzione piastra/tubo (`PF:T` -> `PF`). */
const WELDING_POSITION_SYMBOLS = Object.freeze(Array.from(new Set(WELDING_POSITION_COLUMNS.map((c) => c.split(':')[0]))));

const PLATE_PIPE_SYMBOLS = ['PF', 'PG'];

function normalizeProduct(productType) {
    const s = String(productType || '').trim().toUpperCase();
    if (s === 'P' || s === 'PLATE' || s === 'PIASTRA') return 'P';
    if (s === 'T' || s === 'PIPE' || s === 'TUBO') return 'T';
    return null;
}

function positionSymbol(token) {
    return String(token || '').trim().toUpperCase().split(':')[0];
}

/** Vero se il simbolo compare nella Tab. 6 (non lo è PH/PJ/J-L045 di ISO 9606-1: vedi GAP G4). */
function isPositionSymbolInTable(token) {
    return WELDING_POSITION_SYMBOLS.includes(positionSymbol(token));
}

/**
 * Riga della Tab. 6 per una posizione di prova.
 * @returns {{ row: string|null, reason: 'unknown_symbol'|'product_required'|null }}
 *   `product_required`: PF/PG senza tipo prodotto leggibile (la riga dipende da piastra/tubo).
 */
function resolveTestPositionRow({ testPosition, productType } = {}) {
    const raw = String(testPosition || '').trim().toUpperCase();
    if (POSITION_QUALIFICATION_MATRIX[raw]) return { row: raw, reason: null };
    const symbol = positionSymbol(raw);
    if (PLATE_PIPE_SYMBOLS.includes(symbol)) {
        const product = normalizeProduct(productType);
        if (!product) return { row: null, reason: 'product_required' };
        return { row: `${symbol}:${product}`, reason: null };
    }
    return { row: null, reason: 'unknown_symbol' };
}

/**
 * Posizioni qualificate (identificatori di colonna) dalla/e prova/e eseguita/e.
 * Più posizioni di prova = unione delle righe. Due tubi PF + PC qualificano anche il campo H-L045 (§5.8).
 *
 * @param {{ testPosition: string|string[]|null|undefined, productType?: string|null }} params
 * @returns {string[] | null} null se una posizione non è risolvibile (simbolo fuori Tab. 6 o PF/PG senza P/T)
 */
function computeQualifiedWeldingPositions({ testPosition, productType = null } = {}) {
    const tokens = (Array.isArray(testPosition) ? testPosition : String(testPosition || '').split(/[\s,;/+]+/))
        .map((t) => String(t).trim().toUpperCase())
        .filter(Boolean);
    if (!tokens.length) return null;

    const rows = [];
    for (const token of tokens) {
        const { row } = resolveTestPositionRow({ testPosition: token, productType });
        if (!row) return null;
        if (!rows.includes(row)) rows.push(row);
    }
    if (rows.includes('PF:T') && rows.includes('PC') && !rows.includes('H-L045')) rows.push('H-L045');

    const qualified = new Set();
    for (const row of rows) POSITION_QUALIFICATION_MATRIX[row].forEach((c) => qualified.add(c));
    return WELDING_POSITION_COLUMNS.filter((c) => qualified.has(c));
}

/** Simboli (senza piastra/tubo) delle colonne qualificate, nell'ordine della tabella. */
function qualifiedPositionSymbols(columns) {
    return Array.from(new Set((columns || []).map(positionSymbol)));
}

/**
 * Vero se la posizione target è coperta dalla prova; null se la posizione di prova non è risolvibile.
 * Un simbolo PF/PG senza indicazione piastra/tubo è coperto se lo è almeno una delle due colonne.
 */
function isWeldingPositionQualified({ testPosition, targetPosition, productType = null } = {}) {
    const qualified = computeQualifiedWeldingPositions({ testPosition, productType });
    if (!qualified) return null;
    const target = String(targetPosition || '').trim().toUpperCase();
    if (!target) return false;
    return qualified.includes(target) || qualified.some((c) => c.split(':')[0] === target);
}

/**
 * Normalizza un codice processo al ramo della norma: `15x` (plasma, ISO 4063:2023) -> `15`.
 * Nessuna equivalenza tra processi diversi (§5.2).
 */
function normalizeProcessBranch(code) {
    const c = String(code || '').trim();
    if (/^15\d?$/.test(c)) return '15';
    return c;
}

/**
 * Processi qualificati dalla prova (§5.2): uno solo, quello di prova. `null` se il processo di prova
 * non è tra quelli di §4.2.
 * @returns {string[]|null}
 */
function computeQualifiedWeldingProcesses({ testProcess } = {}) {
    const branch = normalizeProcessBranch(testProcess);
    return QUALIFIED_PROCESSES.includes(branch) ? [branch] : null;
}

/** `YYYY-MM-DD` + n mesi, con l'overflow di fine mese del calendario (31/08 + 6 mesi = 03/03). */
function addMonths(isoDate, months) {
    const [y, m, d] = String(isoDate).slice(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

/** §9.2: data entro cui deve avvenire la prossima conferma (6 mesi dall'esame o dall'ultima conferma). */
function computeNextConfirmationDue(referenceDate) {
    return referenceDate ? addMonths(referenceDate, CONFIRMATION_INTERVAL_MONTHS) : null;
}

/** §9.1, §9.2: scadenza iniziale = data di esecuzione dei provini + 2 anni. */
function computeInitialValidityEnd(examDate) {
    return examDate ? addMonths(examDate, VALIDITY_PERIOD_MONTHS) : null;
}

/** §9.3: scadenza dopo `prolongations` prolungamenti biennali. */
function computeValidityEndAfterProlongations(examDate, prolongations = 0) {
    if (!examDate) return null;
    const n = Math.max(0, Math.floor(Number(prolongations) || 0));
    return addMonths(examDate, VALIDITY_PERIOD_MONTHS + n * PROLONGATION_INTERVAL_MONTHS);
}

module.exports = {
    EDITION,
    QUALIFIED_PROCESSES,
    CONFIRMATION_INTERVAL_MONTHS,
    VALIDITY_PERIOD_MONTHS,
    PROLONGATION_INTERVAL_MONTHS,
    WELDING_POSITION_COLUMNS,
    WELDING_POSITION_SYMBOLS,
    POSITION_QUALIFICATION_MATRIX,
    computeQualifiedThicknessRangeButtWeld,
    computeQualifiedFilletThicknessRange,
    computeQualifiedPipeDiameterRange,
    computePlateToPipeMinDiameter,
    resolveTestPositionRow,
    computeQualifiedWeldingPositions,
    qualifiedPositionSymbols,
    isPositionSymbolInTable,
    isWeldingPositionQualified,
    normalizeProcessBranch,
    computeQualifiedWeldingProcesses,
    addMonths,
    computeNextConfirmationDue,
    computeInitialValidityEnd,
    computeValidityEndAfterProlongations,
};
