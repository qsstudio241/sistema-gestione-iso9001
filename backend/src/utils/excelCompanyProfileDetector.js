/**
 * Detector Excel profilo azienda (ADR-018 S3a).
 * Riconosce header canonici/sinonimi e legge la prima riga dati.
 */
'use strict';

const XLSX = require('xlsx');
const {
    fieldFromExcelHeader,
    pickEditableFields,
    EXCEL_CANONICAL,
} = require('../data/companyProfileFields');

const A_FIELDS = [
    'vat_number', 'legal_name', 'ateco_primary', 'ateco_primary_desc',
    'registered_city', 'registered_street', 'fiscal_code', 'pec', 'rea_number',
];

function detectHeaderRow(rows) {
    let bestIdx = 0;
    let bestScore = 0;
    const maxScan = Math.min(rows.length, 5);
    for (let i = 0; i < maxScan; i++) {
        const row = rows[i] || [];
        let score = 0;
        for (const cell of row) {
            if (fieldFromExcelHeader(cell)) score += 1;
        }
        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    }
    return { headerRowIdx: bestIdx, matchCount: bestScore };
}

function confidenceForPreview(preview) {
    const filledA = A_FIELDS.filter((k) => preview[k] != null && preview[k] !== '');
    const hasVat = preview.vat_number != null && String(preview.vat_number).trim() !== '';
    const hasAteco = preview.ateco_primary != null && String(preview.ateco_primary).trim() !== '';
    const hasSede = !!(preview.registered_city || preview.registered_street);
    if (hasVat && filledA.length >= 4) return 'alta';
    if (hasAteco && hasSede) return 'media';
    if (filledA.length >= 2) return 'media';
    return 'bassa';
}

function firstDataRow(rows, headerRowIdx) {
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every((c) => c == null || String(c).trim() === '')) continue;
        return { row, rowIndex: i };
    }
    return { row: null, rowIndex: -1 };
}

/**
 * @param {Buffer} buffer
 * @returns {{ sheetName: string, headers: string[], mapping: Record<string,string>, preview: object, mappedCount: number, confidence: string, canImport: boolean }}
 */
function detectCompanyProfileFile(buffer) {
    if (!buffer || !buffer.length) {
        return {
            sheetName: '',
            headers: [],
            mapping: {},
            preview: {},
            mappedCount: 0,
            confidence: 'bassa',
            canImport: false,
            error: 'File vuoto o non valido',
        };
    }

    let wb;
    try {
        wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    } catch (err) {
        return {
            sheetName: '',
            headers: [],
            mapping: {},
            preview: {},
            mappedCount: 0,
            confidence: 'bassa',
            canImport: false,
            error: 'File Excel non leggibile',
        };
    }

    const preferred = wb.SheetNames.find((n) => /profilo/i.test(n)) || wb.SheetNames[0];
    const sheet = preferred ? wb.Sheets[preferred] : null;
    if (!sheet) {
        return {
            sheetName: '',
            headers: [],
            mapping: {},
            preview: {},
            mappedCount: 0,
            confidence: 'bassa',
            canImport: false,
            error: 'Nessun foglio nel file',
        };
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
    const { headerRowIdx, matchCount } = detectHeaderRow(rows);
    const headers = (rows[headerRowIdx] || []).map((h) => String(h ?? '').trim());

    const mapping = {};
    const colByField = {};
    headers.forEach((h, idx) => {
        const field = fieldFromExcelHeader(h);
        if (field && mapping[field] == null) {
            mapping[field] = h;
            colByField[field] = idx;
        }
    });

    const { row } = firstDataRow(rows, headerRowIdx);
    const rawPreview = {};
    for (const [field, idx] of Object.entries(colByField)) {
        rawPreview[field] = row ? row[idx] : null;
    }
    const preview = pickEditableFields(rawPreview);
    const mappedCount = Object.keys(mapping).length;
    const filledCount = Object.values(preview).filter((v) => v != null && v !== '').length;
    const confidence = matchCount === 0 ? 'bassa' : confidenceForPreview(preview);
    let error;
    if (mappedCount === 0) error = 'Nessun campo profilo riconosciuto';
    else if (filledCount === 0) error = 'Nessun valore da importare nella prima riga dati';

    return {
        sheetName: preferred,
        headers,
        mapping,
        preview,
        mappedCount,
        confidence,
        canImport: filledCount >= 1,
        error,
    };
}

function buildImportTemplateBuffer() {
    const headers = Object.values(EXCEL_CANONICAL);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, []]);
    XLSX.utils.book_append_sheet(wb, ws, 'ProfiloAzienda');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
    detectCompanyProfileFile,
    detectHeaderRow,
    confidenceForPreview,
    buildImportTemplateBuffer,
};
