-- TYPE: additive
-- BACKFILL: none
-- VERIFY: 182_verify.sql
-- ROLLBACK: 182_rollback.sql
--
-- Campi WPS da ISO 15609-1:2019 Annex A già presenti sulla WPQR collegata
-- (wpqr_records) ma non su welding_procedures, più persistenza di gola e
-- diametro tubo dalla richiesta di generazione. Tutte NULL: i record
-- esistenti restano validi. Nessun backfill da PDF WPS (niente voce
-- Rielaborazioni): i valori arrivano dal generatore WPS←WPQR.
-- Nessuna FK e nessun ON DELETE.
--
-- 8 campi logici da WPQR:
--   preparazione/pulizia, meccanizzazione, portata gas, post-riscaldo,
--   dettagli PWHT, pendolamento (bead_technique), distanza tubo contatto,
--   angolo torcia.
-- Più throat_mm e pipe_diameter_max (min già esiste) dalla richiesta.
--
-- Apply: solo TEST, dopo backup COPY_ONLY + CHECKSUM + VERIFYONLY.
-- Runner: backend/scripts/run-migration-182-vps.js (SGQ_MIGRATION_TARGET=test).
-- PROD: non applicare.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'joint_preparation') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD joint_preparation NVARCHAR(100) NULL;
    PRINT N'182: welding_procedures.joint_preparation aggiunta (ISO 15609-1 §4.4.4).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'cleaning_method') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD cleaning_method NVARCHAR(100) NULL;
    PRINT N'182: welding_procedures.cleaning_method aggiunta (ISO 15609-1 §4.4.4).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'mechanization') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD mechanization NVARCHAR(80) NULL;
    PRINT N'182: welding_procedures.mechanization aggiunta (ISO 15609-1 §4.4.15).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'shielding_gas_flow_l_min_min') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD shielding_gas_flow_l_min_min DECIMAL(8,2) NULL;
    PRINT N'182: welding_procedures.shielding_gas_flow_l_min_min aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'shielding_gas_flow_l_min_max') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD shielding_gas_flow_l_min_max DECIMAL(8,2) NULL;
    PRINT N'182: welding_procedures.shielding_gas_flow_l_min_max aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'post_heating') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD post_heating NVARCHAR(100) NULL;
    PRINT N'182: welding_procedures.post_heating aggiunta (ISO 15609-1 §4.4.14).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'pwht_details') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD pwht_details NVARCHAR(300) NULL;
    PRINT N'182: welding_procedures.pwht_details aggiunta (ISO 15609-1 §4.4.12).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'bead_technique') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD bead_technique NVARCHAR(80) NULL;
    PRINT N'182: welding_procedures.bead_technique aggiunta (weaving / pendolamento).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'contact_tube_distance_mm_min') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD contact_tube_distance_mm_min DECIMAL(8,2) NULL;
    PRINT N'182: welding_procedures.contact_tube_distance_mm_min aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'contact_tube_distance_mm_max') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD contact_tube_distance_mm_max DECIMAL(8,2) NULL;
    PRINT N'182: welding_procedures.contact_tube_distance_mm_max aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'torch_angle_deg') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD torch_angle_deg DECIMAL(8,2) NULL;
    PRINT N'182: welding_procedures.torch_angle_deg aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'throat_mm') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD throat_mm DECIMAL(8,2) NULL;
    PRINT N'182: welding_procedures.throat_mm aggiunta (gola FW dalla richiesta).';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'pipe_diameter_max') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD pipe_diameter_max DECIMAL(8,2) NULL;
    PRINT N'182: welding_procedures.pipe_diameter_max aggiunta (diametro tubo²).';
END
GO
