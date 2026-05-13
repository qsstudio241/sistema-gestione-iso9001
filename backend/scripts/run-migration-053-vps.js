/**
 * Migration 053 — ai_interactions, norm_sources, norm_access_log
 * Sul VPS (path repo): node /tmp/run-migration-053-vps.js
 * Copiare anche database/migrations/053_ai_interactions.sql in deploy oppure usare file sotto /var/www/sgq-backend.
 */
const fs = require('fs');
const path = require('path');

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');

const DEFAULT_SQL = path.join('/var/www/sgq-backend', 'database/migrations/053_ai_interactions.sql');
const FALLBACK_SQL = '/tmp/053_ai_interactions.sql';

async function run() {
    const sqlPath = fs.existsSync(DEFAULT_SQL) ? DEFAULT_SQL : FALLBACK_SQL;
    if (!fs.existsSync(sqlPath)) {
        console.error('File SQL non trovato:', DEFAULT_SQL, 'né', FALLBACK_SQL);
        process.exit(1);
    }

    const sqlText = fs.readFileSync(sqlPath, 'utf8');
    console.log('Connessione al DB in corso...');
    console.log('Esecuzione migration 053 da', sqlPath);

    await query(sqlText);

    console.log('Migration 053 completata.');
    process.exit(0);
}

run().catch((err) => {
    console.error('ERRORE MIGRATION 053:', err.message);
    process.exit(1);
});
