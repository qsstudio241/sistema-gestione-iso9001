/**
 * Migration 110 — Welding Book ISO 3834 (welding_books + equipment + welds)
 * Prerequisito consigliato: migration 104 (equipment_assets)
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');
const fs = require('fs');
const path = require('path');

async function run() {
    const sqlPath = path.join(__dirname, '..', 'database', 'migrations', '110_welding_books.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Esegue blocchi IF ... END separati
    const blocks = sql.split(/\nEND\s*\n/i).map((b) => b.trim()).filter((b) => b.length > 20);
    for (const block of blocks) {
        const stmt = block.endsWith('END') ? block : `${block}\nEND`;
        if (stmt.startsWith('--')) continue;
        try {
            await query(stmt);
            console.log('[110] OK block:', stmt.substring(0, 50).replace(/\s+/g, ' '));
        } catch (err) {
            console.error('[110] ERRORE:', err.message);
            throw err;
        }
    }
    console.log('[110] Migrazione Welding Book completata.');
    process.exit(0);
}

run().catch((err) => {
    console.error('[110] Fallita:', err.message);
    process.exit(1);
});
