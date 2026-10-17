/**
 * Il controllo «solo admin» di Import PDF non deve fermare le route montate dopo.
 */
process.env.JWT_SECRET = 'test-secret-almeno-32-caratteri-ok';
process.env.NODE_ENV = 'test';

jest.mock('../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
    closePool: jest.fn(),
}));

jest.mock('../controllers/importJobs.controller', () => {
    const ok = (req, res) => res.status(200).json({ ok: true, role: req.user.role });
    return {
        listJobs: ok,
        createJob: ok,
        getJob: ok,
        deleteJob: ok,
        uploadFiles: ok,
        processJob: ok,
        screenAndPlace: ok,
        suggestAiExtraction: ok,
        patchFile: ok,
        commitToRegistry: ok,
        commitToQualification: ok,
    };
});

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const importJobsRoutes = require('./importJobs.routes');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/v1', importJobsRoutes);
    const later = (req, res) => res.status(200).json({ list: req.path });
    app.get('/api/v1/welding/wps', later);
    app.get('/api/v1/welding/wpqr', later);
    app.get('/api/v1/projects', later);
    return app;
}

function tokenFor(role) {
    return jwt.sign(
        { user_id: 9, organization_id: 1005, role, email: 'prova@example.invalid' },
        process.env.JWT_SECRET
    );
}

describe('import jobs: admin solo sulle route di import', () => {
    const app = buildApp();

    test.each([
        ['viewer', '/api/v1/welding/wps'],
        ['auditor', '/api/v1/welding/wpqr'],
        ['viewer', '/api/v1/projects'],
        ['auditor', '/api/v1/welding/wps'],
    ])('%s GET %s non è 403 di ruolo', async (role, path) => {
        const res = await request(app).get(path).set('Authorization', `Bearer ${tokenFor(role)}`);
        expect(res.status).toBe(200);
        expect(res.body.code).not.toBe('AUTH_FORBIDDEN');
    });

    test.each(['viewer', 'auditor'])('%s GET import-jobs resta 403', async (role) => {
        const res = await request(app)
            .get('/api/v1/import-jobs')
            .set('Authorization', `Bearer ${tokenFor(role)}`);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('AUTH_FORBIDDEN');
        expect(res.body.requiredRoles).toEqual(['admin']);
    });

    test('admin GET import-jobs passa', async () => {
        const res = await request(app)
            .get('/api/v1/import-jobs')
            .set('Authorization', `Bearer ${tokenFor('admin')}`);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});
