'use strict';

/**
 * Passate presenti solo nella tabella dei campi di validità (range min÷max).
 * Non sostituisce la tabella di prova e non ricalcola un valore puntuale.
 * Fixture sintetiche nei test: niente PDF di clienti.
 */

const RANGE_FIELDS = [
    ['current_a_min', 'current_a_max'],
    ['voltage_v_min', 'voltage_v_max'],
    ['travel_speed_min', 'travel_speed_max'],
    ['heat_input_value_min', 'heat_input_value_max'],
];

const LABEL_RE = /^(\d+\s*\+\s*n|\d+\s*R\s*[÷–—-]\s*\d+\s*R|\d+\s*[÷–—-]\s*\d+\s*R?|\d+\s*R|\d+)\b/i;
const PROCESS_RE = /\b(\d{2,3}(?:-[A-Za-z])?)\b/;
const POLARITY_RE = /\b(DC\s*-?\s*E[PN]|AC)\b/i;
const MEASURE_RE = /(\d+(?:[.,]\d+)?)\s*[÷–—-]\s*(\d+(?:[.,]\d+)?)|(?<![A-Za-z])(\d+(?:[.,]\d+)?)/g;

function normRunLabel(label) {
    return String(label || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[–—-]/g, '÷');
}

function parseDecimalToken(raw) {
    const s = String(raw).replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

function isRunHeader(line) {
    const s = String(line || '').toLowerCase();
    return (/\brun\b|passat/.test(s))
        && (/current|ampere|corrente/.test(s))
        && (/volt|tension/.test(s));
}

function unitFromHeader(header, kind) {
    const h = String(header || '').toLowerCase();
    if (kind === 'speed') {
        if (/mm\s*\/\s*s/.test(h)) return 'mm/s';
        if (/cm\s*\/\s*min/.test(h)) return 'cm/min';
        if (/mm\s*\/\s*min/.test(h)) return 'mm/min';
        return null;
    }
    if (/kj\s*\/\s*mm/.test(h)) return 'kJ/mm';
    if (/(^|[^k])j\s*\/\s*mm/.test(h)) return 'J/mm';
    if (/kj\s*\/\s*cm/.test(h)) return 'kJ/cm';
    return null;
}

function runNoFromLabel(label) {
    const m = /\d+/.exec(String(label || ''));
    return m ? Number(m[0]) : null;
}

function parseRunLine(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed || isRunHeader(trimmed)) return null;
    const labelMatch = LABEL_RE.exec(trimmed);
    if (!labelMatch) return null;
    const runLabel = labelMatch[1].replace(/\s+/g, ' ').trim();
    let rest = trimmed.slice(labelMatch[0].length);
    const processMatch = PROCESS_RE.exec(rest);
    const weldingProcess = processMatch ? processMatch[1] : null;
    if (processMatch) {
        rest = `${rest.slice(0, processMatch.index)} ${rest.slice(processMatch.index + processMatch[0].length)}`;
    }
    const polarityMatch = POLARITY_RE.exec(rest);
    const polarity = polarityMatch ? polarityMatch[1].replace(/\s+/g, ' ').trim() : null;
    if (polarityMatch) {
        rest = `${rest.slice(0, polarityMatch.index)} ${rest.slice(polarityMatch.index + polarityMatch[0].length)}`;
    }

    const measures = [];
    MEASURE_RE.lastIndex = 0;
    let match = MEASURE_RE.exec(rest);
    while (match) {
        if (match[1] != null) {
            measures.push({
                range: true,
                min: parseDecimalToken(match[1]),
                max: parseDecimalToken(match[2]),
            });
        } else {
            measures.push({ range: false, value: parseDecimalToken(match[3]) });
        }
        match = MEASURE_RE.exec(rest);
    }

    let diameter = null;
    let tookDiameter = false;
    const slots = [];
    for (const item of measures) {
        if (!tookDiameter && !item.range && item.value != null && item.value > 0 && item.value < 10) {
            diameter = item.value;
            tookDiameter = true;
            continue;
        }
        slots.push(item);
    }
    const used = slots.slice(0, 4);
    if (!weldingProcess && diameter == null && !used.length) return null;
    return {
        run_label: runLabel,
        welding_process: weldingProcess,
        filler_diameter_mm: diameter,
        current_polarity: polarity,
        slots: used,
        hasRange: used.some((slot) => slot.range),
    };
}

function slotToLimits(slot) {
    if (!slot) return { min: null, max: null };
    if (slot.range) return { min: slot.min, max: slot.max };
    if (slot.value == null) return { min: null, max: null };
    return { min: slot.value, max: slot.value };
}

function toValidityRun(row, speedUnit, heatUnit) {
    const limits = RANGE_FIELDS.map((_, index) => slotToLimits(row.slots[index]));
    const run = {
        run_label: row.run_label,
        run_no: runNoFromLabel(row.run_label),
        welding_process: row.welding_process,
        filler_diameter_mm: row.filler_diameter_mm,
        current_polarity: row.current_polarity,
        current_a: null,
        voltage_v: null,
        travel_speed: null,
        heat_input_value: null,
        travel_speed_unit: speedUnit,
        heat_input_unit: heatUnit,
        source: 'ai',
    };
    RANGE_FIELDS.forEach(([minKey, maxKey], index) => {
        run[minKey] = limits[index].min;
        run[maxKey] = limits[index].max;
    });
    return run;
}

function collectTables(text) {
    const lines = String(text || '').split(/\r?\n/);
    const tables = [];
    for (let i = 0; i < lines.length; i += 1) {
        if (!isRunHeader(lines[i])) continue;
        const header = lines[i];
        const rows = [];
        let j = i + 1;
        for (; j < lines.length; j += 1) {
            const line = lines[j];
            if (line.includes('\f')) break;
            if (!line.trim()) {
                if (rows.length) break;
                continue;
            }
            if (isRunHeader(line)) {
                if (rows.length) break;
                continue;
            }
            const row = parseRunLine(line);
            if (!row) {
                if (rows.length) break;
                continue;
            }
            rows.push(row);
        }
        if (rows.length && rows.every((row) => row.hasRange)) {
            tables.push({ header, rows });
        }
        i = Math.max(i, j - 1);
    }
    return tables;
}

/** Righe della tabella di validità (tutte le celle A/V/velocità/apporto sono range). */
function extractValidityRuns(text) {
    const runs = [];
    for (const table of collectTables(text)) {
        const speedUnit = unitFromHeader(table.header, 'speed');
        const heatUnit = unitFromHeader(table.header, 'heat');
        for (const row of table.rows) runs.push(toValidityRun(row, speedUnit, heatUnit));
    }
    return runs;
}

const POINT_FIELDS = ['current_a', 'voltage_v', 'travel_speed', 'heat_input_value'];
const STUB_TEXT_FIELDS = [
    'run_no', 'welding_process', 'filler_diameter_mm', 'current_polarity',
    'travel_speed_unit', 'heat_input_unit',
];

function isBlank(value) {
    return value == null || value === '';
}

/** Valore misurato in tabella di prova: quella riga non si completa coi range. */
function hasPointValue(row) {
    return POINT_FIELDS.some((key) => row && !isBlank(row[key]));
}

/**
 * Lo stub AI ha l'etichetta ma non i limiti. Si riempiono solo i campi vuoti:
 * un min/max già presente e ogni valore puntuale restano quelli dello stub.
 */
function completeStubFromParsed(stub, parsed) {
    const next = { ...stub };
    let changed = false;
    for (const [minKey, maxKey] of RANGE_FIELDS) {
        if (isBlank(next[minKey]) && !isBlank(parsed[minKey])) {
            next[minKey] = parsed[minKey];
            changed = true;
        }
        if (isBlank(next[maxKey]) && !isBlank(parsed[maxKey])) {
            next[maxKey] = parsed[maxKey];
            changed = true;
        }
    }
    for (const key of STUB_TEXT_FIELDS) {
        if (isBlank(next[key]) && !isBlank(parsed[key])) {
            next[key] = parsed[key];
            changed = true;
        }
    }
    return changed ? next : stub;
}

/**
 * Accoda le passate di validità assenti in prova.
 * Se l'etichetta c'è già solo come stub (niente ampere/volt/velocità/apporto
 * puntuali), i range letti dal testo completano i campi mancanti.
 * Una riga con valori di prova resta lo stesso oggetto.
 */
function mergeValidityOnlyRuns(testRuns, validityRuns) {
    const base = Array.isArray(testRuns) ? testRuns : [];
    const indexByLabel = new Map();
    base.forEach((row, index) => {
        const key = normRunLabel(row && row.run_label);
        if (key && !indexByLabel.has(key)) indexByLabel.set(key, index);
    });
    const extra = [];
    const filled = new Map();
    for (const row of Array.isArray(validityRuns) ? validityRuns : []) {
        const key = normRunLabel(row && row.run_label);
        if (!key) continue;
        if (!indexByLabel.has(key)) {
            indexByLabel.set(key, -1);
            extra.push(row);
            continue;
        }
        const index = indexByLabel.get(key);
        if (index < 0) continue;
        const existing = filled.get(index) || base[index];
        if (!existing || typeof existing !== 'object' || hasPointValue(existing)) continue;
        const next = completeStubFromParsed(existing, row);
        if (next !== existing) filled.set(index, next);
    }
    if (!extra.length && filled.size === 0) return base;
    const head = [];
    base.forEach((row, index) => {
        if (!row || typeof row !== 'object') return;
        head.push(filled.has(index) ? filled.get(index) : row);
    });
    return [...head, ...extra];
}

function withValidityRuns(review, text) {
    if (!review || typeof review !== 'object') return review;
    const runs = mergeValidityOnlyRuns(review.test_runs, extractValidityRuns(text));
    if (runs === review.test_runs) return review;
    return { ...review, test_runs: runs };
}

module.exports = {
    RANGE_FIELDS,
    normRunLabel,
    extractValidityRuns,
    mergeValidityOnlyRuns,
    withValidityRuns,
};
