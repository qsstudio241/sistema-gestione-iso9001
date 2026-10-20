/**
 * @jest-environment node
 *
 * L1 — 181: create/update WPS dichiarano i campi ISO 15609-1 e omettono
 * le colonne se la migrazione non è ancora applicata.
 */
const fs = require('fs');
const path = require('path');

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/entityChangeLog.service', () => ({
    logEntityChange: jest.fn().mockResolvedValue(undefined),
    trashedDetailHidden: jest.fn().mockReturnValue(false),
    softDeleteSql: jest.fn((table, col) => `UPDATE ${table} SET deleted_at = SYSUTCDATETIME() WHERE ${col} = @id`),
}));
jest.mock('../services/companyAccess.service', () => ({
    ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
    companyAccessSqlFilter: jest.fn(),
    assertMutatingAllowed: jest.fn().mockResolvedValue(null),
    assertCompanyRead: jest.fn().mockResolvedValue(null),
    hasCompanyAccessRows: jest.fn().mockReturnValue(false),
    sendAccessDenied: jest.fn(),
}));
jest.mock('../services/wpsWpqrLinks.service', () => {
    const actual = jest.requireActual('../services/wpsWpqrLinks.service');
    return {
        ...actual,
        insertLink: jest.fn().mockResolvedValue({ created: true, available: true }),
        linksAvailable: jest.fn().mockResolvedValue(true),
        listWpqrRecordsForWps: jest.fn().mockResolvedValue([]),
    };
});

const { query } = require('../config/database');
const ctrl = require('./welding.controller');

const ISO_COLS_181 = [
    'wpqr_ref', 'parent_material_a', 'parent_material_b',
    'heat_input', 'current_range', 'voltage_range', 'metal_transfer',
];
const ISO_COLS_182 = [
    'joint_preparation', 'cleaning_method', 'mechanization',
    'shielding_gas_flow_l_min_min', 'shielding_gas_flow_l_min_max',
    'post_heating', 'pwht_details', 'bead_technique',
    'contact_tube_distance_mm_min', 'contact_tube_distance_mm_max',
    'torch_angle_deg', 'throat_mm', 'pipe_diameter_max',
];
const ISO_COLS = [...ISO_COLS_181, ...ISO_COLS_182];

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) { this.statusCode = code; return this; });
    res.json = jest.fn(function json(payload) { this.body = payload; return this; });
    return res;
}

function mockQuery({ columnsPresent, updateExisting = true }) {
    query.mockImplementation(async (sql) => {
        if (/FROM sys\.columns/i.test(sql)) {
            return {
                recordset: columnsPresent ? ISO_COLS.map((name) => ({ name })) : [],
            };
        }
        if (/^UPDATE welding_procedures/i.test(String(sql).trim())) {
            return { recordset: [], rowsAffected: [1] };
        }
        if (/SELECT id, company_id/i.test(sql)) {
            return updateExisting
                ? { recordset: [{ id: 9, company_id: 50, wps_code: 'WPS-X', status: 'bozza', notes: null, deleted_at: null }] }
                : { recordset: [] };
        }
        return { recordset: [{ id: 77 }] };
    });
}

describe('createWPS / updateWPS — campi ISO 15609-1 (migrazione 181+182)', () => {
    afterEach(() => jest.clearAllMocks());

    it('il sorgente elenca i campi 181+182 e sonda sys.columns prima di scriverli', () => {
        const src = fs.readFileSync(path.join(__dirname, 'welding.controller.js'), 'utf8');
        expect(src).toMatch(/ISO15609_WPS_FIELDS/);
        expect(src).toMatch(/presentIso15609WpsColumns/);
        expect(src).toMatch(/FROM sys\.columns/);
        ISO_COLS.forEach((col) => expect(src).toMatch(new RegExp(`'${col}'`)));
    });

    it('INSERT include i campi 181+182 se le colonne ci sono', async () => {
        mockQuery({ columnsPresent: true });
        const res = createRes();
        await ctrl.createWPS({
            user: { organization_id: 1005, user_id: 9 },
            body: {
                company_id: 50,
                wps_code: 'WPS-ISO',
                wpqr_ref: '24-03390-01',
                parent_material_a: 'S355',
                parent_material_b: 'S355',
                heat_input: '0.8 kJ/mm',
                current_range: '190 A',
                voltage_range: '24 V',
                metal_transfer: 'Spray',
                joint_preparation: 'square T',
                cleaning_method: 'grinding',
                mechanization: 'partly mechanized',
                throat_mm: 7.5,
                pipe_diameter_mm: 88.9,
                torch_angle_deg: 15,
            },
        }, res);
        expect(res.statusCode).toBe(201);
        const insert = query.mock.calls.find(([sql]) => /INSERT INTO welding_procedures/i.test(sql));
        expect(insert).toBeTruthy();
        ISO_COLS.forEach((col) => expect(insert[0]).toMatch(new RegExp(col)));
        expect(insert[1].wpqr_ref).toBe('24-03390-01');
        expect(insert[1].parent_material_a).toBe('S355');
        expect(insert[1].metal_transfer).toBe('Spray');
        expect(insert[1].joint_preparation).toBe('square T');
        expect(insert[1].throat_mm).toBe(7.5);
        expect(insert[1].pipe_diameter_max).toBe(88.9);
        expect(insert[1].pipe_diameter_min).toBe(88.9);
        expect(insert[1].torch_angle_deg).toBe(15);
    });

    it('INSERT omette i campi 181+182 se le migrazioni non sono applicate', async () => {
        mockQuery({ columnsPresent: false });
        const res = createRes();
        await ctrl.createWPS({
            user: { organization_id: 1005, user_id: 9 },
            body: {
                company_id: 50,
                wps_code: 'WPS-PRE181',
                wpqr_ref: '24-03390-01',
                heat_input: '0.8 kJ/mm',
            },
        }, res);
        expect(res.statusCode).toBe(201);
        const insert = query.mock.calls.find(([sql]) => /INSERT INTO welding_procedures/i.test(sql));
        expect(insert).toBeTruthy();
        ISO_COLS.forEach((col) => expect(insert[0]).not.toMatch(new RegExp(`\\b${col}\\b`)));
        expect(insert[1].wpqr_ref).toBeUndefined();
    });

    it('updateWPS non nomina le colonne nuove se assenti', async () => {
        mockQuery({ columnsPresent: false });
        const res = createRes();
        await ctrl.updateWPS({
            user: { organization_id: 1005, user_id: 9 },
            params: { id: '9' },
            body: { notes: 'ok', wpqr_ref: 'X', heat_input: '1' },
        }, res);
        expect(res.statusCode).toBe(200);
        const upd = query.mock.calls.find(([sql]) => /UPDATE welding_procedures/i.test(sql));
        expect(upd).toBeTruthy();
        expect(upd[0]).toMatch(/notes = @notes/);
        ISO_COLS.forEach((col) => expect(upd[0]).not.toMatch(new RegExp(`${col} = @${col}`)));
    });
});
