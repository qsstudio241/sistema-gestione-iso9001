-- Migration 091: colonne v1 saldatura/NDT su qualifications
-- Mancavano rispetto al controller/API (084 aggiungeva solo campi v2).
-- Idempotente: ogni ALTER usa IF NOT EXISTS su sys.columns

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'welding_process')
BEGIN
    ALTER TABLE qualifications ADD welding_process NVARCHAR(50) NULL;
    PRINT 'Colonna welding_process aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'material_group')
BEGIN
    ALTER TABLE qualifications ADD material_group NVARCHAR(50) NULL;
    PRINT 'Colonna material_group aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'position_range')
BEGIN
    ALTER TABLE qualifications ADD position_range NVARCHAR(100) NULL;
    PRINT 'Colonna position_range aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'ndt_method')
BEGIN
    ALTER TABLE qualifications ADD ndt_method NVARCHAR(50) NULL;
    PRINT 'Colonna ndt_method aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'ndt_level')
BEGIN
    ALTER TABLE qualifications ADD ndt_level INT NULL;
    PRINT 'Colonna ndt_level aggiunta.';
END

PRINT 'Migration 091 completata.';
