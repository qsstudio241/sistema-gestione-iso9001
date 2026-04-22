/**
 * Auth Controller - Autenticazione JWT con Multi-Tenant
 * 
 * Features:
 * - Register/Login con organization_id
 * - JWT payload: { user_id, organization_id, role, email }
 * - Password hash bcrypt (10 rounds)
 * - Refresh token per sessioni lunghe
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { getLicensedModuleKeysForOrg } = require('../services/moduleLicense.service');

// JWT_SECRET: fail-fast in produzione se mancante (vedi server.js).
// In sviluppo/test il fallback è accettabile; in produzione il server non si avvia senza il segreto.
const JWT_SECRET = process.env.JWT_SECRET || 'sgq-dev-only-secret-not-for-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

// Policy registrazione: 'open' (dev/test), 'superadmin_only' (prod default), 'disabled'
const REGISTER_POLICY = process.env.REGISTER_POLICY ||
    (process.env.NODE_ENV === 'production' ? 'superadmin_only' : 'open');

/**
 * POST /api/v1/auth/register
 * Registra nuovo utente in organizzazione
 */
async function register(req, res) {
    try {
        // Policy produzione: solo superadmin può registrare nuovi utenti.
        // In sviluppo/test (REGISTER_POLICY='open') il controllo viene saltato.
        if (REGISTER_POLICY !== 'open') {
            if (REGISTER_POLICY === 'disabled') {
                return res.status(403).json({
                    success: false,
                    error: 'Registrazione disabilitata su questo ambiente.'
                });
            }
            // 'superadmin_only': verifica Bearer token con ruolo superadmin
            const authHeader = req.headers.authorization || '';
            const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
            if (!token) {
                return res.status(403).json({
                    success: false,
                    error: 'Registrazione riservata ai superadmin: token di autenticazione mancante.'
                });
            }
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                if (decoded.role !== 'superadmin') {
                    return res.status(403).json({
                        success: false,
                        error: 'Registrazione riservata ai superadmin.'
                    });
                }
            } catch {
                return res.status(403).json({
                    success: false,
                    error: 'Registrazione riservata ai superadmin: token non valido.'
                });
            }
        }

        const { email, password, full_name, organization_id, role = 'auditor' } = req.body;

        // Validazione
        if (!email || !password || !full_name || !organization_id) {
            return res.status(400).json({
                success: false,
                error: 'Campi obbligatori: email, password, full_name, organization_id'
            });
        }

        // Verifica email unica per organizzazione
        const existing = await query(`
      SELECT user_id FROM users
      WHERE email = @email AND organization_id = @organization_id
    `, { email, organization_id });

        if (existing.recordset.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Email già registrata per questa organizzazione'
            });
        }

        // Verifica organizzazione attiva
        const orgCheck = await query(`
      SELECT organization_id FROM organizations
      WHERE organization_id = @organization_id AND is_active = 1
    `, { organization_id });

        if (orgCheck.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Organizzazione non trovata o non attiva'
            });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Crea utente
        const result = await query(`
      INSERT INTO users (email, password_hash, full_name, role, organization_id, is_active)
      VALUES (@email, @password_hash, @full_name, @role, @organization_id, 1);
      SELECT SCOPE_IDENTITY() AS user_id;
    `, { email, password_hash, full_name, role, organization_id });

        const user_id = result.recordset[0].user_id;

        // Genera token
        const token = generateToken({ user_id, email, role, organization_id });
        const refreshToken = generateRefreshToken({ user_id, organization_id });
        const licensed_modules = await getLicensedModuleKeysForOrg(organization_id);

        logger.info(`✅ Utente registrato: ${email} (org: ${organization_id})`);

        res.status(201).json({
            success: true,
            user: {
                user_id,
                email,
                full_name,
                role,
                organization_id,
                licensed_modules,
            },
            token,
            refreshToken
        });

    } catch (error) {
        logger.error('Errore registrazione:', error);
        res.status(500).json({
            success: false,
            error: 'Errore durante la registrazione'
        });
    }
}

/**
 * POST /api/v1/auth/login
 * Login con email/password
 */
async function login(req, res) {
    try {
        const { email, password, organization_id } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email e password obbligatori'
            });
        }

        // Query utente con organizzazione (include auditor_org_id per Fase 1 RBAC)
        let userQuery = `
      SELECT 
        u.user_id, u.email, u.password_hash, u.full_name, u.role, 
        u.organization_id, u.auditor_org_id, u.is_active,
        o.organization_code, o.organization_name,
        o.vat_number AS organization_vat_number,
        o.logo_url AS organization_logo_url,
        o.is_active AS org_active
      FROM users u
      INNER JOIN organizations o ON u.organization_id = o.organization_id
      WHERE u.email = @email
    `;

        const params = { email };

        // Se organization_id specificato, filtra anche per quello
        if (organization_id) {
            userQuery += ' AND u.organization_id = @organization_id';
            params.organization_id = organization_id;
        }

        const result = await query(userQuery, params);

        if (result.recordset.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Credenziali non valide'
            });
        }

        // Email ambigua: stessa email registrata in più organizzazioni e organization_id non specificato.
        // Restituire un errore esplicito invece di prendere il primo record in modo non deterministico.
        if (result.recordset.length > 1 && !organization_id) {
            return res.status(400).json({
                success: false,
                error: 'Email associata a più organizzazioni. Specificare organization_id nel corpo della richiesta.',
                requires_organization_id: true
            });
        }

        const user = result.recordset[0];

        // Verifica account attivo
        if (!user.is_active || !user.org_active) {
            return res.status(403).json({
                success: false,
                error: 'Account o organizzazione non attivi'
            });
        }

        // Verifica password
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                error: 'Credenziali non valide'
            });
        }

        // Aggiorna last_login
        await query(`
      UPDATE users SET last_login = GETDATE()
      WHERE user_id = @user_id
    `, { user_id: user.user_id });

        // Genera token (include auditor_org_id per RBAC Fase 1)
        const token = generateToken({
            user_id: user.user_id,
            email: user.email,
            role: user.role,
            organization_id: user.organization_id,
            auditor_org_id: user.auditor_org_id ?? null
        });

        const refreshToken = generateRefreshToken({
            user_id: user.user_id,
            organization_id: user.organization_id
        });

        const allowed_standard_ids = await getAllowedStandardIds(user.user_id);
        const licensed_modules = await getLicensedModuleKeysForOrg(user.organization_id);

        logger.info(`✅ Login: ${user.email} (org: ${user.organization_name})`);

        res.json({
            success: true,
            user: {
                user_id: user.user_id,
                email: user.email,
                full_name: user.full_name,
                role: user.role,
                organization_id: user.organization_id,
                organization_name: user.organization_name,
                organization_vat_number: user.organization_vat_number || '',
                organization_logo_url: user.organization_logo_url || null,
                auditor_org_id: user.auditor_org_id ?? null,
                allowed_standard_ids,
                licensed_modules,
            },
            token,
            refreshToken
        });

    } catch (error) {
        logger.error('Errore login:', error);
        res.status(500).json({
            success: false,
            error: 'Errore durante il login'
        });
    }
}

/**
 * POST /api/v1/auth/refresh
 * Rinnova token JWT con refresh token
 */
async function refreshToken(req, res) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                error: 'Refresh token obbligatorio'
            });
        }

        // Verifica refresh token
        const decoded = jwt.verify(refreshToken, JWT_SECRET);

        // Ottieni dati utente aggiornati (include auditor_org_id)
        const result = await query(`
      SELECT user_id, email, role, organization_id, auditor_org_id, is_active
      FROM users
      WHERE user_id = @user_id
    `, { user_id: decoded.user_id });

        if (result.recordset.length === 0 || !result.recordset[0].is_active) {
            return res.status(401).json({
                success: false,
                error: 'Utente non valido o non attivo'
            });
        }

        const user = result.recordset[0];

        // Genera nuovo token
        const newToken = generateToken({
            user_id: user.user_id,
            email: user.email,
            role: user.role,
            organization_id: user.organization_id,
            auditor_org_id: user.auditor_org_id ?? null
        });

        res.json({
            success: true,
            token: newToken
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Refresh token non valido o scaduto'
            });
        }

        logger.error('Errore refresh token:', error);
        res.status(500).json({
            success: false,
            error: 'Errore durante il refresh del token'
        });
    }
}

/**
 * Recupera gli standard_id consentiti per un utente (tabella user_standards).
 * Se non ci sono righe → null (tutti gli standard consentiti, retrocompatibilità).
 */
async function getAllowedStandardIds(userId) {
    try {
        const r = await query(`
            SELECT standard_id FROM user_standards WHERE user_id = @user_id ORDER BY standard_id
        `, { user_id: userId });
        const ids = (r.recordset || []).map(row => row.standard_id);
        return ids.length > 0 ? ids : null;
    } catch (_) {
        return null; // tabella inesistente o errore → tutti consentiti
    }
}

/**
 * GET /api/v1/auth/me
 * Ottieni dati utente corrente (richiede auth)
 * Include allowed_standard_ids: se null/assente = tutti gli standard; altrimenti array di standard_id consentiti.
 */
async function getCurrentUser(req, res) {
    try {
        const userId = req.user.user_id;

        const result = await query(`
      SELECT 
        u.user_id, u.email, u.full_name, u.role, 
        u.organization_id, u.auditor_org_id, u.created_at, u.last_login,
        o.organization_code, o.organization_name,
        o.vat_number AS organization_vat_number,
        o.logo_url AS organization_logo_url
      FROM users u
      INNER JOIN organizations o ON u.organization_id = o.organization_id
      WHERE u.user_id = @user_id
    `, { user_id: userId });

        if (result.recordset.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Utente non trovato'
            });
        }

        const userRow = result.recordset[0];
        const allowed_standard_ids = await getAllowedStandardIds(userId);
        const licensed_modules = await getLicensedModuleKeysForOrg(userRow.organization_id);
        const user = { ...userRow, allowed_standard_ids, licensed_modules };

        res.json({
            success: true,
            user
        });

    } catch (error) {
        logger.error('Errore get current user:', error);
        res.status(500).json({
            success: false,
            error: 'Errore recupero dati utente'
        });
    }
}

/**
 * Helper: Genera JWT token
 */
function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    });
}

/**
 * Helper: Genera refresh token
 */
function generateRefreshToken(payload) {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN
    });
}

/**
 * POST /api/v1/auth/logout
 * No-op: JWT è stateless, il client rimuove il token.
 * Endpoint per compatibilità con il frontend.
 */
async function logout(req, res) {
    res.json({ success: true, message: 'Logout effettuato' });
}

module.exports = {
    register,
    login,
    logout,
    refreshToken,
    getCurrentUser,
    getAllowedStandardIds
};
