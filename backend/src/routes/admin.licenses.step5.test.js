/**
 * PATCH licenze resta solo per il superadmin di piattaforma.
 */
process.env.JWT_SECRET = 'test-secret-almeno-32-caratteri-ok';
process.env.NODE_ENV = 'test';

jest.mock('../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
    closePool: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

function mockController() {
    const handler = (req, res) => res.status(200).json({ saved: true, role: req.user.role });
    return new Proxy({}, { get: () => handler });
}

jest.mock('../controllers/admin.controller', () => mockController());
jest.mock('../controllers/billing.controller', () => mockController());
jest.mock('../controllers/reprocessTasks.controller', () => mockController());

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const adminRoutes = require('./admin.routes');

function app() {
    const server = express();
    server.use(express.json());
    server.use('/api/v1', adminRoutes);
    return server;
}

function tokenFor(role) {
    return jwt.sign(
        { user_id: 1, organization_id: 1, role, email: 'prova@example.invalid' },
        process.env.JWT_SECRET
    );
}

describe('salvataggio licenze', () => {
    const server = app();

    test('il superadmin raggiunge il salvataggio', async () => {
        const res = await request(server)
            .patch('/api/v1/admin/organizations/1005/licenses')
            .set('Authorization', `Bearer ${tokenFor('superadmin')}`)
            .send({ modules: ['audit'] });
        expect(res.status).toBe(200);
        expect(res.body.saved).toBe(true);
    });

    test('l\'admin di studio non salva le licenze', async () => {
        const res = await request(server)
            .patch('/api/v1/admin/organizations/1005/licenses')
            .set('Authorization', `Bearer ${tokenFor('admin')}`)
            .send({ modules: ['audit'] });
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('AUTH_FORBIDDEN');
    });
});
