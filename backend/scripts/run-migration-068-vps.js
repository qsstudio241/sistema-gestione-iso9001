/**
 * Migration 068 — commercial_case extensions (clarifications, documents, attachments)
 */
'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const sqlPath = path.join('/var/www/sgq-backend', 'database', 'migrations', '068_commercial_case_extensions.sql');
const FALLBACK_SQL = '/tmp/068_commercial_case_extensions.sql';

(async () => {
    console.log('Migration 068 — commercial_case extensions');
    const resolvedPath = fs.existsSync(sqlPath) ? sqlPath : FALLBACK_SQL;
    if (!fs.existsSync(resolvedPath)) {
        console.error('ERRORE: file migration non trovato');
        process.exit(1);
    }
    const sqlText = fs.readFileSync(resolvedPath, 'utf8');
    try {
        await query(sqlText);
        const verify = await query(`
            SELECT COUNT(*) AS cnt FROM sys.tables
            WHERE name IN ('commercial_case_clarifications', 'commercial_case_documents')
              AND schema_id = SCHEMA_ID('dbo')
        `);
        if (Number(verify.recordset[0]?.cnt) !== 2) {
            console.error('ERRORE: tabelle attese non presenti');
            process.exit(1);
        }
        console.log('VERIFICA OK: migration 068 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 068:', e.message);
        process.exit(1);
    }
})();
