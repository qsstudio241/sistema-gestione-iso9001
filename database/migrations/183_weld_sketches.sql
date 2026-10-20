-- TYPE: additive
-- BACKFILL: none
-- VERIFY: 183_verify.sql
-- ROLLBACK: 183_rollback.sql
--
-- Libreria schizzi di giunto (ISO 15609-1 Annex A, celle Joint design |
-- Welding sequences). PNG nello storage allegati, mai base64 in DB.
-- organization_id NOT NULL (libreria per studio). Nessun FK e nessun
-- ON DELETE. Colonne WPS nullable: joint_sketch_id, sequence_sketch_id.
-- Nessun backfill. Status iniziale 'bozza' fino a conferma in Rivedi.
--
-- Apply: solo TEST, dopo backup COPY_ONLY + CHECKSUM + VERIFYONLY.
-- Runner: backend/scripts/run-migration-183-vps.js (SGQ_MIGRATION_TARGET=test).
-- PROD: non applicare.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.weld_sketches', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.weld_sketches (
        id               INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        organization_id  INT NOT NULL,
        company_id       INT NULL,
        slot             NVARCHAR(20) NOT NULL,
        source_kind      NVARCHAR(20) NOT NULL,
        wpqr_id          INT NULL,
        source_attachment_id INT NULL,
        source_page      INT NULL,
        crop_bbox_pt     NVARCHAR(60) NULL,
        file_url         NVARCHAR(500) NOT NULL,
        width_px         INT NULL,
        height_px        INT NULL,
        sha256           CHAR(64) NULL,
        joint_type       NVARCHAR(10) NULL,
        preparation      NVARCHAR(40) NULL,
        product_form     NVARCHAR(20) NULL,
        thickness_min_mm DECIMAL(8,2) NULL,
        thickness_max_mm DECIMAL(8,2) NULL,
        throat_mm        DECIMAL(6,2) NULL,
        outside_diameter_mm DECIMAL(8,2) NULL,
        process_iso4063  NVARCHAR(20) NULL,
        position_iso6947 NVARCHAR(20) NULL,
        run_mode         NVARCHAR(10) NULL,
        n_passes         INT NULL,
        backing          NVARCHAR(40) NULL,
        dimension_text   NVARCHAR(200) NULL,
        status           NVARCHAR(20) NOT NULL CONSTRAINT DF_weld_sketches_status DEFAULT N'bozza',
        created_by       INT NULL,
        created_at       DATETIME2 NOT NULL CONSTRAINT DF_weld_sketches_created_at DEFAULT GETDATE()
    );
    PRINT N'183: tabella weld_sketches creata.';
END
GO

IF OBJECT_ID(N'dbo.weld_sketches', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_weld_sketches_org_company'
          AND object_id = OBJECT_ID(N'dbo.weld_sketches')
   )
BEGIN
    CREATE INDEX IX_weld_sketches_org_company
        ON dbo.weld_sketches (organization_id, company_id, status, slot);
    PRINT N'183: indice IX_weld_sketches_org_company creato.';
END
GO

IF OBJECT_ID(N'dbo.weld_sketches', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_weld_sketches_wpqr'
          AND object_id = OBJECT_ID(N'dbo.weld_sketches')
   )
BEGIN
    CREATE INDEX IX_weld_sketches_wpqr
        ON dbo.weld_sketches (organization_id, wpqr_id);
    PRINT N'183: indice IX_weld_sketches_wpqr creato.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'joint_sketch_id') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD joint_sketch_id INT NULL;
    PRINT N'183: welding_procedures.joint_sketch_id aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'sequence_sketch_id') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD sequence_sketch_id INT NULL;
    PRINT N'183: welding_procedures.sequence_sketch_id aggiunta.';
END
GO
