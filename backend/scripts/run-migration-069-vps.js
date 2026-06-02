/**
 * Migration 069 — CHK_attachments_parent include commercial_case_id
 */
'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const sqlPath = path.join('/var/www/sgq-backend', 'database', 'migrations', '069_attachments_commercial_parent_check.sql');
const FALLBACK_SQL = '/tmp/069_attachments_commercial_parent_check.sql';

(async () => {
    console.log('Migration 069 — attachments commercial_case_id parent check');
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
            SELECT definition
            FROM sys.check_constraints
            WHERE name = 'CHK_attachments_parent'
              AND parent_object_id = OBJECT_ID('dbo.attachments')
        `);
        const def = verify.recordset[0]?.definition || '';
        if (!/commercial_case_id/i.test(def)) {
            console.error('ERRORE: CHK_attachments_parent non include commercial_case_id');
            process.exit(1);
        }
        console.log('VERIFICA OK: migration 069 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 069:', e.message);
        process.exit(1);
    }
})();
