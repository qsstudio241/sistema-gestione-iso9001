/**
 * Migration 017 - ALTER TABLE attachments
 * Aggiunge: question_id (link a domanda checklist) + category (classificazione file)
 * 
 * Eseguire con: node migration-017.js
 * SAFE TO RUN MULTIPLE TIMES - verifica esistenza prima di ogni ALTER
 * 
 * ISO 9001:2015 - 7.5.3: Controllo informazioni documentate
 */

require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER || 'busaborl_admin',
    password: process.env.DB_PASSWORD || 'Ag63.busato',
    server: process.env.DB_SERVER || 'busato.selfip.com',
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
        // 1. Aggiungi colonna question_id
        // ────────────────────────────────────────────────
        console.log('\n📝 [1/5] Aggiunta colonna question_id...');
        const qidCheck = await pool.request().query(`
            SELECT 1 FROM sys.columns 
            WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'question_id'
        `);

        if (qidCheck.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE [dbo].[attachments]
                ADD [question_id] INT NULL
            `);
            console.log('   ✅ Colonna question_id aggiunta');
        } else {
            console.log('   ⏭️  question_id già presente - skip');
        }

        // ────────────────────────────────────────────────
        // 2. Aggiungi FK question_id → checklist_questions
        // ────────────────────────────────────────────────
        console.log('\n📝 [2/5] Aggiunta FK question_id...');
        const fkCheck = await pool.request().query(`
            SELECT 1 FROM sys.foreign_keys 
            WHERE name = 'FK_attachments_question_id'
        `);

        if (fkCheck.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE [dbo].[attachments]
                ADD CONSTRAINT [FK_attachments_question_id]
                FOREIGN KEY ([question_id]) REFERENCES [dbo].[checklist_questions]([question_id])
                ON DELETE SET NULL
            `);
            console.log('   ✅ FK FK_attachments_question_id aggiunta');
        } else {
            console.log('   ⏭️  FK già presente - skip');
        }

        // ────────────────────────────────────────────────
        // 3. Aggiungi colonna category
        // ────────────────────────────────────────────────
        console.log('\n📝 [3/5] Aggiunta colonna category...');
        const catCheck = await pool.request().query(`
            SELECT 1 FROM sys.columns 
            WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'category'
        `);

        if (catCheck.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE [dbo].[attachments]
                ADD [category] NVARCHAR(20) NOT NULL
                CONSTRAINT [DF_attachments_category] DEFAULT 'document'
            `);
            console.log('   ✅ Colonna category aggiunta (default: document)');
        } else {
            console.log('   ⏭️  category già presente - skip');
        }

        // ────────────────────────────────────────────────
        // 4. Aggiungi CHECK constraint su category
        // ────────────────────────────────────────────────
        console.log('\n📝 [4/5] Aggiunta CHECK constraint category...');
        const ckCheck = await pool.request().query(`
            SELECT 1 FROM sys.check_constraints 
            WHERE name = 'CK_attachments_category'
        `);

        if (ckCheck.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE [dbo].[attachments]
                ADD CONSTRAINT [CK_attachments_category]
                CHECK ([category] IN ('photo', 'document', 'audio', 'video'))
            `);
            console.log('   ✅ CHECK constraint CK_attachments_category aggiunto');
        } else {
            console.log('   ⏭️  CHECK constraint già presente - skip');
        }

        // ────────────────────────────────────────────────
        // 5. Backfill category in base al MIME type
        // ────────────────────────────────────────────────
        console.log('\n📝 [5/5] Backfill category per allegati esistenti...');
        const updateResult = await pool.request().query(`
            UPDATE [dbo].[attachments]
            SET [category] = 
                CASE 
                    WHEN [file_type] LIKE 'image/%' THEN 'photo'
                    WHEN [file_type] LIKE 'audio/%' THEN 'audio'
                    WHEN [file_type] LIKE 'video/%' THEN 'video'
                    ELSE 'document'
                END
            WHERE [category] = 'document'
        `);
        console.log(`   ✅ ${updateResult.rowsAffected[0]} righe aggiornate`);

        // ────────────────────────────────────────────────
        // 6. Indice
        // ────────────────────────────────────────────────
        const idxCheck = await pool.request().query(`
            SELECT 1 FROM sys.indexes 
            WHERE object_id = OBJECT_ID('dbo.attachments') 
            AND name = 'IX_attachments_audit_question'
        `);

        if (idxCheck.recordset.length === 0) {
            await pool.request().query(`
                CREATE INDEX [IX_attachments_audit_question]
                ON [dbo].[attachments] ([audit_id], [question_id])
            `);
            console.log('\n   ✅ Indice IX_attachments_audit_question creato');
        }

        // ────────────────────────────────────────────────
        // Verifica finale
        // ────────────────────────────────────────────────
        console.log('\n📊 Schema finale tabella attachments:');
        const schema = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'attachments'
            ORDER BY ORDINAL_POSITION
        `);
        console.table(schema.recordset);

        console.log('\n✅ Migration 017 completata con successo!');

    } catch (error) {
        console.error('\n❌ Errore migration 017:', error.message);
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
