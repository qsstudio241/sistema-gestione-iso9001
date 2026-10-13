/**
 * @jest-environment node
 *
 * L1 — legami WPS↔WPQR dell'ingest (D9): match solo se univoco nello stesso tenant/company, mai cross-tenant,
 * nessuna scelta a caso su ambiguo/assente, INSERT idempotente e legato ai genitori del tenant, tabella 174 assente tollerata.
 * DB simulato in memoria: il filtro tenant vale solo se lo statement lo dichiara (uno statement senza scope farebbe
 * emergere i record dell'altro tenant e il test fallirebbe).
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const svc = require('./wpsWpqrLinks.service');

const ORG_A = 1001;
const ORG_B = 2002;

function makeDb({ wpqr = [], wps = [], links = [], linksTable = true } = {}) {
    const db = { wpqr, wps, links, statements: [] };
    query.mockImplementation(async (sql, params = {}) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        db.statements.push({ text, params });
        if (/^SELECT OBJECT_ID\(N'dbo\.wps_wpqr_links'/.test(text)) {
            return { recordset: [{ object_id: linksTable ? 1 : null }] };
        }
        const tenantOk = (row) => {
            if (!/organization_id = @organization_id/.test(text)) return true;
            if (row.organization_id !== params.organization_id) return false;
            if (/company_id IS NULL/.test(text)) return row.company_id == null;
            if (/company_id = @company_id/.test(text)) return row.company_id === params.company_id;
            return true;
        };
        if (/FROM wpqr_records WHERE/.test(text) && /^SELECT/.test(text)) {
            return { recordset: db.wpqr.filter(tenantOk) };
        }
        if (/FROM welding_procedures WHERE/.test(text) && /^SELECT/.test(text)) {
            return { recordset: db.wps.filter(tenantOk) };
        }
        if (/^INSERT INTO wps_wpqr_links/.test(text)) {
            const w = db.wps.find((x) => x.id === params.wps_id && x.organization_id === params.organization_id);
            const q = db.wpqr.find((x) => x.id === params.wpqr_id && x.organization_id === params.organization_id);
            const sameCompany = w && q && (w.company_id ?? null) === (q.company_id ?? null);
            const companyOk = params.company_id === undefined ? (w && w.company_id == null) : (w && w.company_id === params.company_id);
            const dup = db.links.some((l) => l.wps_id === params.wps_id && l.wpqr_id === params.wpqr_id);
            if (!w || !q || !sameCompany || !companyOk || dup) return { recordset: [] };
            const row = {
                id: db.links.length + 1, organization_id: params.organization_id, wps_id: w.id, wpqr_id: q.id, role: params.role,
            };
            db.links.push(row);
            return { recordset: [{ id: row.id }] };
        }
        return { recordset: [] };
    });
    return db;
}

const WPQR_A = { id: 10, organization_id: ORG_A, company_id: 5, wpqr_code: 'XX0001/99', reference_number: 'XX0001/99', certificate_number: null };
const WPQR_B_SAME_NUMBER = { id: 90, organization_id: ORG_B, company_id: 5, wpqr_code: 'XX0001/99', reference_number: 'XX0001/99', certificate_number: null };

describe('findWpqrByRef', () => {
    afterEach(() => jest.clearAllMocks());

    it('match univoco nello stesso tenant e company (numero normalizzato: spazi, maiuscole, «-» vs «/»)', async () => {
        makeDb({ wpqr: [WPQR_A] });
        const r = await svc.findWpqrByRef({ organizationId: ORG_A, companyId: 5, ref: 'xx0001-99' });
        expect(r).toEqual({ status: 'matched', wpqr_id: 10 });
    });

    it('cross-tenant: lo stesso numero in un altro tenant non è mai un match', async () => {
        makeDb({ wpqr: [WPQR_B_SAME_NUMBER] });
        const r = await svc.findWpqrByRef({ organizationId: ORG_A, companyId: 5, ref: 'XX0001/99' });
        expect(r.status).toBe('not_found');
    });

    it('stesso tenant ma company diversa: nessun match', async () => {
        makeDb({ wpqr: [{ ...WPQR_A, company_id: 7 }] });
        expect((await svc.findWpqrByRef({ organizationId: ORG_A, companyId: 5, ref: 'XX0001/99' })).status).toBe('not_found');
    });

    it('company assente su entrambi i lati: ammesso; company assente solo su un lato: no', async () => {
        makeDb({ wpqr: [{ ...WPQR_A, company_id: null }] });
        expect((await svc.findWpqrByRef({ organizationId: ORG_A, companyId: null, ref: 'XX0001/99' })).status).toBe('matched');
        expect((await svc.findWpqrByRef({ organizationId: ORG_A, companyId: 5, ref: 'XX0001/99' })).status).toBe('not_found');
    });

    it('ambiguo: due WPQR con lo stesso numero normalizzato → ambiguous, nessun id scelto', async () => {
        makeDb({ wpqr: [WPQR_A, { ...WPQR_A, id: 11, wpqr_code: 'xx0001-99' }] });
        const r = await svc.findWpqrByRef({ organizationId: ORG_A, companyId: 5, ref: 'XX0001/99' });
        expect(r).toEqual({ status: 'ambiguous', count: 2 });
    });

    it('numero presente su più colonne dello stesso record non è ambiguo', async () => {
        makeDb({ wpqr: [{ ...WPQR_A, certificate_number: 'XX0001/99' }] });
        expect((await svc.findWpqrByRef({ organizationId: ORG_A, companyId: 5, ref: 'XX0001/99' })).status).toBe('matched');
    });

    it('numero simile ma diverso: nessun match (confronto esatto sul normalizzato)', async () => {
        makeDb({ wpqr: [WPQR_A] });
        expect((await svc.findWpqrByRef({ organizationId: ORG_A, companyId: 5, ref: 'XX0001/98' })).status).toBe('not_found');
        expect((await svc.findWpqrByRef({ organizationId: ORG_A, companyId: 5, ref: 'AA0001/99' })).status).toBe('not_found');
    });

    it('ogni SELECT ripete organization_id e usa parametri (nessun valore concatenato)', async () => {
        const db = makeDb({ wpqr: [WPQR_A] });
        await svc.findWpqrByRef({ organizationId: ORG_A, companyId: 5, ref: "XX0001/99'; DROP TABLE x;--" });
        const sel = db.statements.find((s) => /FROM wpqr_records/.test(s.text));
        expect(sel.text).toContain('organization_id = @organization_id');
        expect(sel.text).not.toMatch(/DROP|XX0001/);
    });

    it('organizzazione non valida → errore, nessuna query', async () => {
        makeDb();
        await expect(svc.findWpqrByRef({ organizationId: 'x', companyId: 5, ref: 'XX0001/99' })).rejects.toMatchObject({ code: 'INVALID_TENANT' });
        expect(query).not.toHaveBeenCalled();
    });
});

describe('findWpsByRef / resolveWpsRef', () => {
    afterEach(() => jest.clearAllMocks());
    const WPS = { id: 3, organization_id: ORG_A, company_id: 5, wps_code: 'ZZ 01/99' };

    it('ignora il suffisso rev. e le maiuscole', async () => {
        makeDb({ wps: [WPS] });
        expect(await svc.findWpsByRef({ organizationId: ORG_A, companyId: 5, ref: 'zz 01/99 rev. 0' })).toEqual({ status: 'matched', wps_id: 3 });
    });

    it('cross-tenant e ambiguo → nessun match', async () => {
        makeDb({ wps: [{ ...WPS, organization_id: ORG_B }] });
        expect((await svc.findWpsByRef({ organizationId: ORG_A, companyId: 5, ref: 'ZZ 01/99' })).status).toBe('not_found');
        makeDb({ wps: [WPS, { ...WPS, id: 4, wps_code: 'ZZ 01/99 ' }] });
        expect((await svc.findWpsByRef({ organizationId: ORG_A, companyId: 5, ref: 'ZZ 01/99' })).status).toBe('ambiguous');
    });

    it('resolveWpsRef: riferimento assente → nessuna segnalazione; non trovato → segnalazione da verificare', async () => {
        makeDb({ wps: [] });
        expect(await svc.resolveWpsRef({ organizationId: ORG_A, companyId: 5, ref: '  ' })).toEqual({ match: null, flags: [] });
        const r = await svc.resolveWpsRef({ organizationId: ORG_A, companyId: 5, ref: 'ZZ 01/99' });
        expect(r.match).toBeNull();
        expect(r.flags[0]).toMatchObject({ status: 'not_found', ref: 'ZZ 01/99' });
        expect(r.flags[0].message).toContain('da verificare');
    });
});

describe('resolveSupportingWpqrRefs', () => {
    afterEach(() => jest.clearAllMocks());

    it('match sicuro + assente + ambiguo nello stesso elenco: solo il match sicuro, il resto è segnalato', async () => {
        makeDb({
            wpqr: [
                WPQR_A,
                { ...WPQR_A, id: 20, wpqr_code: 'YY0202/98', reference_number: 'YY0202/98' },
                { ...WPQR_A, id: 21, wpqr_code: 'YY0202/98', reference_number: 'YY0202/98' },
            ],
        });
        const r = await svc.resolveSupportingWpqrRefs({
            organizationId: ORG_A, companyId: 5, refs: ['XX0001/99', 'YY0202/98', 'ZZ0303/97'],
        });
        expect(r.matches).toEqual([{ ref: 'XX0001/99', wpqr_id: 10 }]);
        expect(r.flags.map((f) => [f.ref, f.status])).toEqual([['YY0202/98', 'ambiguous'], ['ZZ0303/97', 'not_found']]);
    });

    it('lo stesso record raggiunto da due numeri produce un solo match', async () => {
        makeDb({ wpqr: [{ ...WPQR_A, certificate_number: 'CC0009/99' }] });
        const r = await svc.resolveSupportingWpqrRefs({ organizationId: ORG_A, companyId: 5, refs: ['XX0001/99', 'CC0009/99'] });
        expect(r.matches).toHaveLength(1);
    });

    it('nessun riferimento → risultato vuoto senza query', async () => {
        makeDb();
        expect(await svc.resolveSupportingWpqrRefs({ organizationId: ORG_A, companyId: 5, refs: [] })).toEqual({ matches: [], flags: [] });
        expect(query).not.toHaveBeenCalled();
    });
});

describe('insertLink / linkWpsToSupportingWpqr / linkWpqrToWps', () => {
    afterEach(() => jest.clearAllMocks());
    const WPS = { id: 3, organization_id: ORG_A, company_id: 5, wps_code: 'ZZ 01/99' };

    it('crea il legame supporting con organization_id del tenant; seconda chiamata idempotente', async () => {
        const db = makeDb({ wpqr: [WPQR_A], wps: [WPS] });
        const args = { organizationId: ORG_A, companyId: 5, wpsId: 3, matches: [{ ref: 'XX0001/99', wpqr_id: 10 }], userId: 7 };
        const first = await svc.linkWpsToSupportingWpqr(args);
        expect(first.linked).toHaveLength(1);
        expect(db.links).toEqual([{ id: 1, organization_id: ORG_A, wps_id: 3, wpqr_id: 10, role: 'supporting' }]);
        const second = await svc.linkWpsToSupportingWpqr(args);
        expect(second.linked).toHaveLength(0);
        expect(db.links).toHaveLength(1);
    });

    it('cross-tenant: una WPQR di un altro tenant non viene mai legata, nemmeno con id noto', async () => {
        const db = makeDb({ wpqr: [WPQR_B_SAME_NUMBER], wps: [WPS] });
        const r = await svc.insertLink({ organizationId: ORG_A, companyId: 5, wpsId: 3, wpqrId: 90, role: 'supporting' });
        expect(r.created).toBe(false);
        expect(db.links).toEqual([]);
    });

    it('WPS di un altro tenant: nessun legame', async () => {
        const db = makeDb({ wpqr: [WPQR_A], wps: [{ ...WPS, organization_id: ORG_B }] });
        expect((await svc.insertLink({ organizationId: ORG_A, companyId: 5, wpsId: 3, wpqrId: 10, role: 'supporting' })).created).toBe(false);
        expect(db.links).toEqual([]);
    });

    it('company diverse tra WPS e WPQR: nessun legame', async () => {
        const db = makeDb({ wpqr: [{ ...WPQR_A, company_id: 8 }], wps: [WPS] });
        expect((await svc.insertLink({ organizationId: ORG_A, companyId: 5, wpsId: 3, wpqrId: 10, role: 'supporting' })).created).toBe(false);
        expect(db.links).toEqual([]);
    });

    it("l'INSERT parte dai genitori filtrati per tenant (nessun id fidato)", async () => {
        const db = makeDb({ wpqr: [WPQR_A], wps: [WPS] });
        await svc.insertLink({ organizationId: ORG_A, companyId: 5, wpsId: 3, wpqrId: 10, role: 'primary' });
        const ins = db.statements.find((s) => /^INSERT INTO wps_wpqr_links/.test(s.text));
        expect(ins.text).toMatch(/q\.organization_id = @organization_id/);
        expect(ins.text).toMatch(/w\.organization_id = @organization_id/);
        expect(ins.text).toMatch(/NOT EXISTS/);
        expect(ins.text).not.toMatch(/ON DELETE/i);
    });

    it('migrazione 174 non applicata: nessuna scrittura, segnalazione esplicita e nessun errore', async () => {
        const db = makeDb({ wpqr: [WPQR_A], wps: [WPS], linksTable: false });
        const r = await svc.linkWpsToSupportingWpqr({
            organizationId: ORG_A, companyId: 5, wpsId: 3, matches: [{ ref: 'XX0001/99', wpqr_id: 10 }],
        });
        expect(r.linked).toEqual([]);
        expect(r.flags[0].status).toBe('links_unavailable');
        expect(db.statements.some((s) => /^INSERT/.test(s.text))).toBe(false);
    });

    it('linkWpqrToWps: legame primary solo con match; senza match nessuna query', async () => {
        const db = makeDb({ wpqr: [WPQR_A], wps: [WPS] });
        expect(await svc.linkWpqrToWps({ organizationId: ORG_A, companyId: 5, wpqrId: 10, match: null })).toEqual({ linked: [], flags: [] });
        expect(query).not.toHaveBeenCalled();
        const r = await svc.linkWpqrToWps({ organizationId: ORG_A, companyId: 5, wpqrId: 10, match: { ref: 'ZZ 01/99', wps_id: 3 } });
        expect(r.linked).toHaveLength(1);
        expect(db.links[0].role).toBe('primary');
    });

    it('id non validi → nessuna query', async () => {
        makeDb();
        expect((await svc.insertLink({ organizationId: ORG_A, companyId: 5, wpsId: 'x', wpqrId: 10, role: 'primary' })).created).toBe(false);
        expect(query).not.toHaveBeenCalled();
    });
});
