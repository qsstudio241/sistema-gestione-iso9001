-- ============================================================
-- Migration 133: WPQR — campi copertura (pag.1 RANGE OF QUALIFICATION)
--                + parametri prova (pag.2) — DEPUTYTASK1 25/07/2026
-- Aggiunge SOLO colonne mancanti a wpqr_records (idempotente).
-- Tutte le colonne sono NULLABLE — nessun impatto sui record esistenti.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='qualification_level')
    ALTER TABLE wpqr_records ADD qualification_level NVARCHAR(10);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='joint_type')
    ALTER TABLE wpqr_records ADD joint_type NVARCHAR(50);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='standard_reference')
    ALTER TABLE wpqr_records ADD standard_reference NVARCHAR(100);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='wps_ref')
    ALTER TABLE wpqr_records ADD wps_ref NVARCHAR(100);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='base_material_spec')
    ALTER TABLE wpqr_records ADD base_material_spec NVARCHAR(100);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='shielding_gas')
    ALTER TABLE wpqr_records ADD shielding_gas NVARCHAR(100);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='current_type')
    ALTER TABLE wpqr_records ADD current_type NVARCHAR(40);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='metal_transfer')
    ALTER TABLE wpqr_records ADD metal_transfer NVARCHAR(80);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='mechanization')
    ALTER TABLE wpqr_records ADD mechanization NVARCHAR(40);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='single_multi_run')
    ALTER TABLE wpqr_records ADD single_multi_run NVARCHAR(20);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='heat_input_note')
    ALTER TABLE wpqr_records ADD heat_input_note NVARCHAR(200);

PRINT 'Migration 133 completata — colonne copertura WPQR verificate/aggiunte';

-- VERIFICA FINALE
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'wpqr_records'
  AND COLUMN_NAME IN (
    'qualification_level', 'joint_type', 'standard_reference', 'wps_ref',
    'base_material_spec', 'shielding_gas', 'current_type', 'metal_transfer',
    'mechanization', 'single_multi_run', 'heat_input_note'
  )
ORDER BY COLUMN_NAME;
