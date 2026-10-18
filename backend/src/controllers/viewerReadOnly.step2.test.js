/**
 * Il viewer di studio consulta. Non crea, non modifica, non elimina, non apre il cestino.
 * Admin e auditor restano abilitati alle scritture che già avevano.
 */
jest.mock('../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));
jest.mock('../services/wpsGenerator.service', () => ({
    generateWpsFromWpqr: jest.fn(async () => ({
        status: 'need_input',
        questions: [],
        warnings: [],
    })),
}));

const { query } = require('../config/database');
const welding = require('./welding.controller');
const projects = require('./projects.controller');
const qualifications = require('./qualifications.controller');
const documents = require('./document.controller');
const nc = require('./nc.controller');
const trash = require('../services/trash.service');
const testRuns = require('../services/wpqrTestRuns.service');

function res() {
    const out = { statusCode: 200, body: null };
    out.status = jest.fn((code) => {
        out.statusCode = code;
        return out;
    });
    out.json = jest.fn((payload) => {
        out.body = payload;
        return out;
    });
    return out;
}

function user(role) {
    return { user_id: 9, organization_id: 1005, role, company_access: undefined };
}

describe('viewer di studio in sola lettura', () => {
    beforeEach(() => {
        query.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('user_company_access')) return { recordset: [] };
            if (text.includes('COUNT(*)')) return { recordset: [{ total: 0 }] };
            if (text.includes('INSERT INTO welding_procedures')) return { recordset: [{ id: 7 }] };
            if (text.includes('FROM document_registry')) {
                return {
                    recordset: [{
                        id: 3, status: 'bozza', is_system_folder: 0, doc_type: 'procedura', company_id: 11,
                    }],
                };
            }
            if (text.includes('FROM non_conformities')) {
                return {
                    recordset: [{
                        nc_id: 4,
                        current_status: 'open',
                        audit_id: 8,
                        company_id: 11,
                        nc_company_id: 11,
                        source_category: 'audit',
                    }],
                };
            }
            if (text.includes('FROM wpqr_records')) {
                return { recordset: [{ id: 10, organization_id: 1005, company_id: 11, wps_company_id: 11 }] };
            }
            return { recordset: [] };
        });
    });

    test('viewer legge le WPS e non le crea', async () => {
        const list = res();
        await welding.listWPS({ user: user('viewer'), query: {} }, list);
        expect(list.statusCode).toBe(200);

        const created = res();
        await welding.createWPS({
            user: user('viewer'),
            body: { wps_code: 'WPS-1', company_id: 11 },
        }, created);
        expect(created.statusCode).toBe(403);
        expect(created.body.code).toBe('AUTH_FORBIDDEN');
        expect(query.mock.calls.some((c) => String(c[0]).includes('INSERT INTO welding_procedures'))).toBe(false);
    });

    test('auditor e admin creano ancora una WPS', async () => {
        for (const role of ['auditor', 'admin']) {
            query.mockClear();
            const created = res();
            await welding.createWPS({
                user: user(role),
                body: { wps_code: 'WPS-1', company_id: 11 },
            }, created);
            expect(created.statusCode).toBe(201);
        }
    });

    test('viewer non genera una WPS', async () => {
        const out = res();
        await welding.generateWPS({
            user: user('viewer'),
            body: { company_id: 11 },
        }, out);
        expect(out.statusCode).toBe(403);
        expect(out.body.code).toBe('AUTH_FORBIDDEN');
    });

    test('viewer non crea una commessa, l\'auditor non è fermato dal ruolo', async () => {
        const viewerRes = res();
        await projects.createProject({
            user: user('viewer'),
            body: { project_code: 'C-1', company_id: 11 },
        }, viewerRes);
        expect(viewerRes.statusCode).toBe(403);
        expect(viewerRes.body.code).toBe('AUTH_FORBIDDEN');

        const auditorRes = res();
        await projects.createProject({
            user: user('auditor'),
            body: { project_code: 'C-1', company_id: 11 },
        }, auditorRes);
        expect(auditorRes.statusCode).not.toBe(403);
    });

    test('viewer non carica qualifiche, l\'auditor arriva al file', async () => {
        const viewerRes = res();
        await qualifications.uploadBatch({
            user: user('viewer'),
            body: { company_id: 11 },
            query: {},
        }, viewerRes);
        expect(viewerRes.statusCode).toBe(403);

        const auditorRes = res();
        await qualifications.uploadBatch({
            user: user('auditor'),
            body: { company_id: 11 },
            query: {},
        }, auditorRes);
        expect(auditorRes.statusCode).toBe(400);
    });

    test('viewer non elimina un documento', async () => {
        const out = res();
        await documents.deleteDocument({
            user: user('viewer'),
            params: { id: '3' },
        }, out);
        expect(out.statusCode).toBe(403);
        expect(out.body.code).toBe('AUTH_FORBIDDEN');
    });

    test('viewer non modifica una NC di audit', async () => {
        const out = res();
        await nc.updateNonConformity({
            user: user('viewer'),
            params: { id: '4' },
            body: { description: 'x' },
        }, out);
        expect(out.statusCode).toBe(403);
        expect(out.body.code).toBe('AUTH_FORBIDDEN');
    });

    test('il viewer non apre il cestino', async () => {
        const out = res();
        await trash.listTrash({ user: user('viewer'), query: {} }, out);
        expect(out.statusCode).toBe(403);
        expect(out.body.code).toBe('AUTH_FORBIDDEN');
    });

    test('viewer non salva le passate WPQR', async () => {
        await expect(testRuns.replaceTestRuns({
            wpqrId: 10,
            organizationId: 1005,
            user: user('viewer'),
            runs: [],
        })).rejects.toMatchObject({ status: 403, code: 'AUTH_FORBIDDEN' });
    });
});
