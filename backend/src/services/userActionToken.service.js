'use strict';

/**
 * userActionToken.service — token ad uso singolo legati a un utente (migration 131).
 * Generico e riusabile: oggi 'invite' (UAL-3), in futuro anche 'reset' (password
 * dimenticata self-service, slice UAL-4) — stessa tabella, stessa logica.
 *
 * Il token in chiaro NON viene mai salvato: solo il suo hash SHA-256 (token_hash).
 * Il valore raw (64 caratteri hex, 256 bit di entropia) viene generato con
 * crypto.randomBytes e restituito una sola volta al chiamante (per l'email/URL).
 */
const crypto = require('crypto');
const { query } = require('../config/database');

const TOKEN_TTL_HOURS = {
    invite: 72,
    reset: 1,
};

const VALID_TOKEN_TYPES = new Set(Object.keys(TOKEN_TTL_HOURS));

function generateRawToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

/**
 * Invalida (marca come usati) tutti i token non ancora consumati di un certo tipo
 * per un utente. Usato prima di generarne uno nuovo, per evitare che più link
 * validi restino attivi contemporaneamente (es. invito rigenerato/reinviato).
 */
async function invalidateUserTokens(userId, tokenType) {
    await query(`
        UPDATE user_action_tokens
        SET used_at = SYSUTCDATETIME()
        WHERE user_id = @user_id AND token_type = @token_type AND used_at IS NULL
    `, { user_id: userId, token_type: tokenType });
}

/**
 * Crea un nuovo token per un utente. Invalida automaticamente eventuali token
 * dello stesso tipo non ancora usati (un solo link valido alla volta).
 * @returns {Promise<{ rawToken: string, expiresAt: Date, tokenId: number }>}
 */
async function createToken({ userId, organizationId, tokenType, createdBy = null, ttlHours }) {
    if (!VALID_TOKEN_TYPES.has(tokenType)) {
        throw new Error(`token_type non valido: ${tokenType}`);
    }
    if (!userId || !organizationId) {
        throw new Error('userId e organizationId sono obbligatori');
    }

    await invalidateUserTokens(userId, tokenType);

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);
    const hours = ttlHours || TOKEN_TTL_HOURS[tokenType];
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

    const result = await query(`
        INSERT INTO user_action_tokens (user_id, organization_id, token_hash, token_type, expires_at, created_by)
        OUTPUT INSERTED.id
        VALUES (@user_id, @organization_id, @token_hash, @token_type, @expires_at, @created_by)
    `, {
        user_id: userId,
        organization_id: organizationId,
        token_hash: tokenHash,
        token_type: tokenType,
        expires_at: expiresAt,
        created_by: createdBy,
    });

    return { rawToken, expiresAt, tokenId: result.recordset[0].id };
}

/**
 * Verifica un token ricevuto dall'utente (link email). Non lancia mai eccezioni
 * per token invalidi/scaduti: ritorna sempre { valid, reason }.
 * @returns {Promise<{ valid: boolean, reason?: string, row?: object }>}
 */
async function verifyToken(rawToken, tokenType) {
    if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
        return { valid: false, reason: 'TOKEN_MISSING' };
    }
    const tokenHash = hashToken(rawToken.trim());

    const result = await query(`
        SELECT id, user_id, organization_id, expires_at, used_at
        FROM user_action_tokens
        WHERE token_hash = @token_hash AND token_type = @token_type
    `, { token_hash: tokenHash, token_type: tokenType });

    const row = result.recordset[0];
    if (!row) {
        return { valid: false, reason: 'TOKEN_NOT_FOUND' };
    }
    if (row.used_at) {
        return { valid: false, reason: 'TOKEN_ALREADY_USED' };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
        return { valid: false, reason: 'TOKEN_EXPIRED' };
    }
    return { valid: true, row };
}

/** Marca un token come usato (consumo ad uso singolo). */
async function consumeToken(tokenId) {
    await query(`
        UPDATE user_action_tokens SET used_at = SYSUTCDATETIME() WHERE id = @id
    `, { id: tokenId });
}

module.exports = {
    TOKEN_TTL_HOURS,
    generateRawToken,
    hashToken,
    createToken,
    verifyToken,
    consumeToken,
    invalidateUserTokens,
};
