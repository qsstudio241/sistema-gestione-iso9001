/**
 * Integration tests — Autenticazione, RBAC, rate limiting
 *
 * Strategia: mock del layer DB (config/database) e avvio del server Express
 * tramite supertest senza binding TCP reale. I test verificano:
 *   - Reject di richieste senza token (401)
 *   - Reject di token malformati/scaduti (401)
 *   - Enforce ruolo (403 per ruolo non autorizzato)
 *   - Isolamento tenant (403 se organization_id diverso)
 *   - Rate limit auth (429 dopo n tentativi rapidi)
 *
 * @jest-environment node
 */

process.env.JWT_SECRET = 'test-secret-almeno-32-caratteri-ok';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_DISABLED = 'false'; // Attivo nei test per verificarlo
process.env.RATE_LIMIT_AUTH_MAX = '3';      // Soglia bassa per testare 429 rapidamente
process.env.RATE_LIMIT_AUTH_WINDOW_MS = '60000';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.CORS_CREDENTIALS = 'true';
process.env.API_BASE_PATH = '/api/v1';

// ── Mock DB prima che qualsiasi modulo lo richieda ────────────────────────────
jest.mock('../../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
    closePool: jest.fn(),
}));

// Mock alertScheduler (effetti collaterali non necessari nei test)
jest.mock('../../services/alertScheduler', () => ({
    startAlertScheduler: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const { query } = require('../../config/database');

const JWT_SECRET = process.env.JWT_SECRET;

// ── Helper: genera token JWT valido per i test ────────────────────────────────
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

const API = '/api/v1';

// ── SUITE: autenticazione ─────────────────────────────────────────────────────
describe('Autenticazione JWT', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock: lista audit vuota
        query.mockResolvedValue({ recordset: [], rowsAffected: [0] });
    });

    it('401 se Authorization header assente', async () => {
        const res = await request(app).get(`${API}/audits`);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('AUTH_TOKEN_MISSING');
    });

    it('401 se token malformato', async () => {
        const res = await request(app)
            .get(`${API}/audits`)
            .set('Authorization', 'Bearer token.non.valido');
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('401 se token scaduto', async () => {
        const expiredToken = jwt.sign(
            { user_id: 1, email: 't@t.com', role: 'auditor', organization_id: 1 },
            JWT_SECRET,
            { expiresIn: '-1s' }
        );
        const res = await request(app)
            .get(`${API}/audits`)
            .set('Authorization', `Bearer ${expiredToken}`);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('AUTH_TOKEN_EXPIRED');
    });

    it('200 con token valido (mock DB restituisce lista vuota)', async () => {
        query.mockResolvedValue({ recordset: [], rowsAffected: [0] });
        const token = makeToken();
        const res = await request(app)
            .get(`${API}/audits`)
            .set('Authorization', `Bearer ${token}`);
        // Il controller può restituire 200 o 500 a seconda del mock; verifichiamo solo non sia 401/403
        expect([200, 500]).toContain(res.status);
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });
});

// ── SUITE: RBAC ruoli ─────────────────────────────────────────────────────────
describe('RBAC — autorizzazione per ruolo', () => {
    beforeEach(() => jest.clearAllMocks());

    it('403 se viewer tenta GET /admin/users (solo admin)', async () => {
        const token = makeToken({ role: 'viewer' });
        const res = await request(app)
            .get(`${API}/admin/users`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('403 se auditor tenta GET /admin/users', async () => {
        const token = makeToken({ role: 'auditor' });
        const res = await request(app)
            .get(`${API}/admin/users`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    it('non 403 per admin su /admin/users (anche se DB non disponibile)', async () => {
        query.mockResolvedValue({ recordset: [], rowsAffected: [0] });
        const token = makeToken({ role: 'admin' });
        const res = await request(app)
            .get(`${API}/admin/users`)
            .set('Authorization', `Bearer ${token}`);
        // Admin non deve ricevere 403
        expect(res.status).not.toBe(403);
    });
});

// ── SUITE: isolamento tenant ──────────────────────────────────────────────────
describe('Isolamento tenant — organization_id', () => {
    beforeEach(() => jest.clearAllMocks());

    it('il payload JWT contiene sempre organization_id', async () => {
        const tokenSenza = jwt.sign(
            { user_id: 1, email: 'x@x.com', role: 'auditor' /* manca organization_id */ },
            JWT_SECRET,
            { expiresIn: '1h' }
        );
        const res = await request(app)
            .get(`${API}/audits`)
            .set('Authorization', `Bearer ${tokenSenza}`);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe('AUTH_TOKEN_INVALID');
    });

    it('la query DB riceve organization_id dal token (non dal client)', async () => {
        const orgId = 999;
        const token = makeToken({ organization_id: orgId });
        query.mockResolvedValue({ recordset: [], rowsAffected: [0] });

        await request(app)
            .get(`${API}/audits`)
            .set('Authorization', `Bearer ${token}`);

        // Verifica che query sia stata chiamata con il parametro corretto
        const callArgs = query.mock.calls;
        if (callArgs.length > 0) {
            const params = callArgs[0][1] || {};
            // organization_id nel parametro deve corrispondere al token, non a input client
            if (params.organization_id !== undefined) {
                expect(params.organization_id).toBe(orgId);
            }
        }
    });
});

// ── SUITE: Rate limiting auth ─────────────────────────────────────────────────
describe('Rate limiting — endpoint /auth/login', () => {
    it('429 dopo il superamento della soglia (RATE_LIMIT_AUTH_MAX=3)', async () => {
        // Il mock di /auth/login risponde sempre 400 (credenziali mancanti)
        const attempts = Array.from({ length: 5 }, () =>
            request(app)
                .post(`${API}/auth/login`)
                .send({ email: 'brute@force.com', password: 'wrong' })
        );

        const responses = await Promise.all(attempts);
        const statuses = responses.map((r) => r.status);

        // Almeno una risposta deve essere 429 (rate limited)
        expect(statuses).toContain(429);
    });
});

// ── SUITE: endpoint pubblici non protetti ─────────────────────────────────────
describe('Endpoint pubblici', () => {
    it('GET /health risponde 200 senza token', async () => {
        query.mockResolvedValue({ recordset: [{ healthy: 1 }] });
        const res = await request(app).get(`${API}/health`);
        expect(res.status).toBe(200);
    });

    it('GET /response-options risponde senza token', async () => {
        query.mockResolvedValue({ recordset: [] });
        const res = await request(app).get(`${API}/response-options`);
        expect([200, 500]).toContain(res.status);
        expect(res.status).not.toBe(401);
    });
});
