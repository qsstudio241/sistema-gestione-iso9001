/**
 * Migration 091: colonne v1 saldatura/NDT su qualifications
 * Eseguire su VPS: node /tmp/run-migration-091-vps.js
 */
'use strict';
const fs   = require('fs');
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

const SQL_PATH = '/tmp/091_qualifications_v1_welding_ndt.sql';

async function run() {
    if (!fs.existsSync(SQL_PATH)) {
        throw new Error(`File SQL non trovato: ${SQL_PATH}`);
    }
    const SQL = fs.readFileSync(SQL_PATH, 'utf8');
    const batches = SQL.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);

    console.log('[091] Connecting to SQL Server...');
    const pool = await mssql.connect(DB_CONFIG);

    for (let i = 0; i < batches.length; i += 1) {
        console.log(`[091] Batch ${i + 1}/${batches.length}...`);
        await pool.request().query(batches[i]);
    }

    const verify = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'qualifications'
          AND COLUMN_NAME IN ('welding_process','material_group','position_range','ndt_method','ndt_level')
        ORDER BY COLUMN_NAME
    `);
    console.log('[091] Colonne verificate:', verify.recordset.map((r) => r.COLUMN_NAME).join(', '));

    console.log('[091] Migration completata OK');
    process.exit(0);
}

run().catch((err) => {
    console.error('[091] ERRORE FATALE:', err.message);
    process.exit(1);
});
