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

const RANGE_DASH = '[÷–—-]';
const POLARITY_RE = /(?:^|[^A-Za-z])(DC\s*-?\s*E[PN]|AC)(?![A-Za-z])/i;

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

/** Indice di passata (1…20). 250÷270 è una misura, non una passata. */
function smallRunIndex(raw) {
    if (!/^\d+$/.test(String(raw || '').trim())) return false;
    const n = Number(raw);
    return n >= 1 && n <= 20;
}

function continuationOk(rest) {
    if (rest === '' || /^\s/.test(rest)) return true;
    return /^[A-Za-z]?\d{2,3}(?!\d)/.test(rest);
}

function collapseLabel(raw) {
    return String(raw || '').replace(/\s+/g, ' ').trim();
}

/**
 * Etichetta in testa alla riga, anche attaccata al processo (`2Ra138-S`, `1R135`,
 * `3÷4R136`). Il numero intero è goloso: `135-S` non diventa la passata 1.
 * Tra le alternative vale la più lunga (`1R` batte `1`, `3÷4R` batte `3÷4`).
 */
function matchRunLabel(trimmed) {
    const found = [];
    const push = (candidate) => {
        if (candidate) found.push(candidate);
    };

    const plus = /^(\d+\s*\+\s*n)/i.exec(trimmed);
    if (plus && continuationOk(trimmed.slice(plus[0].length))) {
        push({ label: plus[1], rest: trimmed.slice(plus[0].length), len: plus[0].length });
    }

    const rrange = new RegExp(`^(\\d+\\s*R\\s*${RANGE_DASH}\\s*\\d+\\s*R)`, 'i').exec(trimmed);
    if (rrange && continuationOk(trimmed.slice(rrange[0].length))) {
        const parts = rrange[1].split(new RegExp(RANGE_DASH, 'i'));
        const ok = parts.length === 2 && parts.every((p) => smallRunIndex(p.replace(/R/ig, '').trim()));
        if (ok) push({ label: rrange[1], rest: trimmed.slice(rrange[0].length), len: rrange[0].length });
    }

    push(matchShrunkRange(trimmed));

    const singleR = /^(\d+\s*R)/i.exec(trimmed);
    if (singleR && continuationOk(trimmed.slice(singleR[0].length))) {
        push({ label: singleR[1], rest: trimmed.slice(singleR[0].length), len: singleR[0].length });
    }

    const num = /^(\d+)/.exec(trimmed);
    if (num && continuationOk(trimmed.slice(num[0].length))) {
        push({ label: num[1], rest: trimmed.slice(num[0].length), len: num[0].length });
    }

    if (!found.length) return null;
    found.sort((a, b) => b.len - a.len);
    return found[0];
}

/** `3÷4`, `3÷4R`, anche se il processo è attaccato (`3÷4136`, `3÷4R136`). */
function matchShrunkRange(trimmed) {
    const m = new RegExp(`^(\\d+)\\s*(${RANGE_DASH})\\s*(\\d+)`, 'i').exec(trimmed);
    if (!m || !smallRunIndex(m[1])) return null;
    const rightAll = m[3];
    const prefixLen = m[0].length - rightAll.length;
    let best = null;
    for (let len = rightAll.length; len >= 1; len -= 1) {
        const right = rightAll.slice(0, len);
        if (!smallRunIndex(right)) continue;
        let cursor = prefixLen + len;
        const r = /^(\s*R)(?![A-Za-z])/i.exec(trimmed.slice(cursor));
        if (r) cursor += r[0].length;
        const rest = trimmed.slice(cursor);
        if (!continuationOk(rest)) continue;
        if (!best || cursor > best.len) {
            best = { label: trimmed.slice(0, cursor), rest, len: cursor };
        }
    }
    return best;
}

function badLeadingZero(raw) {
    const intPart = String(raw).split(/[.,]/)[0];
    return intPart.length > 1 && intPart[0] === '0';
}

function skipFiller(s, i) {
    while (i < s.length && !/[\d.,÷–—-]/.test(s[i])) i += 1;
    return i;
}

function numberOptions(s, i) {
    let j = i;
    while (j < s.length && /\d/.test(s[j])) j += 1;
    if (j === i) return [];
    const opts = [];
    for (let end = i + 1; end <= j; end += 1) opts.push({ raw: s.slice(i, end), end });
    // Il decimale appartiene solo alla cifra che lo precede (`1,248`, `1,2`).
    // `51,2` è il punto 5 e il diametro 1,2, non 51,2.
    if (j === i + 1 && j < s.length && /[.,]/.test(s[j])) {
        let k = j + 1;
        while (k < s.length && /\d/.test(s[k])) k += 1;
        if (k > j + 1) opts.push({ raw: s.slice(i, k), end: k });
    }
    return opts;
}

function scoreOf(measures) {
    let points = 0;
    let ranges = 0;
    let raw = 0;
    let minRaw = 0;
    for (const m of measures) {
        if (m.range) {
            ranges += 1;
            raw += m._minRaw.length + m._maxRaw.length;
            minRaw += m._minRaw.length;
        } else {
            points += 1;
            raw += m._raw.length;
        }
    }
    return [-points, ranges, raw, minRaw];
}

function addScore(a, b) {
    return a.map((v, idx) => v + b[idx]);
}

function betterScore(a, b) {
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
}

/**
 * Misure attaccate (`250÷27027÷29240÷2601,248÷1,568`).
 * Il taglio giusto consuma tutta la riga, non spezza un decimale e non lascia
 * uno zero spaiato. Tra i tagli possibili vince quello con meno punti isolati.
 */
function parseMeasures(input) {
    const s = String(input || '');
    const memo = new Map();

    function bestFrom(i) {
        if (memo.has(i)) return memo.get(i);
        const pos = skipFiller(s, i);
        if (pos >= s.length) {
            const empty = { measures: [], score: [0, 0, 0, 0] };
            memo.set(i, empty);
            return empty;
        }
        if (!/\d/.test(s[pos])) {
            memo.set(i, null);
            return null;
        }
        let best = null;
        for (const opt of numberOptions(s, pos)) {
            const after = skipFiller(s, opt.end);
            const dash = after < s.length && new RegExp(RANGE_DASH).test(s[after]);
            if (dash) {
                const maxPos = skipFiller(s, after + 1);
                if (maxPos >= s.length || !/\d/.test(s[maxPos])) continue;
                for (const max of numberOptions(s, maxPos)) {
                    if (badLeadingZero(opt.raw) || badLeadingZero(max.raw)) continue;
                    const min = parseDecimalToken(opt.raw);
                    const maxV = parseDecimalToken(max.raw);
                    if (min == null || maxV == null || min > maxV) continue;
                    const rest = bestFrom(max.end);
                    if (!rest) continue;
                    const measure = {
                        range: true, min, max: maxV, _minRaw: opt.raw, _maxRaw: max.raw,
                    };
                    const combined = {
                        measures: [measure, ...rest.measures],
                        score: addScore(scoreOf([measure]), rest.score),
                    };
                    if (!best || betterScore(combined.score, best.score)) best = combined;
                }
            } else {
                if (badLeadingZero(opt.raw)) continue;
                const value = parseDecimalToken(opt.raw);
                if (value == null) continue;
                const rest = bestFrom(opt.end);
                if (!rest) continue;
                const measure = { range: false, value, _raw: opt.raw };
                const combined = {
                    measures: [measure, ...rest.measures],
                    score: addScore(scoreOf([measure]), rest.score),
                };
                if (!best || betterScore(combined.score, best.score)) best = combined;
            }
        }
        memo.set(i, best);
        return best;
    }

    const found = bestFrom(0);
    return found ? found.measures : [];
}

/** Processo 111/135/138-S, anche attaccato (`a138-S1,2` → 138-S). Non è il minimo di un range. */
function findProcess(rest) {
    let s = rest;
    let base = 0;
    if (/^[A-Za-z](?=\d{2,3}(?!\d))/.test(s)) {
        s = s.slice(1);
        base = 1;
    }
    const re = /(\d{2,3})(?:-([A-Za-z]))?/g;
    let m = re.exec(s);
    while (m) {
        const start = m.index;
        const after = s.slice(m.index + m[0].length);
        const insideNumber = (start > 0 && /\d/.test(s[start - 1])) || (!m[2] && /^\d/.test(after));
        const rangeMin = new RegExp(`^\\s*${RANGE_DASH}\\s*\\d`).test(after);
        const rangeMax = new RegExp(`${RANGE_DASH}\\s*$`).test(s.slice(0, start));
        if (!insideNumber && !rangeMin && !rangeMax) {
            return {
                process: m[2] ? `${m[1]}-${m[2]}` : m[1],
                index: base + start,
                length: m[0].length,
            };
        }
        m = re.exec(s);
    }
    return null;
}

function cutSpan(source, index, length) {
    return `${source.slice(0, index)} ${source.slice(index + length)}`;
}

function parseRunLine(line) {
    const trimmed = String(line || '').trim();
    if (!trimmed || isRunHeader(trimmed)) return null;
    const labelMatch = matchRunLabel(trimmed);
    if (!labelMatch) return null;
    const runLabel = collapseLabel(labelMatch.label);
    let rest = labelMatch.rest;
    const processMatch = findProcess(rest);
    const weldingProcess = processMatch ? processMatch.process : null;
    if (processMatch) rest = cutSpan(rest, processMatch.index, processMatch.length);
    const polarityMatch = POLARITY_RE.exec(rest);
    let polarity = null;
    if (polarityMatch) {
        polarity = polarityMatch[1].replace(/\s+/g, ' ').trim();
        const groupStart = polarityMatch.index + polarityMatch[0].indexOf(polarityMatch[1]);
        rest = cutSpan(rest, groupStart, polarityMatch[1].length);
    }

    const measures = parseMeasures(rest);
    const firstRange = measures.findIndex((item) => item.range);
    const before = firstRange === -1 ? measures : measures.slice(0, firstRange);
    const smallPoints = before.filter((item) => !item.range && item.value > 0 && item.value < 10);
    const diameter = smallPoints.length ? smallPoints[smallPoints.length - 1].value : null;
    const used = measures.filter((item) => item.range).slice(0, 4).map((item) => ({
        range: true, min: item.min, max: item.max,
    }));
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

function isStrongValidityRow(row) {
    return !!(row && row.welding_process && row.current_polarity
        && row.slots.length >= 4 && row.slots.every((slot) => slot.range));
}

function nearestUnit(lines, endIndex, kind) {
    const start = Math.max(0, endIndex - 30);
    for (let k = endIndex; k >= start; k -= 1) {
        if (String(lines[k]).includes('\f')) break;
        const unit = unitFromHeader(lines[k], kind);
        if (unit) return unit;
    }
    return null;
}

function collectTables(lines) {
    const tables = [];
    const consumed = new Set();
    for (let i = 0; i < lines.length; i += 1) {
        if (!isRunHeader(lines[i])) continue;
        const header = lines[i];
        const rows = [];
        const rowLines = [];
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
            rowLines.push(j);
        }
        if (rows.length && rows.every((row) => row.hasRange)) {
            tables.push({ header, rows });
            consumed.add(i);
            rowLines.forEach((idx) => consumed.add(idx));
        }
        i = Math.max(i, j - 1);
    }
    return { tables, consumed };
}

/**
 * Righe della tabella di validità (A/V/velocità/apporto sono range).
 * Se l'intestazione è spezzata su più righe, resta una riga forte:
 * processo + polarità + quattro range. Le unità si leggono dalla riga più vicina.
 */
function extractValidityRuns(text) {
    const lines = String(text || '').split(/\r?\n/);
    const { tables, consumed } = collectTables(lines);
    const runs = [];
    for (const table of tables) {
        const speedUnit = unitFromHeader(table.header, 'speed');
        const heatUnit = unitFromHeader(table.header, 'heat');
        for (const row of table.rows) runs.push(toValidityRun(row, speedUnit, heatUnit));
    }
    for (let i = 0; i < lines.length; i += 1) {
        if (consumed.has(i)) continue;
        const row = parseRunLine(lines[i]);
        if (!isStrongValidityRow(row)) continue;
        runs.push(toValidityRun(row, nearestUnit(lines, i, 'speed'), nearestUnit(lines, i, 'heat')));
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
