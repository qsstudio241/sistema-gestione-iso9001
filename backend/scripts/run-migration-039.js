/**
 * run-migration-039.js — Colonne AI su import_job_files (estrazione JSON OpenAI)
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const dbConfigAll = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/database.json'), 'utf8')
);
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

const SQL_039 = `
IF COL_LENGTH('dbo.import_job_files', 'ai_extraction_json') IS NULL
BEGIN
    ALTER TABLE dbo.import_job_files ADD
        ai_extraction_json   NVARCHAR(MAX)  NULL,
        ai_extraction_error  NVARCHAR(2000) NULL,
        ai_extraction_at     DATETIME2      NULL,
        ai_model             NVARCHAR(80)   NULL;
    PRINT '039: colonne AI aggiunte a import_job_files.';
END
ELSE
    PRINT '039: colonne AI gia presenti - skip.';
`;

async function runMigration() {
    let pool;
    try {
        console.log('Connessione al database per migration 039...');
        pool = await sql.connect(dbConfig);
        await pool.request().query(SQL_039);
        console.log('Migration 039 completata.');
    } catch (err) {
        console.error('Errore migration 039:', err.message);
        process.exit(1);
    } finally {
        if (pool) await pool.close();
    }
}

runMigration();
