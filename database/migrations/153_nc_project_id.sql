-- Migration 153 — Ponte NC ↔ commessa ISO 3834 (slice ISO-6)
-- project_id opzionale: una NC può esistere senza commessa.
-- Idempotente. Niente USE / GO (runner Node VPS).
-- FK: ON DELETE SET NULL (niente CASCADE).

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo'
      AND TABLE_NAME = 'non_conformities'
      AND COLUMN_NAME = 'project_id'
)
BEGIN
    ALTER TABLE dbo.non_conformities ADD project_id INT NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_project')
BEGIN
    ALTER TABLE dbo.non_conformities
    ADD CONSTRAINT FK_nc_project
        FOREIGN KEY (project_id) REFERENCES dbo.projects(id)
        ON DELETE SET NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_nc_project_id' AND object_id = OBJECT_ID('dbo.non_conformities')
)
BEGIN
    CREATE INDEX IX_nc_project_id ON dbo.non_conformities(project_id);
END
