require('dotenv').config();
const fs = require('fs'), path = require('path');
const configs = JSON.parse(fs.readFileSync(path.join(__dirname,'..','config','database.json'),'utf8'));
let c = configs.production;
if (process.env.DB_SERVER) c = {
    ...c,
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || c.port, 10),
    database: process.env.DB_DATABASE || c.database,
    user: process.env.DB_USER || c.user,
    password: process.env.DB_PASSWORD || c.password
};
const sql = require('mssql');

sql.connect({
    server: c.server, port: c.port || 1433, database: c.database,
    user: c.user, password: c.password,
    options: { trustServerCertificate: true, encrypt: true }
}).then(async pool => {
    console.log('Connesso al DB. Esecuzione migration 019 (fix pending_issues schema)...\n');

    // 1. target_audit_id ? nullable
    const needsNullable = await pool.request().query(`
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.pending_issues')
          AND name = 'target_audit_id' AND is_nullable = 0`);
    if (needsNullable.recordset.length > 0) {
        const hasFk = await pool.request().query(`
            SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_pending_issues_target_audit'`);
        if (hasFk.recordset.length > 0) {
            await pool.request().query(`ALTER TABLE [dbo].[pending_issues] DROP CONSTRAINT [FK_pending_issues_target_audit]`);
            console.log('[OK] FK_pending_issues_target_audit eliminata per alter colonna');
        }
        await pool.request().query(`ALTER TABLE [dbo].[pending_issues] ALTER COLUMN [target_audit_id] INT NULL`);
        console.log('[OK] target_audit_id reso nullable');
        await pool.request().query(`
            ALTER TABLE [dbo].[pending_issues]
            ADD CONSTRAINT [FK_pending_issues_target_audit]
            FOREIGN KEY ([target_audit_id]) REFERENCES [dbo].[audits]([audit_id])
            ON DELETE SET NULL`);
        console.log('[OK] FK_pending_issues_target_audit ricreata con ON DELETE SET NULL');
    } else {
        console.log('[--] target_audit_id già nullable - skip');
    }

    // 2. CHECK constraint status ? include 'in_progress'
    const hasCk = await pool.request().query(`
        SELECT 1 FROM sys.check_constraints WHERE name = 'CK_pending_issues_status'`);
    if (hasCk.recordset.length > 0) {
        await pool.request().query(`ALTER TABLE [dbo].[pending_issues] DROP CONSTRAINT [CK_pending_issues_status]`);
        console.log('[OK] CK_pending_issues_status eliminato');
    }
    await pool.request().query(`
        ALTER TABLE [dbo].[pending_issues]
        ADD CONSTRAINT [CK_pending_issues_status]
        CHECK ([status] IN ('open', 'in_progress', 'resolved', 'persists'))`);
    console.log('[OK] CK_pending_issues_status ricreato con in_progress');

    // 3. Aggiunge follow_up_notes
    const hasCol = await pool.request().query(`
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('dbo.pending_issues') AND name = 'follow_up_notes'`);
    if (hasCol.recordset.length === 0) {
        await pool.request().query(`ALTER TABLE [dbo].[pending_issues] ADD [follow_up_notes] NVARCHAR(MAX) NULL`);
        console.log('[OK] Colonna follow_up_notes aggiunta');
    } else {
        console.log('[--] follow_up_notes già presente - skip');
    }

    // Verifica finale
    const cols = await pool.request().query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'pending_issues'
        ORDER BY ORDINAL_POSITION`);
    console.log('\n=== Schema pending_issues post-migration ===');
    cols.recordset.forEach(r => console.log(` ${r.COLUMN_NAME} (${r.DATA_TYPE}) nullable=${r.IS_NULLABLE}`));
    console.log('\n=== Migration 019 completata ===');

    await pool.close();
}).catch(err => {
    console.error('Errore:', err.message);
    process.exit(1);
});
