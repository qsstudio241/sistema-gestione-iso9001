/**
 * Migration 113 (VPS) — non_conformities: collegamento al Riesame di Direzione (§9.3.3 → Piano Azioni)
 * Aggiunge la colonna + FK per tracciare quale riesame ha originato un'azione/NC:
 *   management_review_id INT NULL  → FK management_reviews(id)
 *
 * Pattern SQL Server: statement separati (colonna, FK senza ON DELETE, indice), idempotenti.
 * Uso sul VPS:
 *   .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-113-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
    try {
        // 1. Colonna
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
        console.log('[113] (1) colonna OK');

        // 2. FK (senza ON DELETE: i riesami sono soft-deleted)
        await pool.request().query(`
            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_management_review')
            BEGIN
                ALTER TABLE non_conformities WITH NOCHECK
                    ADD CONSTRAINT FK_nc_management_review
                        FOREIGN KEY (management_review_id) REFERENCES management_reviews(id);
                PRINT 'FK_nc_management_review aggiunto';
            END ELSE PRINT 'FK_nc_management_review gia presente — skip';
        `);
        console.log('[113] (2) FK OK');

        // 3. Indice
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
        console.log('[113] (3) indice OK');
        console.log('[113] Migration completata.');
    } catch (e) {
        console.error('[113] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}
run();
