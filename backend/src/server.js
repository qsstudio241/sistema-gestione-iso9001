/**
 * Express Server - Backend API Sistema Gestione ISO 9001
 * Port: 10443 (HTTPS)
 */

require('dotenv').config();
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

const app = express();
const PORT = process.env.PORT || 10443;

// ==========================================
// MIDDLEWARE
// ==========================================

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Configurare in produzione
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Compression
app.use(compression());

// CORS
const corsOptions = {
    origin: process.env.CORS_ORIGIN.split(','),
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Audit-Lock-Token'],
    preflightContinue: false,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting (disabilitato per testing locale - riabilitare in produzione)
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 min
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000, // Aumentato per testing locale (era 100)
    message: 'Troppi request da questo IP, riprova più tardi',
    standardHeaders: true,
    legacyHeaders: false,
});
// app.use('/api/', limiter); // COMMENTATO per testing locale

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
app.get(`${API_BASE}/health`, healthCheckHandler); // Health check API
const responseController = require('./controllers/response.controller');
app.get(`${API_BASE}/response-options`, responseController.getResponseOptions);

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
app.use(API_BASE, complaintsRoutes);
app.use(API_BASE, suppliersRoutes);
app.use(`${API_BASE}/companies/:companyId/certification-findings`, certFindingsRoutes);

// Static files (uploads)
app.use('/uploads', express.static(process.env.UPLOAD_DIR || './uploads'));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint non trovato' });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Server Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Errore interno del server',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
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
