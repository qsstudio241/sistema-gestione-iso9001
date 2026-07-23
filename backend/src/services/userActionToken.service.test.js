/**
 * Test slice UAL-3 — userActionToken.service (token generici invito/reset)
 * Verifica: generazione/hash token, creazione con invalidazione dei precedenti,
 * verifica (valido/scaduto/usato/non trovato), consumo.
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));

const crypto = require('crypto');
const { query } = require('../config/database');
const {
    generateRawToken,
    hashToken,
    createToken,
    verifyToken,
    consumeToken,
    invalidateUserTokens,
    TOKEN_TTL_HOURS,
} = require('./userActionToken.service');

afterEach(() => jest.clearAllMocks());

describe('generateRawToken / hashToken', () => {
    it('genera un token esadecimale di 64 caratteri (256 bit)', () => {
        const raw = generateRawToken();
        expect(raw).toMatch(/^[0-9a-f]{64}$/);
    });

    it('hashToken è deterministico (sha256)', () => {
        const raw = 'abc123';
        const expected = crypto.createHash('sha256').update(raw).digest('hex');
        expect(hashToken(raw)).toBe(expected);
    });
});

describe('createToken', () => {
    it('invalida i token invito precedenti non usati e ne crea uno nuovo', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // invalidateUserTokens (UPDATE)
        query.mockResolvedValueOnce({ recordset: [{ id: 42 }] }); // INSERT

        const result = await createToken({ userId: 1, organizationId: 1001, tokenType: 'invite', createdBy: 5 });

        expect(query).toHaveBeenCalledTimes(2);
        expect(query.mock.calls[0][0]).toContain('UPDATE user_action_tokens');
        expect(query.mock.calls[1][0]).toContain('INSERT INTO user_action_tokens');
        expect(query.mock.calls[1][1]).toEqual(expect.objectContaining({
            user_id: 1, organization_id: 1001, token_type: 'invite', created_by: 5,
        }));
        expect(result.rawToken).toMatch(/^[0-9a-f]{64}$/);
        expect(result.tokenId).toBe(42);
        expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('usa il TTL corretto per tipo (invite=72h)', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [{ id: 1 }] });
        const before = Date.now();

        const result = await createToken({ userId: 1, organizationId: 1001, tokenType: 'invite' });

        const expectedMs = before + TOKEN_TTL_HOURS.invite * 60 * 60 * 1000;
        expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMs - 5000);
        expect(result.expiresAt.getTime()).toBeLessThanOrEqual(expectedMs + 5000);
    });

    it('rifiuta un token_type non valido senza toccare il DB', async () => {
        await expect(createToken({ userId: 1, organizationId: 1001, tokenType: 'bogus' }))
            .rejects.toThrow(/token_type non valido/);
        expect(query).not.toHaveBeenCalled();
    });

    it('rifiuta se userId o organizationId mancano', async () => {
        await expect(createToken({ organizationId: 1001, tokenType: 'invite' }))
            .rejects.toThrow(/obbligatori/);
        expect(query).not.toHaveBeenCalled();
    });
});

describe('invalidateUserTokens', () => {
    it('marca come usati i token non consumati del tipo indicato', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        await invalidateUserTokens(7, 'reset');
        expect(query.mock.calls[0][0]).toContain('used_at = SYSUTCDATETIME()');
        expect(query.mock.calls[0][1]).toEqual({ user_id: 7, token_type: 'reset' });
    });
});

describe('verifyToken', () => {
    it('ritorna invalid TOKEN_MISSING se il token è vuoto', async () => {
        const result = await verifyToken('', 'invite');
        expect(result).toEqual({ valid: false, reason: 'TOKEN_MISSING' });
        expect(query).not.toHaveBeenCalled();
    });

    it('ritorna invalid TOKEN_NOT_FOUND se non esiste nessuna riga', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const result = await verifyToken('sometoken', 'invite');
        expect(result).toEqual({ valid: false, reason: 'TOKEN_NOT_FOUND' });
    });

    it('ritorna invalid TOKEN_ALREADY_USED se used_at è valorizzato', async () => {
        query.mockResolvedValueOnce({
            recordset: [{ id: 1, user_id: 1, organization_id: 1001, expires_at: new Date(Date.now() + 1000000), used_at: new Date() }],
        });
        const result = await verifyToken('sometoken', 'invite');
        expect(result).toEqual({ valid: false, reason: 'TOKEN_ALREADY_USED' });
    });

    it('ritorna invalid TOKEN_EXPIRED se expires_at è nel passato', async () => {
        query.mockResolvedValueOnce({
            recordset: [{ id: 1, user_id: 1, organization_id: 1001, expires_at: new Date(Date.now() - 1000), used_at: null }],
        });
        const result = await verifyToken('sometoken', 'invite');
        expect(result).toEqual({ valid: false, reason: 'TOKEN_EXPIRED' });
    });

    it('ritorna valid true con la riga per un token corretto', async () => {
        const row = { id: 9, user_id: 3, organization_id: 1001, expires_at: new Date(Date.now() + 100000), used_at: null };
        query.mockResolvedValueOnce({ recordset: [row] });
        const result = await verifyToken('sometoken', 'invite');
        expect(result).toEqual({ valid: true, row });
    });
});

describe('consumeToken', () => {
    it('aggiorna used_at per il token indicato', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        await consumeToken(9);
        expect(query.mock.calls[0][0]).toContain('UPDATE user_action_tokens SET used_at = SYSUTCDATETIME()');
        expect(query.mock.calls[0][1]).toEqual({ id: 9 });
    });
});
