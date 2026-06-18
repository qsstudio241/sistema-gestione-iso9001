-- =============================================================================
-- Migration 098 — NC Action Plan multi-fonte
-- Espande non_conformities per supportare un Piano Azioni unificato
-- ISO 9001:2015  §6.1 (rischi) + §9.3 (riesame dir.) + §10.2 (NC) + §10.3 (miglioramento)
-- =============================================================================

-- 1. Aggiunge organization_id diretto (necessario per RBAC quando audit_id = NULL)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'organization_id'
)
BEGIN
    ALTER TABLE non_conformities ADD organization_id INT NULL;
    PRINT 'Colonna organization_id aggiunta a non_conformities';
END
GO

-- 2. Backfill organization_id dalle righe esistenti tramite audit
UPDATE nc
SET    nc.organization_id = a.organization_id
FROM   non_conformities nc
INNER JOIN audits a ON nc.audit_id = a.audit_id
WHERE  nc.organization_id IS NULL;
PRINT 'Backfill organization_id completato';
GO

-- 3. FK organization_id → organizations
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_organization')
BEGIN
    ALTER TABLE non_conformities
    ADD CONSTRAINT FK_nc_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
    PRINT 'FK_nc_organization aggiunto';
END
GO

-- 4. Aggiunge source_category (categoria di business dell''origine azione)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_category'
)
BEGIN
    ALTER TABLE non_conformities ADD source_category NVARCHAR(50) NULL;
    PRINT 'Colonna source_category aggiunta a non_conformities';
END
GO

-- 5. Backfill: tutte le righe esistenti sono legate ad audit
UPDATE non_conformities
SET    source_category = 'audit'
WHERE  source_category IS NULL;
PRINT 'Backfill source_category completato';
GO

-- 6. CHECK constraint source_category
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_nc_source_category')
BEGIN
    ALTER TABLE non_conformities
    ADD CONSTRAINT CK_nc_source_category CHECK (source_category IN (
        'audit', 'complaint', 'risk_action', 'management_review',
        'improvement', 'operational', 'external_audit'
    ));
    PRINT 'CK_nc_source_category aggiunto';
END
GO

-- 7. Aggiunge source_origin_text (descrizione libera dell''origine per categorie non-audit)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_origin_text'
)
BEGIN
    ALTER TABLE non_conformities ADD source_origin_text NVARCHAR(255) NULL;
    PRINT 'Colonna source_origin_text aggiunta a non_conformities';
END
GO

-- 8. Rende audit_id nullable: prima rileva e rimuove tutti i FK verso audits
DECLARE @fkName NVARCHAR(256);
DECLARE fk_cursor CURSOR FOR
    SELECT name FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('non_conformities')
      AND referenced_object_id = OBJECT_ID('audits');

OPEN fk_cursor;
FETCH NEXT FROM fk_cursor INTO @fkName;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC('ALTER TABLE non_conformities DROP CONSTRAINT [' + @fkName + ']');
    PRINT 'Rimosso FK: ' + @fkName;
    FETCH NEXT FROM fk_cursor INTO @fkName;
END
CLOSE fk_cursor;
DEALLOCATE fk_cursor;
GO

ALTER TABLE non_conformities ALTER COLUMN audit_id INT NULL;
PRINT 'audit_id reso nullable';
GO

-- 9. Ri-aggiunge FK audit_id (ora nullable)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_audit_ref')
BEGIN
    ALTER TABLE non_conformities
    ADD CONSTRAINT FK_nc_audit_ref FOREIGN KEY (audit_id) REFERENCES audits(audit_id);
    PRINT 'FK_nc_audit_ref ri-aggiunto';
END
GO

-- 10. Indice su source_category per filtri veloci
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_nc_source_category' AND object_id = OBJECT_ID('non_conformities')
)
BEGIN
    CREATE INDEX IX_nc_source_category ON non_conformities(source_category);
    PRINT 'IX_nc_source_category creato';
END
GO

-- 11. Indice composto (organization_id, source_category) per list query
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_nc_org_category' AND object_id = OBJECT_ID('non_conformities')
)
BEGIN
    CREATE INDEX IX_nc_org_category ON non_conformities(organization_id, source_category);
    PRINT 'IX_nc_org_category creato';
END
GO

PRINT '=== Migration 098 completata ===';
GO
