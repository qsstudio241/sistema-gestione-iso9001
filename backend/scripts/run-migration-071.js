/**
 * run-migration-071.js — verification_responsible su non_conformities
 */
const sql = require('mssql');
const path = require('path');
const fs = require('fs');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const dbConfig = dbConfigAll.production || dbConfigAll;

const sqlPath = path.join(__dirname, '../../database/migrations/071_nc_verification_responsible.sql');
const SQL = fs.readFileSync(sqlPath, 'utf8');

async function runMigration() {
    console.log('Connessione al DB...');
    const pool = await sql.connect({
        server: dbConfig.server,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        options: {
            encrypt: dbConfig.options?.encrypt ?? true,
            trustServerCertificate: dbConfig.options?.trustServerCertificate ?? true,
        },
    });

    try {
        await pool.request().query(SQL);
        console.log('Migration 071 eseguita.');

        const check = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'verification_responsible'
        `);
        if (check.recordset.length === 0) {
            throw new Error('Colonna verification_responsible non trovata dopo migration');
        }
        console.log('VERIFICA OK: verification_responsible presente.');
    } finally {
        await pool.close();
    }
}

runMigration().catch(err => {
    console.error('ERRORE migration 071:', err.message);
    process.exit(1);
});
