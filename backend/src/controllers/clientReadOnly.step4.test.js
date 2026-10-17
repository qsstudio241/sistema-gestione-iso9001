/**
 * Cliente senza licenza propria = permesso read sulla propria azienda.
 * Il permesso write resta scrittura, cancellazione compresa.
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

const { query } = require('../config/database');
const welding = require('./welding.controller');
const documents = require('./document.controller');
const qualifications = require('./qualifications.controller');

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

function client(permission) {
    return {
        user_id: 30,
        organization_id: 1005,
        role: 'viewer',
        company_access: [{ company_id: 11, permission }],
    };
}

describe('cliente senza licenza propria', () => {
    beforeEach(() => {
        query.mockImplementation(async (sql) => {
            const text = String(sql);
            if (text.includes('COUNT(*)')) return { recordset: [{ total: 0 }] };
            if (text.includes('INSERT INTO welding_procedures')) return { recordset: [{ id: 8 }] };
            if (text.includes('FROM welding_procedures w')) {
                return { recordset: [{ id: 8, company_id: 11, deleted_at: null }] };
            }
            if (text.includes('FROM document_registry')) {
                return { recordset: [{ id: 3, status: 'bozza', is_system_folder: 0, doc_type: 'procedura', company_id: 11 }] };
            }
            return { recordset: [] };
        });
    });

    test('read consulta solo la propria azienda e non crea', async () => {
        const list = res();
        await welding.listWPS({ user: client('read'), query: {} }, list);
        expect(list.statusCode).toBe(200);
        const listSql = query.mock.calls.map((c) => String(c[0])).join('\n');
        expect(listSql).toContain('company_id IN');

        const other = res();
        await welding.listWPS({ user: client('read'), query: { company_id: '99' } }, other);
        expect(other.statusCode).toBe(403);

        const created = res();
        await welding.createWPS({
            user: client('read'),
            body: { wps_code: 'WPS-1', company_id: 11 },
        }, created);
        expect(created.statusCode).toBe(403);
        expect(created.body.code).toBe('AUTH_FORBIDDEN');
    });

    test('read non elimina un documento della propria azienda', async () => {
        const out = res();
        await documents.deleteDocument({
            user: client('read'),
            params: { id: '3' },
        }, out);
        expect(out.statusCode).toBe(403);
        expect(out.body.code).toBe('AUTH_FORBIDDEN');
    });

    test('write può ancora creare e il caricamento qualifiche non gli è tolto', async () => {
        const created = res();
        await welding.createWPS({
            user: client('write'),
            body: { wps_code: 'WPS-1', company_id: 11 },
        }, created);
        expect(created.statusCode).toBe(201);

        const upload = res();
        await qualifications.uploadBatch({
            user: client('write'),
            body: { company_id: 11 },
            query: {},
        }, upload);
        expect(upload.statusCode).toBe(400);
    });
});
