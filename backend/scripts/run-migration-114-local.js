/**
 * Migration 114 (local) — Persistenza analisi capitolato: source su ccde + req_type esteso su ccer.
 * Esegue la stessa logica idempotente della 114-vps usando backend/config/database.json.
 * Statement separati (no batch unico) per evitare "Invalid column name 'source'" in fase di compile.
 *
 * Uso (da Windows):
 *   node scripts/run-migration-114-local.js test         # DB di test (default consigliato)
 *   node scripts/run-migration-114-local.js production   # DB di produzione
 */
const sql = require('mssql');
const { resolveDbSection } = require('./mergeDbEnv');

async function main() {
    const profile = process.argv[2] || 'test';
    const c = resolveDbSection(profile);
    console.log(`Migration 114 → [${c.database}] su ${c.server}:${c.port}`);

    const pool = await sql.connect({
        server: c.server, port: c.port || 1433, database: c.database,
        user: c.user, password: c.password,
        options: {
            encrypt: c.options?.encrypt ?? false, trustServerCertificate: true,
            enableArithAbort: true, connectTimeout: 30000, requestTimeout: 30000,
        },
    });

    // (1) Colonna source (default 'drawing')
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
    console.log('  (1) colonna source OK');

    // (2) CHECK su source
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
    console.log('  (2) CHECK source OK');

    // (3) Drop vecchio CHECK su req_type
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
    console.log('  (3) drop CHECK req_type OK');

    // (4) Re-add CHECK req_type esteso
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
    console.log('  (4) CHECK req_type esteso OK');

    // (5) Indice recupero per caso/source
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
    console.log('  (5) indice OK');

    const chk = await pool.request().query(`
        SELECT COUNT(*) AS cnt FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.commercial_case_drawing_extractions') AND name = 'source'
    `);
    console.log(`  source presente: ${chk.recordset[0].cnt === 1}`);
    console.log('  OK: migration 114 applicata.');
    await pool.close();
    process.exit(0);
}

main().catch((e) => { console.error('ERRORE migration 114:', e.message); process.exit(1); });
