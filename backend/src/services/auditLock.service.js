/**
 * Servizio lock pessimistico su audit (TTL + token opaco).
 * Best practice: un lock per audit; heartbeat rinnova expires_at.
 */

const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { studioScopeClause } = require('./auditListRbac.service');

const TTL_MINUTES = parseInt(process.env.AUDIT_LOCK_TTL_MINUTES || '15', 10);

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function ttlDate() {
    return new Date(Date.now() + TTL_MINUTES * 60 * 1000);
}

/**
 * Pulisce lock scaduti (best-effort, chiamata frequente).
 */
async function purgeExpiredLocks() {
    try {
        await query(`DELETE FROM audit_locks WHERE expires_at < SYSUTCDATETIME()`);
    } catch (e) {
        logger.warn('[AUDIT_LOCK] purgeExpiredLocks:', e.message);
    }
}

/**
 * Risolve audit_id da riferimento (INT o UUID) con RBAC come listAudits/getAudit.
 * @returns {Promise<{ audit_id: number, audit_uuid: string } | null>}
 */
async function resolveAuditForUser(reqUser, auditRef) {
    const { organization_id } = reqUser;
    const ref = auditRef != null ? String(auditRef).trim() : '';

    if (!ref) return null;

    const scope = studioScopeClause(reqUser, 'a');
    const rbacSql = scope.clause ? ` AND ${scope.clause}` : '';
    const params = { organization_id, audit_ref: ref, ...scope.params };

    const result = await query(`
        SELECT a.audit_id, CAST(a.audit_uuid AS NVARCHAR(36)) AS audit_uuid
        FROM audits a
        WHERE a.organization_id = @organization_id
          AND a.is_deleted = 0
          AND (
            (TRY_CAST(@audit_ref AS INT) IS NOT NULL AND a.audit_id = TRY_CAST(@audit_ref AS INT))
            OR (TRY_CAST(@audit_ref AS UNIQUEIDENTIFIER) IS NOT NULL AND a.audit_uuid = TRY_CAST(@audit_ref AS UNIQUEIDENTIFIER))
          )
        ${rbacSql}
    `, params);

    if (!result.recordset?.length) return null;
    return result.recordset[0];
}

/**
 * Stato lock per UI (senza token).
 */
async function getLockStatus(reqUser, auditRef) {
    await purgeExpiredLocks();
    const audit = await resolveAuditForUser(reqUser, auditRef);
    if (!audit) {
        return { found: false, locked: false };
    }

    const row = await query(`
        SELECT l.user_id, l.expires_at, u.full_name AS holder_name, u.email AS holder_email
        FROM audit_locks l
        INNER JOIN users u ON u.user_id = l.user_id
        WHERE l.audit_id = @audit_id AND l.expires_at >= SYSUTCDATETIME()
    `, { audit_id: audit.audit_id });

    if (!row.recordset?.length) {
        return { found: true, audit_id: audit.audit_id, locked: false };
    }

    const r = row.recordset[0];
    return {
        found: true,
        audit_id: audit.audit_id,
        locked: true,
        holder_user_id: r.user_id,
        holder_name: r.holder_name || r.holder_email || `Utente #${r.user_id}`,
        expires_at: r.expires_at,
        is_holder: r.user_id === reqUser.user_id,
    };
}

/**
 * Acquisisce lock (o rinnova se stesso utente: nuovo token).
 */
async function acquireLock(reqUser, auditRef) {
    return acquireOrTakeover(reqUser, auditRef);
}

async function acquireOrTakeover(reqUser, auditRef) {
    await purgeExpiredLocks();
    const audit = await resolveAuditForUser(reqUser, auditRef);
    if (!audit) {
        return { ok: false, status: 404, code: 'AUDIT_NOT_FOUND', message: 'Audit non trovato' };
    }

    const existing = await query(`
        SELECT l.user_id, l.expires_at, u.full_name AS holder_name
        FROM audit_locks l
        INNER JOIN users u ON u.user_id = l.user_id
        WHERE l.audit_id = @audit_id
    `, { audit_id: audit.audit_id });

    const now = Date.now();
    if (existing.recordset?.length) {
        const row = existing.recordset[0];
        if (new Date(row.expires_at).getTime() > now) {
            if (row.user_id !== reqUser.user_id) {
                return {
                    ok: false,
                    status: 423,
                    code: 'AUDIT_LOCKED',
                    message: 'Audit in modifica da un altro utente',
                    locked_by_name: row.holder_name || `Utente #${row.user_id}`,
                };
            }
            await query(`DELETE FROM audit_locks WHERE audit_id = @audit_id`, { audit_id: audit.audit_id });
        }
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = ttlDate();

    await query(`
        INSERT INTO audit_locks (audit_id, user_id, lock_token_hash, expires_at)
        VALUES (@audit_id, @user_id, @hash, @expires_at)
    `, {
        audit_id: audit.audit_id,
        user_id: reqUser.user_id,
        hash: tokenHash,
        expires_at: expiresAt,
    });

    logger.info('[AUDIT_LOCK] acquired', { audit_id: audit.audit_id, user_id: reqUser.user_id });

    return {
        ok: true,
        lock_token: token,
        expires_at: expiresAt,
        audit_id: audit.audit_id,
        audit_uuid: audit.audit_uuid,
    };
}

/**
 * Rinnova TTL se token valido.
 */
async function renewLock(reqUser, auditRef, plainToken) {
    await purgeExpiredLocks();
    if (!plainToken) {
        return { ok: false, status: 423, code: 'AUDIT_LOCK_REQUIRED', message: 'Token lock mancante' };
    }

    const audit = await resolveAuditForUser(reqUser, auditRef);
    if (!audit) {
        return { ok: false, status: 404, code: 'AUDIT_NOT_FOUND', message: 'Audit non trovato' };
    }

    const tokenHash = hashToken(plainToken);
    const chk = await query(`
        SELECT lock_id FROM audit_locks
        WHERE audit_id = @audit_id
          AND user_id = @user_id
          AND lock_token_hash = @hash
          AND expires_at >= SYSUTCDATETIME()
    `, { audit_id: audit.audit_id, user_id: reqUser.user_id, hash: tokenHash });

    if (!chk.recordset?.length) {
        return { ok: false, status: 423, code: 'AUDIT_LOCK_INVALID', message: 'Lock scaduto o non valido' };
    }

    const expiresAt = ttlDate();
    await query(`UPDATE audit_locks SET expires_at = @expires_at WHERE audit_id = @audit_id`, {
        audit_id: audit.audit_id,
        expires_at: expiresAt,
    });

    return { ok: true, expires_at: expiresAt };
}

/**
 * Rilascia lock se token valido.
 */
async function releaseLock(reqUser, auditRef, plainToken) {
    await purgeExpiredLocks();
    const audit = await resolveAuditForUser(reqUser, auditRef);
    if (!audit || !plainToken) {
        return { ok: true, released: false };
    }

    const tokenHash = hashToken(plainToken);
    const existing = await query(`
        SELECT lock_id FROM audit_locks
        WHERE audit_id = @audit_id AND user_id = @user_id AND lock_token_hash = @hash
    `, { audit_id: audit.audit_id, user_id: reqUser.user_id, hash: tokenHash });
    const released = existing.recordset?.length > 0;
    if (released) {
        await query(`
            DELETE FROM audit_locks
            WHERE audit_id = @audit_id AND user_id = @user_id AND lock_token_hash = @hash
        `, { audit_id: audit.audit_id, user_id: reqUser.user_id, hash: tokenHash });
        logger.info('[AUDIT_LOCK] released', { audit_id: audit.audit_id, user_id: reqUser.user_id });
    }
    return { ok: true, released };
}

/**
 * Verifica scrittura: se esiste lock attivo, serve token valido del titolare.
 * Se non c'è lock, scrittura consentita (sync offline, compatibilità).
 */
async function assertWriteAllowed(reqUser, auditIdNumeric, lockTokenHeader) {
    await purgeExpiredLocks();
    const token = lockTokenHeader || null;

    const locks = await query(`
        SELECT l.user_id, l.lock_token_hash
        FROM audit_locks l
        WHERE l.audit_id = @audit_id AND l.expires_at >= SYSUTCDATETIME()
    `, { audit_id: auditIdNumeric });

    if (!locks.recordset?.length) {
        return { ok: true };
    }

    const row = locks.recordset[0];
    const holder = await query(`SELECT full_name, email FROM users WHERE user_id = @id`, { id: row.user_id });
    const holderName = holder.recordset?.[0]?.full_name || holder.recordset?.[0]?.email || `Utente #${row.user_id}`;

    const isSameUser = row.user_id === reqUser.user_id;

    if (!token) {
        // Distingui: lock di un ALTRO utente vs lock del PROPRIO utente (token perso dopo refresh).
        // Il messaggio "attendi il rilascio" è corretto solo se è un altro utente.
        if (isSameUser) {
            return {
                ok: false,
                status: 423,
                code: 'AUDIT_LOCK_REQUIRED',
                message: 'La tua sessione di lock è scaduta o non è stata riconosciuta. Riapri l\'audit per continuare a modificarlo.',
                locked_by_name: holderName,
            };
        }
        return {
            ok: false,
            status: 423,
            code: 'AUDIT_LOCK_REQUIRED',
            message: `Audit in uso da ${holderName}. Attendi che venga rilasciato il lock prima di procedere.`,
            locked_by_name: holderName,
        };
    }

    const hash = hashToken(token);
    if (hash !== row.lock_token_hash) {
        // Anche qui distingui: token sbagliato del proprietario vs token di un intruso.
        if (isSameUser) {
            return {
                ok: false,
                status: 423,
                code: 'AUDIT_LOCK_INVALID',
                message: 'La tua sessione di lock è scaduta. Riapri l\'audit per riacquisire il lock.',
                locked_by_name: holderName,
            };
        }
        return {
            ok: false,
            status: 423,
            code: 'AUDIT_LOCK_INVALID',
            message: `Audit bloccato da ${holderName}. Token non valido.`,
            locked_by_name: holderName,
        };
    }

    if (!isSameUser) {
        return {
            ok: false,
            status: 423,
            code: 'AUDIT_LOCKED',
            message: `Audit in modifica da ${holderName}. Attendi il rilascio.`,
            locked_by_name: holderName,
        };
    }

    return { ok: true };
}

function getLockTokenFromRequest(req) {
    const h = req.headers['x-audit-lock-token'];
    if (!h) return null;
    return String(h).trim() || null;
}

module.exports = {
    acquireLock,
    renewLock,
    releaseLock,
    getLockStatus,
    assertWriteAllowed,
    getLockTokenFromRequest,
    resolveAuditForUser,
    purgeExpiredLocks,
    TTL_MINUTES,
};
