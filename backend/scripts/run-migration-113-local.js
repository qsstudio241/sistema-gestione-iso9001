/**
 * Migration 113 (local) — non_conformities.management_review_id + FK + indice
 * Esegue la stessa logica idempotente della 113-vps usando backend/config/database.json.
 *
 * Uso (da Windows):
 *   node scripts/run-migration-113-local.js production   # DB di produzione (default)
 *   node scripts/run-migration-113-local.js test         # DB di test
 */
const sql = require('mssql');
const { resolveDbSection } = require('./mergeDbEnv');

async function main() {
    const profile = process.argv[2] || 'production';
    const c = resolveDbSection(profile);
    console.log(`Migration 113 → [${c.database}] su ${c.server}:${c.port}`);

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
            WHERE object_id = OBJECT_ID('non_conformities') AND name = 'management_review_id'
        )
        BEGIN
            ALTER TABLE non_conformities ADD management_review_id INT NULL;
            PRINT 'management_review_id aggiunto';
        END ELSE PRINT 'management_review_id gia presente — skip';
    `);
    console.log('  (1) colonna OK');

    await pool.request().query(`
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_management_review')
        BEGIN
            ALTER TABLE non_conformities WITH NOCHECK
                ADD CONSTRAINT FK_nc_management_review
                    FOREIGN KEY (management_review_id) REFERENCES management_reviews(id);
            PRINT 'FK_nc_management_review aggiunto';
        END ELSE PRINT 'FK_nc_management_review gia presente — skip';
    `);
    console.log('  (2) FK OK');

    await pool.request().query(`
        IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = 'IX_nc_management_review' AND object_id = OBJECT_ID('non_conformities')
        )
        BEGIN
            CREATE INDEX IX_nc_management_review ON non_conformities(management_review_id)
                WHERE management_review_id IS NOT NULL;
            PRINT 'IX_nc_management_review creato';
        END ELSE PRINT 'IX_nc_management_review gia presente — skip';
    `);
    console.log('  (3) indice OK');

    const chk = await pool.request().query(`
        SELECT COUNT(*) AS cnt FROM sys.columns
        WHERE object_id = OBJECT_ID('non_conformities') AND name = 'management_review_id'
    `);
    console.log(`  management_review_id presente: ${chk.recordset[0].cnt === 1}`);
    console.log('  OK: migration 113 applicata.');
    await pool.close();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE migration 113:', e.message); process.exit(1); });
