/**
 * Integration tests — POST/GET /api/v1/audits/:uuid/events (T2 — ADR-008)
 *
 * Strategia: mock del layer DB; verifica:
 *   - Batch valido → 207 inserted > 0
 *   - Stesso batch → 207 skipped = N (idempotency)
 *   - event_type non valido → 400
 *   - idempotency_key mancante → 400
 *   - Audit di altra org → 404
 *   - Senza token → 401
 *
 * @jest-environment node
 */

process.env.JWT_SECRET = 'test-secret-almeno-32-caratteri-ok';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.CORS_CREDENTIALS = 'true';
process.env.API_BASE_PATH = '/api/v1';

jest.mock('../../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
    closePool: jest.fn(),
}));

jest.mock('../../services/alertScheduler', () => ({
    startAlertScheduler: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const { query } = require('../../config/database');

const JWT_SECRET = process.env.JWT_SECRET;
const API = '/api/v1';
const AUDIT_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeToken(overrides = {}) {
    return jwt.sign(
        {
            user_id: overrides.user_id ?? 1,
            email: overrides.email ?? 'test@example.com',
            role: overrides.role ?? 'auditor',
            organization_id: overrides.organization_id ?? 100,
            auditor_org_id: overrides.auditor_org_id ?? null,
        },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

const VALID_EVENT = {
    event_type: 'response_set',
    idempotency_key: 'ffffffff-0000-0000-0000-000000000001',
    client_ts: new Date().toISOString(),
    field_path: 'question_87',
    new_value: 'C',
};

describe('POST /audits/:uuid/events — batch insert', () => {
    beforeEach(() => jest.clearAllMocks());

    it('401 senza token', async () => {
        const res = await request(app)
            .post(`${API}/audits/${AUDIT_UUID}/events`)
            .send({ events: [VALID_EVENT] });
        expect(res.status).toBe(401);
    });

    it('207 con inserted=1 — batch di un evento valido', async () => {
        // Prima chiamata: risolve audit_id
        query
            .mockResolvedValueOnce({ recordset: [{ audit_id: 35 }] })  // SELECT audit_id
            .mockResolvedValueOnce({ recordset: [], rowsAffected: [1] }); // INSERT

        const token = makeToken({ organization_id: 100 });
        const res = await request(app)
            .post(`${API}/audits/${AUDIT_UUID}/events`)
            .set('Authorization', `Bearer ${token}`)
            .send({ events: [VALID_EVENT] });

        expect(res.status).toBe(207);
        expect(res.body.inserted).toBe(1);
        expect(res.body.skipped).toBe(0);
        expect(res.body.total).toBe(1);
    });

    it('207 con skipped=1 — idempotency: stesso evento reinviato', async () => {
        const dupErr = new Error('Unique constraint violation');
        dupErr.number = 2627;

        query
            .mockResolvedValueOnce({ recordset: [{ audit_id: 35 }] })
            .mockRejectedValueOnce(dupErr); // INSERT → unique constraint

        const token = makeToken({ organization_id: 100 });
        const res = await request(app)
            .post(`${API}/audits/${AUDIT_UUID}/events`)
            .set('Authorization', `Bearer ${token}`)
            .send({ events: [VALID_EVENT] });

        expect(res.status).toBe(207);
        expect(res.body.inserted).toBe(0);
        expect(res.body.skipped).toBe(1);
        expect(res.body.total).toBe(1);
    });

    it('400 con INVALID_EVENT_TYPE — event_type non nella lista ammessa', async () => {
        query.mockResolvedValueOnce({ recordset: [{ audit_id: 35 }] });

        const token = makeToken({ organization_id: 100 });
        const res = await request(app)
            .post(`${API}/audits/${AUDIT_UUID}/events`)
            .set('Authorization', `Bearer ${token}`)
            .send({ events: [{ ...VALID_EVENT, event_type: 'tipo_non_valido' }] });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_EVENT_TYPE');
    });

    it('400 con MISSING_FIELDS — idempotency_key assente', async () => {
        query.mockResolvedValueOnce({ recordset: [{ audit_id: 35 }] });

        const { idempotency_key: _omit, ...eventSenzaKey } = VALID_EVENT;
        const token = makeToken({ organization_id: 100 });
        const res = await request(app)
            .post(`${API}/audits/${AUDIT_UUID}/events`)
            .set('Authorization', `Bearer ${token}`)
            .send({ events: [eventSenzaKey] });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('MISSING_FIELDS');
    });

    it('400 con INVALID_PAYLOAD — events array vuoto', async () => {
        const token = makeToken({ organization_id: 100 });
        const res = await request(app)
            .post(`${API}/audits/${AUDIT_UUID}/events`)
            .set('Authorization', `Bearer ${token}`)
            .send({ events: [] });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_PAYLOAD');
    });

    it('404 con AUDIT_NOT_FOUND — audit di altra org', async () => {
        // DB restituisce 0 righe (audit non trovato per questa org)
        query.mockResolvedValueOnce({ recordset: [] });

        const token = makeToken({ organization_id: 999 });
        const res = await request(app)
            .post(`${API}/audits/${AUDIT_UUID}/events`)
            .set('Authorization', `Bearer ${token}`)
            .send({ events: [VALID_EVENT] });

        expect(res.status).toBe(404);
        expect(res.body.code).toBe('AUDIT_NOT_FOUND');
    });
});

describe('GET /audits/:uuid/events — lettura eventi', () => {
    beforeEach(() => jest.clearAllMocks());

    it('401 senza token', async () => {
        const res = await request(app)
            .get(`${API}/audits/${AUDIT_UUID}/events`);
        expect(res.status).toBe(401);
    });

    it('200 con array eventi (anche vuoto)', async () => {
        query.mockResolvedValueOnce({ recordset: [] });

        const token = makeToken({ organization_id: 100 });
        const res = await request(app)
            .get(`${API}/audits/${AUDIT_UUID}/events`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.events)).toBe(true);
    });
});
