-- TYPE: additive
-- BACKFILL: none
-- VERIFY: 174_verify.sql
-- ROLLBACK: 174_rollback.sql
--
-- Migration 174 (WV-3, D9 forma A): tabella di legame dbo.wps_wpqr_links tra WPS e WPQR.
-- Colonne: id (PK), organization_id, wps_id, wpqr_id, role (primary|supporting, solo applicativo), created_at, created_by.
-- UNIQUE (wps_id, wpqr_id); indice (organization_id, wpqr_id); DUE FK in statement separati, SENZA ON DELETE.
-- Nessun backfill: nessun link viene creato dalla migrazione. wpqr_records.wps_id resta invariata.
-- La coerenza di organization_id con WPS e WPQR collegate e le cancellazioni (link prima di WPS/WPQR) sono a carico
-- dell'applicazione; 174_verify.sql conta le righe incoerenti.
-- Idempotente; welding_procedures o wpqr_records assenti (CI apply-on-empty) -> no-op.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NULL
   OR OBJECT_ID(N'dbo.wpqr_records', N'U') IS NULL
BEGIN
    PRINT N'174: dbo.welding_procedures o dbo.wpqr_records assenti - skip (apply-on-empty / gap pre-169).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wps_wpqr_links (
        id               INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        organization_id  INT NOT NULL,
        wps_id           INT NOT NULL,
        wpqr_id          INT NOT NULL,
        role             NVARCHAR(20) NULL,
        created_at       DATETIME2 NOT NULL CONSTRAINT DF_wps_wpqr_links_created_at DEFAULT GETDATE(),
        created_by       INT NULL
    );
    PRINT N'174: tabella wps_wpqr_links creata.';
END
GO

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.key_constraints
        WHERE name = N'UQ_wps_wpqr_links_wps_wpqr'
          AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
   )
BEGIN
    ALTER TABLE dbo.wps_wpqr_links
        ADD CONSTRAINT UQ_wps_wpqr_links_wps_wpqr UNIQUE (wps_id, wpqr_id);
    PRINT N'174: UNIQUE (wps_id, wpqr_id) creato.';
END
GO

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wps_wpqr_links_org_wpqr'
          AND object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
   )
BEGIN
    CREATE INDEX IX_wps_wpqr_links_org_wpqr ON dbo.wps_wpqr_links (organization_id, wpqr_id);
    PRINT N'174: indice IX_wps_wpqr_links_org_wpqr creato.';
END
GO

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = N'FK_wps_wpqr_links_wps'
          AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
   )
BEGIN
    ALTER TABLE dbo.wps_wpqr_links
        ADD CONSTRAINT FK_wps_wpqr_links_wps FOREIGN KEY (wps_id) REFERENCES dbo.welding_procedures (id);
    PRINT N'174: FK_wps_wpqr_links_wps creata (nessuna azione referenziale).';
END
GO

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = N'FK_wps_wpqr_links_wpqr'
          AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
   )
BEGIN
    ALTER TABLE dbo.wps_wpqr_links
        ADD CONSTRAINT FK_wps_wpqr_links_wpqr FOREIGN KEY (wpqr_id) REFERENCES dbo.wpqr_records (id);
    PRINT N'174: FK_wps_wpqr_links_wpqr creata (nessuna azione referenziale).';
END
GO
