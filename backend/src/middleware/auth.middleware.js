/**
 * Auth Middleware
 * Verifica JWT e gestisce autorizzazioni
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// Fail-fast: il server NON deve avviarsi con un secret debole o assente.
// In sviluppo locale impostare JWT_SECRET nel .env (mai in chiaro nel repo).
const MIN_JWT_SECRET_LENGTH = 32;

if (!process.env.JWT_SECRET) {
    throw new Error(
        '[auth.middleware] JWT_SECRET non configurato. ' +
        'Impostare la variabile d\'ambiente JWT_SECRET (minimo 32 caratteri) prima di avviare il server.'
    );
}

if (process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    const msg =
        `[auth.middleware] JWT_SECRET troppo corto (${process.env.JWT_SECRET.length} car., minimo ${MIN_JWT_SECRET_LENGTH}). ` +
        'Usare un secret casuale robusto.';
    if (process.env.NODE_ENV === 'production') {
        throw new Error(msg);
    }
    logger.warn(msg + ' — tollerato solo in sviluppo locale.');
}

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware: Verifica JWT e autentica utente
 * 
 * Attacca a req.user i dati decodificati dal token:
 * - user_id
 * - email
 * - role
 * - organization_id
 */
function authenticate(req, res, next) {
    try {
        // Estrai token da header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            logger.warn('Auth: Token mancante', {
                ip: req.ip,
                path: req.path
            });

            return res.status(401).json({
                error: 'Token di autenticazione mancante',
                code: 'AUTH_TOKEN_MISSING'
            });
        }

        const token = authHeader.substring(7); // Rimuovi "Bearer "

        // Verifica token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Verifica campi obbligatori nel payload
        if (!decoded.user_id || !decoded.organization_id) {
            logger.error('Auth: Token malformato', { decoded });

            return res.status(401).json({
                error: 'Token non valido',
                code: 'AUTH_TOKEN_INVALID'
            });
        }

        // Attacca dati utente alla request (auditor_org_id per RBAC Fase 1)
        const rawRole = decoded.role || 'auditor';
        req.user = {
            user_id: decoded.user_id,
            email: decoded.email,
            role: String(rawRole).trim().toLowerCase(),
            organization_id: decoded.organization_id,
            auditor_org_id: decoded.auditor_org_id ?? null
        };

        logger.debug('Auth: Utente autenticato', {
            user_id: req.user.user_id,
            org_id: req.user.organization_id,
            path: req.path
        });

        next();

    } catch (error) {
        // Token scaduto
        if (error.name === 'TokenExpiredError') {
            logger.warn('Auth: Token scaduto', {
                expiredAt: error.expiredAt,
                ip: req.ip
            });

            return res.status(401).json({
                error: 'Token scaduto',
                code: 'AUTH_TOKEN_EXPIRED',
                expiredAt: error.expiredAt
            });
        }

        // Token non valido
        if (error.name === 'JsonWebTokenError') {
            logger.warn('Auth: Token non valido', {
                message: error.message,
                ip: req.ip
            });

            return res.status(401).json({
                error: 'Token non valido',
                code: 'AUTH_TOKEN_INVALID'
            });
        }

        // Errore generico
        logger.error('Auth: Errore verifica token', {
            error: error.message,
            stack: error.stack
        });

        return res.status(500).json({
            error: 'Errore durante autenticazione',
            code: 'AUTH_ERROR'
        });
    }
}

/**
 * Middleware: Verifica ruolo utente
 * 
 * @param {string[]} allowedRoles - Ruoli autorizzati (es. ['admin', 'auditor'])
 * @returns {Function} Express middleware
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        // authenticate deve essere chiamato prima
        if (!req.user) {
            logger.error('Authorize: req.user non presente (authenticate non chiamato?)');

            return res.status(500).json({
                error: 'Errore configurazione middleware',
                code: 'MIDDLEWARE_ERROR'
            });
        }

        const userRole = req.user.role;

        // superadmin ha accesso a qualsiasi route senza dover essere elencato esplicitamente
        if (userRole === 'superadmin') return next();

        // Verifica ruolo
        if (!allowedRoles.includes(userRole)) {
            logger.warn('Authorize: Accesso negato', {
                user_id: req.user.user_id,
                userRole,
                allowedRoles,
                path: req.path
            });

            return res.status(403).json({
                error: 'Accesso negato: ruolo insufficiente',
                code: 'AUTH_FORBIDDEN',
                requiredRoles: allowedRoles
            });
        }

        logger.debug('Authorize: Accesso consentito', {
            user_id: req.user.user_id,
            role: userRole,
            path: req.path
        });

        next();
    };
}

/**
 * Middleware: Verifica che l'utente appartenga all'organizzazione richiesta
 * 
 * Utile per endpoint con :organization_id in URL
 */
function verifyOrganization(req, res, next) {
    const urlOrgId = parseInt(req.params.organization_id, 10);
    const userOrgId = req.user.organization_id;

    // Admin possono accedere a tutte le organizzazioni
    if (req.user.role === 'admin') {
        return next();
    }

    // Verifica corrispondenza
    if (urlOrgId !== userOrgId) {
        logger.warn('VerifyOrg: Tentativo accesso altra organizzazione', {
            user_id: req.user.user_id,
            userOrgId,
            requestedOrgId: urlOrgId,
            path: req.path
        });

        return res.status(403).json({
            error: 'Accesso negato: organizzazione diversa',
            code: 'AUTH_ORGANIZATION_MISMATCH'
        });
    }

    next();
}

/**
 * Middleware: Autenticazione per endpoint download/view
 *
 * Accetta token da:
 * 1. Header Authorization: Bearer <token>  (chiamate API standard)
 * 2. Query param ?token=<token>            (browser apre URL direttamente: <img src>, <a href>)
 *
 * SOLO per endpoint read-only (download, view). Non usare su endpoint mutating.
 */
function authenticateDownload(req, res, next) {
    // Prova header prima (priorità), poi query param come fallback
    const authHeader = req.headers.authorization;

    // req.query.token può essere vuoto se il query parser non è attivo sul router;
    // come fallback si legge il token direttamente da req.url
    let queryToken = req.query.token;
    if (!queryToken) {
        const urlMatch = (req.url || '').match(/[?&]token=([^&]+)/);
        if (urlMatch) queryToken = decodeURIComponent(urlMatch[1]);
    }

    if (!authHeader && !queryToken) {
        return res.status(401).json({
            error: 'Token di autenticazione mancante',
            code: 'AUTH_TOKEN_MISSING'
        });
    }

    // Estrai token da header o query
    let token;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else if (queryToken) {
        token = queryToken;
    } else {
        return res.status(401).json({
            error: 'Token non valido',
            code: 'AUTH_TOKEN_MISSING'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (!decoded.user_id || !decoded.organization_id) {
            return res.status(401).json({
                error: 'Token non valido',
                code: 'AUTH_TOKEN_INVALID'
            });
        }

        const rawRole2 = decoded.role || 'auditor';
        req.user = {
            user_id: decoded.user_id,
            email: decoded.email,
            role: String(rawRole2).trim().toLowerCase(),
            organization_id: decoded.organization_id,
            auditor_org_id: decoded.auditor_org_id ?? null
        };

        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token scaduto',
                code: 'AUTH_TOKEN_EXPIRED'
            });
        }
        return res.status(401).json({
            error: 'Token non valido',
            code: 'AUTH_TOKEN_INVALID'
        });
    }
}

/**
 * Middleware: Verifica che l'utente abbia accesso all'auditor_org (Fase 1 RBAC)
 * - Superadmin (admin senza auditor_org_id): accesso a tutti
 * - Auditor: solo al proprio auditor_org_id
 * - Se auditor_org_id richiesto ma utente non ce l'ha: 403
 */
function requireAuditorOrgOrSuperadmin(req, res, next) {
    if (!req.user) {
        return res.status(500).json({ error: 'Errore middleware', code: 'MIDDLEWARE_ERROR' });
    }
    const requestedOrgId = parseInt(req.params.auditor_org_id || req.body.auditor_org_id || req.query.auditor_org_id, 10);
    const userOrgId = req.user.auditor_org_id;
    const isSuperadmin = req.user.role === 'admin' && !userOrgId;

    if (isSuperadmin) return next();
    if (!userOrgId) {
        return res.status(403).json({
            error: 'Accesso negato: risorsa richiede auditor_org',
            code: 'AUTH_AUDITOR_ORG_REQUIRED'
        });
    }
    if (requestedOrgId && requestedOrgId !== userOrgId) {
        return res.status(403).json({
            error: 'Accesso negato: auditor_org diverso',
            code: 'AUTH_AUDITOR_ORG_MISMATCH'
        });
    }
    next();
}

module.exports = {
    authenticate,
    authenticateDownload,
    authorize,
    verifyOrganization,
    requireAuditorOrgOrSuperadmin
};
