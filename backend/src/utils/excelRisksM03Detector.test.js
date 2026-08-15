/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const {
    detectRisksM03File,
    buildM03TemplateBuffer,
    readPg,
    toDateInput,
    colLetter,
    letterToIndex,
} = require('./excelRisksM03Detector');

function bookFromAoa(aoa, sheetName = 'Analisi Rischio', merges) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (merges) ws['!merges'] = merges;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function bookFromSheets(sheets) {
    const wb = XLSX.utils.book_new();
    sheets.forEach(({ name, aoa }) => {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
    });
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

const HEADER = [
    'Elemento valutato', 'Contesto', 'Parti interessate',
    'Azioni attuali di mitigazione del rischio', 'P', 'G', 'R', 'Livello di rischio',
    'Possibili ulteriori azioni', 'Resp.', 'Temp.', 'Aggiornamento',
    'P', 'G', 'R', 'Livello di rischio residuo',
];

const CLIENT_UPLOADS = [
    path.join('/home/ubuntu/.cursor/projects/workspace/uploads/ANALISI_RISCHI_2026_568f.xlsx'),
    path.join('/home/ubuntu/.cursor/projects/workspace/uploads/RISK_SGQ_-_2025_REV.10_eb92.xlsx'),
];

describe('readPg / toDateInput / lettere', () => {
    it('accetta 1-3 e rifiuta 4', () => {
        expect(readPg(2)).toMatchObject({ present: true, value: 2, invalid: false });
        expect(readPg(4).invalid).toBe(true);
        expect(readPg(4, 5)).toMatchObject({ present: true, value: 4, invalid: false });
        expect(readPg('').present).toBe(false);
    });

    it('mappa peso qualitativo e valore con segno', () => {
        expect(readPg('MEDIO')).toMatchObject({ present: true, value: 2, invalid: false });
        expect(readPg('basso')).toMatchObject({ present: true, value: 1, invalid: false });
        expect(readPg('ALTO')).toMatchObject({ present: true, value: 3, invalid: false });
        expect(readPg(-2)).toMatchObject({ present: true, value: 2, invalid: false });
        expect(readPg(-5).invalid).toBe(true);
        expect(readPg(-5, 5)).toMatchObject({ present: true, value: 5, invalid: false });
    });

    it('normalizza date ISO, DMY e mon-yy', () => {
        expect(toDateInput('2026-09-01')).toBe('2026-09-01');
        expect(toDateInput('1/9/2026')).toBe('2026-09-01');
        expect(toDateInput('Dec-26')).toBe('2026-12-01');
        expect(toDateInput('Mar-27')).toBe('2027-03-01');
        expect(toDateInput('continua')).toBeNull();
    });

    it('converte indice ↔ lettera Excel', () => {
        expect(colLetter(0)).toBe('A');
        expect(colLetter(25)).toBe('Z');
        expect(colLetter(26)).toBe('AA');
        expect(letterToIndex('G')).toBe(6);
        expect(letterToIndex('AA')).toBe(26);
    });
});

describe('detectRisksM03File', () => {
    it('riconosce il template vuoto e non importa', () => {
        const d = detectRisksM03File(buildM03TemplateBuffer());
        expect(d.layout).toBe('m03');
        expect(d.sheetName).toBe('Analisi Rischio');
        expect(d.canImport).toBe(false);
        expect(d.canMap).toBe(true);
        expect(d.stats.create).toBe(0);
        expect(d.mapping.probability).toBe('E');
        expect(d.mapping.impact).toBe('F');
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

    it('residuo P=4 e G=2: importa la riga senza nessun fattore residuo', () => {
        const aoa = [
            HEADER,
            ['A', 'c', 'p', 'x', 2, 2, 4, 'Medio', null, null, null, null, 4, 2, 8, 'Alto'],
        ];
        const d = detectRisksM03File(bookFromAoa(aoa));
        expect(d.stats.create).toBe(1);
        expect(d.rows[0].action).toBe('create');
        expect(d.rows[0].probability).toBe(2);
        expect(d.rows[0].impact).toBe(2);
        expect(d.rows[0].residual_probability).toBeNull();
        expect(d.rows[0].residual_impact).toBeNull();
        expect(d.rows[0].issues.join(' ')).toMatch(/senza residuo/i);
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

    it('non blocca un foglio SWOT: avvisa e importa se P/G sono 1-3', () => {
        const aoa = [
            ['SWOT', 'P', 'G', 'RI'],
            ['S', 2, 2, 4],
        ];
        const d = detectRisksM03File(bookFromAoa(aoa, 'Foglio1'));
        expect(d.canMap).toBe(true);
        expect(d.canImport).toBe(true);
        expect(d.warnings.join(' ')).toMatch(/SWOT/i);
        expect(d.rows[0].probability).toBe(2);
        expect(d.rows[0].impact).toBe(2);
    });

    it('mappa peso qualitativo e spezza rischi/opportunità in due righe', () => {
        const aoa = [
            ['UNITA\'', 'PARTE INTERESSATA', 'FATTORE DEL CONTESTO', 'RISCHI', 'OPPORTUNITÀ', 'SITUAZIONE INIZIALE', 'PESO', 'AZIONI DI MIGLIORAMENTO', 'RESP.', 'ENTRO', 'PESO RESIDUO', 'STATO ATTUALE'],
            ['METAX', 'Clienti', 'Efficienza', 'Ritardo commessa', 'Nuovo mercato', 'Gantt parziale', 'MEDIO', 'Formare UT', 'Mario', 'Dec-26', 'BASSO', 'In corso'],
            ['CORPORATE', 'Banche', 'Credito', null, 'Accesso al credito', 'Rapporti ok', 'BASSO', 'Nessuna', null, null, 'BASSO', null],
        ];
        const d = detectRisksM03File(bookFromAoa(aoa, 'ANALISI RISCHI'));
        expect(d.canImport).toBe(true);
        expect(d.layout).toBe('qualitative');
        expect(d.mapping.peso).toBe('G');
        expect(d.mapping.title_risk).toBe('D');
        expect(d.mapping.title_opportunity).toBe('E');
        expect(d.stats.create).toBe(3);
        expect(d.rows[0].nature).toBe('risk');
        expect(d.rows[0].title).toBe('Ritardo commessa');
        expect(d.rows[0].probability).toBe(2);
        expect(d.rows[0].impact).toBe(2);
        expect(d.rows[0].residual_probability).toBe(1);
        expect(d.rows[0].review_date).toBe('2026-12-01');
        expect(d.rows[1].nature).toBe('opportunity');
        expect(d.rows[1].title).toBe('Nuovo mercato');
        expect(d.rows[2].nature).toBe('opportunity');
        expect(d.rows[2].title).toBe('Accesso al credito');
        expect(d.rows[2].probability).toBe(1);
    });

    it('sceglie il foglio RISK_2025 e accetta Di con segno in 1-3', () => {
        const buf = bookFromSheets([
            { name: 'Contesto est. (2)', aoa: [['Fattori esterni', 'Commenti'], ['Mercato', 'ok']] },
            {
                name: 'RISK_2025',
                aoa: [
                    ['FATTORI', 'PARTI INTERESSATE', 'RISCHI', "OPPORTUNITA'", 'Pi', 'Di', 'Ri', 'Trattamento - Action', 'Resp.', 'Data', 'Pf', 'Df'],
                    ['Mercato', 'Clienti', 'Perdita quote', null, 3, -2, -6, 'Monitorare', 'R&D', null, 2, -2],
                    ['Mercato', 'Direzione', 'Prezzo alto', null, 3, -5, -15, 'Analisi costi', 'UT', null, 3, -2],
                    ['R&S', 'Clienti', null, 'Nuovo prodotto', 2, 2, 4, 'Sviluppo', 'UT', null, 2, 2],
                ],
            },
        ]);
        const d = detectRisksM03File(buf);
        expect(d.sheetName).toBe('RISK_2025');
        expect(d.canImport).toBe(true);
        expect(d.mapping.probability).toBe('E');
        expect(d.mapping.impact).toBe('F');
        expect(d.rows[0].impact).toBe(2);
        expect(d.rows[0].action).toBe('create');
        expect(d.rows[1].action).toBe('skip');
        expect(d.rows[2].nature).toBe('opportunity');
        expect(d.sheets.map((s) => s.name)).toEqual(['Contesto est. (2)', 'RISK_2025']);
        expect(d.observedPgMax).toBe(5);
        const d5 = detectRisksM03File(buf, { pgMax: 5 });
        expect(d5.rows[1].action).toBe('create');
        expect(d5.rows[1].impact).toBe(5);
        expect(d5.stats.create).toBe(3);
    });

    it('rispetta foglio e mapping scelti dall\'utente', () => {
        const buf = bookFromSheets([
            { name: 'Contesto est. (2)', aoa: [['Fattori esterni', 'P', 'G'], ['x', 2, 2]] },
            {
                name: 'RISK_2025',
                aoa: [
                    ['A', 'B', 'C'],
                    ['Titolo custom', 1, 3],
                ],
            },
        ]);
        const d = detectRisksM03File(buf, {
            sheetName: 'RISK_2025',
            mapping: { evaluated_element: 'A', probability: 'B', impact: 'C' },
        });
        expect(d.sheetName).toBe('RISK_2025');
        expect(d.canImport).toBe(true);
        expect(d.rows[0].title).toBe('Titolo custom');
        expect(d.rows[0].probability).toBe(1);
        expect(d.rows[0].impact).toBe(3);
    });

    it('SWOT: quadrante e G negativo → method + segno + nature', () => {
        const buf = bookFromAoa([
            ['Elemento', 'Parti interessate', 'SWOT', 'P', 'G'],
            ['Mercato', 'Clienti', 'T', 2, -3],
            ['Offerta', 'Cliente', 'O', 1, 2],
        ], 'RISK_2025');
        const d = detectRisksM03File(buf, { pgMax: 3 });
        expect(d.layout).toBe('swot');
        expect(d.canImport).toBe(true);
        const threat = d.rows.find((r) => r.swot_quadrant === 'T');
        expect(threat).toMatchObject({
            analysis_method: 'swot_signed',
            impact: 3,
            impact_sign: -1,
            nature: 'risk',
        });
        const opp = d.rows.find((r) => r.swot_quadrant === 'O');
        expect(opp).toMatchObject({
            analysis_method: 'swot_signed',
            impact: 2,
            impact_sign: 1,
            nature: 'opportunity',
        });
    });
});

describe('file cliente reali (se presenti)', () => {
    const [analisiPath, riskSgqPath] = CLIENT_UPLOADS;

    it('ANALISI RISCHI 2026: peso qualitativo importabile', () => {
        if (!fs.existsSync(analisiPath)) return;
        const d = detectRisksM03File(fs.readFileSync(analisiPath));
        expect(d.canMap).toBe(true);
        expect(d.canImport).toBe(true);
        expect(d.sheetName).toBe('ANALISI RISCHI');
        expect(d.mapping.peso).toBeTruthy();
        expect(d.mapping.title_risk).toBeTruthy();
        expect(d.stats.create).toBeGreaterThan(5);
        expect(d.rows.some((r) => r.nature === 'opportunity')).toBe(true);
        expect(d.rows.some((r) => r.nature === 'risk')).toBe(true);
    });

    it('RISK_SGQ 2025: sceglie RISK_2025 e non il catalogo contesto', () => {
        if (!fs.existsSync(riskSgqPath)) return;
        const d = detectRisksM03File(fs.readFileSync(riskSgqPath));
        expect(d.canMap).toBe(true);
        expect(d.sheetName).toBe('RISK_2025');
        expect(d.sheets.length).toBeGreaterThan(2);
        expect(d.mapping.probability).toBeTruthy();
        expect(d.mapping.impact).toBeTruthy();
        expect(d.canImport).toBe(true);
        expect(d.stats.skip).toBeGreaterThan(0);
    });
});
