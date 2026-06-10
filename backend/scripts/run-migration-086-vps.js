/**
 * Migration 086: Aggiunge certificate_original_url alla tabella qualifications
 * Eseguire su VPS: node /tmp/run-migration-086-vps.js
 */
'use strict';
const mssql = require('/var/www/sgq-backend/node_modules/mssql');

const DB_CONFIG = {
    server: '127.0.0.1',
    port: 11043,
    database: 'SGQ_ISO9001',
    user: 'pascarella',
    password: '#Gestione2025@',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000,
    },
};

async function run() {
    const pool = await mssql.connect(DB_CONFIG);
    const sql = `
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'certificate_original_url')
        BEGIN
            ALTER TABLE qualifications ADD certificate_original_url NVARCHAR(500) NULL;
            PRINT 'Colonna certificate_original_url aggiunta.';
        END
        ELSE
        BEGIN
            PRINT 'Colonna certificate_original_url gia presente.';
        END
    `;
    await pool.request().query(sql);
    console.log('[086] Migration completata OK');
    process.exit(0);
}

run().catch(err => {
    console.error('[086] ERRORE:', err.message);
    process.exit(1);
});
