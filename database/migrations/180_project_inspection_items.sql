-- TYPE: additive
-- BACKFILL: none
-- VERIFY: n/a (solo schema, nessuna riorganizzazione dati)
-- ROLLBACK: n/a (drop solo in migrazione di cleanup successiva)
--
-- Migration 180: elenco «controlli previsti» sulla commessa (passo 3 Verbali CND).
-- Tabella nuova dbo.project_inspection_items. Non modifica le righe delle tabelle già presenti.
-- Fase: before | during | after, gli stessi valori di ndt_reports.inspection_phase (177).
-- Metodo: gli stessi codici già previsti per il verbale (VT, MT, PT, UT, RT, ET).
-- La norma di accettazione è testo libero: nessuna soglia e nessuna clausola inserita qui.
-- FK in statement separati, senza azione referenziale. projects assente (CI apply-on-empty) = skip.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.projects', N'U') IS NULL
BEGIN
    PRINT N'180: dbo.projects assente - skip (apply-on-empty).';
END
GO

IF OBJECT_ID(N'dbo.projects', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.project_inspection_items', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.project_inspection_items (
        id                   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        organization_id      INT NOT NULL,
        project_id           INT NOT NULL,
        inspection_phase     NVARCHAR(16) NULL,
        method               NVARCHAR(5) NULL,
        coverage_percent     DECIMAL(5,2) NULL,
        acceptance_standard  NVARCHAR(500) NULL,
        deleted_at           DATETIME2(7) NULL,
        deleted_by           INT NULL,
        created_at           DATETIME2(7) NOT NULL
            CONSTRAINT DF_project_inspection_items_created_at DEFAULT SYSUTCDATETIME(),
        created_by           INT NULL
    );
    PRINT N'180: tabella project_inspection_items creata.';
END
GO

IF OBJECT_ID(N'dbo.project_inspection_items', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CK_project_inspection_items_phase'
          AND parent_object_id = OBJECT_ID(N'dbo.project_inspection_items')
   )
BEGIN
    ALTER TABLE dbo.project_inspection_items
      ADD CONSTRAINT CK_project_inspection_items_phase
      CHECK (inspection_phase IS NULL OR inspection_phase IN (N'before', N'during', N'after'));
    PRINT N'180: CK fase (before, during, after) aggiunto.';
END
GO

IF OBJECT_ID(N'dbo.project_inspection_items', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CK_project_inspection_items_method'
          AND parent_object_id = OBJECT_ID(N'dbo.project_inspection_items')
   )
BEGIN
    ALTER TABLE dbo.project_inspection_items
      ADD CONSTRAINT CK_project_inspection_items_method
      CHECK (method IS NULL OR method IN (N'VT', N'MT', N'PT', N'UT', N'RT', N'ET'));
    PRINT N'180: CK metodo CND aggiunto.';
END
GO

IF OBJECT_ID(N'dbo.project_inspection_items', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CK_project_inspection_items_percent'
          AND parent_object_id = OBJECT_ID(N'dbo.project_inspection_items')
   )
BEGIN
    ALTER TABLE dbo.project_inspection_items
      ADD CONSTRAINT CK_project_inspection_items_percent
      CHECK (coverage_percent IS NULL OR (coverage_percent >= 0 AND coverage_percent <= 100));
    PRINT N'180: CK percentuale 0-100 aggiunto.';
END
GO

IF OBJECT_ID(N'dbo.project_inspection_items', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_project_inspection_items_org_project_live'
          AND object_id = OBJECT_ID(N'dbo.project_inspection_items')
   )
BEGIN
    CREATE INDEX IX_project_inspection_items_org_project_live
        ON dbo.project_inspection_items (organization_id, project_id)
        WHERE deleted_at IS NULL;
    PRINT N'180: indice sulle righe vive creato.';
END
GO

IF OBJECT_ID(N'dbo.project_inspection_items', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.projects', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = N'FK_project_inspection_items_project'
          AND parent_object_id = OBJECT_ID(N'dbo.project_inspection_items')
   )
BEGIN
    ALTER TABLE dbo.project_inspection_items
      ADD CONSTRAINT FK_project_inspection_items_project
      FOREIGN KEY (project_id) REFERENCES dbo.projects (id);
    PRINT N'180: FK verso projects creata, senza azione referenziale.';
END
GO

IF OBJECT_ID(N'dbo.project_inspection_items', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.organizations', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.organizations', N'organization_id') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = N'FK_project_inspection_items_org'
          AND parent_object_id = OBJECT_ID(N'dbo.project_inspection_items')
   )
BEGIN
    ALTER TABLE dbo.project_inspection_items
      ADD CONSTRAINT FK_project_inspection_items_org
      FOREIGN KEY (organization_id) REFERENCES dbo.organizations (organization_id);
    PRINT N'180: FK verso organizations creata, senza azione referenziale.';
END
GO
