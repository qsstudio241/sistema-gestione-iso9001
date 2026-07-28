/**
 * Migration 137 — target_qualification_id + field_scope su ingest_staging
 * Supporto "rielaborazione" (backfill) su qualifiche esistenti — vedi
 * database/migrations/137_ingest_staging_reprocess.sql e
 * backend/scripts/reprocess-qualifications.js.
 *
 * Uso (solo su VPS, via SSH — vedi backend/scripts/run-on-vps.ps1):
 *   node /tmp/run-migration-137-vps.js
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function columnExists(pool, table, column) {
    const r = await pool.request().query(`
        SELECT 1 AS x FROM sys.columns
        WHERE object_id = OBJECT_ID('${table}') AND name = '${column}'
    `);
    return r.recordset.length > 0;
}

async function run() {
    const pool = await getPool();
    try {
        if (!(await columnExists(pool, 'ingest_staging', 'target_qualification_id'))) {
            await pool.request().query(`ALTER TABLE ingest_staging ADD target_qualification_id INT NULL`);
            console.log('[137] Colonna target_qualification_id aggiunta');
        } else {
            console.log('[137] Colonna target_qualification_id gia esistente — skip');
        }

        if (!(await columnExists(pool, 'ingest_staging', 'field_scope'))) {
            await pool.request().query(`ALTER TABLE ingest_staging ADD field_scope NVARCHAR(200) NULL`);
            console.log('[137] Colonna field_scope aggiunta');
        } else {
            console.log('[137] Colonna field_scope gia esistente — skip');
        }

        const fkCheck = await pool.request().query(`
            SELECT 1 AS x FROM sys.foreign_keys WHERE name = 'FK_ingest_staging_target_qualification'
        `);
        if (fkCheck.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE ingest_staging
                ADD CONSTRAINT FK_ingest_staging_target_qualification
                FOREIGN KEY (target_qualification_id) REFERENCES qualifications(id) ON DELETE SET NULL
            `);
            console.log('[137] FK FK_ingest_staging_target_qualification aggiunta');
        } else {
            console.log('[137] FK gia esistente — skip');
        }

        const idxCheck = await pool.request().query(`
            SELECT 1 AS x FROM sys.indexes
            WHERE name = 'IX_ingest_staging_target_qual' AND object_id = OBJECT_ID('ingest_staging')
        `);
        if (idxCheck.recordset.length === 0) {
            await pool.request().query(`
                CREATE INDEX IX_ingest_staging_target_qual
                    ON ingest_staging (target_qualification_id, field_scope, review_status)
                    WHERE target_qualification_id IS NOT NULL
            `);
            console.log('[137] Indice IX_ingest_staging_target_qual creato');
        } else {
            console.log('[137] Indice gia esistente — skip');
        }

        const verify = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'ingest_staging' AND COLUMN_NAME IN ('target_qualification_id', 'field_scope')
        `);
        console.log('[137] Verifica:', JSON.stringify(verify.recordset));
        console.log('[137] Migrazione completata.');
    } catch (err) {
        console.error('[137] ERRORE:', err.message);
        process.exitCode = 1;
    } finally {
        process.exit(process.exitCode || 0);
    }
}

run();
