/**
 * run-migration-098-vps.js — NC Action Plan multi-fonte (esecuzione VPS)
 * Usa la configurazione DB del backend installato sul VPS.
 * Eseguire con: node /tmp/run-migration-098-vps.js (dopo scp sul VPS)
 */
const sql = require('/var/www/sgq-backend/node_modules/mssql');
const path = require('path');
const fs = require('fs');

const dbConfig = require('/var/www/sgq-backend/src/config/database');

// Legge il file SQL passato come argomento o usa il path di default
const sqlPath = process.argv[2] || path.join(__dirname, '../../database/migrations/098_nc_action_plan.sql');

async function runMigration() {
    let SQL;
    try {
        SQL = fs.readFileSync(sqlPath, 'utf8');
    } catch {
        // Fallback: SQL inline per esecuzione sul VPS senza accesso ai file locali
        SQL = `
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='non_conformities' AND COLUMN_NAME='organization_id')
BEGIN ALTER TABLE non_conformities ADD organization_id INT NULL; PRINT 'organization_id aggiunto'; END
GO
UPDATE nc SET nc.organization_id = a.organization_id FROM non_conformities nc INNER JOIN audits a ON nc.audit_id = a.audit_id WHERE nc.organization_id IS NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_nc_organization')
BEGIN ALTER TABLE non_conformities ADD CONSTRAINT FK_nc_organization FOREIGN KEY (organization_id) REFERENCES organizations(organization_id); END
GO
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='non_conformities' AND COLUMN_NAME='source_category')
BEGIN ALTER TABLE non_conformities ADD source_category NVARCHAR(50) NULL; END
GO
UPDATE non_conformities SET source_category='audit' WHERE source_category IS NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name='CK_nc_source_category')
BEGIN ALTER TABLE non_conformities ADD CONSTRAINT CK_nc_source_category CHECK (source_category IN ('audit','complaint','risk_action','management_review','improvement','operational','external_audit')); END
GO
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='non_conformities' AND COLUMN_NAME='source_origin_text')
BEGIN ALTER TABLE non_conformities ADD source_origin_text NVARCHAR(255) NULL; END
GO
DECLARE @fkName NVARCHAR(256); DECLARE fk_cursor CURSOR FOR SELECT name FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('non_conformities') AND referenced_object_id=OBJECT_ID('audits'); OPEN fk_cursor; FETCH NEXT FROM fk_cursor INTO @fkName; WHILE @@FETCH_STATUS=0 BEGIN EXEC('ALTER TABLE non_conformities DROP CONSTRAINT ['+@fkName+']'); FETCH NEXT FROM fk_cursor INTO @fkName; END CLOSE fk_cursor; DEALLOCATE fk_cursor;
GO
ALTER TABLE non_conformities ALTER COLUMN audit_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_nc_audit_ref') BEGIN ALTER TABLE non_conformities ADD CONSTRAINT FK_nc_audit_ref FOREIGN KEY (audit_id) REFERENCES audits(audit_id); END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_nc_source_category' AND object_id=OBJECT_ID('non_conformities')) BEGIN CREATE INDEX IX_nc_source_category ON non_conformities(source_category); END
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_nc_org_category' AND object_id=OBJECT_ID('non_conformities')) BEGIN CREATE INDEX IX_nc_org_category ON non_conformities(organization_id, source_category); END
GO
PRINT 'Migration 098 completata';
GO
        `;
    }

    const batches = SQL
        .split(/^\s*GO\s*$/gim)
        .map(b => b.trim())
        .filter(Boolean);

    const pool = await sql.connect(dbConfig);
    try {
        for (let i = 0; i < batches.length; i++) {
            process.stdout.write(`Batch ${i + 1}/${batches.length}... `);
            await pool.request().query(batches[i]);
            console.log('OK');
        }
        console.log('=== Migration 098 completata ===');
    } finally {
        await pool.close();
    }
}

runMigration().catch(err => {
    console.error('ERRORE migration 098:', err.message);
    process.exit(1);
});
