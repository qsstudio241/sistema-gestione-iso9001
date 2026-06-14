/**
 * Migration 092: arricchimento campi qualifica saldatore ISO 9606-1 su qualifications
 * Eseguire su VPS: node /tmp/run-migration-092-vps.js
 */
'use strict';
const fs    = require('fs');
const mssql = require('/var/www/sgq-backend/node_modules/mssql');

const DB_CONFIG = {
    server: '127.0.0.1',
    port: 11043,
    database: 'SGQ_ISO9001',
    user: 'pascarella',
    password: '#Gestione2025@',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 120000,
    },
};

const SQL_PATH = '/tmp/092_qualifications_saldatore_9606_enrich.sql';

const EXPECTED = [
    'thickness_min_mm', 'thickness_max_mm', 'pipe_diameter_min_mm', 'pipe_diameter_max_mm',
    'last_confirmation_date', 'next_confirmation_due', 'revalidation_date', 'exam_date',
    'product_type', 'weld_details', 'qualification_designation',
];

async function run() {
    if (!fs.existsSync(SQL_PATH)) {
        throw new Error(`File SQL non trovato: ${SQL_PATH}`);
    }
    const SQL = fs.readFileSync(SQL_PATH, 'utf8');
    const batches = SQL.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);

    console.log('[092] Connecting to SQL Server...');
    const pool = await mssql.connect(DB_CONFIG);

    for (let i = 0; i < batches.length; i += 1) {
        console.log(`[092] Batch ${i + 1}/${batches.length}...`);
        await pool.request().query(batches[i]);
    }

    const verify = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'qualifications'
          AND COLUMN_NAME IN ('${EXPECTED.join("','")}')
        ORDER BY COLUMN_NAME
    `);
    const found = verify.recordset.map((r) => r.COLUMN_NAME);
    console.log('[092] Colonne verificate:', found.join(', '));
    const missing = EXPECTED.filter((c) => !found.includes(c));
    if (missing.length) {
        throw new Error(`Colonne mancanti dopo migrazione: ${missing.join(', ')}`);
    }

    console.log('[092] Migration completata OK');
    process.exit(0);
}

run().catch((err) => {
    console.error('[092] ERRORE FATALE:', err.message);
    process.exit(1);
});
