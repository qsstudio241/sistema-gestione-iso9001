/**
 * Test slice UAL-2 — userAudit.service (scrittura/lettura audit trail utenti)
 * Verifica: scrittura riuscita, action_type non valido (skip), lettura storico,
 * e la regola vincolante "il log fallisce ma non lancia mai eccezioni".
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { logUserAuditEvent, getUserAuditLog } = require('./userAudit.service');

afterEach(() => jest.clearAllMocks());

describe('logUserAuditEvent', () => {
    it('scrive un evento valido in user_audit_log', async () => {
        query.mockResolvedValueOnce({ recordset: [] });

        await logUserAuditEvent({
            organizationId: 1001,
            targetUserId: 42,
            actorUserId: 5,
            action: 'user_created',
            newValue: { email: 'a@b.it' },
        });

        expect(query).toHaveBeenCalledTimes(1);
        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain('INSERT INTO user_audit_log');
        expect(params).toEqual(expect.objectContaining({
            organization_id: 1001,
            target_user_id: 42,
            actor_user_id: 5,
            action_type: 'user_created',
        }));
        expect(JSON.parse(params.new_value)).toEqual({ email: 'a@b.it' });
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('salta silenziosamente un action_type non valido (nessuna query, nessun throw)', async () => {
        await expect(logUserAuditEvent({
            organizationId: 1001,
            targetUserId: 42,
            action: 'azione_inventata',
        })).resolves.toBeUndefined();

        expect(query).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    it('salta silenziosamente se mancano organizationId o targetUserId', async () => {
        await expect(logUserAuditEvent({ action: 'user_created' })).resolves.toBeUndefined();
        expect(query).not.toHaveBeenCalled();
    });

    it('REGOLA VINCOLANTE: se la scrittura DB fallisce, non lancia mai un\'eccezione (log applicativo dell\'errore)', async () => {
        query.mockRejectedValueOnce(new Error('DB down'));

        await expect(logUserAuditEvent({
            organizationId: 1001,
            targetUserId: 42,
            actorUserId: 5,
            action: 'deactivated',
        })).resolves.toBeUndefined();

        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('Scrittura log fallita'),
            expect.objectContaining({ error: 'DB down' }),
        );
    });
});

describe('getUserAuditLog', () => {
    it('legge lo storico ordinato cronologicamente inverso', async () => {
        const rows = [
            { id: 2, action_type: 'deactivated', created_at: '2026-07-23T10:00:00Z' },
            { id: 1, action_type: 'user_created', created_at: '2026-07-01T10:00:00Z' },
        ];
        query.mockResolvedValueOnce({ recordset: rows });

        const result = await getUserAuditLog(42, 1001, 50);

        expect(result).toEqual(rows);
        const [sql, params] = query.mock.calls[0];
        expect(sql).toContain('ORDER BY ual.created_at DESC');
        expect(params).toEqual(expect.objectContaining({ target_user_id: 42, organization_id: 1001, limit: 50 }));
    });

    it('applica un limite massimo di 200 anche se richiesto un valore più alto', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        await getUserAuditLog(42, 1001, 9999);
        const [, params] = query.mock.calls[0];
        expect(params.limit).toBe(200);
    });
});
