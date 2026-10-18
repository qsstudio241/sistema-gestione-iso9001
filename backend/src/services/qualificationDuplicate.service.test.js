/**
 * @jest-environment node
 */

const {
    DUPLICATE_INDEX_NAME,
    DUPLICATE_QUALIFICATION_MESSAGE,
    findQualificationDuplicate,
    isQualificationDuplicateIndexError,
    poolDb,
} = require('./qualificationDuplicate.service');

describe('qualificationDuplicate.service', () => {
    describe('findQualificationDuplicate', () => {
        const base = { organizationId: 1, companyId: 2, certificateNumber: ' ZZ-1 ', qualificationType: 'Saldatore ISO 9606-1', personName: 'Mario Rossi' };

        it('senza certificato o azienda non interroga il DB', async () => {
            const db = { query: jest.fn() };
            expect(await findQualificationDuplicate(db, { ...base, certificateNumber: '  ' })).toBe(false);
            expect(await findQualificationDuplicate(db, { ...base, companyId: null })).toBe(false);
            expect(db.query).not.toHaveBeenCalled();
        });

        it('copre entrambi i criteri (tipo OR persona), esclude le revocate e rifila il certificato', async () => {
            const db = { query: jest.fn().mockResolvedValue({ recordset: [{ cnt: 1 }] }) };
            expect(await findQualificationDuplicate(db, base)).toBe(true);
            const [sql, params] = db.query.mock.calls[0];
            expect(sql).toMatch(/qualification_type = @qualType OR person_name = @personName/);
            expect(sql).toMatch(/status <> 'revocata'/);
            expect(params).toMatchObject({ orgId: 1, compId: 2, certNum: 'ZZ-1', qualType: 'Saldatore ISO 9606-1', personName: 'Mario Rossi', excludeId: null });
        });

        it('nessuna corrispondenza: false', async () => {
            const db = { query: jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] }) };
            expect(await findQualificationDuplicate(db, base)).toBe(false);
        });
    });

    describe('isQualificationDuplicateIndexError', () => {
        it('riconosce solo la violazione dell\'indice unico delle qualifiche', () => {
            const msg = `Cannot insert duplicate key row in object 'dbo.qualifications' with unique index '${DUPLICATE_INDEX_NAME}'. The duplicate key value is (1, 2, X, Y).`;
            expect(isQualificationDuplicateIndexError({ number: 2601, message: msg })).toBe(true);
            expect(isQualificationDuplicateIndexError({ number: 2627, message: msg })).toBe(true);
            expect(isQualificationDuplicateIndexError({ number: 2601, message: 'unique index IX_altro' })).toBe(false);
            expect(isQualificationDuplicateIndexError({ number: 547, message: msg })).toBe(false);
            expect(isQualificationDuplicateIndexError(null)).toBe(false);
        });

        it('il messaggio utente non espone indice, schema o dati', () => {
            expect(DUPLICATE_QUALIFICATION_MESSAGE).not.toMatch(/UX_|dbo\.|index|duplicate key/i);
        });
    });

    it('poolDb inoltra i parametri a request().input()', async () => {
        const request = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [] }) };
        await poolDb({ request: () => request }).query('SELECT 1', { a: 1, b: null });
        expect(request.input).toHaveBeenCalledWith('a', 1);
        expect(request.input).toHaveBeenCalledWith('b', null);
        expect(request.query).toHaveBeenCalledWith('SELECT 1');
    });
});
