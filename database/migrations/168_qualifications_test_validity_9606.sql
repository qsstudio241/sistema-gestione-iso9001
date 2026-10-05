-- ============================================================
-- Migration 168: Qualifiche ISO 9606-1 — colonne prova vs validità (fetta 1)
-- Additive, nullable. NON applicare sul VPS in questa slice (HITL).
-- Conserva qualification_designation già esistente (stringa certificato).
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qualifications' AND COLUMN_NAME='welding_process_test')
    ALTER TABLE qualifications ADD welding_process_test NVARCHAR(50);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qualifications' AND COLUMN_NAME='welding_processes_validity')
    ALTER TABLE qualifications ADD welding_processes_validity NVARCHAR(200);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qualifications' AND COLUMN_NAME='welding_position_test')
    ALTER TABLE qualifications ADD welding_position_test NVARCHAR(50);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qualifications' AND COLUMN_NAME='thickness_s_test_mm')
    ALTER TABLE qualifications ADD thickness_s_test_mm DECIMAL(10,2) NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qualifications' AND COLUMN_NAME='thickness_t_test_mm')
    ALTER TABLE qualifications ADD thickness_t_test_mm DECIMAL(10,2) NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qualifications' AND COLUMN_NAME='pipe_diameter_test_mm')
    ALTER TABLE qualifications ADD pipe_diameter_test_mm DECIMAL(10,2) NULL;

PRINT 'Migration 168 completata — colonne prova/validita 9606 verificate/aggiunte su qualifications (NON applicare in PROD senza HITL)';

SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'qualifications'
  AND COLUMN_NAME IN (
    'welding_process_test', 'welding_processes_validity', 'welding_position_test',
    'thickness_s_test_mm', 'thickness_t_test_mm', 'pipe_diameter_test_mm',
    'qualification_designation'
  )
ORDER BY COLUMN_NAME;
