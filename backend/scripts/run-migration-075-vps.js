'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { query } = require('/var/www/sgq-backend/src/config/database');

const STEPS = [
    `IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'handoff_ref'
    )
    BEGIN
        ALTER TABLE commercial_cases ADD handoff_ref NVARCHAR(100) NULL;
    END`,
    `IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'handoff_at'
    )
    BEGIN
        ALTER TABLE commercial_cases ADD handoff_at DATETIME2 NULL;
    END`,
    `IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'handoff_by'
    )
    BEGIN
        ALTER TABLE commercial_cases ADD handoff_by INT NULL;
    END`,
    `IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'handoff_notes'
    )
    BEGIN
        ALTER TABLE commercial_cases ADD handoff_notes NVARCHAR(500) NULL;
    END`,
];

(async () => {
    console.log('Migration 075 — commercial_cases handoff stub');
    try {
        for (let i = 0; i < STEPS.length; i++) {
            await query(STEPS[i]);
            console.log(`Step ${i + 1}/${STEPS.length} OK`);
        }
        const verify = await query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME IN ('handoff_ref','handoff_at','handoff_by')
        `);
        if (verify.recordset.length < 3) {
            console.error('ERRORE: colonne handoff incomplete');
            process.exit(1);
        }
        console.log('Migration 075 completata.', JSON.stringify(verify.recordset));
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 075:', e.message);
        process.exit(1);
    }
})();
