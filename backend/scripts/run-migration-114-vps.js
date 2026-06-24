/**
 * Migration 114 (VPS) — Persistenza analisi capitolato sul caso commerciale.
 *   1) commercial_case_drawing_extractions.source ('drawing'|'text'|'ocr'|'table')
 *   2) CHECK req_type esteso con i tipi testuali ('delivery','legal','commercial','spec')
 *   3) indice IX_ccde_case_source per recupero ultima analisi testo
 *
 * Pattern SQL Server: statement separati (idempotenti). NON applicare a produzione
 * finché lo smoke test in ambiente test non è verde.
 * Uso sul VPS:
 *   .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-114-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
    try {
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM sys.columns
                WHERE object_id = OBJECT_ID('dbo.commercial_case_drawing_extractions') AND name = 'source'
            )
            BEGIN
                ALTER TABLE commercial_case_drawing_extractions
                    ADD source NVARCHAR(20) NOT NULL CONSTRAINT DF_ccde_source DEFAULT 'drawing';
                PRINT 'source aggiunto';
            END ELSE PRINT 'source gia presente — skip';
        `);
        console.log('[114] (1) colonna source OK');

        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE name = 'CK_ccde_source' AND parent_object_id = OBJECT_ID('dbo.commercial_case_drawing_extractions')
            )
            BEGIN
                ALTER TABLE commercial_case_drawing_extractions
                    ADD CONSTRAINT CK_ccde_source CHECK (source IN ('drawing','text','ocr','table'));
                PRINT 'CK_ccde_source aggiunto';
            END ELSE PRINT 'CK_ccde_source gia presente — skip';
        `);
        console.log('[114] (2) CHECK source OK');

        await pool.request().query(`
            IF EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE name = 'CK_ccer_req_type' AND parent_object_id = OBJECT_ID('dbo.commercial_case_extracted_requirements')
            )
            BEGIN
                ALTER TABLE commercial_case_extracted_requirements DROP CONSTRAINT CK_ccer_req_type;
                PRINT 'CK_ccer_req_type vecchio rimosso';
            END ELSE PRINT 'CK_ccer_req_type assente — skip drop';
        `);
        console.log('[114] (3) drop CHECK req_type OK');

        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM sys.check_constraints
                WHERE name = 'CK_ccer_req_type' AND parent_object_id = OBJECT_ID('dbo.commercial_case_extracted_requirements')
            )
            BEGIN
                ALTER TABLE commercial_case_extracted_requirements
                    ADD CONSTRAINT CK_ccer_req_type CHECK (req_type IN (
                        'dimension','tolerance','gdt','material','weld_symbol','surface','note','title_block',
                        'delivery','legal','commercial','spec'
                    ));
                PRINT 'CK_ccer_req_type esteso aggiunto';
            END ELSE PRINT 'CK_ccer_req_type gia presente — skip';
        `);
        console.log('[114] (4) CHECK req_type esteso OK');

        await pool.request().query(`
            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE name = 'IX_ccde_case_source' AND object_id = OBJECT_ID('dbo.commercial_case_drawing_extractions')
            )
            BEGIN
                CREATE INDEX IX_ccde_case_source
                    ON commercial_case_drawing_extractions(case_id, source, status, id DESC);
                PRINT 'IX_ccde_case_source creato';
            END ELSE PRINT 'IX_ccde_case_source gia presente — skip';
        `);
        console.log('[114] (5) indice OK');
        console.log('[114] Migration completata.');
    } catch (e) {
        console.error('[114] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}
run();
