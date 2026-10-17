/**
 * @jest-environment node
 *
 * L1 — handler WPQR passate di prova (GET/PUT /welding/wpqr/:id/test-runs), testata condizioni di prova
 * in updateWPQR e ordine delle cancellazioni (passate/link prima di WPQR/WPS). Il servizio è quello reale;
 * il database è simulato e il tenant è applicato solo se lo statement lo dichiara.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

const { query, getPool } = require('../config/database');
const ctrl = require('./welding.controller');

const ORG_A = 1001;
const ORG_B = 2002;

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) { this.statusCode = code; return this; });
    res.json = jest.fn(function json(payload) { this.body = payload; return this; });
    return res;
}

function setupDb({ tables = ['wpqr_test_runs', 'wps_wpqr_links'], headerColumns = true } = {}) {
    const log = [];
    const state = {
        wpqr: [
            { id: 10, organization_id: ORG_A, company_id: 5, wps_id: 7 },
            { id: 20, organization_id: ORG_B, company_id: 9, wps_id: 8 },
        ],
        runs: [{ id: 2, organization_id: ORG_B, company_id: 9, wpqr_id: 20, run_label: 'ALTRUI' }],
    };
    const exec = async (sql, params = {}) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        log.push({ text, params });
        const m = /^SELECT OBJECT_ID\(N'dbo\.(\w+)'/.exec(text);
        if (m) return { recordset: [{ object_id: tables.includes(m[1]) ? 1 : null }] };
        if (/^SELECT COL_LENGTH/.test(text)) return { recordset: [{ len: headerColumns ? 500 : null }] };
        if (/wps_company_id/.test(text) && /FROM wpqr_records/.test(text) && /@wpqr_id/.test(text)) {
            return { recordset: state.wpqr.filter((w) => w.id === params.wpqr_id && w.organization_id === params.organization_id) };
        }
        if (/wps_company_id/.test(text) && /FROM wpqr_records/.test(text) && /@id/.test(text)) {
            return { recordset: state.wpqr.filter((w) => w.id === params.id && w.organization_id === params.organization_id) };
        }
        if (/^SELECT id FROM wpqr_records WHERE wps_id = @id AND organization_id/.test(text)) {
            return { recordset: state.wpqr.filter((w) => w.wps_id === params.id && w.organization_id === params.organization_id).map((w) => ({ id: w.id })) };
        }
        if (/^SELECT id, company_id FROM welding_procedures WHERE id = @id AND organization_id/.test(text)) {
            return { recordset: params.organization_id === ORG_A && params.id === 7 ? [{ id: 7, company_id: 5 }] : [] };
        }
        if (/^SELECT .* FROM wpqr_test_runs/.test(text)) {
            return { recordset: state.runs.filter((r) => r.wpqr_id === params.wpqr_id && r.organization_id === params.organization_id) };
        }
        return { recordset: [] };
    };
    query.mockImplementation((sql, params) => exec(sql, params));
    const tx = {
        begin: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        request() {
            const params = {};
            return { input(k, v) { params[k] = v; }, query: (sql) => exec(sql, params) };
        },
    };
    getPool.mockResolvedValue({ transaction: () => tx });
    return { log, state, tx };
}

const req = (over = {}) => ({ user: { organization_id: ORG_A, user_id: 5 }, params: {}, body: {}, ...over });

describe('GET /welding/wpqr/:id/test-runs', () => {
    afterEach(() => jest.clearAllMocks());

    it('ID non numerico → 400', async () => {
        setupDb();
        const res = createRes();
        await ctrl.listWpqrTestRuns(req({ params: { id: '10; DROP' } }), res);
        expect(res.statusCode).toBe(400);
    });

    it('cross-tenant: la WPQR dell\'altro tenant risponde 404 senza leggere le passate', async () => {
        const { log } = setupDb();
        const res = createRes();
        await ctrl.listWpqrTestRuns(req({ params: { id: '20' } }), res);
        expect(res.statusCode).toBe(404);
        expect(res.body.code).toBe('WPQR_NOT_FOUND');
        expect(log.some((s) => /FROM wpqr_test_runs/.test(s.text))).toBe(false);
    });

    it('migrazione 173 non applicata → 200 con available:false', async () => {
        setupDb({ tables: [] });
        const res = createRes();
        await ctrl.listWpqrTestRuns(req({ params: { id: '10' } }), res);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true, runs: [], available: false });
    });
});

describe('PUT /welding/wpqr/:id/test-runs', () => {
    afterEach(() => jest.clearAllMocks());

    it('salva e ignora organization_id/wpqr_id del client', async () => {
        const { log } = setupDb();
        const res = createRes();
        await ctrl.saveWpqrTestRuns(req({
            params: { id: '10' },
            body: { runs: [{ run_label: '1', current_a: '120', organization_id: ORG_B, wpqr_id: 20 }] },
        }), res);
        expect(res.statusCode).toBe(200);
        const insert = log.find((s) => /^INSERT INTO wpqr_test_runs/.test(s.text));
        expect(insert.params.organization_id).toBe(ORG_A);
        expect(insert.params.wpqr_id).toBe(10);
        expect(insert.params.current_a).toBe(120);
    });

    it('cross-tenant negativo: 404 e nessuna scrittura', async () => {
        const { log, tx } = setupDb();
        const res = createRes();
        await ctrl.saveWpqrTestRuns(req({ params: { id: '20' }, body: { runs: [{ run_label: '1' }] } }), res);
        expect(res.statusCode).toBe(404);
        expect(tx.begin).not.toHaveBeenCalled();
        expect(log.some((s) => /^(INSERT|DELETE)/.test(s.text))).toBe(false);
    });

    it('dato non valido → 400 con details per riga', async () => {
        setupDb();
        const res = createRes();
        await ctrl.saveWpqrTestRuns(req({ params: { id: '10' }, body: { runs: [{ run_label: '1', current_a: 'abc' }] } }), res);
        expect(res.statusCode).toBe(400);
        expect(res.body.details).toEqual([{ row: 1, field: 'current_a', message: 'Inserire un numero.' }]);
    });

    it('migrazione non applicata → 503 esplicito', async () => {
        setupDb({ tables: [] });
        const res = createRes();
        await ctrl.saveWpqrTestRuns(req({ params: { id: '10' }, body: { runs: [] } }), res);
        expect(res.statusCode).toBe(503);
        expect(res.body.code).toBe('WPQR_TEST_RUNS_UNAVAILABLE');
    });

    it('body senza runs → 400', async () => {
        setupDb();
        const res = createRes();
        await ctrl.saveWpqrTestRuns(req({ params: { id: '10' }, body: {} }), res);
        expect(res.statusCode).toBe(400);
    });
});

describe('updateWPQR — condizioni di prova di testata', () => {
    afterEach(() => jest.clearAllMocks());

    it('scrive le colonne di testata con UPDATE scoped per organization_id', async () => {
        const { log } = setupDb();
        const res = createRes();
        await ctrl.updateWPQR(req({ params: { id: '10' }, body: { nozzle_diameter_mm: '12,5', bead_technique: 'weave' } }), res);
        expect(res.statusCode).toBe(200);
        const upd = log.find((s) => /^UPDATE wpqr_records/.test(s.text));
        expect(upd.text).toMatch(/WHERE id = @id AND organization_id = @organization_id/);
        expect(upd.params.organization_id).toBe(ORG_A);
        expect(upd.params.nozzle_diameter_mm).toBe(12.5);
        expect(upd.params.bead_technique).toBe('weave');
    });

    it('valore non valido → 400 e nessun UPDATE', async () => {
        const { log } = setupDb();
        const res = createRes();
        await ctrl.updateWPQR(req({ params: { id: '10' }, body: { bead_technique: 'zigzag' } }), res);
        expect(res.statusCode).toBe(400);
        expect(log.some((s) => /^UPDATE/.test(s.text))).toBe(false);
    });

    it('colonne 173 assenti → 503, nessun UPDATE', async () => {
        const { log } = setupDb({ headerColumns: false });
        const res = createRes();
        await ctrl.updateWPQR(req({ params: { id: '10' }, body: { nozzle_diameter_mm: 5 } }), res);
        expect(res.statusCode).toBe(503);
        expect(res.body.code).toBe('WPQR_TEST_DATA_UNAVAILABLE');
        expect(log.some((s) => /^UPDATE/.test(s.text))).toBe(false);
    });

    it('cross-tenant: la WPQR dell\'altro tenant risponde 404 senza UPDATE', async () => {
        const { log } = setupDb();
        const res = createRes();
        await ctrl.updateWPQR(req({ params: { id: '20' }, body: { nozzle_diameter_mm: 5 } }), res);
        expect(res.statusCode).toBe(404);
        expect(log.some((s) => /^UPDATE/.test(s.text))).toBe(false);
    });
});

describe('cancellazioni — passate e link prima delle WPQR/WPS', () => {
    afterEach(() => jest.clearAllMocks());

    it('deleteWPQR: DELETE passate e link prima di DELETE wpqr_records', async () => {
        const { log } = setupDb();
        const res = createRes();
        await ctrl.deleteWPQR(req({ params: { id: '10' } }), res);
        expect(res.statusCode).toBe(200);
        const idx = (re) => log.findIndex((s) => re.test(s.text));
        const runs = idx(/UPDATE wpqr_test_runs SET deleted_at/);
        const links = idx(/UPDATE wps_wpqr_links SET deleted_at/);
        const wpqr = idx(/UPDATE wpqr_records SET deleted_at/);
        expect(runs).toBeGreaterThan(-1);
        expect(links).toBeGreaterThan(-1);
        expect(wpqr).toBeGreaterThan(Math.max(runs, links));
        expect(log[runs].text).toContain('organization_id = @organization_id');
        expect(log[links].text).toContain('organization_id = @organization_id');
    });

    it('deleteWPQR: tabelle assenti → nessuna DELETE sulle nuove tabelle, WPQR cancellata', async () => {
        const { log } = setupDb({ tables: [] });
        const res = createRes();
        await ctrl.deleteWPQR(req({ params: { id: '10' } }), res);
        expect(res.statusCode).toBe(200);
        expect(log.some((s) => /wpqr_test_runs|wps_wpqr_links/.test(s.text) && /SET deleted_at/.test(s.text))).toBe(false);
        expect(log.some((s) => /UPDATE wpqr_records SET deleted_at/.test(s.text))).toBe(true);
    });

    it('deleteWPQR cross-tenant: 404 e nessuna DELETE', async () => {
        const { log } = setupDb();
        const res = createRes();
        await ctrl.deleteWPQR(req({ params: { id: '20' } }), res);
        expect(res.statusCode).toBe(404);
        expect(log.some((s) => /SET deleted_at/.test(s.text))).toBe(false);
    });

    it('deleteWPS: link e passate delle WPQR figlie cancellati prima di WPQR e WPS', async () => {
        const { log } = setupDb();
        const res = createRes();
        await ctrl.deleteWPS(req({ params: { id: '7' } }), res);
        expect(res.statusCode).toBe(200);
        const idx = (re) => log.findIndex((s) => re.test(s.text));
        const runs = idx(/UPDATE wpqr_test_runs SET deleted_at/);
        const links = log.findIndex((s) => /UPDATE wps_wpqr_links SET deleted_at/.test(s.text));
        const wpqr = idx(/UPDATE wpqr_records SET deleted_at/);
        const wps = idx(/UPDATE welding_procedures SET deleted_at/);
        expect(runs).toBeGreaterThan(-1);
        expect(links).toBeGreaterThan(-1);
        expect(wpqr).toBeGreaterThan(runs);
        expect(wps).toBeGreaterThan(wpqr);
        expect(wps).toBeGreaterThan(links);
    });
});

describe('route', () => {
    it('registra GET e PUT /welding/wpqr/:id/test-runs', () => {
        const fs = require('fs');
        const path = require('path');
        const src = fs.readFileSync(path.join(__dirname, '../routes/welding.routes.js'), 'latin1');
        expect(src).toMatch(/router\.get\s*\('\/welding\/wpqr\/:id\/test-runs',\s*ctrl\.listWpqrTestRuns\)/);
        expect(src).toMatch(/router\.put\s*\('\/welding\/wpqr\/:id\/test-runs',\s*ctrl\.saveWpqrTestRuns\)/);
    });
});
