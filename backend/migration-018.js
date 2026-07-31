/**
 * Migration 018 - CREATE TABLE pending_issues
 * Rilievi pendenti (NC/OSS/OM) da trasportare nei Re-Audit successivi
 * 
 * Eseguire con: node migration-018.js
 * SAFE TO RUN MULTIPLE TIMES - verifica esistenza prima di ogni CREATE
 * 
 * ISO 9001:2015 - 10.2: Non conformità e azioni correttive
 */

require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER || 'busaborl_admin',
    password: process.env.DB_PASSWORD || 'Ag63.busato',
    server: process.env.DB_SERVER || 'sistemi.fr-busato.it',
    port: parseInt(process.env.DB_PORT || '11043'),
    database: process.env.DB_NAME || 'SGQ_ISO9001',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true
    },
    requestTimeout: 60000
};

async function runMigration() {
    let pool;

    try {
        console.log('🔌 Connessione al database...');
        console.log(`   Server: ${config.server}:${config.port} / DB: ${config.database}`);
        pool = await sql.connect(config);
        console.log('✅ Connesso a', config.database);

        // ────────────────────────────────────────────────
        // 1. Crea tabella pending_issues
        // ────────────────────────────────────────────────
        console.log('\n📝 [1/4] Creazione tabella pending_issues...');
        const tableCheck = await pool.request().query(`
            SELECT 1 FROM sys.tables WHERE name = 'pending_issues'
        `);

        if (tableCheck.recordset.length === 0) {
            await pool.request().query(`
                CREATE TABLE [dbo].[pending_issues] (
                    [issue_id]               INT IDENTITY(1,1) NOT NULL,
                    [target_audit_id]         INT               NOT NULL,
                    [source_audit_id]         INT               NOT NULL,
                    [question_id]             INT               NOT NULL,
                    [source_response_id]      INT               NULL,
                    [status]                  NVARCHAR(20)      NOT NULL
                                              CONSTRAINT [DF_pending_issues_status] DEFAULT 'open',
                    [original_status]         NVARCHAR(10)      NOT NULL,
                    [resolution_notes]        NVARCHAR(MAX)     NULL,
                    [organization_id]         INT               NOT NULL,
                    [created_at]              DATETIME2         NOT NULL
                                              CONSTRAINT [DF_pending_issues_created_at] DEFAULT GETDATE(),
                    [updated_at]              DATETIME2         NOT NULL
                                              CONSTRAINT [DF_pending_issues_updated_at] DEFAULT GETDATE(),
                    CONSTRAINT [PK_pending_issues] PRIMARY KEY CLUSTERED ([issue_id]),
                    CONSTRAINT [CK_pending_issues_status]
                        CHECK ([status] IN ('open', 'resolved', 'persists')),
                    CONSTRAINT [CK_pending_issues_original_status]
                        CHECK ([original_status] IN ('NC', 'OSS', 'OM'))
                )
            `);
            console.log('   ✅ Tabella pending_issues creata');
        } else {
            console.log('   ⏭️  Tabella pending_issues già presente - skip');
        }

        // ────────────────────────────────────────────────
        // 2. Foreign Keys
        // ────────────────────────────────────────────────
        console.log('\n📝 [2/4] Aggiunta Foreign Keys...');

        const fks = [
            {
                name: 'FK_pending_issues_target_audit',
                sql: `ALTER TABLE [dbo].[pending_issues]
                      ADD CONSTRAINT [FK_pending_issues_target_audit]
                      FOREIGN KEY ([target_audit_id]) REFERENCES [dbo].[audits]([audit_id])
                      ON DELETE CASCADE`
            },
            {
                name: 'FK_pending_issues_source_audit',
                sql: `ALTER TABLE [dbo].[pending_issues]
                      ADD CONSTRAINT [FK_pending_issues_source_audit]
                      FOREIGN KEY ([source_audit_id]) REFERENCES [dbo].[audits]([audit_id])`
            },
            {
                name: 'FK_pending_issues_question',
                sql: `ALTER TABLE [dbo].[pending_issues]
                      ADD CONSTRAINT [FK_pending_issues_question]
                      FOREIGN KEY ([question_id]) REFERENCES [dbo].[checklist_questions]([question_id])`
            },
            {
                name: 'FK_pending_issues_source_response',
                sql: `ALTER TABLE [dbo].[pending_issues]
                      ADD CONSTRAINT [FK_pending_issues_source_response]
                      FOREIGN KEY ([source_response_id]) REFERENCES [dbo].[audit_responses]([response_id])
                      ON DELETE NO ACTION`  // SET NULL causa cascade cycle con FK target_audit (CASCADE)
            },
            {
                name: 'FK_pending_issues_organization',
                sql: `ALTER TABLE [dbo].[pending_issues]
                      ADD CONSTRAINT [FK_pending_issues_organization]
                      FOREIGN KEY ([organization_id]) REFERENCES [dbo].[organizations]([organization_id])`
            }
        ];

        for (const fk of fks) {
            const fkCheck = await pool.request().query(`
                SELECT 1 FROM sys.foreign_keys WHERE name = '${fk.name}'
            `);
            if (fkCheck.recordset.length === 0) {
                await pool.request().query(fk.sql);
                console.log(`   ✅ FK ${fk.name} aggiunta`);
            } else {
                console.log(`   ⏭️  FK ${fk.name} già presente - skip`);
            }
        }

        // ────────────────────────────────────────────────
        // 3. Indici
        // ────────────────────────────────────────────────
        console.log('\n📝 [3/4] Creazione indici...');

        const indexes = [
            {
                name: 'IX_pending_issues_target_audit',
                sql: `CREATE INDEX [IX_pending_issues_target_audit]
                      ON [dbo].[pending_issues] ([target_audit_id], [status])`
            },
            {
                name: 'IX_pending_issues_source_audit',
                sql: `CREATE INDEX [IX_pending_issues_source_audit]
                      ON [dbo].[pending_issues] ([source_audit_id], [status])`
            }
        ];

        for (const idx of indexes) {
            const idxCheck = await pool.request().query(`
                SELECT 1 FROM sys.indexes 
                WHERE object_id = OBJECT_ID('dbo.pending_issues') AND name = '${idx.name}'
            `);
            if (idxCheck.recordset.length === 0) {
                await pool.request().query(idx.sql);
                console.log(`   ✅ Indice ${idx.name} creato`);
            } else {
                console.log(`   ⏭️  Indice ${idx.name} già presente - skip`);
            }
        }

        // ────────────────────────────────────────────────
        // 4. Verifica finale
        // ────────────────────────────────────────────────
        console.log('\n📊 [4/4] Schema finale tabella pending_issues:');
        const schema = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'pending_issues'
            ORDER BY ORDINAL_POSITION
        `);
        console.table(schema.recordset);

        const fkList = await pool.request().query(`
            SELECT fk.name AS fk_name, tp.name AS parent_col, tr.name AS ref_table
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
            JOIN sys.columns tp ON fkc.parent_object_id = tp.object_id AND fkc.parent_column_id = tp.column_id
            JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
            WHERE fk.parent_object_id = OBJECT_ID('dbo.pending_issues')
        `);
        console.log('FK attive:');
        console.table(fkList.recordset);

        console.log('\n✅ Migration 018 completata con successo!');

    } catch (error) {
        console.error('\n❌ Errore migration 018:', error.message);
        if (error.originalError) {
            console.error('   Dettaglio:', error.originalError.message);
        }
        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
        }
    }
}

runMigration();
