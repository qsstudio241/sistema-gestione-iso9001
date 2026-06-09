/**
 * Migration 086: Aggiunge certificate_original_url alla tabella qualifications
 * Eseguire su VPS: node /tmp/run-migration-086-vps.js
 */
'use strict';
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
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
