-- TYPE: additive
-- BACKFILL: none
-- VERIFY: 181_verify.sql
-- ROLLBACK: 181_rollback.sql
--
-- Campi WPS da ISO 15609-1:2019 §4 che oggi stanno solo in memoria (generatore)
-- o nel PDF, non su welding_procedures. Tutte NULL: i record esistenti restano validi.
-- Non è backfill da PDF WPS (niente voce Rielaborazioni): i valori arrivano dal
-- generatore WPS←WPQR o da modifica manuale dopo il sì del committente.
-- Nessuna FK e nessun ON DELETE.
--
-- Apply: solo TEST, dopo backup COPY_ONLY + CHECKSUM + VERIFYONLY.
-- Runner: backend/scripts/run-migration-181-vps.js (SGQ_MIGRATION_TARGET=test).
-- PROD: non applicare.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'wpqr_ref') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD wpqr_ref NVARCHAR(120) NULL;
    PRINT N'181: welding_procedures.wpqr_ref aggiunta (ISO 15609-1 §4.2).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'parent_material_a') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD parent_material_a NVARCHAR(120) NULL;
    PRINT N'181: welding_procedures.parent_material_a aggiunta (ISO 15609-1 §4.3.1).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'parent_material_b') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD parent_material_b NVARCHAR(120) NULL;
    PRINT N'181: welding_procedures.parent_material_b aggiunta (ISO 15609-1 §4.3.1).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'heat_input') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD heat_input NVARCHAR(120) NULL;
    PRINT N'181: welding_procedures.heat_input aggiunta (ISO 15609-1 §4.4.17).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'current_range') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD current_range NVARCHAR(80) NULL;
    PRINT N'181: welding_procedures.current_range aggiunta (ISO 15609-1 §4.4.9).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'voltage_range') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD voltage_range NVARCHAR(80) NULL;
    PRINT N'181: welding_procedures.voltage_range aggiunta (ISO 15609-1 §4.4.9).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'metal_transfer') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD metal_transfer NVARCHAR(80) NULL;
    PRINT N'181: welding_procedures.metal_transfer aggiunta (ISO 15609-1 §4.5 / 15614 transfer).';
END
GO
