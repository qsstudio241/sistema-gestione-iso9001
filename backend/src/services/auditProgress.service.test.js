jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
}));

const { AUDIT_PROGRESS_SQL, updateAuditProgress, updateAuditProgressSafe } = require('./auditProgress.service');

describe('updateAuditProgress', () => {
    it('conta il catalogo attivo e non tocca colonne inesistenti', async () => {
        const calls = [];
        const queryFn = async (sql, params) => {
            calls.push({ sql, params });
        };
        await updateAuditProgress(35234, 1002, queryFn);
        expect(calls).toHaveLength(1);
        expect(calls[0].params).toEqual({ audit_id: 35234, organization_id: 1002 });
        expect(calls[0].sql).toMatch(/checklist_questions/);
        expect(calls[0].sql).toMatch(/cq\.is_active = 1/);
        expect(calls[0].sql).toMatch(/answered_questions/);
        expect(calls[0].sql).not.toMatch(/observations_count/);
        expect(calls[0].sql).not.toMatch(/opportunities_count/);
        expect(calls[0].sql).toMatch(/organization_id = @organization_id/);
    });

    it('riprova il conteggio se il database segnala un deadlock', async () => {
        let calls = 0;
        const queryFn = async () => {
            calls += 1;
            if (calls === 1) {
                const error = new Error('deadlock victim');
                error.number = 1205;
                throw error;
            }
        };
        await updateAuditProgressSafe(35234, 1002, queryFn);
        expect(calls).toBe(2);
    });

    it('il testo SQL è quello esportato', () => {
        expect(AUDIT_PROGRESS_SQL).toMatch(/completion_percentage/);
        expect(AUDIT_PROGRESS_SQL).toMatch(/audit_standards/);
    });
});
