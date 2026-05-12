/**
 * Migration 052 — tabella norm_requirements
 *
 * Prerequisito: file SQL deployato sul VPS in
 *   /var/www/sgq-backend/database/migrations/052_norm_requirements.sql
 *
 * Esecuzione sul VPS:
 *   scp -P 1122 -i $KEY backend/scripts/run-migration-052-vps.js spascarella@www.fr-busato.it:/tmp/
 *   ssh ... "cd /var/www/sgq-backend && node /tmp/run-migration-052-vps.js"
 */
'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const sqlPath = path.join('/var/www/sgq-backend', 'database', 'migrations', '052_norm_requirements.sql');

(async () => {
    console.log('Migration 052 — norm_requirements');
    console.log('Lettura SQL:', sqlPath);

    if (!fs.existsSync(sqlPath)) {
        console.error('ERRORE: file migration non trovato sul VPS:', sqlPath);
        process.exit(1);
    }

    const sqlText = fs.readFileSync(sqlPath, 'utf8');

    try {
        await query(sqlText);
        console.log('Batch SQL eseguito.');

        const verify = await query(`
            SELECT COUNT(*) AS cnt FROM sys.tables
            WHERE name = 'norm_requirements' AND schema_id = SCHEMA_ID('dbo')
        `);
        const cnt = verify.recordset[0]?.cnt ?? 0;
        if (Number(cnt) === 0) {
            console.error('ERRORE: tabella norm_requirements non trovata dopo migration');
            process.exit(1);
        }

        console.log('VERIFICA OK: tabella dbo.norm_requirements presente.');
        console.log('Migration 052 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 052:', e.message);
        process.exit(1);
    }
})();
