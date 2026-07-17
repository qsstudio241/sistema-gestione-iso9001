/**
 * Migration 112 (local) — management_reviews: input §9.3.2 c)5 monitoraggio e misurazione
 * Esegue la stessa ALTER idempotente della 112-vps usando backend/config/database.json.
 *
 * Uso (da Windows):
 *   node scripts/run-migration-112-local.js production   # DB di produzione (default)
 *   node scripts/run-migration-112-local.js test         # DB di test
 */
const sql = require('mssql');
const { resolveDbSection } = require('./mergeDbEnv');

async function main() {
    const profile = process.argv[2] || 'production';
    const c = resolveDbSection(profile);
    console.log(`Migration 112 → [${c.database}] su ${c.server}:${c.port}`);

    const pool = await sql.connect({
        server: c.server, port: c.port || 1433, database: c.database,
        user: c.user, password: c.password,
        options: {
            encrypt: c.options?.encrypt ?? false, trustServerCertificate: true,
            enableArithAbort: true, connectTimeout: 30000, requestTimeout: 30000,
        },
    });

    await pool.request().query(`
        IF NOT EXISTS (
            SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID('management_reviews') AND name = 'input_monitoring'
        )
        BEGIN
            ALTER TABLE management_reviews ADD input_monitoring NVARCHAR(MAX) NULL;
            PRINT 'input_monitoring aggiunto';
        END
        ELSE PRINT 'input_monitoring gia esistente — skip';
    `);

    const chk = await pool.request().query(`
        SELECT COUNT(*) AS cnt FROM sys.columns
        WHERE object_id = OBJECT_ID('management_reviews') AND name = 'input_monitoring'
    `);
    console.log(`  input_monitoring presente: ${chk.recordset[0].cnt === 1}`);
    console.log('  OK: migration 112 applicata.');
    await pool.close();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE migration 112:', e.message); process.exit(1); });
