/**
 * Detector Excel analisi rischi (ROO-6 / ROO-6c).
 * Auto-suggest + mapping colonne override (lettere Excel).
 * Peso qualitativo BASSO/MEDIO/ALTO → P=G=1/2/3.
 * Due colonne Rischi/Opportunità → due righe SGQ.
 * Scala CHECK resta 1–3 (valori 4/5 o |D|>3 → skip riga).
 */
'use strict';

const XLSX = require('xlsx');

const QUALITATIVE_PG = {
    basso: 1, bassa: 1, low: 1,
    medio: 2, media: 2, medium: 2,
    alto: 3, alta: 3, high: 3,
};

const MONTH_NUM = {
    jan: 1, gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, may: 5,
    giu: 6, jun: 6, lug: 7, jul: 7, ago: 8, aug: 8,
    set: 9, sep: 9, ott: 10, oct: 10, nov: 11, dic: 12, dec: 12,
};

/** Sinonimi ordinati dal più specifico: primo match vince, tranne effectiveness_note (ultimo). */
const FIELD_SYNONYMS = [
    { field: 'peso_residuo', syns: ['peso residuo'] },
    { field: 'peso', syns: ['peso'] },
    { field: 'title_opportunity', syns: ['opportunita', "opportunita'", 'opport.'] },
    { field: 'title_risk', syns: ['rischi', 'identificazione rischi'] },
    { field: 'evaluated_element', syns: ['elemento valutato', 'elemento valutatao', 'elemento di rischio', 'elemento', "unita'", 'unita'] },
    { field: 'context_text', syns: ['fattore del contesto', 'fattori del contesto', 'fattori', 'contesto'] },
    { field: 'interested_parties_text', syns: ['parte interessata', 'parti interessate', 'parti'] },
    { field: 'current_actions', syns: ['situazione iniziale', 'azioni attuali di mitigazione del rischio', 'azioni attuali'] },
    { field: 'further_actions', syns: ['azioni di miglioramento', 'possibili ulteriori azioni', 'ulteriori azioni', 'trattamento - action'] },
    { field: 'responsible', syns: ['resp.', 'resp', 'responsabile'] },
    { field: 'review_date', syns: ['temp.', 'temp', 'tempistica', 'entro', 'data'] },
    { field: 'effectiveness_note', syns: ['aggiornamento', 'stato attuale', 'actual status', 'follow up/rischi residui'] },
];

const MAPPING_FIELDS = [
    'evaluated_element', 'title_risk', 'title_opportunity',
    'context_text', 'interested_parties_text',
    'current_actions', 'further_actions',
    'responsible', 'review_date',
    'probability', 'impact', 'peso',
    'residual_probability', 'residual_impact', 'peso_residuo',
    'effectiveness_note',
];

function normHeader(value) {
    return String(value ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function headerMatches(h, syn) {
    return h === syn
        || h.startsWith(`${syn} `)
        || h.startsWith(`${syn}(`)
        || h.startsWith(`${syn}/`);
}

function isPHeader(h) {
    return h === 'p' || h === 'pi' || h === 'pf'
        || h === 'probabilita' || h === 'probabilita (p)';
}

function isGHeader(h) {
    return h === 'g' || h === 'd' || h === 'di' || h === 'df'
        || h === 'gravita' || h === 'impatto' || h === 'danno'
        || h === 'gravita (g)';
}

function isRHeader(h) {
    return h === 'r' || h === 'ri' || h === 'rf' || h === 'rr'
        || h === 'rischio' || h === 'r%';
}

function isLevelHeader(h) {
    return h.startsWith('livello') || h === 'lev.' || h === 'lev';
}

function fieldFromHeader(h) {
    for (const { field, syns } of FIELD_SYNONYMS) {
        if (syns.some((syn) => headerMatches(h, syn))) return field;
    }
    return null;
}

function looksLikeSwotOrFmea(headers) {
    return headers.some((h) => {
        const n = normHeader(h);
        return n === 'swot' || n === 'ipr' || n.includes('rilevabil');
    });
}

function colLetter(idx) {
    let n = idx;
    let s = '';
    while (n >= 0) {
        s = String.fromCharCode((n % 26) + 65) + s;
        n = Math.floor(n / 26) - 1;
    }
    return s;
}

function letterToIndex(letter) {
    const raw = String(letter || '').trim().toUpperCase();
    if (!/^[A-Z]+$/.test(raw)) return null;
    let n = 0;
    for (let i = 0; i < raw.length; i += 1) {
        n = n * 26 + (raw.charCodeAt(i) - 64);
    }
    return n - 1;
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
        if (headers.some((h) => fieldFromHeader(h) === 'title_risk')) score += 2;
        if (headers.some((h) => fieldFromHeader(h) === 'title_opportunity')) score += 1;
        if (headers.some((h) => fieldFromHeader(h) === 'peso')) score += 2;
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
        if (!field) return;
        if (field === 'effectiveness_note') {
            mapping[field] = colLetter(idx);
            colByField[field] = idx;
            return;
        }
        if (colByField[field] == null) {
            mapping[field] = colLetter(idx);
            colByField[field] = idx;
        }
    });
    if (pIdxs[0] != null) {
        mapping.probability = colLetter(pIdxs[0]);
        colByField.probability = pIdxs[0];
    }
    if (gIdxs[0] != null) {
        mapping.impact = colLetter(gIdxs[0]);
        colByField.impact = gIdxs[0];
    }
    if (pIdxs[1] != null) {
        mapping.residual_probability = colLetter(pIdxs[1]);
        colByField.residual_probability = pIdxs[1];
    }
    if (gIdxs[1] != null) {
        mapping.residual_impact = colLetter(gIdxs[1]);
        colByField.residual_impact = gIdxs[1];
    }
    return { mapping, colByField };
}

function mappingToColByField(mapping) {
    const colByField = {};
    Object.entries(mapping || {}).forEach(([field, letter]) => {
        if (!MAPPING_FIELDS.includes(field) || !letter) return;
        const idx = letterToIndex(letter);
        if (idx != null) colByField[field] = idx;
    });
    return colByField;
}

function cellText(row, idx) {
    if (idx == null) return null;
    const v = row[idx];
    if (v == null) return null;
    const s = String(v).replace(/\r\n/g, '\n').trim();
    return s === '' ? null : s;
}

function readPg(value) {
    if (value == null || String(value).trim() === '') {
        return { present: false, value: null, invalid: false };
    }
    const raw = String(value).trim();
    const label = QUALITATIVE_PG[normHeader(raw)];
    if (label != null) {
        return { present: true, value: label, invalid: false };
    }
    const n = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(n)) {
        return { present: true, value: null, invalid: true, raw: value };
    }
    const i = Math.abs(Math.round(n));
    if (i < 1 || i > 3) {
        return { present: true, value: null, invalid: true, raw: value };
    }
    return { present: true, value: i, invalid: false };
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
    const mon = s.match(/^([A-Za-z]{3})[-/. ](\d{2}|\d{4})$/);
    if (mon) {
        const m = MONTH_NUM[mon[1].toLowerCase()];
        if (m) {
            const year = mon[2].length === 2 ? `20${mon[2]}` : mon[2];
            return `${year}-${String(m).padStart(2, '0')}-01`;
        }
    }
    return null;
}

function rowHasContent(mapped, p, g) {
    return !!(
        mapped.evaluated_element
        || mapped.title_risk
        || mapped.title_opportunity
        || mapped.context_text
        || mapped.interested_parties_text
        || mapped.current_actions
        || mapped.further_actions
        || mapped.effectiveness_note
        || (p && p.present)
        || (g && g.present)
    );
}

function buildTitle(mapped, excelRow) {
    const el = mapped.evaluated_element && String(mapped.evaluated_element).trim();
    if (el) return el.slice(0, 200);
    return `Valutazione riga ${excelRow}`;
}

function scoreSheetName(name, headers, matchScore) {
    const n = normHeader(name);
    let score = matchScore;
    if (/^risk[_\s-]?\d{4}/.test(n)) score += 8;
    if (/analisi\s*risch/.test(n) || /valutazione\s*risch/.test(n)) score += 5;
    if (/rischi/.test(n) && !/old/.test(n)) score += 4;
    if (/rsk_?old|old/.test(n)) score += 1;
    if (/contesto|tabelle|pivot|istruz/.test(n)) score -= 6;
    const nh = headers.map((h) => normHeader(h));
    if (nh.some((h) => fieldFromHeader(h) === 'title_risk' || fieldFromHeader(h) === 'title_opportunity')) score += 3;
    if (nh.some((h) => isPHeader(h) || fieldFromHeader(h) === 'peso')) score += 2;
    return score;
}

function buildColumns(headers) {
    return headers.map((header, idx) => ({
        key: colLetter(idx),
        header: String(header || '').trim() || `(colonna ${colLetter(idx)})`,
    }));
}

function applyMappedRows(rows, headerRowIdx, colByField) {
    ['evaluated_element', 'context_text', 'current_actions', 'interested_parties_text'].forEach((field) => {
        if (colByField[field] != null) forwardFillColumn(rows, headerRowIdx + 1, colByField[field]);
    });

    const previewRows = [];
    for (let i = headerRowIdx + 1; i < rows.length; i += 1) {
        const raw = rows[i] || [];
        const mapped = {
            evaluated_element: cellText(raw, colByField.evaluated_element),
            title_risk: cellText(raw, colByField.title_risk),
            title_opportunity: cellText(raw, colByField.title_opportunity),
            context_text: cellText(raw, colByField.context_text),
            interested_parties_text: cellText(raw, colByField.interested_parties_text),
            current_actions: cellText(raw, colByField.current_actions),
            further_actions: cellText(raw, colByField.further_actions),
            responsible: cellText(raw, colByField.responsible),
            review_date: toDateInput(raw[colByField.review_date]),
            effectiveness_note: cellText(raw, colByField.effectiveness_note),
        };

        const peso = readPg(raw[colByField.peso]);
        const pesoRes = readPg(raw[colByField.peso_residuo]);
        let p = readPg(raw[colByField.probability]);
        let g = readPg(raw[colByField.impact]);
        let rp = readPg(raw[colByField.residual_probability]);
        let rg = readPg(raw[colByField.residual_impact]);
        if (colByField.probability == null && colByField.peso != null) p = peso;
        if (colByField.impact == null && colByField.peso != null) g = peso;
        if (colByField.residual_probability == null && colByField.peso_residuo != null) rp = pesoRes;
        if (colByField.residual_impact == null && colByField.peso_residuo != null) rg = pesoRes;

        mapped.probability = p.value;
        mapped.impact = g.value;
        mapped.residual_probability = rp.invalid ? null : rp.value;
        mapped.residual_impact = rg.invalid ? null : rg.value;

        if (!rowHasContent(mapped, p, g) && !p.present && !g.present) continue;

        const issues = [];
        let action = 'create';
        if (p.invalid || g.invalid) {
            action = 'skip';
            issues.push('P o G fuori scala 1-3 (ROO-13). Riga non importata.');
        } else if (!p.present || !g.present) {
            action = 'skip';
            issues.push('P e G sono entrambi obbligatori sulla riga (oppure un peso qualitativo).');
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
        const variants = [];
        if (mapped.title_risk || mapped.title_opportunity) {
            if (mapped.title_risk) {
                variants.push({
                    nature: 'risk',
                    title: mapped.title_risk.slice(0, 200),
                    evaluated_element: mapped.evaluated_element || mapped.title_risk.slice(0, 200),
                });
            }
            if (mapped.title_opportunity) {
                variants.push({
                    nature: 'opportunity',
                    title: mapped.title_opportunity.slice(0, 200),
                    evaluated_element: mapped.evaluated_element || mapped.title_opportunity.slice(0, 200),
                });
            }
        } else {
            variants.push({
                nature: 'risk',
                title: buildTitle(mapped, excelRow),
                evaluated_element: mapped.evaluated_element,
            });
        }

        variants.forEach((variant, vIdx) => {
            previewRows.push({
                excelRow,
                splitIndex: vIdx,
                action,
                issues,
                title: variant.title,
                nature: variant.nature,
                evaluated_element: variant.evaluated_element,
                context_text: mapped.context_text,
                interested_parties_text: mapped.interested_parties_text,
                current_actions: mapped.current_actions,
                further_actions: mapped.further_actions,
                responsible: mapped.responsible,
                review_date: mapped.review_date,
                effectiveness_note: mapped.effectiveness_note,
                probability: mapped.probability,
                impact: mapped.impact,
                residual_probability: mapped.residual_probability,
                residual_impact: mapped.residual_impact,
            });
        });
    }
    return previewRows;
}

function analyzeSheet(wb, sheetName) {
    const sheet = wb.Sheets[sheetName];
    const rows = fillMerges(
        XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false }),
        sheet['!merges']
    );
    const { headerRowIdx, matchScore } = detectHeaderRow(rows);
    const headers = (rows[headerRowIdx] || []).map((h) => String(h ?? '').trim());
    const { mapping, colByField } = mapColumns(headers);
    const score = scoreSheetName(sheetName, headers, matchScore);
    return {
        name: sheetName,
        headerRow: headerRowIdx + 1,
        columns: buildColumns(headers),
        suggestedMapping: mapping,
        score,
        matchScore,
        headers,
        rows,
        colByField,
        looksSpecial: looksLikeSwotOrFmea(headers),
    };
}

function pickBestSheet(sheetInfos, preferredName) {
    if (preferredName) {
        const found = sheetInfos.find((s) => s.name === preferredName);
        if (found) return found;
    }
    return sheetInfos.slice().sort((a, b) => b.score - a.score)[0] || null;
}

function inferLayout(mapping, headers, previewRows) {
    if (mapping.peso && !mapping.probability) return 'qualitative';
    if (looksLikeSwotOrFmea(headers)) return 'swot_or_fmea';
    if (previewRows.some((r) => r.nature === 'opportunity')) return 'split_titles';
    if (/analisi\s*rischio/i.test(headers.join(' ')) || mapping.residual_probability) return 'm03';
    return 'mapped';
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
 * @param {{ sheetName?: string, mapping?: Record<string, string> }} [options]
 */
function detectRisksM03File(buffer, options = {}) {
    const empty = {
        layout: null,
        sheetName: '',
        headers: [],
        columns: [],
        sheets: [],
        mapping: {},
        suggestedMapping: {},
        rows: [],
        stats: { create: 0, skip: 0 },
        confidence: 'bassa',
        canImport: false,
        canMap: false,
        warnings: [],
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

    if (!wb.SheetNames.length) {
        return { ...empty, error: 'Nessun foglio nel file' };
    }

    const sheetInfos = wb.SheetNames.map((name) => analyzeSheet(wb, name));
    const selected = pickBestSheet(sheetInfos, options.sheetName);
    if (!selected) {
        return { ...empty, error: 'Nessun foglio nel file' };
    }

    const mapping = (options.mapping && Object.keys(options.mapping).length)
        ? options.mapping
        : selected.suggestedMapping;
    const colByField = mappingToColByField(mapping);
    const previewRows = applyMappedRows(selected.rows, selected.headerRow - 1, colByField);

    const create = previewRows.filter((r) => r.action === 'create').length;
    const skip = previewRows.filter((r) => r.action === 'skip').length;
    const mappedCount = Object.keys(colByField).length;
    const hasCore = colByField.context_text != null && colByField.interested_parties_text != null;
    const hasPg = (colByField.probability != null && colByField.impact != null) || colByField.peso != null;
    const hasTitle = colByField.evaluated_element != null
        || colByField.title_risk != null
        || colByField.title_opportunity != null;
    const sheetIsM03 = /analisi\s*rischio/i.test(selected.name);
    const hasResiduoHeader = selected.headers.some((h) => normHeader(h).includes('residuo'));

    const warnings = [];
    if (selected.looksSpecial) {
        warnings.push('Il foglio ha segnali SWOT/FMEA: controlla il mapping. La scala resta 1–3.');
    }
    if (mapping.peso && !mapping.probability) {
        warnings.push('Peso BASSO/MEDIO/ALTO convertito in P e G = 1/2/3.');
    }
    if (skip > 0) {
        warnings.push('Righe con P/G fuori scala 1–3 (o peso non riconosciuto) vengono saltate, non bloccano il file.');
    }

    let confidence = 'bassa';
    if ((sheetIsM03 || hasResiduoHeader) && mappedCount >= 6) confidence = 'alta';
    else if ((hasCore || hasTitle) && hasPg) confidence = 'media';
    else if (mappedCount >= 4) confidence = 'media';

    const canMap = selected.columns.length > 0;
    const canImport = create > 0;
    let error = null;
    if (!canImport) {
        if (previewRows.length) {
            error = 'Nessuna riga importabile con questo mapping (servono P e G 1–3, o un peso qualitativo).';
        } else if (!hasTitle && !hasPg) {
            error = 'Intestazioni non riconosciute. Seleziona il foglio e associa le colonne.';
        } else {
            error = 'Nessuna riga dati nel foglio. Controlla foglio e mapping colonne.';
        }
    }

    return {
        layout: inferLayout(mapping, selected.headers, previewRows),
        sheetName: selected.name,
        headers: selected.headers,
        columns: selected.columns,
        sheets: sheetInfos.map((s) => ({
            name: s.name,
            headerRow: s.headerRow,
            columns: s.columns,
            suggestedMapping: s.suggestedMapping,
            score: s.score,
        })),
        mapping,
        suggestedMapping: selected.suggestedMapping,
        rows: previewRows,
        stats: { create, skip },
        confidence,
        canImport,
        canMap,
        warnings,
        error,
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
    colLetter,
    letterToIndex,
    applyMappedRows,
    mappingToColByField,
    MAPPING_FIELDS,
};
