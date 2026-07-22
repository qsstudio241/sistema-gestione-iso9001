'use strict';
const path = require('path');
// Usa database.json locale (gitignored) con credenziali produzione
process.env.NODE_ENV = 'production';
const dbConfig = require(path.join(__dirname, '../backend/config/database.json'));
const sql = require(path.join(__dirname, '../backend/node_modules/mssql'));

async function run() {
    const cfg = dbConfig.production || dbConfig;
    const pool = await sql.connect({
        server:   cfg.server,
        port:     cfg.port || 11043,
        database: cfg.database,
        user:     cfg.user || cfg.username,
        password: cfg.password,
        options: {
            encrypt:                   cfg.options?.encrypt              ?? false,
            trustServerCertificate:    cfg.options?.trustServerCertificate ?? true,
        },
    });

    const stmt = `
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'certificate_original_url')
        BEGIN
            ALTER TABLE qualifications ADD certificate_original_url NVARCHAR(500) NULL;
            PRINT 'certificate_original_url aggiunta.';
        END
        ELSE
            PRINT 'certificate_original_url gia presente.';
    `;
    const result = await pool.request().query(stmt);
    console.log('[086] Migration OK:', result.recordsets);
    await pool.close();
    process.exit(0);
}

run().catch(err => {
    console.error('[086] ERRORE:', err.message);
    process.exit(1);
});
