-- ============================================================
-- Migration 159: WPQR — Stud Welding / prigioniero + P+T + doppio materiale
--                STUD-1 (Mason 25/08/2026). Nessun range ISO 14555.
-- Aggiunge SOLO colonne mancanti a wpqr_records (idempotente).
-- Tutte nullable — nessun impatto sui record esistenti.
-- product_type resta NVARCHAR(5): "P+T" ci entra (3 char).
-- joint_type resta NVARCHAR(50): "SW" ci entra.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='qualifying_element')
    ALTER TABLE wpqr_records ADD qualifying_element NVARCHAR(20);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='base_material_group_2')
    ALTER TABLE wpqr_records ADD base_material_group_2 NVARCHAR(50);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='base_material_spec_2')
    ALTER TABLE wpqr_records ADD base_material_spec_2 NVARCHAR(100);

PRINT 'Migration 159 completata — colonne qualifying_element / base_material_group_2 / base_material_spec_2 verificate/aggiunte su wpqr_records';

SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'wpqr_records'
  AND COLUMN_NAME IN (
    'qualifying_element', 'base_material_group_2', 'base_material_spec_2',
    'product_type', 'joint_type', 'diameter_min', 'diameter_max'
  )
ORDER BY COLUMN_NAME;
