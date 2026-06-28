'use strict';

/**
 * jsonRepair.js — parsing difensivo di risposte JSON dall'AI.
 * Usato da documentIngestPipeline e importAiExtraction.
 */

function stripCodeFences(raw) {
    let s = String(raw || '').trim();
    if (s.startsWith('```')) {
        s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    }
    return s.trim();
}

/**
 * Estrae il primo oggetto JSON bilanciato da testo sporco.
 * @param {string} raw
 * @returns {string|null}
 */
function extractJsonObject(raw) {
    const s = String(raw || '');
    const start = s.indexOf('{');
    if (start < 0) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < s.length; i++) {
        const ch = s[i];
        if (inString) {
            if (escape) {
                escape = false;
            } else if (ch === '\\') {
                escape = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }
        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === '{') depth++;
        if (ch === '}') {
            depth--;
            if (depth === 0) {
                return s.slice(start, i + 1);
            }
        }
    }
    return null;
}

/**
 * Correzioni conservative su JSON quasi-valido.
 * @param {string} s
 * @returns {string}
 */
function repairCommonJsonIssues(s) {
    let out = String(s || '');
    // Virgole trailing prima di } o ]
    out = out.replace(/,\s*([}\]])/g, '$1');
    // Apostrofi tipografici
    out = out.replace(/[\u2018\u2019]/g, "'");
    return out;
}

/**
 * @param {string} raw
 * @param {object} [options]
 * @param {boolean} [options.allowRepair=true]
 * @returns {object}
 */
function parseJsonWithRepair(raw, options = {}) {
    const { allowRepair = true } = options;
    const cleaned = stripCodeFences(raw);

    const attempts = [cleaned];
    if (allowRepair) {
        const extracted = extractJsonObject(cleaned);
        if (extracted && extracted !== cleaned) {
            attempts.push(extracted);
            attempts.push(repairCommonJsonIssues(extracted));
        } else {
            attempts.push(repairCommonJsonIssues(cleaned));
        }
    }

    let lastErr = null;
    for (const candidate of attempts) {
        if (!candidate) continue;
        try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed)) {
                const e = new Error('JSON array non supportato');
                e.code = 'AI_BAD_SHAPE';
                throw e;
            }
            if (parsed && typeof parsed === 'object') {
                return parsed;
            }
        } catch (err) {
            if (err.code === 'AI_BAD_SHAPE') throw err;
            lastErr = err;
        }
    }

    const e = new Error(lastErr ? lastErr.message : 'JSON non valido');
    e.code = 'AI_INVALID_JSON';
    throw e;
}

module.exports = {
    stripCodeFences,
    extractJsonObject,
    repairCommonJsonIssues,
    parseJsonWithRepair,
};
