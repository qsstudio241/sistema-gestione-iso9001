/**
 * Migration 070 — link bidirezionale import job ↔ caso Riesame (R3)
 * Uso: scp to VPS, then: node /tmp/run-migration-070-import-job-case-link-vps.js
 */
'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const sqlPath = path.join(
    '/var/www/sgq-backend',
    'database',
    'migrations',
    '070_import_job_case_link.sql',
);
const FALLBACK_SQL = '/tmp/070_import_job_case_link.sql';

(async () => {
    console.log('Migration 070 — import job ↔ caso Riesame link');
    const resolvedPath = fs.existsSync(sqlPath) ? sqlPath : FALLBACK_SQL;
    if (!fs.existsSync(resolvedPath)) {
        console.error('ERRORE: file migration non trovato');
        process.exit(1);
    }
    const sqlText = fs.readFileSync(resolvedPath, 'utf8');
    const batches = sqlText.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
    try {
        for (let i = 0; i < batches.length; i++) {
            console.log(`Batch ${i + 1}/${batches.length}...`);
            await query(batches[i]);
        }
        const verify = await query(`
            SELECT
              (SELECT COUNT(*) FROM sys.columns
               WHERE object_id = OBJECT_ID('dbo.commercial_cases') AND name = 'source_import_job_id') AS cc_col,
              (SELECT COUNT(*) FROM sys.columns
               WHERE object_id = OBJECT_ID('dbo.import_job_files') AND name = 'commercial_case_id') AS ijf_col
        `);
        const row = verify.recordset[0] || {};
        if (!row.cc_col || !row.ijf_col) {
            console.error('ERRORE: colonne migration 070 non presenti');
            process.exit(1);
        }
        console.log('VERIFICA OK: migration 070 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 070:', e.message);
        process.exit(1);
    }
})();
