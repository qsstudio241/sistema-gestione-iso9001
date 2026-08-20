/**
 * Testo per lo screening Import: PDF, Word, Excel, txt.
 * Immagini / DWG / .doc legacy: nessun testo (OCR = IA-8).
 */

const fs = require('fs');
const path = require('path');
const { extractPdfText } = require('./importPdfText');
const { extractDocumentText } = require('../services/documentTextExtractor.service');

const MAX_STORED_CHARS = 50000;
const DOCUMENT_EXTS = new Set(['.docx', '.txt', '.csv', '.md', '.log']);
const SPREADSHEET_EXTS = new Set(['.xlsx', '.xls']);

function capText(text) {
    const s = String(text || '').trim();
    if (!s) return null;
    return s.length > MAX_STORED_CHARS ? s.slice(0, MAX_STORED_CHARS) : s;
}

/**
 * Prime foglie Excel come CSV (righe = righe foglio).
 * @param {Buffer} buffer
 * @returns {string}
 */
function extractSpreadsheetText(buffer) {
    const XLSX = require('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const parts = [];
    for (const sheetName of (wb.SheetNames || []).slice(0, 5)) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName] || {});
        if (String(csv).trim()) {
            parts.push(`# ${sheetName}\n${String(csv).trim()}`);
        }
        if (parts.join('\n\n').length >= MAX_STORED_CHARS) break;
    }
    return parts.join('\n\n');
}

/**
 * @param {{ storagePath: string, originalName?: string }} input
 * @returns {Promise<{ text: string|null, reason: string }>}
 */
async function extractImportFileText({ storagePath, originalName }) {
    const name = originalName || storagePath || '';
    const ext = path.extname(name).toLowerCase();

    if (ext === '.pdf') {
        const buf = fs.readFileSync(storagePath);
        const text = await extractPdfText(buf);
        const capped = capText(text);
        return { text: capped, reason: capped ? 'pdf' : 'pdf_empty' };
    }

    if (DOCUMENT_EXTS.has(ext)) {
        const out = await extractDocumentText(storagePath, null, name);
        const capped = capText(out.text);
        return { text: capped, reason: out.reason || (capped ? 'ok' : 'empty') };
    }

    if (SPREADSHEET_EXTS.has(ext)) {
        try {
            const buf = fs.readFileSync(storagePath);
            const capped = capText(extractSpreadsheetText(buf));
            return { text: capped, reason: capped ? 'xlsx' : 'xlsx_empty' };
        } catch (_) {
            return { text: null, reason: 'xlsx_parse_error' };
        }
    }

    return { text: null, reason: 'no_text_layer' };
}

module.exports = {
    MAX_STORED_CHARS,
    capText,
    extractSpreadsheetText,
    extractImportFileText,
};
