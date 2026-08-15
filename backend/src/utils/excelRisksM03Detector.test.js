/**
 * @jest-environment node
 */

const XLSX = require('xlsx');
const { detectRisksM03File, buildM03TemplateBuffer, readPg, toDateInput } = require('./excelRisksM03Detector');

function bookFromAoa(aoa, sheetName = 'Analisi Rischio', merges) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (merges) ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const HEADER = [
    'Elemento valutato', 'Contesto', 'Parti interessate',
    'Azioni attuali di mitigazione del rischio', 'P', 'G', 'R', 'Livello di rischio',
    'Possibili ulteriori azioni', 'Resp.', 'Temp.', 'Aggiornamento',
    'P', 'G', 'R', 'Livello di rischio residuo',
];

describe('readPg / toDateInput', () => {
    it('accetta 1-3 e rifiuta 4', () => {
        expect(readPg(2)).toEqual({ present: true, value: 2, invalid: false });
        expect(readPg(4).invalid).toBe(true);
        expect(readPg('').present).toBe(false);
    });

    it('normalizza date ISO e DMY', () => {
        expect(toDateInput('2026-09-01')).toBe('2026-09-01');
        expect(toDateInput('1/9/2026')).toBe('2026-09-01');
    });
});

describe('detectRisksM03File', () => {
    it('riconosce il template vuoto e non importa', () => {
        const d = detectRisksM03File(buildM03TemplateBuffer());
        expect(d.layout).toBe('m03');
        expect(d.sheetName).toBe('Analisi Rischio');
        expect(d.canImport).toBe(false);
        expect(d.stats.create).toBe(0);
    });

    it('mappa due righe, residuo e celle unite sull\'elemento', () => {
        const aoa = [
            ['', "ANALISI RISCHI E OPPORTUNITA'"],
            HEADER,
            ['Processo commerciale', 'Mercato', 'Clienti', 'Review', 3, 3, 9, 'Alto', 'Formazione', 'Mario', '2026-09-01', 'ok', 1, 2, 2, 'Basso'],
            [null, 'Altro contesto', 'Fornitori', 'Audit', 2, 2, 4, 'Medio', 'Piano', 'Luca', null, null, null, null, null, null],
        ];
        const buf = bookFromAoa(aoa, 'Analisi Rischio', [{ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }]);
        const d = detectRisksM03File(buf);
        expect(d.canImport).toBe(true);
        expect(d.confidence).toBe('alta');
        expect(d.stats.create).toBe(2);
        expect(d.rows[0].title).toBe('Processo commerciale');
        expect(d.rows[0].probability).toBe(3);
        expect(d.rows[0].residual_probability).toBe(1);
        expect(d.rows[0].residual_impact).toBe(2);
        expect(d.rows[0].review_date).toBe('2026-09-01');
        expect(d.rows[1].evaluated_element).toBe('Processo commerciale');
        expect(d.rows[1].residual_probability).toBeNull();
    });

    it('skippa G=4 senza bloccare le altre righe', () => {
        const aoa = [
            HEADER,
            ['A', 'c', 'p', 'x', 2, 2, 4, 'Medio', null, null, null, null, null, null, null, null],
            ['B', 'c', 'p', 'x', 2, 4, 8, 'Medio', null, null, null, null, null, null, null, null],
        ];
        const d = detectRisksM03File(bookFromAoa(aoa));
        expect(d.stats.create).toBe(1);
        expect(d.stats.skip).toBe(1);
        expect(d.rows[1].action).toBe('skip');
        expect(d.canImport).toBe(true);
    });

    it('rifiuta SWOT', () => {
        const aoa = [
            ['SWOT', 'P', 'G', 'RI'],
            ['S', 2, 2, 4],
        ];
        const d = detectRisksM03File(bookFromAoa(aoa, 'Foglio1'));
        expect(d.canImport).toBe(false);
        expect(d.error).toMatch(/SWOT/);
    });
});
