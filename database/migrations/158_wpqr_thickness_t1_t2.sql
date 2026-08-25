-- ============================================================
-- Migration 158: WPQR — range spessore duali t1/t2 (giunti FW)
--                Segnalazione Mason 25/08/2026 + ISO 15614-1 Tabella 8 nota (a)
--                e ISO 15614-2 §8.3.2 (range dichiarati sul verbale).
-- Aggiunge SOLO colonne mancanti a wpqr_records (idempotente).
-- Tutte nullable / BIT con default — nessun impatto sui record esistenti.
-- thickness_min/max restano per WPQR a singolo range (BW) e retrocompatibilità.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='thickness_t1_min')
    ALTER TABLE wpqr_records ADD thickness_t1_min DECIMAL(8,2);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='thickness_t1_max')
    ALTER TABLE wpqr_records ADD thickness_t1_max DECIMAL(8,2);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='thickness_t1_max_unlimited')
    ALTER TABLE wpqr_records ADD thickness_t1_max_unlimited BIT NOT NULL CONSTRAINT DF_wpqr_records_thickness_t1_max_unlimited DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='thickness_t2_min')
    ALTER TABLE wpqr_records ADD thickness_t2_min DECIMAL(8,2);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='thickness_t2_max')
    ALTER TABLE wpqr_records ADD thickness_t2_max DECIMAL(8,2);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='thickness_t2_max_unlimited')
    ALTER TABLE wpqr_records ADD thickness_t2_max_unlimited BIT NOT NULL CONSTRAINT DF_wpqr_records_thickness_t2_max_unlimited DEFAULT 0;

PRINT 'Migration 158 completata — colonne thickness_t1_*/thickness_t2_* verificate/aggiunte su wpqr_records';

SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'wpqr_records'
  AND COLUMN_NAME IN (
    'thickness_t1_min', 'thickness_t1_max', 'thickness_t1_max_unlimited',
    'thickness_t2_min', 'thickness_t2_max', 'thickness_t2_max_unlimited'
  )
ORDER BY COLUMN_NAME;
