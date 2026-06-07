-- Migration 072: NC Hardening — push custom checklist + approvazione RQ chiusura
-- Eseguire via run-migration-072.js (no GO — driver mssql)

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_custom_item_id'
)
BEGIN
    ALTER TABLE non_conformities ADD source_custom_item_id INT NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_source_custom_item')
BEGIN
    ALTER TABLE non_conformities
    ADD CONSTRAINT FK_nc_source_custom_item
    FOREIGN KEY (source_custom_item_id) REFERENCES custom_checklist_items(id);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_nc_audit_custom_item_unique')
BEGIN
    CREATE UNIQUE INDEX IX_nc_audit_custom_item_unique
    ON non_conformities (audit_id, source_custom_item_id)
    WHERE source_custom_item_id IS NOT NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'approved_by'
)
BEGIN
    ALTER TABLE non_conformities ADD approved_by INT NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'approved_at'
)
BEGIN
    ALTER TABLE non_conformities ADD approved_at DATETIME2 NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_approved_by')
BEGIN
    ALTER TABLE non_conformities
    ADD CONSTRAINT FK_nc_approved_by
    FOREIGN KEY (approved_by) REFERENCES users(user_id);
END
