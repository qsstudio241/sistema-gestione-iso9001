/**
 * @jest-environment node
 *
 * IA-1 — mappa tipo → folder_code e resolveFolderByCode.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { query } = require('../config/database');
const {
    folderCodeForDocType,
    isNormaPlacementType,
    parentIdForExistingFolder,
    resolveFolderByCode,
    resolveExplicitFolder,
} = require('./documentTreeProvisioner.service');

describe('folderCodeForDocType', () => {
    it('mappa procedura / manuale / istruzione / norma', () => {
        expect(folderCodeForDocType('procedura')).toBe('1.2');
        expect(folderCodeForDocType('manuale')).toBe('1.1');
        expect(folderCodeForDocType('istruzione')).toBe('1.3');
        expect(folderCodeForDocType('modulo')).toBe('1.4');
        expect(folderCodeForDocType('norma')).toBe('2.3');
    });

    it('altro e tipi sconosciuti non hanno cartella automatica', () => {
        expect(folderCodeForDocType('altro')).toBeNull();
        expect(folderCodeForDocType('')).toBeNull();
        expect(folderCodeForDocType(null)).toBeNull();
    });

    it('capitolato e alias RFQ/ordine → cassetto 2.2', () => {
        expect(folderCodeForDocType('capitolato')).toBe('2.2');
        expect(folderCodeForDocType('rfq')).toBe('2.2');
        expect(folderCodeForDocType('ordine')).toBe('2.2');
    });
});

describe('isNormaPlacementType / parentIdForExistingFolder (IA-11)', () => {
    it('classifica norma o hint job norma', () => {
        expect(isNormaPlacementType('norma', null)).toBe(true);
        expect(isNormaPlacementType('altro', 'norma')).toBe(true);
        expect(isNormaPlacementType('NORMA', 'capitolato')).toBe(true);
        expect(isNormaPlacementType('capitolato', 'procedura')).toBe(false);
        expect(isNormaPlacementType(null, null)).toBe(false);
    });

    it('parent_id solo se la cartella 2.3 esiste', () => {
        expect(parentIdForExistingFolder({ id: 23, company_id: 8 })).toBe(23);
        expect(parentIdForExistingFolder(null)).toBeNull();
        expect(parentIdForExistingFolder({})).toBeNull();
        expect(parentIdForExistingFolder({ id: 0 })).toBeNull();
    });
});

describe('resolveFolderByCode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('trova la cartella azienda per folder_code', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 42, company_id: 8 }] });
        const folder = await resolveFolderByCode(1001, '1.2', 8);
        expect(folder).toEqual({ id: 42, company_id: 8 });
        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/folder_code = @folderCode/);
        expect(sql).toMatch(/company_id = @companyId/);
        expect(params).toEqual({ orgId: 1001, folderCode: '1.2', companyId: 8 });
    });

    it('senza company_id cerca solo cartelle senza azienda', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 7, company_id: null }] });
        const folder = await resolveFolderByCode(1001, '1.1', null);
        const [sql] = query.mock.calls[0];
        expect(sql).toMatch(/company_id IS NULL/);
        expect(folder).toEqual({ id: 7, company_id: null });
    });

    it('restituisce null se la cartella manca', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        await expect(resolveFolderByCode(1001, '1.2', 8)).resolves.toBeNull();
    });

    it('senza folderCode non interroga il DB', async () => {
        await expect(resolveFolderByCode(1001, '', 8)).resolves.toBeNull();
        expect(query).not.toHaveBeenCalled();
    });
});

describe('resolveExplicitFolder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('accetta solo cartelle della stessa org', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 15, company_id: 3 }] });
        const folder = await resolveExplicitFolder(1001, 15);
        expect(folder).toEqual({ id: 15, company_id: 3 });
        expect(query.mock.calls[0][0]).toMatch(/doc_type = 'folder'/);
    });

    it('id non numerico → null', async () => {
        await expect(resolveExplicitFolder(1001, 'x')).resolves.toBeNull();
        expect(query).not.toHaveBeenCalled();
    });
});
