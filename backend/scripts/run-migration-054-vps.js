/**
 * Migration 054 — commercial_cases, commercial_case_history, commercial_case_checklist
 *
 * Prerequisito: file SQL deployato sul VPS in
 *   /var/www/sgq-backend/database/migrations/054_commercial_cases.sql
 *
 * Esecuzione sul VPS:
 *   scp -P 1122 -i $KEY backend/scripts/run-migration-054-vps.js spascarella@www.fr-busato.it:/tmp/
 *   ssh ... "cd /var/www/sgq-backend && node /tmp/run-migration-054-vps.js"
 */
'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const sqlPath = path.join('/var/www/sgq-backend', 'database', 'migrations', '054_commercial_cases.sql');
const FALLBACK_SQL = '/tmp/054_commercial_cases.sql';

(async () => {
    console.log('Migration 054 — commercial_cases / history / checklist');
    const resolvedPath = fs.existsSync(sqlPath) ? sqlPath : FALLBACK_SQL;
    console.log('Lettura SQL:', resolvedPath);

    if (!fs.existsSync(resolvedPath)) {
        console.error('ERRORE: file migration non trovato:', sqlPath, 'né', FALLBACK_SQL);
        process.exit(1);
    }

    const sqlText = fs.readFileSync(resolvedPath, 'utf8');

    try {
        await query(sqlText);
        console.log('Batch SQL eseguito.');

        const verify = await query(`
            SELECT COUNT(*) AS cnt FROM sys.tables
            WHERE name IN ('commercial_cases', 'commercial_case_history', 'commercial_case_checklist')
              AND schema_id = SCHEMA_ID('dbo')
        `);
        const cnt = verify.recordset[0]?.cnt ?? 0;
        if (Number(cnt) !== 3) {
            console.error('ERRORE: attese 3 tabelle commercial_* dopo migration, trovate:', cnt);
            process.exit(1);
        }

        console.log('VERIFICA OK: tabelle commercial_cases / commercial_case_history / commercial_case_checklist presenti.');
        console.log('Migration 054 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 054:', e.message);
        process.exit(1);
    }
})();
