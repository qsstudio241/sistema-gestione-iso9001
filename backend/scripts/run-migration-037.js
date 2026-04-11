/**
 * run-migration-037.js — Sprint 8: colonna licensed_modules su organizations
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const dbConfigAll = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/database.json'), 'utf8')
);
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

const SQL_037 = `
IF COL_LENGTH('organizations', 'licensed_modules') IS NULL
BEGIN
    ALTER TABLE organizations ADD licensed_modules NVARCHAR(MAX) NULL;
    PRINT 'Colonna organizations.licensed_modules aggiunta.';
END
ELSE
    PRINT 'Colonna licensed_modules gia presente - skip.';
`;

async function runMigration() {
    let pool;
    try {
        console.log('Connessione al database per migration 037...');
        pool = await sql.connect(dbConfig);
        await pool.request().query(SQL_037);
        console.log('Migration 037 completata.');
    } catch (err) {
        console.error('Errore migration 037:', err.message);
        process.exit(1);
    } finally {
        if (pool) await pool.close();
    }
}

runMigration();
