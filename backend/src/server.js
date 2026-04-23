/**
 * Express Server - Backend API Sistema Gestione ISO 9001
 * Port: 10443 (HTTPS)
 */

require('dotenv').config();

// Fail-fast: variabili d'ambiente critiche mancanti in produzione.
// Impedisce l'avvio con segreti di default o configurazione insicura.
if (process.env.NODE_ENV === 'production') {
    const DEV_JWT_SECRETS = [
        'sgq-iso9001-secret-change-in-production',
        'sgq-dev-only-secret-not-for-production',
    ];
    if (!process.env.JWT_SECRET || DEV_JWT_SECRETS.includes(process.env.JWT_SECRET)) {
        // eslint-disable-next-line no-console
        console.error('[FATAL] JWT_SECRET non configurato o usa un valore di default non sicuro. ' +
            'Impostare JWT_SECRET nel file .env di produzione (min 32 caratteri, casuale). ' +
            'Il server non si avvia.');
        process.exit(1);
    }
    if (!process.env.CORS_ORIGIN) {
        // eslint-disable-next-line no-console
        console.error('[FATAL] CORS_ORIGIN non configurato in produzione. Il server non si avvia.');
        process.exit(1);
    }
}

const express = require('express');
const https = require('https');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { closePool } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth.routes');
const auditRoutes = require('./routes/audit.routes');
const responseRoutes = require('./routes/response.routes');
const ncRoutes = require('./routes/nc.routes');
const attachmentRoutes = require('./routes/attachment.routes');
const checklistRoutes = require('./routes/checklist.routes');
const syncRoutes = require('./routes/sync.routes');
const standardRoutes = require('./routes/standard.routes');
const companyRoutes = require('./routes/company.routes');
const organizationRoutes = require('./routes/organization.routes');
const auditorOrgRoutes = require('./routes/auditorOrg.routes');
const certFindingsRoutes = require('./routes/certificationFindings.routes');
const adminRoutes = require('./routes/admin.routes');
const reportTemplateRoutes = require('./routes/reportTemplate.routes');
const customChecklistRoutes = require('./routes/customChecklist.routes');
const documentRoutes        = require('./routes/document.routes');
const alertRoutes           = require('./routes/alert.routes');
const notificationsRoutes   = require('./routes/notifications.routes');
const docfileRoutes         = require('./routes/docfile.routes');
const qualificationsRoutes  = require('./routes/qualifications.routes');
const risksRoutes           = require('./routes/risks.routes');
const complaintsRoutes      = require('./routes/complaints.routes');
const suppliersRoutes       = require('./routes/suppliers.routes');
const importJobsRoutes      = require('./routes/importJobs.routes');
const { apiRouter: webdavApiRoutes, webdavRouter } = require('./routes/webdav.routes');

const app = express();
const PORT = process.env.PORT || 10443;

// Trust proxy: necessario quando Express è dietro Nginx/HAProxy sul VPS.
// Senza questa riga req.ip sarebbe sempre l'IP del proxy (127.0.0.1) e il
// rate limiter conterebbe TUTTI gli utenti nello stesso bucket → 429 falsi.
// '1' = un solo livello di proxy di fiducia (Nginx locale).
app.set('trust proxy', 1);

// ==========================================
// MIDDLEWARE
// ==========================================

// Security headers
app.use(helmet({
    // CSP: il server espone JSON API + static uploads (immagini/allegati).
    // Non serve una policy HTML; blocchiamo tutto tranne gli asset necessari.
    contentSecurityPolicy: {
        directives: {
            defaultSrc:      ["'none'"],
            imgSrc:          ["'self'", "data:", "blob:"],   // allegati immagine via /uploads
            mediaSrc:        ["'self'"],
            connectSrc:      ["'self'"],
            frameAncestors:  ["'none'"],                     // no clickjacking
            formAction:      ["'none'"],
            objectSrc:       ["'none'"],
            scriptSrc:       ["'none'"],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }, // necessario per immagini su frontend diverso
    hsts: {
        maxAge: 31536000,        // 1 anno
        includeSubDomains: true,
        preload: true,
    },
}));

// Compression
app.use(compression());

// CORS
const corsOptions = {
    origin: process.env.CORS_ORIGIN.split(','),
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'PROPFIND', 'LOCK', 'UNLOCK'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Audit-Lock-Token'],
    preflightContinue: false,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting — tiered per tipo di endpoint
// Valori configurabili da env; default conservativi per produzione.
// Per disabilitare in sviluppo locale: RATE_LIMIT_DISABLED=true nel .env
const rateLimitDisabled = process.env.RATE_LIMIT_DISABLED === 'true';

// Auth: anti brute-force (login/register) — stretto
const authLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS)  || 15 * 60 * 1000, // 15 min
    max:      parseInt(process.env.RATE_LIMIT_AUTH_MAX)        || 20,
    message:  { error: 'Troppi tentativi di accesso. Riprova tra 15 minuti.', code: 'RATE_LIMIT_AUTH' },
    standardHeaders: true,
    legacyHeaders:   false,
    skip: () => rateLimitDisabled,
});

// API generale — moderato
// keyGenerator: usa l'ID utente JWT (se già autenticato) oppure l'IP reale.
// Così ogni utente ha il suo budget separato anche condividendo lo stesso IP
// (uffici/NAT) e il bucket non è mai condiviso tra tutti come accadrebbe
// usando solo req.ip senza trust proxy configurato.
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS)       || 15 * 60 * 1000, // 15 min
    max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)    || 500,
    message:  { error: 'Troppe richieste. Riprova tra qualche minuto.', code: 'RATE_LIMIT_API' },
    standardHeaders: true,
    legacyHeaders:   false,
    skip: () => rateLimitDisabled,
    keyGenerator: (req) => {
        // JWT non ancora verificato qui (middleware auth viene dopo), ma se il
        // token è presente in Authorization proviamo a leggere il sub in chiaro.
        // In caso di token assente/malformato cade sull'IP reale.
        try {
            const auth = req.headers.authorization || '';
            if (auth.startsWith('Bearer ')) {
                const payload = JSON.parse(
                    Buffer.from(auth.split('.')[1], 'base64url').toString('utf8')
                );
                if (payload.id || payload.sub) return `user:${payload.id || payload.sub}`;
            }
        } catch (_) { /* token assente o malformato: fallback su IP */ }
        return req.ip;
    },
});

if (rateLimitDisabled) {
    logger.warn('[RateLimit] Rate limiting DISABILITATO (RATE_LIMIT_DISABLED=true). Solo per sviluppo locale.');
}

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
});

// ==========================================
// ROUTES
// ==========================================

app.get('/', (req, res) => {
    res.json({
        name: 'SGQ ISO 9001 API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
    });
});

// Health check (root e API)
const healthCheckHandler = async (req, res) => {
    const { healthCheck } = require('./config/database');
    const dbHealth = await healthCheck();

    res.json({
        status: dbHealth.healthy ? 'healthy' : 'unhealthy',
        database: dbHealth,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
};

app.get('/health', healthCheckHandler);

// API routes
const API_BASE = process.env.API_BASE_PATH || '/api/v1';

// Endpoint pubblici (no auth) - DEVONO venire PRIMA delle altre routes
app.get(`${API_BASE}/health`, healthCheckHandler); // Health check API — escluso da rate limit
const responseController = require('./controllers/response.controller');
app.get(`${API_BASE}/response-options`, responseController.getResponseOptions);

// Rate limiting applicato prima delle route
app.use(`${API_BASE}/auth`, authLimiter);   // Stretto su login/register
app.use(API_BASE, apiLimiter);              // Moderato su tutto il resto

// Endpoint autenticati
app.use(API_BASE, authRoutes);
app.use(API_BASE, attachmentRoutes); // Prima degli altri: authenticateDownload accetta ?token=, i router successivi hanno router.use(authenticate) globale che bloccherebbe le richieste senza Bearer
app.use(API_BASE, auditRoutes);
app.use(API_BASE, responseRoutes);
app.use(API_BASE, ncRoutes);
app.use(API_BASE, checklistRoutes);
app.use(API_BASE, syncRoutes);
app.use(API_BASE, standardRoutes);
app.use(API_BASE, companyRoutes);
app.use(API_BASE, organizationRoutes);
app.use(API_BASE, auditorOrgRoutes);
app.use(API_BASE, adminRoutes);
app.use(API_BASE, reportTemplateRoutes);
app.use(API_BASE, customChecklistRoutes);
app.use(API_BASE, documentRoutes);
app.use(API_BASE, alertRoutes);
app.use(API_BASE, notificationsRoutes);
app.use(API_BASE, docfileRoutes);
app.use(API_BASE, qualificationsRoutes);
app.use(API_BASE, risksRoutes);
app.use(`${API_BASE}/complaints`, complaintsRoutes);
app.use(`${API_BASE}/suppliers`, suppliersRoutes);
app.use(API_BASE, importJobsRoutes);
app.use(`${API_BASE}/companies/:companyId/certification-findings`, certFindingsRoutes);
// Sprint 12-A: WebDAV — endpoint REST (genera link) + endpoint WebDAV (Office R/W)
app.use(API_BASE, webdavApiRoutes);
app.use('/webdav', webdavRouter); // /webdav/ non sotto /api/v1/: Office non usa prefisso API

// Static files (uploads)
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Endpoint non trovato' });
});

// Global error handler — risposta strutturata coerente su tutti gli endpoint.
// Campi fissi: code (machine-readable), message (human-readable).
// In development aggiunge stack trace; in production solo code+message.
app.use((err, req, res, _next) => {
    const status  = err.status || err.statusCode || 500;
    const code    = err.code   || (status === 400 ? 'BAD_REQUEST'
                                 : status === 401 ? 'UNAUTHORIZED'
                                 : status === 403 ? 'FORBIDDEN'
                                 : status === 404 ? 'NOT_FOUND'
                                 : status === 409 ? 'CONFLICT'
                                 : status === 422 ? 'UNPROCESSABLE'
                                 : status === 429 ? 'RATE_LIMITED'
                                 : 'INTERNAL_ERROR');
    const message = err.message || 'Errore interno del server';

    if (status >= 500) {
        logger.error(`[${code}] ${req.method} ${req.path} →`, err);
    } else {
        logger.warn(`[${code}] ${req.method} ${req.path} → ${message}`);
    }

    const body = { code, message };
    if (process.env.NODE_ENV === 'development') {
        body.stack = err.stack;
    }

    res.status(status).json(body);
});

// ==========================================
// SERVER STARTUP
// ==========================================

function startServer() {
    if (process.env.SSL_ENABLED === 'true') {
        // HTTPS Server
        const privateKey = fs.readFileSync(process.env.SSL_KEY_PATH, 'utf8');
        const certificate = fs.readFileSync(process.env.SSL_CERT_PATH, 'utf8');
        const credentials = { key: privateKey, cert: certificate };

        const httpsServer = https.createServer(credentials, app);
        httpsServer.listen(PORT, () => {
            logger.info(`🔒 HTTPS Server running on https://www.fr-busato.it:${PORT}`);
        });
    } else {
        // HTTP Server (development)
        app.listen(PORT, () => {
            logger.info(`🚀 HTTP Server running on http://localhost:${PORT}`);
        });
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing server...');
    await closePool();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing server...');
    await closePool();
    process.exit(0);
});

// Start
startServer();

// Avvia cron job alert scadenze (dopo startup server)
const { startAlertScheduler } = require('./services/alertScheduler');
startAlertScheduler();

module.exports = app;
