'use strict';

/**
 * weldingDesignation.js — Costruzione designazione qualifica saldatore ISO 9606-1.
 *
 * Genera una stringa sintetica del campo di validita' della qualifica a partire
 * dai campi estratti/inseriti, es. "141 P BW FM1 t10 D60 PA ss nb".
 *
 * Ordine (ISO 9606-1, forma compatta):
 *   processo, tipo prodotto (P/T), tipo giunto (BW/FW), gruppo apporto (FMx),
 *   spessore (t..), diametro tubo (D..), posizioni, dettagli giunto.
 *
 * Tutti i campi sono opzionali: la funzione include solo i token disponibili.
 * Restituisce null se non c'e' alcun token significativo.
 */

function num(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function fmtNum(n) {
    // 10 -> "10", 2.5 -> "2.5" (rimuove zeri/punto inutili)
    return String(n).replace(/\.0+$/, '');
}

function normalizePositions(positions) {
    if (positions == null) return [];
    let arr = positions;
    if (typeof positions === 'string') {
        arr = positions.split(/[,;/]+/);
    }
    if (!Array.isArray(arr)) return [];
    return arr.map((p) => String(p).trim()).filter(Boolean);
}

/**
 * @param {object} f
 * @param {string|null} [f.welding_process]
 * @param {string|null} [f.product_type] - "P" | "T"
 * @param {string|null} [f.joint_type]   - "BW" | "FW"
 * @param {string|null} [f.filler_material_group] - es. "FM1"
 * @param {number|string|null} [f.thickness_min_mm]
 * @param {number|string|null} [f.thickness_max_mm]
 * @param {number|string|null} [f.pipe_diameter_min_mm]
 * @param {number|string|null} [f.pipe_diameter_max_mm]
 * @param {string[]|string|null} [f.welding_positions]
 * @param {string|null} [f.weld_details]
 * @returns {string|null}
 */
function buildWelderQualificationDesignation(f = {}) {
    const tokens = [];

    if (f.welding_process) tokens.push(String(f.welding_process).trim());
    if (f.product_type) tokens.push(String(f.product_type).trim().toUpperCase());
    if (f.joint_type) tokens.push(String(f.joint_type).trim().toUpperCase());
    if (f.filler_material_group) tokens.push(String(f.filler_material_group).trim());

    // Spessore: min+max noti -> range; solo max noto -> valore singolo (prova puntuale);
    // solo min noto (max vuoto/null) -> "senza limite superiore" (es. t>=3, tipico ISO 9606-1
    // quando il certificato non riporta un massimo esplicito). Vedi feedback cliente Studio Mason.
    const tMin = num(f.thickness_min_mm);
    const tMax = num(f.thickness_max_mm);
    if (tMin != null && tMax != null) {
        tokens.push(tMin === tMax ? `t${fmtNum(tMax)}` : `t${fmtNum(tMin)}-${fmtNum(tMax)}`);
    } else if (tMax != null) {
        tokens.push(`t${fmtNum(tMax)}`);
    } else if (tMin != null) {
        tokens.push(`t\u2265${fmtNum(tMin)}`);
    }

    const dMin = num(f.pipe_diameter_min_mm);
    const dMax = num(f.pipe_diameter_max_mm);
    if (dMin != null && dMax != null) {
        tokens.push(dMin === dMax ? `D${fmtNum(dMax)}` : `D${fmtNum(dMin)}-${fmtNum(dMax)}`);
    } else if (dMax != null) {
        tokens.push(`D${fmtNum(dMax)}`);
    } else if (dMin != null) {
        tokens.push(`D\u2265${fmtNum(dMin)}`);
    }

    const positions = normalizePositions(f.welding_positions);
    if (positions.length) tokens.push(positions.join('/'));

    if (f.weld_details) tokens.push(String(f.weld_details).trim());

    if (!tokens.length) return null;
    return tokens.join(' ').substring(0, 200);
}

/**
 * Conserva la designazione stampata. Il ricalcolo da min/max è solo fallback
 * se il certificato/router non ha letto la riga.
 */
function resolvePrintedDesignation(printed, computeFields = {}) {
    const p = printed != null ? String(printed).trim() : '';
    if (p) return p.substring(0, 200);
    return buildWelderQualificationDesignation(computeFields);
}

const POSITION_TOKEN_RE = /^(PA|PB|PC|PD|PE|PF|PG|PH|PJ|H-L045|J-L045)$/i;
/** ISO 4063 in riga stampata: 135, 141, o 135S (processo + suffisso trasferimento). */
const PROCESS_TOKEN_RE = /^\d{2,3}[A-Z]?$/i;
const PROCESS_IN_LINE_RE = /\b\d{2,3}[A-Z]?\b/i;
const EDITION_ONLY_RE = /^(?:19|20)\d{2}(?:\s*[+]\s*A\d+)?\s*$/i;
const LABELED_9606_RE = /ISO\s*9606-1\s*[:.\-]?\s*([^\n\r]*)/gi;

function parseNumberToken(raw) {
    if (raw == null || raw === '') return null;
    const n = Number(String(raw).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function isEditionOnlyRemainder(rest) {
    return EDITION_ONLY_RE.test(String(rest || '').trim());
}

/** Riga §11: processo + P/T + BW/FW. Non è l'edizione in testata (es. ISO 9606-1:2017). */
function isDesignationRemainder(rest) {
    const s = String(rest || '');
    if (!s.trim() || isEditionOnlyRemainder(s)) return false;
    return PROCESS_IN_LINE_RE.test(s) && /\b[PT]\b/.test(s) && /\b(?:BW|FW)\b/i.test(s);
}

function compactLine(line) {
    return String(line || '').replace(/\s+/g, ' ').trim();
}

function pickDesignationSource(body) {
    LABELED_9606_RE.lastIndex = 0;
    let m;
    while ((m = LABELED_9606_RE.exec(body))) {
        if (!isDesignationRemainder(m[1])) continue;
        return {
            rawLine: compactLine(m[0]),
            tokenSource: m[1],
        };
    }
    const lines = String(body).split(/\r?\n/);
    for (const line of lines) {
        const compact = compactLine(line);
        if (!compact || isEditionOnlyRemainder(compact.replace(/^ISO\s*9606-1\s*[:.\-]?\s*/i, ''))) continue;
        const remainder = compact.replace(/^ISO\s*9606-1\s*[:.\-]?\s*/i, '');
        if (!isDesignationRemainder(remainder) && !isDesignationRemainder(compact)) continue;
        return { rawLine: compact, tokenSource: remainder || compact };
    }
    return null;
}

/**
 * Parser deterministico della riga designazione ISO 9606-1.
 * Esempio: "ISO 9606-1: 135 P FW FM1 t8 PB ss mb"
 * Ignora le sole edizioni in testata ("ISO 9606-1:2017").
 *
 * @param {string} text
 * @returns {object|null}
 */
function parseWelderQualificationDesignation(text) {
    const body = String(text || '');
    if (!body.trim()) return null;

    const picked = pickDesignationSource(body);
    if (!picked) return null;
    const rawLine = picked.rawLine;
    const tokenSource = picked.tokenSource;

    const tokens = String(tokenSource || '')
        .replace(/[;,]+/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);

    const parsed = {
        qualification_designation: rawLine ? String(rawLine).substring(0, 200) : null,
        welding_process_test: null,
        product_type: null,
        joint_type: null,
        filler_material_group: null,
        thickness_s_test_mm: null,
        thickness_t_test_mm: null,
        pipe_diameter_test_mm: null,
        welding_position_test: null,
        weld_details: null,
        transfer_mode: null,
        tokens,
    };

    const leftover = [];
    for (const tok of tokens) {
        if (!parsed.welding_process_test && PROCESS_TOKEN_RE.test(tok)) {
            const digits = String(tok).match(/^(\d{2,3})/i);
            parsed.welding_process_test = digits ? digits[1] : tok;
            const suffix = String(tok).slice(String(parsed.welding_process_test).length).toUpperCase();
            if (suffix === 'S' || suffix === 'D') parsed.transfer_mode = suffix;
            continue;
        }
        const up = tok.toUpperCase();
        if (!parsed.product_type && (up === 'P' || up === 'T')) {
            parsed.product_type = up;
            continue;
        }
        if (!parsed.joint_type && (up === 'BW' || up === 'FW')) {
            parsed.joint_type = up;
            continue;
        }
        if (!parsed.filler_material_group && /^FM\d$/i.test(tok)) {
            parsed.filler_material_group = up;
            continue;
        }
        const sTok = tok.match(/^s\s*=?\s*(\d+(?:[.,]\d+)?)(?:-(\d+(?:[.,]\d+)?))?$/i);
        if (sTok) {
            parsed.thickness_s_test_mm = parseNumberToken(sTok[1]);
            continue;
        }
        const tTok = tok.match(/^t\s*=?\s*(\d+(?:[.,]\d+)?)(?:-(\d+(?:[.,]\d+)?))?$/i);
        if (tTok) {
            parsed.thickness_t_test_mm = parseNumberToken(tTok[1]);
            continue;
        }
        const dTok = tok.match(/^D\s*=?\s*(\d+(?:[.,]\d+)?)(?:-(\d+(?:[.,]\d+)?))?$/i);
        if (dTok) {
            parsed.pipe_diameter_test_mm = parseNumberToken(dTok[1]);
            continue;
        }
        if (!parsed.welding_position_test && POSITION_TOKEN_RE.test(up)) {
            parsed.welding_position_test = up;
            continue;
        }
        // Suffisso trasferimento ISO 9606-1 (S/D): non è ss/bs/nb/mb/sl/ml.
        if (up === 'S' || up === 'D') {
            if (!parsed.transfer_mode) parsed.transfer_mode = up;
            continue;
        }
        leftover.push(tok);
    }

    if (leftover.length) parsed.weld_details = leftover.join(' ');

    const hasCore = parsed.welding_process_test && parsed.product_type && parsed.joint_type;
    if (!hasCore) return null;
    return parsed;
}

/**
 * Campi ingest da parser (prova). Non scrive i range di validità min/max.
 */
function designationFieldsToIngest(parsed) {
    if (!parsed) return {};
    const out = {};
    if (parsed.qualification_designation) out.qualification_designation = parsed.qualification_designation;
    if (parsed.welding_process_test) {
        out.welding_process_test = parsed.welding_process_test;
    }
    if (parsed.transfer_mode) out.transfer_mode = parsed.transfer_mode;
    if (parsed.product_type) out.product_type = parsed.product_type;
    if (parsed.joint_type) out.joint_type = parsed.joint_type;
    if (parsed.filler_material_group) out.filler_material_group = parsed.filler_material_group;
    if (parsed.thickness_s_test_mm != null) out.thickness_s_test_mm = parsed.thickness_s_test_mm;
    if (parsed.thickness_t_test_mm != null) out.thickness_t_test_mm = parsed.thickness_t_test_mm;
    if (parsed.pipe_diameter_test_mm != null) out.pipe_diameter_test_mm = parsed.pipe_diameter_test_mm;
    if (parsed.welding_position_test) out.welding_position_test = parsed.welding_position_test;
    if (parsed.weld_details) out.weld_details = parsed.weld_details;
    return out;
}

module.exports = {
    buildWelderQualificationDesignation,
    resolvePrintedDesignation,
    parseWelderQualificationDesignation,
    designationFieldsToIngest,
};
