/**
 * L1 — excelCompanyProfileDetector (ADR-018 S3a)
 */
const XLSX = require('xlsx');
const {
    detectCompanyProfileFile,
    confidenceForPreview,
    buildImportTemplateBuffer,
} = require('./excelCompanyProfileDetector');

function xlsxFromRows(rows, sheetName = 'ProfiloAzienda') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('excelCompanyProfileDetector', () => {
    it('riconosce header canonici e legge la prima riga', () => {
        const buf = xlsxFromRows([
            ['partita_iva', 'ragione_sociale', 'ateco_primario', 'sede_comune', 'n_lavoratori'],
            ['01234567890', 'Acme Srl', '25.11.00', 'Modena', 12],
        ]);
        const r = detectCompanyProfileFile(buf);
        expect(r.canImport).toBe(true);
        expect(r.preview.vat_number).toBe('01234567890');
        expect(r.preview.legal_name).toBe('Acme Srl');
        expect(r.preview.ateco_primary).toBe('25.11.00');
        expect(r.preview.registered_city).toBe('Modena');
        expect(r.preview.employees_count).toBe(12);
        expect(r.confidence).toBe('alta');
    });

    it('accetta sinonimi header (p.iva, ateco, dipendenti, citta)', () => {
        const buf = xlsxFromRows([
            ['P.IVA', 'Codice ATECO', 'Città', 'Dipendenti'],
            ['09876543210', '33.20.01', 'Bologna', '8'],
        ]);
        const r = detectCompanyProfileFile(buf);
        expect(r.mapping.vat_number).toBeTruthy();
        expect(r.mapping.ateco_primary).toBeTruthy();
        expect(r.mapping.registered_city).toBeTruthy();
        expect(r.mapping.employees_count).toBeTruthy();
        expect(r.preview.vat_number).toBe('09876543210');
    });

    it('normalizza bool si/no', () => {
        const buf = xlsxFromRows([
            ['ha_dvr', 'cantieri', 'produce_rifiuti'],
            ['si', 'NO', '1'],
        ]);
        const r = detectCompanyProfileFile(buf);
        expect(r.preview.has_dvr).toBe(1);
        expect(r.preview.has_construction_sites).toBe(0);
        expect(r.preview.produces_waste).toBe(1);
    });

    it('confidence media se ATECO + sede senza P.IVA', () => {
        expect(confidenceForPreview({
            ateco_primary: '25.11.00',
            registered_city: 'Modena',
        })).toBe('media');
    });

    it('confidence bassa se pochi campi', () => {
        const buf = xlsxFromRows([
            ['note'],
            ['solo una nota'],
        ]);
        const r = detectCompanyProfileFile(buf);
        expect(r.confidence).toBe('bassa');
        expect(r.canImport).toBe(true);
        expect(r.preview.notes).toBe('solo una nota');
    });

    it('file non Excel non lancia', () => {
        const r = detectCompanyProfileFile(Buffer.from('ciao'));
        expect(r.canImport).toBe(false);
        expect(r.error).toBeTruthy();
    });

    it('template ha header canonici', () => {
        const buf = buildImportTemplateBuffer();
        const wb = XLSX.read(buf, { type: 'buffer' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
        expect(rows[0]).toContain('partita_iva');
        expect(rows[0]).toContain('ateco_primario');
        expect(rows[0]).toContain('n_lavoratori');
    });
});
