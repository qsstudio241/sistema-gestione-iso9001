/**
 * @jest-environment node
 *
 * L1 — passate di prova WPQR: validazione, isolamento multi-tenant (incluso cross-tenant negativo),
 * replace-set transazionale, tolleranza a migrazioni non applicate, ordine delle cancellazioni.
 * Nessun database reale: `query` e `getPool` sono simulati da un DB in memoria che applica il filtro tenant
 * SOLO se lo statement lo contiene (uno statement senza scope tenant farebbe emergere il dato altrui).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));

const logger = require('../utils/logger');
const { query, getPool } = require('../config/database');
const svc = require('./wpqrTestRuns.service');

const ORG_A = 1001;
const ORG_B = 2002;

function makeDb({ tables = ['wpqr_test_runs', 'wps_wpqr_links'], failOnInsert = false, failOnNthInsert = null, columns = true } = {}) {
    const db = {
        wpqr: [
            { id: 10, organization_id: ORG_A, company_id: 5 },
            { id: 20, organization_id: ORG_B, company_id: 9 },
        ],
        runs: [
            { id: 1, organization_id: ORG_A, company_id: 5, wpqr_id: 10, run_label: '1', current_a: 120 },
            { id: 2, organization_id: ORG_B, company_id: 9, wpqr_id: 20, run_label: 'ALTRUI', current_a: 99 },
        ],
        nextId: 100,
        statements: [],
    };
    const scoped = (sql) => /organization_id = @organization_id/.test(sql);

    const exec = async (sql, params = {}, tx = null) => {
        const text = sql.replace(/\s+/g, ' ').trim();
        db.statements.push({ text, params, tx: Boolean(tx) });
        let m = /OBJECT_ID\(N'dbo\.(\w+)'/.exec(text);
        if (m && /^SELECT OBJECT_ID/.test(text)) {
            return { recordset: [{ object_id: tables.includes(m[1]) ? 1 : null }] };
        }
        if (/^SELECT COL_LENGTH/.test(text)) return { recordset: [{ len: columns ? 500 : null }] };
        if (/wps_company_id/.test(text) && /FROM wpqr_records/.test(text)) {
            const rows = db.wpqr.filter((w) => w.id === params.wpqr_id && (!scoped(text) || w.organization_id === params.organization_id));
            return { recordset: rows };
        }
        if (/^SELECT .* FROM wpqr_test_runs/.test(text)) {
            const rows = db.runs.filter((r) => r.wpqr_id === params.wpqr_id && !r.deleted_at && (!scoped(text) || r.organization_id === params.organization_id));
            return { recordset: rows };
        }
        if (/^DELETE FROM wpqr_test_runs/.test(text)) {
            db.runs = db.runs.filter((r) => {
                const sameWpqr = params.wpqr_id != null ? r.wpqr_id === params.wpqr_id : true;
                const drop = sameWpqr && !r.deleted_at && (!scoped(text) || r.organization_id === params.organization_id);
                return !drop;
            });
            return { recordset: [] };
        }
        if (/^UPDATE wpqr_test_runs SET deleted_at/.test(text)) {
            db.runs.forEach((r) => {
                const sameWpqr = params.wpqr_id != null
                    ? r.wpqr_id === params.wpqr_id
                    : true;
                if (sameWpqr && !r.deleted_at && (!scoped(text) || r.organization_id === params.organization_id)) {
                    r.deleted_at = 'cestino';
                }
            });
            return { recordset: [] };
        }
        if (/^INSERT INTO wpqr_test_runs/.test(text)) {
            if (failOnInsert) throw new Error('boom');
            const insertN = db.statements.filter((s) => /^INSERT INTO wpqr_test_runs/.test(s.text)).length;
            if (failOnNthInsert != null && insertN === failOnNthInsert) throw new Error('boom');
            db.runs.push({ id: db.nextId++, ...params });
            return { recordset: [] };
        }
        return { recordset: [] };
    };

    query.mockImplementation((sql, params) => exec(sql, params));
    const tx = {
        begin: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
        snapshot: null,
        request() {
            const params = {};
            return {
                input(k, v) { params[k] = v; },
                query: (sql) => exec(sql, params, tx),
            };
        },
    };
    const origBegin = tx.begin;
    tx.begin = jest.fn(async () => { tx.snapshot = JSON.parse(JSON.stringify(db.runs)); return origBegin(); });
    tx.rollback = jest.fn(async () => { db.runs.length = 0; db.runs.push(...tx.snapshot); });
    getPool.mockResolvedValue({ transaction: () => tx });
    return { db, tx };
}

const validRun = (extra = {}) => ({
    run_label: '2 +n', welding_process: '135', filler_diameter_mm: '1,2', current_a: 180, voltage_v: '24.5',
    current_polarity: 'DC-EP', travel_speed: 5.5, travel_speed_unit: 'mm/s',
    heat_input_value: 0.9, heat_input_unit: 'kJ/mm', metal_transfer: 'spray', remarks: 'ok', ...extra,
});

describe('normalizeRun — validazione input', () => {
    it('normalizza virgola/punto, testo, run_no dall\'etichetta e provenienza', () => {
        const { value, errors } = svc.normalizeRun(validRun());
        expect(errors).toEqual([]);
        expect(value.filler_diameter_mm).toBe(1.2);
        expect(value.voltage_v).toBe(24.5);
        expect(value.run_no).toBe(2);
        expect(value.run_label).toBe('2 +n');
        expect(value.current_polarity).toBe('DC-EP');
        expect(value.source).toBe('manual');
        expect(value.wire_feed_speed).toBeNull();
    });

    it('scarta chiavi non whitelisted (id, organization_id, company_id, wpqr_id, created_at)', () => {
        const { value } = svc.normalizeRun(validRun({ id: 9, organization_id: 7, company_id: 7, wpqr_id: 7, created_at: 'x', hack: 1 }));
        ['id', 'organization_id', 'company_id', 'wpqr_id', 'created_at', 'hack'].forEach((k) => expect(value).not.toHaveProperty(k));
    });

    it('«N.A.» e vuoto → null; testo ambiguo («3-6», «abc», «1e3», boolean) → errore', () => {
        const { value, errors } = svc.normalizeRun(validRun({ voltage_v: 'N.A.', current_a: '' }));
        expect(errors).toEqual([]);
        expect(value.voltage_v).toBeNull();
        expect(value.current_a).toBeNull();
        for (const bad of ['3-6', 'abc', '1e3', true, {}, '12 A']) {
            const r = svc.normalizeRun(validRun({ current_a: bad }));
            expect(r.errors.map((e) => e.field)).toContain('current_a');
        }
    });

    it('limiti numerici (protezione overflow, non soglie normative): negativi e oltre il massimo → errore', () => {
        expect(svc.normalizeRun(validRun({ current_a: -1 })).errors[0].field).toBe('current_a');
        expect(svc.normalizeRun(validRun({ current_a: 5000.01 })).errors[0].field).toBe('current_a');
        expect(svc.normalizeRun(validRun({ filler_diameter_mm: 51 })).errors[0].field).toBe('filler_diameter_mm');
        expect(svc.normalizeRun(validRun({ current_a: 5000 })).errors).toEqual([]);
        expect(svc.normalizeRun(validRun({ current_a: 0 })).errors).toEqual([]);
    });

    it('unità: obbligatoria se c\'è il valore; solo valori ammessi', () => {
        let r = svc.normalizeRun(validRun({ travel_speed_unit: '' }));
        expect(r.errors).toEqual([{ field: 'travel_speed_unit', message: "Selezionare l'unità di misura." }]);
        r = svc.normalizeRun(validRun({ heat_input_unit: null }));
        expect(r.errors.map((e) => e.field)).toEqual(['heat_input_unit']);
        r = svc.normalizeRun(validRun({ heat_input_unit: 'BTU' }));
        expect(r.errors.map((e) => e.field)).toEqual(['heat_input_unit']);
        r = svc.normalizeRun(validRun({ wire_feed_speed: 8 }));
        expect(r.errors.map((e) => e.field)).toEqual(['wire_feed_unit']);
        r = svc.normalizeRun(validRun({ wire_feed_speed: 8, wire_feed_unit: 'm/min' }));
        expect(r.errors).toEqual([]);
        r = svc.normalizeRun(validRun({ travel_speed: null, travel_speed_unit: null }));
        expect(r.errors).toEqual([]);
    });

    it('testo oltre il limite di colonna → errore (nessun troncamento silenzioso)', () => {
        const r = svc.normalizeRun(validRun({ run_label: 'x'.repeat(21), remarks: 'y'.repeat(201) }));
        expect(r.errors.map((e) => e.field).sort()).toEqual(['remarks', 'run_label']);
    });

    it('righe stud (ISO 14555): campi capacitivi numerici validati', () => {
        const ok = svc.normalizeRun({ run_label: '1', current_a: 1200, weld_time_ms: 800, protrusion_mm: 3, lift_mm: 2, capacitance_mf: 30, charging_voltage_v: 150, gap_lift_mm: 1.5, spring_force_n: 20 });
        expect(ok.errors).toEqual([]);
        const bad = svc.normalizeRun({ run_label: '1', capacitance_mf: 'molta' });
        expect(bad.errors[0].field).toBe('capacitance_mf');
    });

    it('source: solo ai|manual, altrimenti manual', () => {
        expect(svc.normalizeRun(validRun({ source: 'ai' })).value.source).toBe('ai');
        expect(svc.normalizeRun(validRun({ source: 'admin' })).value.source).toBe('manual');
    });

    it('riga non oggetto → errore', () => {
        expect(svc.normalizeRun(null).errors).toHaveLength(1);
        expect(svc.normalizeRun([]).errors).toHaveLength(1);
        expect(svc.normalizeRun('x').errors).toHaveLength(1);
    });
});

describe('normalizeRuns', () => {
    it('richiede un array e un massimo di passate', () => {
        expect(() => svc.normalizeRuns({})).toThrow(svc.TestRunsError);
        expect(() => svc.normalizeRuns(undefined)).toThrow(/runs/);
        expect(() => svc.normalizeRuns(new Array(svc.MAX_RUNS + 1).fill({}))).toThrow(/Massimo/);
    });

    it('numera gli errori per riga', () => {
        const { errors } = svc.normalizeRuns([validRun(), validRun({ current_a: 'x' })]);
        expect(errors).toEqual([{ row: 2, field: 'current_a', message: 'Inserire un numero.' }]);
    });
});

describe('parseId', () => {
    it.each([['12', 12], [12, 12], ['0', null], ['-3', null], ['12abc', null], ['1.5', null], ['', null], [undefined, null], ['99999999999999999999', null]])(
        '%j → %j', (raw, expected) => expect(svc.parseId(raw)).toBe(expected)
    );
});

describe('listTestRuns', () => {
    beforeEach(() => jest.clearAllMocks());

    it('restituisce solo le passate del tenant', async () => {
        const { db } = makeDb();
        const out = await svc.listTestRuns({ wpqrId: 10, organizationId: ORG_A });
        expect(out.available).toBe(true);
        expect(out.runs.map((r) => r.id)).toEqual([1]);
        db.statements.forEach((s) => {
            if (/FROM wpqr_test_runs|FROM wpqr_records/.test(s.text)) expect(s.text).toContain('organization_id = @organization_id');
        });
    });

    it('cross-tenant: la WPQR di un altro tenant risponde 404 e non legge alcuna passata', async () => {
        const { db } = makeDb();
        await expect(svc.listTestRuns({ wpqrId: 20, organizationId: ORG_A })).rejects.toMatchObject({ status: 404, code: 'WPQR_NOT_FOUND' });
        expect(db.statements.some((s) => /FROM wpqr_test_runs/.test(s.text))).toBe(false);
    });

    it('tabella assente (migrazione 173 non applicata) → available:false, nessuna query sulla tabella', async () => {
        const { db } = makeDb({ tables: [] });
        const out = await svc.listTestRuns({ wpqrId: 10, organizationId: ORG_A });
        expect(out).toEqual({ runs: [], available: false });
        expect(db.statements.some((s) => /FROM wpqr_test_runs/.test(s.text))).toBe(false);
    });

    it('organizzazione non valida → 403', async () => {
        makeDb();
        await expect(svc.listTestRuns({ wpqrId: 10, organizationId: undefined })).rejects.toMatchObject({ status: 403 });
    });
});

describe('replaceTestRuns', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sostituisce le passate in transazione con organization_id/company_id derivati dalla WPQR, mai dal client', async () => {
        const { db, tx } = makeDb();
        const out = await svc.replaceTestRuns({
            wpqrId: 10,
            organizationId: ORG_A,
            runs: [validRun({ id: 77, organization_id: ORG_B, company_id: 9, wpqr_id: 20 }), validRun({ run_label: '3-4' })],
        });
        expect(tx.begin).toHaveBeenCalledTimes(1);
        expect(tx.commit).toHaveBeenCalledTimes(1);
        expect(out.runs).toHaveLength(2);
        const inserts = db.statements.filter((s) => /^INSERT INTO wpqr_test_runs/.test(s.text));
        expect(inserts).toHaveLength(2);
        inserts.forEach((s) => {
            expect(s.tx).toBe(true);
            expect(s.params.organization_id).toBe(ORG_A);
            expect(s.params.company_id).toBe(5);
            expect(s.params.wpqr_id).toBe(10);
        });
        expect(inserts[1].params.run_no).toBe(3);
        const del = db.statements.find((s) => /^DELETE FROM wpqr_test_runs/.test(s.text));
        expect(del.text).toContain('organization_id = @organization_id');
        expect(del.text).not.toContain('SET deleted_at');
        expect(del.tx).toBe(true);
        expect(db.runs.some((r) => r.id === 1)).toBe(false);
        expect(db.runs.some((r) => r.id === 2 && !r.deleted_at)).toBe(true);
        const audit = db.statements.find((s) => /INSERT INTO entity_change_log/.test(s.text));
        expect(audit.params.action_type).toBe('updated');
        expect(audit.params.entity_table).toBe('wpqr_test_runs');
        expect(audit.params.old_value).toContain('1');
        expect(audit.params.new_value).toContain('2');
        expect(audit.tx).toBe(false);
    });

    it('cross-tenant negativo: nessuna cancellazione né inserimento, dati dell\'altro tenant intatti', async () => {
        const { db, tx } = makeDb();
        await expect(svc.replaceTestRuns({ wpqrId: 20, organizationId: ORG_A, runs: [validRun()] }))
            .rejects.toMatchObject({ status: 404 });
        expect(tx.begin).not.toHaveBeenCalled();
        expect(db.statements.some((s) => /^(DELETE|INSERT|UPDATE)/.test(s.text))).toBe(false);
        expect(db.runs.map((r) => r.id).sort()).toEqual([1, 2]);
    });

    it('un wpqr_id nel corpo non sposta la scrittura su altra WPQR', async () => {
        const { db } = makeDb();
        await svc.replaceTestRuns({ wpqrId: 10, organizationId: ORG_A, runs: [validRun({ wpqr_id: 20, organization_id: ORG_B })] });
        expect(db.runs.filter((r) => r.wpqr_id === 20).map((r) => r.id)).toEqual([2]);
    });

    it('validazione: errori per riga → 400 con details, nessuna transazione', async () => {
        const { tx } = makeDb();
        await expect(svc.replaceTestRuns({ wpqrId: 10, organizationId: ORG_A, runs: [validRun({ voltage_v: -5 })] }))
            .rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR', details: [expect.objectContaining({ row: 1, field: 'voltage_v' })] });
        expect(tx.begin).not.toHaveBeenCalled();
    });

    it('tabella assente → 503 esplicito, nessuna transazione', async () => {
        const { tx } = makeDb({ tables: [] });
        await expect(svc.replaceTestRuns({ wpqrId: 10, organizationId: ORG_A, runs: [validRun()] }))
            .rejects.toMatchObject({ status: 503, code: 'WPQR_TEST_RUNS_UNAVAILABLE' });
        expect(tx.begin).not.toHaveBeenCalled();
    });

    it('errore a metà: rollback, le passate precedenti restano, errore generico senza dettagli SQL', async () => {
        const { db, tx } = makeDb({ failOnInsert: true });
        await expect(svc.replaceTestRuns({ wpqrId: 10, organizationId: ORG_A, runs: [validRun()] }))
            .rejects.toMatchObject({ status: 500, code: 'WPQR_TEST_RUNS_SAVE_ERROR', message: 'Errore durante il salvataggio delle passate' });
        expect(tx.rollback).toHaveBeenCalledTimes(1);
        expect(tx.commit).not.toHaveBeenCalled();
        expect(db.runs.map((r) => r.id).sort()).toEqual([1, 2]);
    });

    it('elenco vuoto = cancella tutte le passate della WPQR (non dell\'altro tenant)', async () => {
        const { db } = makeDb();
        const out = await svc.replaceTestRuns({ wpqrId: 10, organizationId: ORG_A, runs: [] });
        expect(out.runs).toEqual([]);
        expect(db.runs.find((r) => r.id === 1)).toBeUndefined();
        expect(db.runs.find((r) => r.id === 2).deleted_at).toBeFalsy();
    });

    it('log senza valori di prova né nomi: solo id e conteggio', async () => {
        makeDb();
        await svc.replaceTestRuns({ wpqrId: 10, organizationId: ORG_A, runs: [validRun({ remarks: 'NOTA RISERVATA' })] });
        const logged = JSON.stringify(logger.info.mock.calls);
        expect(logged).not.toContain('NOTA RISERVATA');
        expect(logger.info).toHaveBeenCalledWith('WPQR test runs replaced', { wpqr_id: 10, organization_id: ORG_A, count: 1 });
    });
});

describe('cancellazione dipendenze', () => {
    beforeEach(() => jest.clearAllMocks());

    it('deleteWpqrDependents: passate e link con scope tenant, ID solo numerici', async () => {
        const { db } = makeDb();
        await svc.deleteWpqrDependents({ organizationId: ORG_A, wpqrIds: [10, '11', '1; DROP TABLE x', -4, 10] });
        const updates = db.statements.filter((s) => /^UPDATE \w+ SET deleted_at/.test(s.text));
        expect(updates.map((d) => d.text.match(/UPDATE (\w+)/)[1])).toEqual(['wpqr_test_runs', 'wps_wpqr_links']);
        updates.forEach((d) => {
            expect(d.text).toContain('organization_id = @organization_id');
            expect(d.text).toContain('wpqr_id IN (10,11)');
            expect(d.params.organization_id).toBe(ORG_A);
        });
    });

    it('tabelle assenti: nessuna DELETE', async () => {
        const { db } = makeDb({ tables: [] });
        await svc.deleteWpqrDependents({ organizationId: ORG_A, wpqrIds: [10] });
        await svc.deleteWpsLinks({ organizationId: ORG_A, wpsId: 4 });
        expect(db.statements.some((s) => /^DELETE/.test(s.text) || /^UPDATE \w+ SET deleted_at/.test(s.text))).toBe(false);
    });

    it('nessun id valido: nessuna query', async () => {
        const { db } = makeDb();
        await svc.deleteWpqrDependents({ organizationId: ORG_A, wpqrIds: [] });
        await svc.deleteWpqrDependents({ organizationId: ORG_A, wpqrIds: ['x'] });
        await svc.deleteWpsLinks({ organizationId: ORG_A, wpsId: 'x' });
        expect(db.statements).toHaveLength(0);
    });

    it('deleteWpsLinks: scope tenant e wps_id parametrizzato', async () => {
        const { db } = makeDb();
        await svc.deleteWpsLinks({ organizationId: ORG_A, wpsId: 4 });
        const del = db.statements.find((s) => /^UPDATE wps_wpqr_links SET deleted_at/.test(s.text));
        expect(del.text).toContain('organization_id = @organization_id');
        expect(del.params.organization_id).toBe(ORG_A);
        expect(del.params.wps_id).toBe(4);
    });
});

describe('normalizeTestHeader — condizioni di prova su wpqr_records', () => {
    it('accetta solo le chiavi inviate; vuoto/null svuota', () => {
        const { fields, errors } = svc.normalizeTestHeader({
            welding_position_test: ' PA ', diameter_test_mm: '168,3', heat_input_kind: 'arc_energy', heat_input_plus_unlimited: true,
            preheat_temp_test: '', bead_technique: 'weave', electrode_count: 'single', heat_input_range_unit: 'kJ/cm',
            unknown_field: 'x', wps_id: 5,
        });
        expect(errors).toEqual([]);
        expect(fields).toEqual({
            welding_position_test: 'PA', diameter_test_mm: 168.3, heat_input_kind: 'arc_energy', heat_input_plus_unlimited: 1,
            preheat_temp_test: null, bead_technique: 'weave', electrode_count: 'single', heat_input_range_unit: 'kJ/cm',
        });
    });

    it('enum, range numerici, min<=max e lunghezze', () => {
        const { errors } = svc.normalizeTestHeader({
            heat_input_kind: 'altro', heat_input_range_basis: 'x', bead_technique: 'zig', electrode_count: 'tre',
            torch_angle_deg: 400, preheat_temp_test: -60, nozzle_diameter_mm: 'ampio',
            heat_input_range_min: 5, heat_input_range_max: 2,
            shielding_gas_flow_l_min_min: 20, shielding_gas_flow_l_min_max: 10,
            other_test_info: 'z'.repeat(501), heat_input_plus_unlimited: 'forse',
        });
        expect(errors.map((e) => e.field).sort()).toEqual([
            'bead_technique', 'electrode_count', 'heat_input_kind', 'heat_input_plus_unlimited', 'heat_input_range_basis',
            'heat_input_range_max', 'nozzle_diameter_mm', 'other_test_info', 'preheat_temp_test',
            'shielding_gas_flow_l_min_max', 'torch_angle_deg',
        ].sort());
    });

    it('body senza campi di testata → nessun campo, nessun errore', () => {
        expect(svc.normalizeTestHeader({ wpqr_code: 'X' })).toEqual({ fields: {}, errors: [] });
        expect(svc.normalizeTestHeader(undefined)).toEqual({ fields: {}, errors: [] });
    });

    it('i nomi esposti coincidono con le colonne della migrazione 173', () => {
        const fs = require('fs');
        const path = require('path');
        const sql = fs.readFileSync(path.resolve(__dirname, '../../../database/migrations/173_wpqr_test_data.sql'), 'utf8');
        svc.WPQR_TEST_HEADER_FIELDS.forEach((f) => expect(sql).toContain(`ALTER TABLE dbo.wpqr_records ADD ${f} `));
        const cols = sql.match(/ADD (\w+) /g).map((m) => m.slice(4, -1)).filter((c) => c !== 'CONSTRAINT');
        const covered = new Set([...svc.WPQR_TEST_HEADER_FIELDS, 'filler_make']);
        cols.forEach((c) => expect(covered.has(c)).toBe(true));
    });

    it('le colonne di passata scritte coincidono con la tabella della migrazione 173', () => {
        const fs = require('fs');
        const path = require('path');
        const sql = fs.readFileSync(path.resolve(__dirname, '../../../database/migrations/173_wpqr_test_data.sql'), 'utf8');
        svc.WRITABLE_COLUMNS.forEach((c) => expect(sql).toMatch(new RegExp(`\\n\\s+${c}\\s+`)));
    });
});

describe('insertAiTestRunsIfEmpty — transazione e lucchetto', () => {
    it('non inserisce se una passata c\'è già', async () => {
        const { db } = makeDb();
        const n = await svc.insertAiTestRunsIfEmpty({
            wpqrId: 10, organizationId: ORG_A, companyId: 5,
            runs: [{ run_label: 'X', current_a: 1 }],
        });
        expect(n).toBe(0);
        expect(db.statements.some((s) => /^INSERT INTO wpqr_test_runs/.test(s.text))).toBe(false);
    });

    it('inserisce il gruppo in transazione con lucchetto sulla WPQR', async () => {
        const { db, tx } = makeDb();
        db.wpqr.push({ id: 11, organization_id: ORG_A, company_id: 5 });
        const n = await svc.insertAiTestRunsIfEmpty({
            wpqrId: 11, organizationId: ORG_A, companyId: 5,
            runs: [{ run_label: '1', current_a: 10 }, { run_label: '2', current_a: 20 }],
        });
        expect(n).toBe(2);
        expect(tx.begin).toHaveBeenCalled();
        expect(tx.commit).toHaveBeenCalled();
        expect(db.runs.filter((r) => r.wpqr_id === 11)).toHaveLength(2);
        expect(db.statements.some((s) => /UPDLOCK/.test(s.text) && /wpqr_records/.test(s.text))).toBe(true);
    });

    it('senza le colonne 184 non salva la passata di validità, con le colonne scrive il range', async () => {
        const without = makeDb({ columns: false });
        without.db.wpqr.push({ id: 11, organization_id: ORG_A, company_id: 5 });
        const skipped = await svc.insertAiTestRunsIfEmpty({
            wpqrId: 11, organizationId: ORG_A, companyId: 5,
            runs: [
                { run_label: '1', current_a: 100 },
                { run_label: '4R', current_a: null, current_a_min: 140, current_a_max: 160 },
            ],
        });
        expect(skipped).toBe(1);
        const saved = without.db.runs.filter((r) => r.wpqr_id === 11);
        expect(saved.map((r) => r.run_label)).toEqual(['1']);
        expect(saved[0].current_a).toBe(100);
        const insertSql = without.db.statements.filter((s) => /^INSERT INTO wpqr_test_runs/.test(s.text));
        expect(insertSql).toHaveLength(1);
        expect(insertSql[0].text).not.toMatch(/current_a_min/);

        const withRanges = makeDb({ columns: true });
        withRanges.db.wpqr.push({ id: 12, organization_id: ORG_A, company_id: 5 });
        const inserted = await svc.insertAiTestRunsIfEmpty({
            wpqrId: 12, organizationId: ORG_A, companyId: 5,
            runs: [
                { run_label: '1', current_a: 100 },
                { run_label: '4R', current_a: null, current_a_min: 140, current_a_max: 160 },
            ],
        });
        expect(inserted).toBe(2);
        const validity = withRanges.db.runs.find((r) => r.wpqr_id === 12 && r.run_label === '4R');
        expect(validity.current_a).toBeNull();
        expect(validity.current_a_min).toBe(140);
        expect(withRanges.db.statements.some((s) => (
            /^INSERT INTO wpqr_test_runs/.test(s.text) && /current_a_min/.test(s.text) && s.params.run_label === '4R'
        ))).toBe(true);
    });

    it('se una riga fallisce, le precedenti non restano', async () => {
        const { db, tx } = makeDb({ failOnNthInsert: 2 });
        db.wpqr.push({ id: 11, organization_id: ORG_A, company_id: 5 });
        await expect(svc.insertAiTestRunsIfEmpty({
            wpqrId: 11, organizationId: ORG_A, companyId: 5,
            runs: [{ run_label: '1', current_a: 10 }, { run_label: '2', current_a: 20 }],
        })).rejects.toThrow('boom');
        expect(tx.rollback).toHaveBeenCalled();
        expect(db.runs.filter((r) => r.wpqr_id === 11)).toHaveLength(0);
    });
});

describe('insertMissingValidityRuns', () => {
    it('accoda solo l\'etichetta assente e non modifica il valore puntuale già salvato', async () => {
        const { db } = makeDb();
        const before = db.runs.find((r) => r.wpqr_id === 10);
        const n = await svc.insertMissingValidityRuns({
            wpqrId: 10, organizationId: ORG_A, companyId: 5,
            runs: [
                { run_label: '1', current_a: 999, current_a_min: 90, current_a_max: 110 },
                {
                    run_label: '4R', welding_process: '141-S', filler_diameter_mm: 1.6,
                    current_polarity: 'DC EP', current_a: null,
                    current_a_min: 140, current_a_max: 160,
                    voltage_v_min: 26, voltage_v_max: 28,
                    travel_speed_min: 200, travel_speed_max: 220, travel_speed_unit: 'mm/min',
                    heat_input_value_min: 0.8, heat_input_value_max: 0.95, heat_input_unit: 'kJ/mm',
                },
            ],
        });
        expect(n).toBe(1);
        expect(before.current_a).toBe(120);
        const added = db.runs.filter((r) => r.wpqr_id === 10 && r.run_label === '4R');
        expect(added).toHaveLength(1);
        expect(added[0].current_a).toBeNull();
        expect(added[0].current_a_min).toBe(140);
        expect(added[0].welding_process).toBe('141-S');
    });

    it('senza le colonne 184 non scrive', async () => {
        const { db } = makeDb({ columns: false });
        const n = await svc.insertMissingValidityRuns({
            wpqrId: 10, organizationId: ORG_A, companyId: 5,
            runs: [{ run_label: '4R', current_a_min: 1, current_a_max: 2 }],
        });
        expect(n).toBe(0);
        expect(db.statements.some((s) => /^INSERT INTO wpqr_test_runs/.test(s.text))).toBe(false);
    });
});
