-- Rollback di 174_wps_wpqr_links.sql (NON eseguito dal runner: file manuale, solo su richiesta esplicita).
-- ATTENZIONE: elimina TUTTI i link WPS-WPQR presenti in dbo.wps_wpqr_links, anche quelli scritti dopo l'apply.
-- Fare un backup prima. Ordine: FK, UNIQUE, indice, tabella. Idempotente.
-- Rimuove SOLO gli oggetti creati da 174.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_wps_wpqr_links_wps' AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links'))
BEGIN
    ALTER TABLE dbo.wps_wpqr_links DROP CONSTRAINT FK_wps_wpqr_links_wps;
    PRINT N'174 rollback: FK_wps_wpqr_links_wps rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_wps_wpqr_links_wpqr' AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links'))
BEGIN
    ALTER TABLE dbo.wps_wpqr_links DROP CONSTRAINT FK_wps_wpqr_links_wpqr;
    PRINT N'174 rollback: FK_wps_wpqr_links_wpqr rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_wps_wpqr_links_wps_wpqr' AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links'))
BEGIN
    ALTER TABLE dbo.wps_wpqr_links DROP CONSTRAINT UQ_wps_wpqr_links_wps_wpqr;
    PRINT N'174 rollback: UNIQUE (wps_id, wpqr_id) rimosso.';
END
GO

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wps_wpqr_links_org_wpqr' AND object_id = OBJECT_ID(N'dbo.wps_wpqr_links'))
BEGIN
    DROP INDEX IX_wps_wpqr_links_org_wpqr ON dbo.wps_wpqr_links;
    PRINT N'174 rollback: indice IX_wps_wpqr_links_org_wpqr rimosso.';
END
GO

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.wps_wpqr_links;
    PRINT N'174 rollback: tabella wps_wpqr_links rimossa.';
END
GO
