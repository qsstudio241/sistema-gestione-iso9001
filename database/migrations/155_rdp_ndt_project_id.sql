-- Migration 155 — Ponte RDP/NDT ↔ commessa ISO 3834 (slice ISO-7)
-- project_id opzionale su rdp_reports e ndt_reports.
-- Idempotente. Niente USE / GO. FK ON DELETE SET NULL (niente CASCADE).

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'rdp_reports' AND COLUMN_NAME = 'project_id'
)
BEGIN
    ALTER TABLE dbo.rdp_reports ADD project_id INT NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ndt_reports' AND COLUMN_NAME = 'project_id'
)
BEGIN
    ALTER TABLE dbo.ndt_reports ADD project_id INT NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_rdp_project')
BEGIN
    ALTER TABLE dbo.rdp_reports
    ADD CONSTRAINT FK_rdp_project
        FOREIGN KEY (project_id) REFERENCES dbo.projects(id)
        ON DELETE SET NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ndt_project')
BEGIN
    ALTER TABLE dbo.ndt_reports
    ADD CONSTRAINT FK_ndt_project
        FOREIGN KEY (project_id) REFERENCES dbo.projects(id)
        ON DELETE SET NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_rdp_project_id' AND object_id = OBJECT_ID('dbo.rdp_reports')
)
BEGIN
    CREATE INDEX IX_rdp_project_id ON dbo.rdp_reports(project_id);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_ndt_project_id' AND object_id = OBJECT_ID('dbo.ndt_reports')
)
BEGIN
    CREATE INDEX IX_ndt_project_id ON dbo.ndt_reports(project_id);
END
