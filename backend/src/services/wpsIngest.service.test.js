/**
 * @jest-environment node
 */

jest.mock('./documentIngestPipeline.service', () => ({
    runDocumentIngest: jest.fn(),
}));

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const { runDocumentIngest } = require('./documentIngestPipeline.service');
const { query } = require('../config/database');
const { extractWPSFromPdf, checkWpsPlausibility, commitWPSFromFields } = require('./wpsIngest.service');

describe('checkWpsPlausibility (gap analysis 26/07/2026 — warning-only)', () => {
    it('nessun warning per campi plausibili e coerenti', () => {
        const warnings = checkWpsPlausibility({
            thickness_min_mm: 3, thickness_max_mm: 12,
            filler_material: 'G 42 4 M21 3Si1',
            shielding_gas: 'M21',
        });
        expect(warnings).toEqual([]);
    });

    it('segnala range spessore invertito', () => {
        const warnings = checkWpsPlausibility({ thickness_min_mm: 20, thickness_max_mm: 5 });
        expect(warnings.some((w) => w.includes('invertito'))).toBe(true);
    });

    it('segnala designazione filler non riconosciuta come ISO 14341', () => {
        const warnings = checkWpsPlausibility({ filler_material: '###???' });
        expect(warnings.some((w) => w.includes('ISO 14341'))).toBe(true);
    });

    it('segnala gas di protezione fuori catalogo ISO 14175', () => {
        const warnings = checkWpsPlausibility({ shielding_gas: 'GAS-INESISTENTE' });
        expect(warnings.some((w) => w.includes('ISO 14175'))).toBe(true);
    });
});

describe('extractWPSFromPdf — warning di plausibilità propagati', () => {
    afterEach(() => jest.clearAllMocks());

    it('include il warning di range spessore incoerente nell\'esito pending_review', async () => {
        runDocumentIngest.mockResolvedValue({
            text: 'WPS 12/25 processo 135',
            fields: {
                wps_number: 'WPS-12-25',
                welding_process: '135',
                thickness_min_mm: 20,
                thickness_max_mm: 5,
            },
            fieldConfidence: {},
            extractionConfidence: 70,
            aiModel: 'gemini-1.5-flash',
            warnings: [],
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await extractWPSFromPdf(Buffer.from('%PDF'), 'WPS-12-25.pdf', 1001, 2001);

        expect(out.status).toBe('pending_review');
        expect(out.warnings.some((w) => w.includes('invertito'))).toBe(true);
    });
});

/**
 * Test L1 — commitWPSFromFields, sanitizzazione numerica (stesso pattern del
 * bug produzione 27/07/2026 su qualificationIngest.service.js): thickness_range_min/max
 * su `welding_procedures` è DECIMAL(8,2) — "N.A."/stringa vuota non deve rompere l'INSERT.
 */
describe('commitWPSFromFields — sanitizzazione numerica', () => {
    afterEach(() => jest.clearAllMocks());

    it('salva null invece di crashare quando thickness_min/max sono "N.A." o vuoti', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // checkDuplicate
        query.mockResolvedValueOnce({ recordset: [{ id: 77 }] }); // INSERT

        const result = await commitWPSFromFields({
            wps_number: 'WPS-99',
            welding_process: '111',
            thickness_min_mm: 'N.A.',
            thickness_max_mm: '',
        }, 1001, 2001, { fileName: 'wps99.pdf' });

        expect(result.wps_id).toBe(77);
        const insertCall = query.mock.calls[1];
        expect(insertCall[1].thickness_range_min).toBeNull();
        expect(insertCall[1].thickness_range_max).toBeNull();
    });
});

/**
 * «WPQR di supporto n.» (pagina WPS EN ISO 15609-1): riconoscimento, nessuna confusione WPS/WPQR, riferimento salvato
 * e legame creato solo con match sicuro nello stesso tenant. Testi e numeri sintetici.
 */
describe('WPS con «WPQR di supporto n.»', () => {
    afterEach(() => { jest.clearAllMocks(); query.mockReset(); });

    const WPS_TEXT = `EN ISO 15609 - 1 MANUFACTURER'S WELDING PROCEDURE SPECIFICATION
WPS-n./WPS n. ZZ 01/99
Supporting WPQR n./ WPQR di supporto n.
10/08/2023 XX0001/99
Procedura qualificata secondo EN ISO 15614-1 Preheat Tp 20 Interpass Ti 250 heat input`;

    function routeQuery({ wpqrRows = [], linksTable = true, duplicate = false } = {}) {
        const log = [];
        query.mockImplementation(async (sql, params = {}) => {
            const text = sql.replace(/\s+/g, ' ').trim();
            log.push({ text, params });
            if (/^SELECT OBJECT_ID/.test(text)) return { recordset: [{ object_id: linksTable ? 1 : null }] };
            if (/FROM wpqr_records/.test(text)) {
                return { recordset: wpqrRows.filter((r) => r.organization_id === params.organization_id) };
            }
            if (/SELECT id FROM welding_procedures/.test(text)) return { recordset: duplicate ? [{ id: 1 }] : [] };
            if (/^INSERT INTO welding_procedures/.test(text)) return { recordset: [{ id: 55 }] };
            if (/^INSERT INTO wps_wpqr_links/.test(text)) return { recordset: [{ id: 1 }] };
            if (/^UPDATE welding_procedures/.test(text)) return { recordset: [] };
            return { recordset: [] };
        });
        return log;
    }

    function mockPipeline(fields) {
        runDocumentIngest.mockResolvedValue({
            text: WPS_TEXT, fields, fieldConfidence: {}, extractionConfidence: 70, aiModel: 'test', warnings: [],
        });
    }

    it('non è scambiata per WPQR: niente wrong_module, riferimento in revisione, match sicuro segnalato', async () => {
        routeQuery({ wpqrRows: [{ id: 10, organization_id: 1001, company_id: 2001, wpqr_code: 'XX0001/99' }] });
        mockPipeline({ wps_number: 'ZZ 01/99', welding_process: '138', wpqr_ref: 'XX0001/99' });
        const out = await extractWPSFromPdf(Buffer.from('%PDF'), 'x.pdf', 1001, 2001);
        expect(out.status).toBe('pending_review');
        expect(out.fields.wpqr_ref).toBe('XX0001/99');
        expect(out.supporting_wpqr_matches).toEqual([{ ref: 'XX0001/99', wpqr_id: 10 }]);
        expect(out.verification_flags).toEqual([]);
    });

    it('WPQR di supporto assente dall\'archivio: nessun match e segnalazione «da verificare» in revisione', async () => {
        routeQuery({ wpqrRows: [] });
        mockPipeline({ wps_number: 'ZZ 01/99', wpqr_ref: 'XX0001/99' });
        const out = await extractWPSFromPdf(Buffer.from('%PDF'), 'x.pdf', 1001, 2001);
        expect(out.supporting_wpqr_matches).toEqual([]);
        expect(out.verification_flags[0]).toMatchObject({ ref: 'XX0001/99', status: 'not_found' });
        expect(out.warnings.some((w) => w.includes('da verificare'))).toBe(true);
    });

    it('cross-tenant: la stessa WPQR in un altro tenant non produce match', async () => {
        routeQuery({ wpqrRows: [{ id: 90, organization_id: 2002, company_id: 2001, wpqr_code: 'XX0001/99' }] });
        mockPipeline({ wps_number: 'ZZ 01/99', wpqr_ref: 'XX0001/99' });
        const out = await extractWPSFromPdf(Buffer.from('%PDF'), 'x.pdf', 1001, 2001);
        expect(out.supporting_wpqr_matches).toEqual([]);
        expect(out.verification_flags[0].status).toBe('not_found');
    });

    it('commit con match sicuro: legame supporting scritto, il numero WPQR NON finisce in qualification_standard', async () => {
        const log = routeQuery({ wpqrRows: [{ id: 10, organization_id: 1001, company_id: 2001, wpqr_code: 'XX0001/99' }] });
        const res = await commitWPSFromFields({ wps_number: 'ZZ 01/99', wpqr_ref: 'XX0001/99' }, 1001, 2001, { userId: 9 });
        expect(res.wps_id).toBe(55);
        const ins = log.find((s) => /^INSERT INTO welding_procedures/.test(s.text));
        expect(ins.params.qualification_standard).toBeNull();
        expect(ins.params.notes).toBeNull();
        const link = log.find((s) => /^INSERT INTO wps_wpqr_links/.test(s.text));
        expect(link.params).toMatchObject({ organization_id: 1001, wps_id: 55, wpqr_id: 10, role: 'supporting', created_by: 9 });
        expect(res.linked_wpqr).toEqual([{ ref: 'XX0001/99', wpqr_id: 10 }]);
        expect(res.verification_flags).toEqual([]);
    });

    it('commit con riferimento non risolto: nessun legame, riferimento conservato nelle note e segnalato', async () => {
        const log = routeQuery({ wpqrRows: [] });
        const res = await commitWPSFromFields({ wps_number: 'ZZ 01/99', wpqr_ref: 'XX0001/99' }, 1001, 2001, {});
        const ins = log.find((s) => /^INSERT INTO welding_procedures/.test(s.text));
        expect(ins.params.notes).toBe('WPQR di supporto da verificare: XX0001/99');
        expect(log.some((s) => /^INSERT INTO wps_wpqr_links/.test(s.text))).toBe(false);
        expect(res.linked_wpqr).toEqual([]);
        expect(res.warnings.some((w) => w.includes('da verificare'))).toBe(true);
    });

    it('commit con due WPQR omonime nel tenant (ambiguo): nessun legame', async () => {
        const rows = [
            { id: 10, organization_id: 1001, company_id: 2001, wpqr_code: 'XX0001/99' },
            { id: 11, organization_id: 1001, company_id: 2001, wpqr_code: 'xx0001-99' },
        ];
        const log = routeQuery({ wpqrRows: rows });
        const res = await commitWPSFromFields({ wps_number: 'ZZ 01/99', wpqr_ref: 'XX0001/99' }, 1001, 2001, {});
        expect(log.some((s) => /^INSERT INTO wps_wpqr_links/.test(s.text))).toBe(false);
        expect(res.verification_flags[0].status).toBe('ambiguous');
    });

    it('migrazione 174 non applicata: la WPS viene comunque creata, con avviso', async () => {
        const log = routeQuery({
            wpqrRows: [{ id: 10, organization_id: 1001, company_id: 2001, wpqr_code: 'XX0001/99' }],
            linksTable: false,
        });
        const res = await commitWPSFromFields({ wps_number: 'ZZ 01/99', wpqr_ref: 'XX0001/99' }, 1001, 2001, {});
        expect(res.wps_id).toBe(55);
        expect(log.some((s) => /^INSERT INTO wps_wpqr_links/.test(s.text))).toBe(false);
        expect(res.verification_flags.some((f) => f.status === 'links_unavailable')).toBe(true);
    });

    it('senza riferimento: nessuna query di ricerca WPQR (comportamento invariato)', async () => {
        const log = routeQuery();
        const res = await commitWPSFromFields({ wps_number: 'ZZ 02/99' }, 1001, 2001, {});
        expect(res.wps_id).toBe(55);
        expect(log.some((s) => /FROM wpqr_records/.test(s.text))).toBe(false);
        expect(res.verification_flags).toEqual([]);
    });

    it('commit: data nel campo wpqr_ref (layout IIS) non è un numero da verificare', async () => {
        const log = routeQuery({ wpqrRows: [] });
        const res = await commitWPSFromFields(
            { wps_number: 'ZZ 01/99', wpqr_ref: '10/08/2023 XX0001/99, YY0202/98' },
            1001, 2001, {}
        );
        const ins = log.find((s) => /^INSERT INTO welding_procedures/.test(s.text));
        expect(ins.params.notes).toBe('WPQR di supporto da verificare: XX0001/99, YY0202/98');
        expect(ins.params.notes).not.toMatch(/10\/08/);
        expect(res.verification_flags.map((f) => f.ref).sort()).toEqual(['XX0001/99', 'YY0202/98']);
    });

    it('commit: errore di ricerca conserva i numeri in notes (non si perdono)', async () => {
        const log = [];
        query.mockImplementation(async (sql, params = {}) => {
            const text = sql.replace(/\s+/g, ' ').trim();
            log.push({ text, params });
            if (/FROM wpqr_records/.test(text)) throw new Error('timeout lookup');
            if (/SELECT id FROM welding_procedures/.test(text)) return { recordset: [] };
            if (/^INSERT INTO welding_procedures/.test(text)) return { recordset: [{ id: 55 }] };
            if (/^SELECT OBJECT_ID/.test(text)) return { recordset: [{ object_id: 1 }] };
            return { recordset: [] };
        });
        const res = await commitWPSFromFields({ wps_number: 'ZZ 01/99', wpqr_ref: 'XX0001/99, YY0202/98' }, 1001, 2001, {});
        const ins = log.find((s) => /^INSERT INTO welding_procedures/.test(s.text));
        expect(ins.params.notes).toBe('WPQR di supporto da verificare: XX0001/99, YY0202/98');
        expect(res.linked_wpqr).toEqual([]);
        expect(res.verification_flags.map((f) => [f.ref, f.status])).toEqual([
            ['XX0001/99', 'resolve_error'],
            ['YY0202/98', 'resolve_error'],
        ]);
    });
});
