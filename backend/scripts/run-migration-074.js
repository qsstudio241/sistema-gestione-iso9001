/**
 * run-migration-074.js � FK referenti NC + nc_notification_log
 */
const sql = require('mssql');
const path = require('path');
const fs = require('fs');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const dbConfig = dbConfigAll.production || dbConfigAll;
const sqlPath = path.join(__dirname, '../../database/migrations/074_nc_notification_contacts.sql');
const SQL = fs.readFileSync(sqlPath, 'utf8');

async function runMigration() {
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
        console.log('Migration 074 eseguita.');
    } finally {
        await pool.close();
    }
}

runMigration().catch((err) => {
    console.error('ERRORE migration 074:', err.message);
    process.exit(1);
});
