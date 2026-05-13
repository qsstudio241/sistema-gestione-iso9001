/**
 * Esegue la migrazione 052 (NC <-> audit integration) sul DB SQL Server.
 * Statement dichiarati esplicitamente in array per garantire ordine ed evitare problemi di split.
 */

const fs = require('fs');

try {
    require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
} catch (_) {
    try {
        const envText = fs.readFileSync('/var/www/sgq-backend/.env', 'utf8');
        envText.split(/\r?\n/).forEach(line => {
            const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/i.exec(line.trim());
            if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        });
    } catch (e) {
        console.warn('[migration 052] .env load fail:', e.message);
    }
}
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { getPool } = require('/var/www/sgq-backend/src/config/database');

const STATEMENTS = [
    {
        name: 'add non_conformities.source_type',
        sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_type')
              ALTER TABLE [dbo].[non_conformities]
              ADD [source_type] NVARCHAR(20) NULL
                  CONSTRAINT [CK_nc_source_type] CHECK ([source_type] IN ('audit_nc', 'audit_oss', 'manual', 'reaudit_persists'));`
    },
    {
        name: 'add non_conformities.source_pending_issue_id',
        sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_pending_issue_id')
              ALTER TABLE [dbo].[non_conformities] ADD [source_pending_issue_id] INT NULL;`
    },
    {
        name: 'add non_conformities.source_question_id',
        sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_question_id')
              ALTER TABLE [dbo].[non_conformities] ADD [source_question_id] INT NULL;`
    },
    {
        name: 'add pending_issues.nc_id',
        sql: `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'pending_issues' AND COLUMN_NAME = 'nc_id')
              ALTER TABLE [dbo].[pending_issues] ADD [nc_id] INT NULL;`
    },
    {
        name: 'FK FK_nc_source_pending',
        sql: `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_source_pending')
              ALTER TABLE [dbo].[non_conformities]
              ADD CONSTRAINT [FK_nc_source_pending]
              FOREIGN KEY ([source_pending_issue_id]) REFERENCES [dbo].[pending_issues]([issue_id])
              ON DELETE NO ACTION;`
    },
    {
        name: 'FK FK_nc_source_question',
        sql: `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_source_question')
              ALTER TABLE [dbo].[non_conformities]
              ADD CONSTRAINT [FK_nc_source_question]
              FOREIGN KEY ([source_question_id]) REFERENCES [dbo].[checklist_questions]([question_id])
              ON DELETE NO ACTION;`
    },
    {
        name: 'FK FK_pending_issues_nc',
        sql: `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_pending_issues_nc')
              ALTER TABLE [dbo].[pending_issues]
              ADD CONSTRAINT [FK_pending_issues_nc]
              FOREIGN KEY ([nc_id]) REFERENCES [dbo].[non_conformities]([nc_id])
              ON DELETE NO ACTION;`
    },
    {
        name: 'IX_nc_source_pending',
        sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_nc_source_pending')
              CREATE INDEX [IX_nc_source_pending]
              ON [dbo].[non_conformities] ([source_pending_issue_id])
              WHERE [source_pending_issue_id] IS NOT NULL;`
    },
    {
        name: 'IX_pending_issues_nc',
        sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pending_issues_nc')
              CREATE INDEX [IX_pending_issues_nc]
              ON [dbo].[pending_issues] ([nc_id])
              WHERE [nc_id] IS NOT NULL;`
    },
    {
        name: 'IX_nc_audit_question_unique',
        sql: `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_nc_audit_question_unique')
              CREATE UNIQUE INDEX [IX_nc_audit_question_unique]
              ON [dbo].[non_conformities] ([audit_id], [source_question_id])
              WHERE [source_question_id] IS NOT NULL;`
    },
];

async function run() {
    console.log(`[migration 052] avvio - ${STATEMENTS.length} statement`);
    const pool = await getPool();
    for (let i = 0; i < STATEMENTS.length; i++) {
        const stmt = STATEMENTS[i];
        try {
            await pool.request().query(stmt.sql);
            console.log(`[migration 052] ${i + 1}/${STATEMENTS.length} OK | ${stmt.name}`);
        } catch (err) {
            console.error(`[migration 052] ${i + 1}/${STATEMENTS.length} FAIL | ${stmt.name}`);
            console.error('   ' + err.message);
            process.exit(1);
        }
    }

    // Verifica finale
    const verify = await pool.request().query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'non_conformities'
          AND COLUMN_NAME IN ('source_type', 'source_pending_issue_id', 'source_question_id')
        UNION ALL
        SELECT 'pending_issues.' + COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'pending_issues' AND COLUMN_NAME = 'nc_id'
    `);
    console.log('[migration 052] colonne verificate:', verify.recordset.map(r => r.COLUMN_NAME).join(', '));
    console.log('[migration 052] completata!');
    process.exit(0);
}

run().catch(err => { console.error('[migration 052] fatal:', err); process.exit(1); });
