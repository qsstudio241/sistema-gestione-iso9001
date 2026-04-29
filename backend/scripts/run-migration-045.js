/**
 * Migrazione 045 — T1: Temporal Tables
 * Eseguire DOPO backup: SGQ_ISO9001_pre_T1_2026-04-29_13_06.bak
 *
 * Uso:
 *   node backend/scripts/run-migration-045.js
 *   oppure tramite script bash:
 *   bash backend/scripts/run-migration-agent.sh 045
 */

const path = require('path');
const fs = require('fs');
const sql = require('../node_modules/mssql');

const ENV = process.env.NODE_ENV || 'production';

// Carica configurazione DB
function loadDbConfig() {
    // Priorità: variabili ambiente (Cursor Cloud Secrets) > database.json
    if (process.env.DB_SERVER && process.env.DB_USER && process.env.DB_PASSWORD) {
        return {
            server: process.env.DB_SERVER,
            port: parseInt(process.env.DB_PORT || '11043'),
            database: process.env.DB_DATABASE || 'SGQ_ISO9001',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            options: { encrypt: true, trustServerCertificate: true },
            connectionTimeout: 30000,
            requestTimeout: 60000,
        };
    }
    const dbJsonPath = path.join(__dirname, '../config/database.json');
    if (fs.existsSync(dbJsonPath)) {
        const cfg = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
        const env = cfg[ENV] || cfg['production'];
        return {
            server: env.host || env.server,
            port: parseInt(env.port || 11043),
            database: env.database || 'SGQ_ISO9001',
            user: env.username || env.user,
            password: env.password,
            options: { encrypt: true, trustServerCertificate: true },
            connectionTimeout: 30000,
            requestTimeout: 60000,
        };
    }
    throw new Error('Configurazione DB non trovata. Impostare variabili DB_* o creare backend/config/database.json');
}

async function runMigration() {
    const sqlFile = path.join(__dirname, '../../database/migrations/045_temporal_tables_T1.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('');
    console.log('=====================================================');
    console.log('  Migrazione 045 — T1: Temporal Tables');
    console.log('  Ambiente:', ENV);
    console.log('  Data:', new Date().toISOString());
    console.log('  Backup pre-migrazione: SGQ_ISO9001_pre_T1_2026-04-29_13_06.bak');
    console.log('=====================================================');
    console.log('');

    const config = loadDbConfig();
    console.log('Connessione a:', config.server + ':' + config.port + '/' + config.database);

    const pool = await sql.connect(config);
    console.log('✅ Connesso');
    console.log('');

    try {
        // Esegui la migrazione con output dettagliato
        const request = pool.request();

        // Cattura messaggi PRINT dal server
        pool.on('infoMessage', (info) => {
            if (info.message && info.message.trim()) {
                console.log('[SQL] ' + info.message.trim());
            }
        });

        const result = await request.query(sqlContent);

        // Mostra tabella di verifica finale
        if (result.recordset && result.recordset.length > 0) {
            console.log('');
            console.log('Stato temporal tables:');
            result.recordset.forEach(row => {
                console.log('  ' + row.table_name.padEnd(20) + row.temporal_type.padEnd(30) + (row.history_table || ''));
            });
        }

        console.log('');
        console.log('✅ Migrazione 045 completata con successo');
        console.log('');
        console.log('Query di verifica (da eseguire su SQL Server Management Studio):');
        console.log('  SELECT * FROM audit_responses FOR SYSTEM_TIME ALL WHERE audit_id = 35185;');
        console.log('  SELECT * FROM audits FOR SYSTEM_TIME ALL WHERE audit_id = 35185;');

    } catch (err) {
        console.error('');
        console.error('❌ ERRORE migrazione 045:', err.message);
        console.error('');
        console.error('Rollback procedura:');
        console.error('  ALTER TABLE audit_responses SET (SYSTEM_VERSIONING = OFF);');
        console.error('  ALTER TABLE audit_responses DROP PERIOD FOR SYSTEM_TIME;');
        console.error('  ALTER TABLE audit_responses DROP COLUMN ValidFrom, ValidTo;');
        console.error('  DROP TABLE IF EXISTS dbo.audit_responses_history;');
        console.error('');
        console.error('  ALTER TABLE audits SET (SYSTEM_VERSIONING = OFF);');
        console.error('  ALTER TABLE audits DROP PERIOD FOR SYSTEM_TIME;');
        console.error('  ALTER TABLE audits DROP COLUMN ValidFrom, ValidTo;');
        console.error('  DROP TABLE IF EXISTS dbo.audits_history;');
        process.exit(1);
    } finally {
        await sql.close();
    }
}

runMigration().catch(err => {
    console.error('Errore fatale:', err.message);
    process.exit(1);
});
