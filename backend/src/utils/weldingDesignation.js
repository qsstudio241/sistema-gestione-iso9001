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

    const tMin = num(f.thickness_min_mm);
    const tMax = num(f.thickness_max_mm);
    if (tMin != null || tMax != null) {
        if (tMin != null && tMax != null && tMin !== tMax) {
            tokens.push(`t${fmtNum(tMin)}-${fmtNum(tMax)}`);
        } else {
            tokens.push(`t${fmtNum(tMax != null ? tMax : tMin)}`);
        }
    }

    const dMin = num(f.pipe_diameter_min_mm);
    const dMax = num(f.pipe_diameter_max_mm);
    if (dMin != null || dMax != null) {
        if (dMin != null && dMax != null && dMin !== dMax) {
            tokens.push(`D${fmtNum(dMin)}-${fmtNum(dMax)}`);
        } else {
            tokens.push(`D${fmtNum(dMax != null ? dMax : dMin)}`);
        }
    }

    const positions = normalizePositions(f.welding_positions);
    if (positions.length) tokens.push(positions.join('/'));

    if (f.weld_details) tokens.push(String(f.weld_details).trim());

    if (!tokens.length) return null;
    return tokens.join(' ').substring(0, 200);
}

module.exports = { buildWelderQualificationDesignation };
