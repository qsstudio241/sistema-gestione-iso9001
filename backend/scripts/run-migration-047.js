/**
 * Migrazione 047 — custom_item_id in attachments (unificazione allegati)
 *
 * Uso:
 *   node backend/scripts/run-migration-047.js
 *   oppure tramite script bash:
 *   bash backend/scripts/run-migration-agent.sh 047
 */

const path = require('path');
const fs = require('fs');
const sql = require('../node_modules/mssql');

const ENV = process.env.NODE_ENV || 'production';

function loadDbConfig() {
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
    const sqlFile = path.join(__dirname, '../../database/migrations/047_attachments_custom_item_id.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    console.log('');
    console.log('=====================================================');
    console.log('  Migrazione 047 — custom_item_id in attachments');
    console.log('  Ambiente:', ENV);
    console.log('  Data:', new Date().toISOString());
    console.log('=====================================================');
    console.log('');

    const config = loadDbConfig();
    console.log('Connessione a:', config.server + ':' + config.port + '/' + config.database);

    const pool = await sql.connect(config);
    console.log('✅ Connesso');
    console.log('');

    try {
        pool.on('infoMessage', (info) => {
            if (info.message && info.message.trim()) {
                console.log('[SQL] ' + info.message.trim());
            }
        });

        // Esegui ogni statement separatamente (GO separator non supportato da mssql)
        const statements = sqlContent
            .split(/\bGO\b/i)
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
            if (stmt.trim()) {
                await pool.request().query(stmt);
            }
        }

        console.log('');
        console.log('✅ Migrazione 047 completata con successo');
        console.log('');
        console.log('Query di verifica:');
        console.log('  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS');
        console.log('    WHERE TABLE_NAME=\'attachments\' AND COLUMN_NAME=\'custom_item_id\';');

    } catch (err) {
        console.error('');
        console.error('❌ ERRORE migrazione 047:', err.message);
        process.exit(1);
    } finally {
        await sql.close();
    }
}

runMigration().catch(err => {
    console.error('Errore fatale:', err.message);
    process.exit(1);
});
