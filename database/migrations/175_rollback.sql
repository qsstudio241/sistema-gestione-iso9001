-- NON APPLICARE senza sì del committente.
-- Rollback manuale di 175_entity_change_log.sql. Non è eseguito dal runner.
-- Elimina la tabella dbo.entity_change_log e quindi tutte le righe di log già scritte.
-- Fare un backup prima, se la tabella contiene eventi.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.entity_change_log', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_entity_change_log_entity' AND object_id = OBJECT_ID(N'dbo.entity_change_log'))
BEGIN
    DROP INDEX IX_entity_change_log_entity ON dbo.entity_change_log;
    PRINT N'175 rollback: indice entità rimosso.';
END
GO

IF OBJECT_ID(N'dbo.entity_change_log', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_entity_change_log_org_created' AND object_id = OBJECT_ID(N'dbo.entity_change_log'))
BEGIN
    DROP INDEX IX_entity_change_log_org_created ON dbo.entity_change_log;
    PRINT N'175 rollback: indice org rimosso.';
END
GO

IF OBJECT_ID(N'dbo.entity_change_log', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_entity_change_log_entity_ref' AND parent_object_id = OBJECT_ID(N'dbo.entity_change_log'))
BEGIN
    ALTER TABLE dbo.entity_change_log DROP CONSTRAINT CK_entity_change_log_entity_ref;
    PRINT N'175 rollback: CHECK entity_ref rimosso.';
END
GO

IF OBJECT_ID(N'dbo.entity_change_log', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_entity_change_log_action' AND parent_object_id = OBJECT_ID(N'dbo.entity_change_log'))
BEGIN
    ALTER TABLE dbo.entity_change_log DROP CONSTRAINT CK_entity_change_log_action;
    PRINT N'175 rollback: CHECK action rimosso.';
END
GO

IF OBJECT_ID(N'dbo.entity_change_log', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.entity_change_log;
    PRINT N'175 rollback: tabella entity_change_log rimossa.';
END
GO
