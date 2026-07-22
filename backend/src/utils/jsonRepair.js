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
 * Sostituisce newline/CR/TAB letterali con spazio SOLO dentro le stringhe JSON.
 * Parser stateful robusto anche quando la stringa non è chiusa (troncamento).
 * @param {string} s
 * @returns {string}
 */
function stripNewlinesInsideStrings(s) {
    const src = String(s || '');
    let out = '';
    let inString = false;
    let escape = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inString) {
            if (escape) {
                out += ch;
                escape = false;
                continue;
            }
            if (ch === '\\') { out += ch; escape = true; continue; }
            if (ch === '"') { out += ch; inString = false; continue; }
            if (ch === '\n' || ch === '\r' || ch === '\t') {
                out += ' ';
                continue;
            }
            out += ch;
        } else {
            out += ch;
            if (ch === '"') inString = true;
        }
    }
    return out;
}

/**
 * Correzioni conservative su JSON quasi-valido.
 * @param {string} s
 * @returns {string}
 */
function repairCommonJsonIssues(s) {
    let out = String(s || '');
    out = stripNewlinesInsideStrings(out);
    // Virgole trailing prima di } o ]
    out = out.replace(/,\s*([}\]])/g, '$1');
    // Apostrofi tipografici
    out = out.replace(/[\u2018\u2019]/g, "'");
    return out;
}

/**
 * Prova a chiudere un oggetto/array JSON troncato aggiungendo } / ] mancanti.
 * Se una stringa è aperta ma non chiusa, la chiude prima.
 * @param {string} s
 * @returns {string}
 */
function closeTruncatedJson(s) {
    const src = String(s || '');
    let inString = false;
    let escape = false;
    const stack = [];
    let lastNonWsIsComma = false;
    for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if (inString) {
            if (escape) { escape = false; continue; }
            if (ch === '\\') { escape = true; continue; }
            if (ch === '"') { inString = false; }
            continue;
        }
        if (ch === '"') { inString = true; lastNonWsIsComma = false; continue; }
        if (ch === '{' || ch === '[') { stack.push(ch); lastNonWsIsComma = false; continue; }
        if (ch === '}' || ch === ']') { stack.pop(); lastNonWsIsComma = false; continue; }
        if (ch === ',') { lastNonWsIsComma = true; continue; }
        if (!/\s/.test(ch)) lastNonWsIsComma = false;
    }
    let closed = src;
    if (inString) closed += '"';
    // Rimuovi eventuale trailing comma prima di chiudere
    if (lastNonWsIsComma) {
        closed = closed.replace(/,\s*$/, '');
    }
    // Se dopo un valore incompleto è rimasto : senza valore, lo chiudiamo con null
    closed = closed.replace(/:\s*$/, ': null');
    while (stack.length) {
        const opener = stack.pop();
        closed += opener === '{' ? '}' : ']';
    }
    return closed;
}

/**
 * Prende un array di oggetti e restituisce un singolo oggetto con i primi valori non-null per chiave.
 * @param {object[]} arr
 * @returns {object}
 */
function mergeArrayOfObjects(arr) {
    const out = {};
    for (const item of arr) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
        for (const [k, v] of Object.entries(item)) {
            if (out[k] == null && v != null && v !== '') out[k] = v;
        }
    }
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
        const repaired = repairCommonJsonIssues(cleaned);
        if (repaired !== cleaned) attempts.push(repaired);
        const extracted = extractJsonObject(cleaned);
        if (extracted && extracted !== cleaned) {
            attempts.push(extracted);
            attempts.push(repairCommonJsonIssues(extracted));
        }
        // Ultima chance: chiudi la struttura troncata (stringhe non chiuse, graffe/parentesi mancanti)
        attempts.push(repairCommonJsonIssues(closeTruncatedJson(cleaned)));
    }

    let lastErr = null;
    for (const candidate of attempts) {
        if (!candidate) continue;
        try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed)) {
                // L'AI a volte avvolge una singola estrazione in un array,
                // o restituisce più righe (es. certificato con più posizioni).
                // Uniamo i valori: prima riga vince per ogni chiave.
                const merged = mergeArrayOfObjects(parsed);
                if (Object.keys(merged).length > 0) return merged;
                const e = new Error('JSON array vuoto o non normalizzabile');
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
    stripNewlinesInsideStrings,
    closeTruncatedJson,
    mergeArrayOfObjects,
    parseJsonWithRepair,
};
