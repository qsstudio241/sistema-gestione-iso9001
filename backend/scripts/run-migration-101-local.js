/**
 * Migration 101 — Estrazione requisiti tecnici dai disegni (commercial_case_drawing_extractions
 * + commercial_case_extracted_requirements). Applicare al DB di TEST locale.
 *
 * Uso:
 *   cd C:\Dev\ProgettoISO\backend
 *   node scripts/run-migration-101-local.js
 *
 * NON carica .env — legge solo database.json sezione "test".
 * Statement separati (ALTER/ADD CONSTRAINT/CREATE INDEX) come da regola FK SQL Server.
 */

const sql = require('mssql');
const { loadDatabaseJsonConfigs } = require('./mergeDbEnv');

async function main() {
    const configs = loadDatabaseJsonConfigs();
    const c = configs['test'];
    if (!c) throw new Error('Sezione "test" mancante in backend/config/database.json');

    console.log(`Migration 101 -> [${c.database}] su ${c.server}:${c.port}`);

    const pool = await sql.connect({
        server: c.server,
        port: c.port || 1433,
        database: c.database,
        user: c.user,
        password: c.password,
        options: {
            encrypt: c.options?.encrypt ?? false,
            trustServerCertificate: true,
            enableArithAbort: true,
            connectTimeout: c.options?.connectTimeout ?? 30000,
            requestTimeout: c.options?.requestTimeout ?? 30000,
        },
    });

    await applyMigration101(pool);
    await pool.close();
}

/**
 * Applica la migration 101 in modo idempotente.
 * Esportata per riuso dallo script VPS (stessa logica, pool diverso).
 * @param {import('mssql').ConnectionPool} pool
 */
async function applyMigration101(pool) {
    // 1) Tabella job di estrazione
    const t1 = await pool.request().query(`
        SELECT COUNT(*) AS cnt FROM sys.tables
        WHERE name = 'commercial_case_drawing_extractions' AND schema_id = SCHEMA_ID('dbo')
    `);
    if (t1.recordset[0].cnt === 0) {
        console.log('  Creazione tabella commercial_case_drawing_extractions...');
        await pool.request().query(`
            CREATE TABLE commercial_case_drawing_extractions (
              id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ccde PRIMARY KEY,
              organization_id  INT           NOT NULL,
              case_id          INT           NOT NULL,
              document_id      INT           NULL,
              attachment_id    INT           NULL,
              provider         NVARCHAR(30)  NOT NULL DEFAULT 'gemini',
              external_job_id  NVARCHAR(200) NULL,
              status           NVARCHAR(20)  NOT NULL DEFAULT 'pending'
                CONSTRAINT CK_ccde_status CHECK (status IN ('pending','processing','done','error')),
              raw_response     NVARCHAR(MAX) NULL,
              error_message    NVARCHAR(MAX) NULL,
              page_count       INT           NULL,
              created_by       INT           NULL,
              created_at       DATETIME2     NOT NULL DEFAULT SYSDATETIME(),
              completed_at     DATETIME2     NULL
            )
        `);
    } else {
        console.log('  SKIP: commercial_case_drawing_extractions gia presente.');
    }

    await ensureIndex(pool, 'IX_ccde_case', 'commercial_case_drawing_extractions',
        'CREATE INDEX IX_ccde_case ON commercial_case_drawing_extractions(case_id, created_at DESC)');
    await ensureIndex(pool, 'IX_ccde_org', 'commercial_case_drawing_extractions',
        'CREATE INDEX IX_ccde_org ON commercial_case_drawing_extractions(organization_id)');
    await ensureFk(pool, 'FK_ccde_case',
        `ALTER TABLE commercial_case_drawing_extractions
         ADD CONSTRAINT FK_ccde_case FOREIGN KEY (case_id) REFERENCES commercial_cases(id)`);

    // 2) Tabella requisiti estratti
    const t2 = await pool.request().query(`
        SELECT COUNT(*) AS cnt FROM sys.tables
        WHERE name = 'commercial_case_extracted_requirements' AND schema_id = SCHEMA_ID('dbo')
    `);
    if (t2.recordset[0].cnt === 0) {
        console.log('  Creazione tabella commercial_case_extracted_requirements...');
        await pool.request().query(`
            CREATE TABLE commercial_case_extracted_requirements (
              id             INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ccer PRIMARY KEY,
              extraction_id  INT           NOT NULL,
              req_type       NVARCHAR(30)  NOT NULL
                CONSTRAINT CK_ccer_req_type CHECK (req_type IN
                  ('dimension','tolerance','gdt','material','weld_symbol','surface','note','title_block')),
              field_key      NVARCHAR(100) NULL,
              value_text     NVARCHAR(MAX) NULL,
              unit           NVARCHAR(30)  NULL,
              confidence     DECIMAL(5,4)  NULL,
              source_bbox    NVARCHAR(200) NULL,
              review_status  NVARCHAR(20)  NOT NULL DEFAULT 'extracted'
                CONSTRAINT CK_ccer_review_status CHECK (review_status IN ('extracted','confirmed','rejected','edited')),
              reviewed_by    INT           NULL,
              created_at     DATETIME2     NOT NULL DEFAULT SYSDATETIME()
            )
        `);
    } else {
        console.log('  SKIP: commercial_case_extracted_requirements gia presente.');
    }

    await ensureIndex(pool, 'IX_ccer_extraction', 'commercial_case_extracted_requirements',
        'CREATE INDEX IX_ccer_extraction ON commercial_case_extracted_requirements(extraction_id)');
    await ensureFk(pool, 'FK_ccer_extraction',
        `ALTER TABLE commercial_case_extracted_requirements
         ADD CONSTRAINT FK_ccer_extraction FOREIGN KEY (extraction_id)
         REFERENCES commercial_case_drawing_extractions(id)`);

    const chk = await pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM sys.tables WHERE name='commercial_case_drawing_extractions') AS ext,
          (SELECT COUNT(*) FROM sys.tables WHERE name='commercial_case_extracted_requirements') AS req
    `);
    console.log(`  Verifica: extractions=${chk.recordset[0].ext} requirements=${chk.recordset[0].req}`);
    console.log('  OK: migration 101 applicata.');
}

async function ensureIndex(pool, indexName, tableName, createSql) {
    const r = await pool.request().query(`
        SELECT COUNT(*) AS cnt FROM sys.indexes
        WHERE name = '${indexName}' AND object_id = OBJECT_ID('dbo.${tableName}')
    `);
    if (r.recordset[0].cnt === 0) {
        console.log(`  Creazione indice ${indexName}...`);
        await pool.request().query(createSql);
    }
}

async function ensureFk(pool, fkName, alterSql) {
    const r = await pool.request().query(
        `SELECT COUNT(*) AS cnt FROM sys.foreign_keys WHERE name = '${fkName}'`,
    );
    if (r.recordset[0].cnt === 0) {
        console.log(`  Creazione FK ${fkName}...`);
        await pool.request().query(alterSql);
    }
}

module.exports = { applyMigration101 };

if (require.main === module) {
    main().catch((e) => {
        console.error('ERRORE migration 101:', e.message);
        process.exit(1);
    });
}
