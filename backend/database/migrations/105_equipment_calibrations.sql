-- Migration 102: Storico tarature strumenti (event log append-only)

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'equipment_calibrations')
BEGIN
    CREATE TABLE equipment_calibrations (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        asset_id                INT           NOT NULL,  -- FK equipment_assets.id

        calibration_date        DATE          NOT NULL,
        next_calibration_date   DATE          NOT NULL,
        calibrated_by           NVARCHAR(200) NULL,      -- ente o persona che ha effettuato la taratura
        certificate_number      NVARCHAR(100) NULL,
        result                  NVARCHAR(20)  NOT NULL DEFAULT 'pass',
            -- 'pass' | 'fail' | 'conditional'

        -- Allegato certificato PDF (usa tabella attachments esistente)
        attachment_id           INT           NULL,      -- FK attachments.attachment_id

        notes                   NVARCHAR(MAX) NULL,
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        created_by              INT           NULL       -- FK users.user_id
    );

    CREATE INDEX IX_equipment_calibrations_asset ON equipment_calibrations (asset_id);
    CREATE INDEX IX_equipment_calibrations_date ON equipment_calibrations (calibration_date DESC);

    PRINT 'Tabella equipment_calibrations creata.';
END
ELSE
    PRINT 'Tabella equipment_calibrations gia'' esistente — skip.';

-- FK separato (pattern SQL Server del repo)
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_equipment_calibrations_asset'
)
BEGIN
    ALTER TABLE equipment_calibrations
        ADD CONSTRAINT FK_equipment_calibrations_asset
        FOREIGN KEY (asset_id) REFERENCES equipment_assets (id);
    PRINT 'FK_equipment_calibrations_asset aggiunta.';
END
