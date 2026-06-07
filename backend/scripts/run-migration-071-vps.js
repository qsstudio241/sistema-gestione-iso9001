'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const sqlPath = path.join('/var/www/sgq-backend', 'database', 'migrations', '071_nc_verification_responsible.sql');
const FALLBACK_SQL = '/tmp/071_nc_verification_responsible.sql';

(async () => {
    console.log('Migration 071 — verification_responsible');
    const resolvedPath = fs.existsSync(sqlPath) ? sqlPath : FALLBACK_SQL;
    console.log('Lettura SQL:', resolvedPath);

    if (!fs.existsSync(resolvedPath)) {
        console.error('ERRORE: file migration non trovato');
        process.exit(1);
    }

    const sqlText = fs.readFileSync(resolvedPath, 'utf8');

    try {
        await query(sqlText);
        const verify = await query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'verification_responsible'
        `);
        if (verify.recordset.length === 0) {
            console.error('ERRORE: colonna verification_responsible assente dopo migration');
            process.exit(1);
        }
        console.log('Migration 071 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration 071:', e.message);
        process.exit(1);
    }
})();
