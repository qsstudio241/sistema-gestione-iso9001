/**
 * L1 — resolveOptionalProjectId (ponte commessa opzionale ISO-6/ISO-7)
 */
const { resolveOptionalProjectId } = require('./resolveOptionalProjectId');

const query = jest.fn();

afterEach(() => jest.clearAllMocks());

describe('resolveOptionalProjectId', () => {
    it('skip se project_id assente', async () => {
        const r = await resolveOptionalProjectId(query, {
            organizationId: 1001, projectId: undefined, companyId: 7,
        });
        expect(r).toEqual({ skip: true });
        expect(query).not.toHaveBeenCalled();
    });

    it('null se stringa vuota', async () => {
        const r = await resolveOptionalProjectId(query, {
            organizationId: 1001, projectId: '', companyId: 7,
        });
        expect(r).toEqual({ value: null });
    });

    it('404 se commessa fuori organizzazione', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const r = await resolveOptionalProjectId(query, {
            organizationId: 1001, projectId: 12, companyId: 7,
        });
        expect(r).toMatchObject({ code: 'PROJECT_NOT_FOUND', status: 404 });
    });

    it('400 se la commessa è di un\'altra azienda', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 12, company_id: 99 }] });
        const r = await resolveOptionalProjectId(query, {
            organizationId: 1001, projectId: 12, companyId: 7,
        });
        expect(r).toMatchObject({ code: 'PROJECT_COMPANY_MISMATCH', status: 400 });
    });

    it('accetta la commessa della stessa azienda', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 12, company_id: 7 }] });
        const r = await resolveOptionalProjectId(query, {
            organizationId: 1001, projectId: '12', companyId: 7,
        });
        expect(r).toEqual({ value: 12 });
    });
});
