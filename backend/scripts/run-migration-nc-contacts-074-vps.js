/**
 * Migration NC 074 � FK referenti NC/azioni + nc_notification_log
 * Eseguire sul VPS: node scripts/run-migration-nc-contacts-074-vps.js
 */
'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const candidates = [
    path.join('/var/www/sgq-backend', 'database', 'migrations', '074_nc_notification_contacts.sql'),
    path.join('/var/www/sgq-backend', '..', 'database', 'migrations', '074_nc_notification_contacts.sql'),
    '/tmp/074_nc_notification_contacts.sql',
];

(async () => {
    const resolvedPath = candidates.find((p) => fs.existsSync(p));
    if (!resolvedPath) {
        console.error('ERRORE: 074_nc_notification_contacts.sql non trovato');
        process.exit(1);
    }
    console.log('Migration NC 074 � FK referenti + nc_notification_log');
    console.log('File:', resolvedPath);
    const batches = fs.readFileSync(resolvedPath, 'utf8')
        .split(/^\s*GO\s*$/gim)
        .map((b) => b.trim())
        .filter(Boolean);
    try {
        for (let i = 0; i < batches.length; i++) {
            console.log(`Batch ${i + 1}/${batches.length}...`);
            await query(batches[i]);
        }
        const verify = await query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'non_conformities'
              AND COLUMN_NAME IN ('responsible_contact_id', 'verification_contact_id')
        `);
        if (verify.recordset.length < 2) {
            console.error('ERRORE: colonne FK NC incomplete:', verify.recordset);
            process.exit(1);
        }
        console.log('Migration NC 074 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration NC 074:', e.message);
        process.exit(1);
    }
})();
