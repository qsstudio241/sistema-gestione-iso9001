const fs = require('fs');
const os = require('os');
const path = require('path');
const XLSX = require('xlsx');
const {
    capText,
    extractSpreadsheetText,
    extractImportFileText,
    MAX_STORED_CHARS,
} = require('./importExtractText');

jest.mock('./importPdfText', () => ({
    extractPdfText: jest.fn(async () => 'testo pdf'),
}));

jest.mock('../services/documentTextExtractor.service', () => ({
    extractDocumentText: jest.fn(async () => ({ text: 'testo word capitolato' })),
}));

const { extractPdfText } = require('./importPdfText');
const { extractDocumentText } = require('../services/documentTextExtractor.service');

describe('capText', () => {
    it('tronca oltre il tetto', () => {
        const out = capText('a'.repeat(MAX_STORED_CHARS + 10));
        expect(out.length).toBe(MAX_STORED_CHARS);
    });

    it('vuoto → null', () => {
        expect(capText('   ')).toBeNull();
    });
});

describe('extractSpreadsheetText', () => {
    it('legge le celle come righe CSV', () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([
            ['Tipo', 'Titolo'],
            ['capitolato', 'RFQ Rossi'],
        ]);
        XLSX.utils.book_append_sheet(wb, ws, 'Foglio1');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        const text = extractSpreadsheetText(buf);
        expect(text).toContain('Foglio1');
        expect(text).toMatch(/capitolato/i);
        expect(text).toContain('RFQ Rossi');
    });
});

describe('extractImportFileText', () => {
    let dir;

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-extract-'));
        jest.clearAllMocks();
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('PDF → extractPdfText', async () => {
        const p = path.join(dir, 'a.pdf');
        fs.writeFileSync(p, '%PDF-1.4');
        const out = await extractImportFileText({ storagePath: p, originalName: 'cartella/a.pdf' });
        expect(extractPdfText).toHaveBeenCalled();
        expect(out.text).toBe('testo pdf');
        expect(out.reason).toBe('pdf');
    });

    it('DOCX → extractDocumentText', async () => {
        const p = path.join(dir, 'b.docx');
        fs.writeFileSync(p, 'fake');
        const out = await extractImportFileText({ storagePath: p, originalName: 'SGQ/b.docx' });
        expect(extractDocumentText).toHaveBeenCalled();
        expect(out.text).toBe('testo word capitolato');
    });

    it('XLSX → celle', async () => {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['manuale qualità']]), 'Q');
        const p = path.join(dir, 'c.xlsx');
        fs.writeFileSync(p, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
        const out = await extractImportFileText({ storagePath: p, originalName: 'c.xlsx' });
        expect(out.reason).toBe('xlsx');
        expect(out.text).toMatch(/manuale/i);
    });

    it('DWG → nessun testo', async () => {
        const p = path.join(dir, 'pezzo.dwg');
        fs.writeFileSync(p, 'binary');
        const out = await extractImportFileText({ storagePath: p, originalName: 'Disegni/pezzo.dwg' });
        expect(out.text).toBeNull();
        expect(out.reason).toBe('no_text_layer');
        expect(extractPdfText).not.toHaveBeenCalled();
    });
});
