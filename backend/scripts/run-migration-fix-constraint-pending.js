/**
 * Migrazione: aggiorna CK_pending_issues_original_status
 * Rimuove 'OM' e aggiunge 'NV' tra i valori ammessi per original_status.
 * Eseguire sul VPS: node /tmp/run-migration-fix-constraint-pending.js
 */
const sql = require('/var/www/sgq-backend/node_modules/mssql');

const config = {
    server: '127.0.0.1',
    port: 11043,
    database: 'SGQ_ISO9001',
    user: 'pascarella',
    password: '#Gestione2025@',
    options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
    let pool;
    try {
        pool = await sql.connect(config);
        console.log('Connesso al DB.');

        // Verifica valori attuali nel constraint
        const check = await pool.request().query(`
            SELECT cc.definition
            FROM sys.check_constraints cc
            JOIN sys.tables t ON cc.parent_object_id = t.object_id
            WHERE t.name = 'pending_issues'
              AND cc.name = 'CK_pending_issues_original_status'
        `);
        if (check.recordset.length > 0) {
            console.log('Constraint attuale:', check.recordset[0].definition);
        } else {
            console.log('ATTENZIONE: constraint non trovato. Creazione diretta.');
        }

        // Verifica che non esistano righe con original_status = 'OM' che bloccherebbero il vincolo
        const omRows = await pool.request().query(`
            SELECT COUNT(*) AS cnt FROM [dbo].[pending_issues] WHERE original_status = 'OM'
        `);
        const omCount = omRows.recordset[0].cnt;
        console.log(`Righe con original_status = 'OM': ${omCount}`);
        if (omCount > 0) {
            console.log("ATTENZIONE: esistono righe con 'OM'. Saranno aggiornate a 'OSS' prima di aggiornare il constraint.");
            await pool.request().query(`
                UPDATE [dbo].[pending_issues] SET original_status = 'OSS' WHERE original_status = 'OM'
            `);
            console.log(`${omCount} righe aggiornate da 'OM' a 'OSS'.`);
        }

        // Drop constraint esistente (se presente)
        await pool.request().query(`
            IF EXISTS (
                SELECT 1 FROM sys.check_constraints cc
                JOIN sys.tables t ON cc.parent_object_id = t.object_id
                WHERE t.name = 'pending_issues' AND cc.name = 'CK_pending_issues_original_status'
            )
            ALTER TABLE [dbo].[pending_issues] DROP CONSTRAINT [CK_pending_issues_original_status];
        `);
        console.log('Constraint rimosso (o non esisteva).');

        // Ricrea con i valori corretti: NC, OSS, NV
        await pool.request().query(`
            ALTER TABLE [dbo].[pending_issues]
            ADD CONSTRAINT [CK_pending_issues_original_status]
            CHECK ([original_status] IN ('NC', 'OSS', 'NV'));
        `);
        console.log("Constraint ricreato con valori ('NC', 'OSS', 'NV').");

        // Verifica finale
        const verify = await pool.request().query(`
            SELECT cc.definition
            FROM sys.check_constraints cc
            JOIN sys.tables t ON cc.parent_object_id = t.object_id
            WHERE t.name = 'pending_issues'
              AND cc.name = 'CK_pending_issues_original_status'
        `);
        console.log('Constraint finale:', verify.recordset[0]?.definition);
        console.log('Migrazione completata con successo.');
    } catch (err) {
        console.error('ERRORE migrazione:', err.message);
        process.exit(1);
    } finally {
        if (pool) await pool.close();
    }
}

run();
