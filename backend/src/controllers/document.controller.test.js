/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./document.controller');

const ORG_ID = 1001;

function mockReq(overrides = {}) {
    return {
        user: { organization_id: ORG_ID, user_id: 1 },
        params: {},
        query: {},
        body: {},
        ...overrides,
    };
}

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

afterEach(() => jest.clearAllMocks());

describe('listDocuments', () => {
    it('aggiunge filtro NOT EXISTS quando without_file=1', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ id: 1, title: 'Doc A', has_file: 0 }] })
            .mockResolvedValueOnce({ recordset: [{ total: 1 }] });

        const req = mockReq({ query: { without_file: '1', page: 1, limit: 20 } });
        const res = mockRes();
        await ctrl.listDocuments(req, res);

        expect(query).toHaveBeenCalledTimes(2);
        const listSql = query.mock.calls[0][0];
        expect(listSql).toMatch(/NOT\s+EXISTS/i);
        expect(listSql).toMatch(/has_file/i);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                data: expect.any(Array),
            })
        );
    });

    it('include has_file e current_file_name nel SELECT', async () => {
        query
            .mockResolvedValueOnce({ recordset: [] })
            .mockResolvedValueOnce({ recordset: [{ total: 0 }] });

        const req = mockReq({ query: { page: 1, limit: 10 } });
        const res = mockRes();
        await ctrl.listDocuments(req, res);

        const listSql = query.mock.calls[0][0];
        expect(listSql).toMatch(/has_file/i);
        expect(listSql).toMatch(/current_file_name/i);
        expect(listSql).toMatch(/OUTER APPLY/i);
    });
});

describe('deleteDocument', () => {
    it('rifiuta eliminazione cartella di sistema', async () => {
        query.mockResolvedValueOnce({
            recordset: [{ id: 10, status: 'rilasciato', is_system_folder: 1, doc_type: 'folder' }],
        });

        const req = mockReq({ params: { id: '10' } });
        const res = mockRes();
        await ctrl.deleteDocument(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'SYSTEM_FOLDER_PROTECTED' })
        );
    });

    it('rifiuta eliminazione cartella non vuota', async () => {
        query
            .mockResolvedValueOnce({
                recordset: [{ id: 11, status: 'rilasciato', is_system_folder: 0, doc_type: 'folder' }],
            })
            .mockResolvedValueOnce({ recordset: [{ cnt: 2 }] });

        const req = mockReq({ params: { id: '11' } });
        const res = mockRes();
        await ctrl.deleteDocument(req, res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'FOLDER_NOT_EMPTY', children_count: 2 })
        );
    });

    it('consente eliminazione cartella custom vuota', async () => {
        query
            .mockResolvedValueOnce({
                recordset: [{ id: 12, status: 'rilasciato', is_system_folder: 0, doc_type: 'folder' }],
            })
            .mockResolvedValueOnce({ recordset: [{ cnt: 0 }] })
            .mockResolvedValueOnce({ recordset: [] });

        const req = mockReq({ params: { id: '12' } });
        const res = mockRes();
        await ctrl.deleteDocument(req, res);

        expect(query).toHaveBeenCalledTimes(3);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ success: true })
        );
    });
});

describe('getDocumentStats', () => {
    it('restituisce senza_file e rilasciati_senza_file', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                total: 10,
                vigenti: 8,
                senza_file: 3,
                rilasciati_senza_file: 2,
            }],
        });

        const req = mockReq();
        const res = mockRes();
        await ctrl.getDocumentStats(req, res);

        const statsSql = query.mock.calls[0][0];
        expect(statsSql).toMatch(/senza_file/i);
        expect(statsSql).toMatch(/rilasciati_senza_file/i);
        expect(statsSql).toMatch(/SELECT COUNT\(\*\)\s+FROM document_registry dr/i);
        expect(statsSql).not.toMatch(/SUM\(CASE[\s\S]*NOT EXISTS/i);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: expect.objectContaining({
                senza_file: 3,
                rilasciati_senza_file: 2,
            }),
        });
    });
});
