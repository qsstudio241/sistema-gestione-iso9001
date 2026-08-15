/**
 * Detector Excel analisi rischi M03 (ROO-6).
 * Layout: foglio Analisi Rischio, header riga 2, dati da riga 3.
 * SWOT / FMEA = rifiuto (ROO-6b). Scala P/G resta 1–3 (G=4 → skip riga).
 */
'use strict';

const XLSX = require('xlsx');

const FIELD_SYNONYMS = {
    evaluated_element: ['elemento valutato', 'elemento valutatao', 'elemento'],
    context_text: ['contesto'],
    interested_parties_text: ['parti interessate', 'parti'],
    current_actions: ['azioni attuali di mitigazione del rischio', 'azioni attuali'],
    further_actions: ['possibili ulteriori azioni', 'ulteriori azioni'],
    responsible: ['resp.', 'resp', 'responsabile'],
    review_date: ['temp.', 'temp', 'tempistica'],
    effectiveness_note: ['aggiornamento'],
};

function normHeader(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function isPHeader(h) {
    return h === 'p' || h === 'probabilita' || h === 'probabilita (p)';
}

function isGHeader(h) {
    return h === 'g' || h === 'gravita' || h === 'impatto' || h === 'gravita (g)';
}

function isRHeader(h) {
    return h === 'r' || h === 'rischio';
}

function isLevelHeader(h) {
    return h.startsWith('livello');
}

function fieldFromHeader(h) {
    for (const [field, syns] of Object.entries(FIELD_SYNONYMS)) {
        if (syns.includes(h)) return field;
    }
    return null;
}

function looksLikeSwotOrFmea(headers) {
    return headers.some((h) => {
        const n = normHeader(h);
        return n === 'swot' || n === 'ipr' || n.includes('rilevabil') || n === 'ri' || n === 'rr';
    });
}

function fillMerges(rows, merges) {
    if (!Array.isArray(merges) || !merges.length) return rows;
    for (const m of merges) {
        const src = rows[m.s.r] && rows[m.s.r][m.s.c];
        for (let r = m.s.r; r <= m.e.r; r += 1) {
            if (!rows[r]) rows[r] = [];
            for (let c = m.s.c; c <= m.e.c; c += 1) {
                if (r === m.s.r && c === m.s.c) continue;
                const cur = rows[r][c];
                if (cur == null || String(cur).trim() === '') rows[r][c] = src;
            }
        }
    }
    return rows;
}

function forwardFillColumn(rows, startIdx, colIdx) {
    let last = null;
    for (let i = startIdx; i < rows.length; i += 1) {
        if (!rows[i]) rows[i] = [];
        const cur = rows[i][colIdx];
        if (cur != null && String(cur).trim() !== '') last = cur;
        else if (last != null) rows[i][colIdx] = last;
    }
}

function detectHeaderRow(rows) {
    let bestIdx = 0;
    let bestScore = 0;
    const maxScan = Math.min(rows.length, 8);
    for (let i = 0; i < maxScan; i += 1) {
        const headers = (rows[i] || []).map((c) => normHeader(c));
        let score = 0;
        if (headers.some((h) => fieldFromHeader(h) === 'context_text')) score += 2;
        if (headers.some((h) => fieldFromHeader(h) === 'interested_parties_text')) score += 2;
        if (headers.some((h) => h.includes('residuo'))) score += 3;
        if (headers.some((h) => fieldFromHeader(h) === 'evaluated_element')) score += 1;
        if (headers.some(isPHeader) && headers.some(isGHeader)) score += 2;
        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    }
    return { headerRowIdx: bestIdx, matchScore: bestScore };
}

function mapColumns(headers) {
    const mapping = {};
    const colByField = {};
    const pIdxs = [];
    const gIdxs = [];
    headers.forEach((raw, idx) => {
        const h = normHeader(raw);
        if (isPHeader(h)) { pIdxs.push(idx); return; }
        if (isGHeader(h)) { gIdxs.push(idx); return; }
        if (isRHeader(h) || isLevelHeader(h)) return;
        const field = fieldFromHeader(h);
        if (field && colByField[field] == null) {
            mapping[field] = raw;
            colByField[field] = idx;
        }
    });
    if (pIdxs[0] != null) {
        mapping.probability = headers[pIdxs[0]];
        colByField.probability = pIdxs[0];
    }
    if (gIdxs[0] != null) {
        mapping.impact = headers[gIdxs[0]];
        colByField.impact = gIdxs[0];
    }
    if (pIdxs[1] != null) {
        mapping.residual_probability = headers[pIdxs[1]];
        colByField.residual_probability = pIdxs[1];
    }
    if (gIdxs[1] != null) {
        mapping.residual_impact = headers[gIdxs[1]];
        colByField.residual_impact = gIdxs[1];
    }
    return { mapping, colByField };
}

function cellText(row, idx) {
    if (idx == null) return null;
    const v = row[idx];
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

function readPg(value) {
    if (value == null || String(value).trim() === '') {
        return { present: false, value: null, invalid: false };
    }
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 3) {
        return { present: true, value: null, invalid: true, raw: value };
    }
    return { present: true, value: n, invalid: false };
}

function toDateInput(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }
    const s = String(value).trim();
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1];
    const dmy = s.match(/^(\d{1,2})[/.\\-](\d{1,2})[/.\\-](\d{4})$/);
    if (dmy) {
        return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    }
    return null;
}

function rowHasContent(mapped) {
    return !!(
        mapped.evaluated_element
        || mapped.context_text
        || mapped.interested_parties_text
        || mapped.current_actions
        || mapped.further_actions
        || mapped.effectiveness_note
        || mapped.probability != null
        || mapped.impact != null
    );
}

function buildTitle(mapped, excelRow) {
    const el = mapped.evaluated_element && String(mapped.evaluated_element).trim();
    if (el) return el.slice(0, 200);
    return `Valutazione riga ${excelRow}`;
}

function pickSheet(wb) {
    const named = wb.SheetNames.find((n) => /analisi\s*rischio/i.test(n));
    return named || wb.SheetNames[0] || null;
}

function buildM03TemplateBuffer() {
    const wb = XLSX.utils.book_new();
    const aoa = [
        ['', "ANALISI RISCHI E OPPORTUNITA'", '', '', 'M03 / rev.00'],
        [
            'Elemento valutato', 'Contesto', 'Parti interessate',
            'Azioni attuali di mitigazione del rischio', 'P', 'G', 'R', 'Livello di rischio',
            'Possibili ulteriori azioni', 'Resp.', 'Temp.', 'Aggiornamento',
            'P', 'G', 'R', 'Livello di rischio residuo',
        ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, 'Analisi Rischio');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * @param {Buffer} buffer
 */
function detectRisksM03File(buffer) {
    const empty = {
        layout: null,
        sheetName: '',
        headers: [],
        mapping: {},
        rows: [],
        stats: { create: 0, skip: 0 },
        confidence: 'bassa',
        canImport: false,
        error: null,
    };

    if (!buffer || !buffer.length) {
        return { ...empty, error: 'File vuoto o non valido' };
    }

    let wb;
    try {
        wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch {
        return { ...empty, error: 'File Excel non leggibile' };
    }

    const sheetName = pickSheet(wb);
    const sheet = sheetName ? wb.Sheets[sheetName] : null;
    if (!sheet) {
        return { ...empty, error: 'Nessun foglio nel file' };
    }

    const rows = fillMerges(
        XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false }),
        sheet['!merges']
    );
    const { headerRowIdx, matchScore } = detectHeaderRow(rows);
    const headers = (rows[headerRowIdx] || []).map((h) => String(h ?? '').trim());

    if (looksLikeSwotOrFmea(headers)) {
        return {
            ...empty,
            sheetName,
            headers,
            error: 'Layout SWOT/FMEA non supportato in questa versione (solo M03).',
        };
    }

    const { mapping, colByField } = mapColumns(headers);
    const mappedCount = Object.keys(colByField).length;
    const hasCore = colByField.context_text != null && colByField.interested_parties_text != null;
    const hasPg = colByField.probability != null && colByField.impact != null;
    const sheetIsM03 = /analisi\s*rischio/i.test(sheetName);
    const hasResiduoHeader = headers.some((h) => normHeader(h).includes('residuo'));

    if (!hasCore && !hasPg && matchScore < 3) {
        return {
            ...empty,
            sheetName,
            headers,
            mapping,
            error: 'Intestazioni M03 non riconosciute (servono Contesto, Parti, P e G).',
        };
    }

    ['evaluated_element', 'context_text', 'current_actions'].forEach((field) => {
        if (colByField[field] != null) forwardFillColumn(rows, headerRowIdx + 1, colByField[field]);
    });

    const previewRows = [];
    for (let i = headerRowIdx + 1; i < rows.length; i += 1) {
        const raw = rows[i] || [];
        const mapped = {
            evaluated_element: cellText(raw, colByField.evaluated_element),
            context_text: cellText(raw, colByField.context_text),
            interested_parties_text: cellText(raw, colByField.interested_parties_text),
            current_actions: cellText(raw, colByField.current_actions),
            further_actions: cellText(raw, colByField.further_actions),
            responsible: cellText(raw, colByField.responsible),
            review_date: toDateInput(raw[colByField.review_date]),
            effectiveness_note: cellText(raw, colByField.effectiveness_note),
        };
        const p = readPg(raw[colByField.probability]);
        const g = readPg(raw[colByField.impact]);
        const rp = readPg(raw[colByField.residual_probability]);
        const rg = readPg(raw[colByField.residual_impact]);
        mapped.probability = p.value;
        mapped.impact = g.value;
        mapped.residual_probability = rp.invalid ? null : rp.value;
        mapped.residual_impact = rg.invalid ? null : rg.value;

        if (!rowHasContent(mapped) && !p.present && !g.present) continue;

        const issues = [];
        let action = 'create';
        if (p.invalid || g.invalid) {
            action = 'skip';
            issues.push('P o G fuori scala 1-3 (ROO-13). Riga non importata.');
        } else if (!p.present || !g.present) {
            action = 'skip';
            issues.push('P e G sono entrambi obbligatori sulla riga.');
        }
        if ((rp.invalid || rg.invalid) && action === 'create') {
            issues.push('Residuo P/G fuori scala: importo la riga senza residuo.');
        }
        if ((rp.present && !rg.present) || (!rp.present && rg.present)) {
            mapped.residual_probability = null;
            mapped.residual_impact = null;
            if (action === 'create') issues.push('Residuo incompleto: importo senza P/G residui.');
        }

        const excelRow = i + 1;
        previewRows.push({
            excelRow,
            action,
            issues,
            title: buildTitle(mapped, excelRow),
            nature: 'risk',
            ...mapped,
        });
    }

    const create = previewRows.filter((r) => r.action === 'create').length;
    const skip = previewRows.filter((r) => r.action === 'skip').length;
    let confidence = 'bassa';
    if ((sheetIsM03 || hasResiduoHeader) && mappedCount >= 6) confidence = 'alta';
    else if (hasCore && hasPg) confidence = 'media';
    else if (mappedCount >= 4) confidence = 'media';

    return {
        layout: 'm03',
        sheetName,
        headers,
        mapping,
        rows: previewRows,
        stats: { create, skip },
        confidence,
        canImport: create > 0,
        error: create > 0 ? null : (previewRows.length ? 'Nessuna riga importabile (P/G 1-3).' : 'Nessuna riga dati nel foglio.'),
    };
}

module.exports = {
    detectRisksM03File,
    buildM03TemplateBuffer,
    normHeader,
    mapColumns,
    fillMerges,
    readPg,
    toDateInput,
};
