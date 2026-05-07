/**
 * run-migration-049.js
 * ISO 14001:2015 — Checklist COMPLETA (53 domande, clausole 4→10)
 * Cloud Agent: eseguire sul VPS tramite SSH (DB non raggiungibile direttamente)
 *   scp -P 1122 -i $KEY run-migration-049.js spascarella@www.fr-busato.it:/tmp/
 *   ssh -p 1122 -i $KEY spascarella@... "node /tmp/run-migration-049.js"
 */

'use strict';
const path = require('path');
const fs   = require('fs');
const sql  = require('mssql');

// Carica la config database dal backend installato sul VPS
const dbConfig = require('/var/www/sgq-backend/src/config/database');

async function run() {
    let pool;
    try {
        console.log('Connessione al database…');
        pool = await dbConfig.getPool();
        console.log('Connesso.');

        const sqlFile = path.join(__dirname, '049_iso14001_completa_48q.sql');
        // Se eseguito dal VPS direttamente, il file SQL viene copiato in /tmp
        const sqlPath = fs.existsSync(sqlFile) ? sqlFile : '/tmp/049_iso14001_completa_48q.sql';
        const migrationSql = fs.readFileSync(sqlPath, 'utf8');

        // Dividi in batch su GO
        const batches = migrationSql.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(b => b.length > 0);
        console.log(`Esecuzione di ${batches.length} batch SQL…`);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            if (!batch) continue;
            try {
                const result = await pool.request().query(batch);
                if (result.recordset && result.recordset.length > 0) {
                    console.log(`Batch ${i + 1} — risultato:`, JSON.stringify(result.recordset));
                } else {
                    console.log(`Batch ${i + 1} OK (${result.rowsAffected ? result.rowsAffected.join(',') : '0'} righe)`);
                }
            } catch (batchErr) {
                console.error(`Batch ${i + 1} ERRORE:`, batchErr.message);
                // Continua sui batch successivi per non bloccare l'intera migrazione
            }
        }

        console.log('\nMigrazione 049 completata.');
        process.exit(0);
    } catch (err) {
        console.error('ERRORE:', err.message);
        process.exit(1);
    }
}

run();
