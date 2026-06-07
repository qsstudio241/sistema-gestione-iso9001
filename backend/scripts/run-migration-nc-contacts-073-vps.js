/**
 * Migration NC 073 � notification_contacts (rubrica referenti)
 * Eseguire sul VPS: node scripts/run-migration-nc-contacts-073-vps.js
 */
'use strict';

process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const candidates = [
    path.join('/var/www/sgq-backend', 'database', 'migrations', '073_notification_contacts.sql'),
    path.join('/var/www/sgq-backend', '..', 'database', 'migrations', '073_notification_contacts.sql'),
    '/tmp/073_notification_contacts.sql',
];

(async () => {
    const resolvedPath = candidates.find((p) => fs.existsSync(p));
    if (!resolvedPath) {
        console.error('ERRORE: 073_notification_contacts.sql non trovato');
        process.exit(1);
    }
    console.log('Migration NC 073 � notification_contacts');
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
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = 'notification_contacts'
        `);
        if (!verify.recordset.length) {
            console.error('ERRORE: tabella notification_contacts assente');
            process.exit(1);
        }
        console.log('Migration NC 073 completata.');
        process.exit(0);
    } catch (e) {
        console.error('ERRORE migration NC 073:', e.message);
        process.exit(1);
    }
})();
