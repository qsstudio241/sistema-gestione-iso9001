/**
 * @jest-environment node
 *
 * Test L1 — createWPQR/updateWPQR, campi estensione ISO 15614-1 (08/08/2026).
 * Gap segnalato dal committente: 6 campi (thickness_max_unlimited, preheat_temp,
 * interpass_temp, throat_test_mm, product_type, rotated_position) erano scrivibili
 * SOLO dall'ingest AI, mai da form/API manuale. Copre anche il mirroring
 * testing_body -> examiner_body sull'update.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const { query } = require('../config/database');
const { createWPQR, updateWPQR } = require('./welding.controller');

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) { this.statusCode = code; return this; });
    res.json = jest.fn(function json(payload) { this.body = payload; return this; });
    return res;
}

describe('createWPQR — campi estensione ISO 15614-1', () => {
    afterEach(() => jest.clearAllMocks());

    it('inserisce thickness_max_unlimited/preheat_temp/interpass_temp/throat_test_mm/product_type/rotated_position', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 1 }] }); // check WPS exists
        query.mockResolvedValueOnce({ recordset: [{ id: 42 }] }); // INSERT

        const req = {
            user: { organization_id: 1001, user_id: 5 },
            body: {
                wps_id: 1,
                wpqr_code: 'WPQR-EXT-01',
                thickness_max_unlimited: true,
                preheat_temp: 'min 100 C',
                interpass_temp: 'max 250 C',
                throat_test_mm: 6.5,
                product_type: 'P',
                rotated_position: true,
            },
        };
        const res = createRes();
        await createWPQR(req, res);

        expect(res.statusCode).toBe(201);
        const insertCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO wpqr_records'));
        expect(insertCall).toBeTruthy();
        const params = insertCall[1];
        expect(params.thickness_max_unlimited).toBe(1);
        expect(params.preheat_temp).toBe('min 100 C');
        expect(params.interpass_temp).toBe('max 250 C');
        expect(params.throat_test_mm).toBe(6.5);
        expect(params.product_type).toBe('P');
        expect(params.rotated_position).toBe(1);
    });

    it('senza i campi estensione, li salva come null/0 (nessun crash, retrocompatibile)', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 1 }] });
        query.mockResolvedValueOnce({ recordset: [{ id: 43 }] });

        const req = {
            user: { organization_id: 1001, user_id: 5 },
            body: { wps_id: 1, wpqr_code: 'WPQR-EXT-02' },
        };
        const res = createRes();
        await createWPQR(req, res);

        const insertCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO wpqr_records'));
        const params = insertCall[1];
        expect(params.thickness_max_unlimited).toBe(0);
        expect(params.preheat_temp).toBeNull();
        expect(params.throat_test_mm).toBeNull();
        expect(params.product_type).toBeNull();
        expect(params.rotated_position).toBe(0);
    });
});

describe('updateWPQR — campi estensione ISO 15614-1 + mirroring examiner_body', () => {
    afterEach(() => jest.clearAllMocks());

    it('aggiorna i 6 campi estensione precedentemente bloccati', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 7 }] }); // existing check
        query.mockResolvedValueOnce({ recordset: [] }); // UPDATE

        const req = {
            params: { id: '7' },
            user: { organization_id: 1001 },
            body: {
                thickness_max_unlimited: true,
                preheat_temp: 'min 80 C',
                interpass_temp: 'max 200 C',
                throat_test_mm: 4,
                product_type: 'T',
                rotated_position: false,
            },
        };
        const res = createRes();
        await updateWPQR(req, res);

        expect(res.statusCode).toBe(200);
        const updateCall = query.mock.calls.find(([sql]) => sql.includes('UPDATE wpqr_records'));
        expect(updateCall).toBeTruthy();
        const [sql, params] = updateCall;
        expect(sql).toMatch(/thickness_max_unlimited = @thickness_max_unlimited/);
        expect(sql).toMatch(/throat_test_mm = @throat_test_mm/);
        expect(sql).toMatch(/product_type = @product_type/);
        expect(sql).toMatch(/rotated_position = @rotated_position/);
        expect(params.thickness_max_unlimited).toBe(1);
        expect(params.throat_test_mm).toBe(4);
        expect(params.product_type).toBe('T');
        expect(params.rotated_position).toBe(0);
    });

    it('aggiornando solo testing_body, sincronizza automaticamente anche examiner_body', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 8 }] });
        query.mockResolvedValueOnce({ recordset: [] });

        const req = {
            params: { id: '8' },
            user: { organization_id: 1001 },
            body: { testing_body: 'IIS - ISSCERT' },
        };
        const res = createRes();
        await updateWPQR(req, res);

        const updateCall = query.mock.calls.find(([sql]) => sql.includes('UPDATE wpqr_records'));
        const [sql, params] = updateCall;
        expect(sql).toMatch(/testing_body = @testing_body/);
        expect(sql).toMatch(/examiner_body = @examiner_body/);
        expect(params.testing_body).toBe('IIS - ISSCERT');
        expect(params.examiner_body).toBe('IIS - ISSCERT');
    });

    it('se examiner_body viene inviato esplicitamente, non viene sovrascritto dal mirroring', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 9 }] });
        query.mockResolvedValueOnce({ recordset: [] });

        const req = {
            params: { id: '9' },
            user: { organization_id: 1001 },
            body: { testing_body: 'TÜV', examiner_body: 'Mario Rossi (esaminatore)' },
        };
        const res = createRes();
        await updateWPQR(req, res);

        const updateCall = query.mock.calls.find(([sql]) => sql.includes('UPDATE wpqr_records'));
        const [, params] = updateCall;
        expect(params.testing_body).toBe('TÜV');
        expect(params.examiner_body).toBe('Mario Rossi (esaminatore)');
    });
});
