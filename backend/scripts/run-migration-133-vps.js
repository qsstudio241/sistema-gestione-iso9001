/**
 * Migration 133 — WPQR: campi copertura (pag.1 RANGE OF QUALIFICATION)
 *                 + parametri prova (pag.2) — DEPUTYTASK1 25/07/2026
 * Aggiunge SOLO colonne mancanti a wpqr_records (idempotente, tutte NULLABLE).
 *
 * Uso (solo su VPS, via SSH — vedi backend/scripts/run-on-vps.ps1):
 *   node /tmp/run-migration-133-vps.js
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const NEW_COLUMNS = [
    { name: 'qualification_level', type: 'NVARCHAR(10)' },
    { name: 'joint_type', type: 'NVARCHAR(50)' },
    { name: 'standard_reference', type: 'NVARCHAR(100)' },
    { name: 'wps_ref', type: 'NVARCHAR(100)' },
    { name: 'base_material_spec', type: 'NVARCHAR(100)' },
    { name: 'shielding_gas', type: 'NVARCHAR(100)' },
    { name: 'current_type', type: 'NVARCHAR(40)' },
    { name: 'metal_transfer', type: 'NVARCHAR(80)' },
    { name: 'mechanization', type: 'NVARCHAR(40)' },
    { name: 'single_multi_run', type: 'NVARCHAR(20)' },
    { name: 'heat_input_note', type: 'NVARCHAR(200)' },
];

async function run() {
    const pool = await getPool();
    try {
        for (const col of NEW_COLUMNS) {
            const sql = `
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='${col.name}')
BEGIN
    ALTER TABLE wpqr_records ADD ${col.name} ${col.type};
    PRINT 'Colonna ${col.name} aggiunta.';
END
ELSE PRINT 'Colonna ${col.name} gia esistente — skip.';
`;
            console.log(`[133] Eseguo: wpqr_records.${col.name}`);
            await pool.request().query(sql);
        }

        const verify = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'wpqr_records'
              AND COLUMN_NAME IN (${NEW_COLUMNS.map((c) => `'${c.name}'`).join(', ')})
            ORDER BY COLUMN_NAME
        `);
        console.log('[133] Colonne verificate:', verify.recordset);
        console.log('[133] Migration WPQR coverage completata.');
    } catch (e) {
        console.error('[133] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}

run();
