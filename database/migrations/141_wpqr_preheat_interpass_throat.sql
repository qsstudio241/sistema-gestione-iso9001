-- ============================================================
-- Migration 141: WPQR — preheat_temp/interpass_temp (gap strutturale
-- rilevato 07/08/2026: campi presenti in fields/aiPrompt/aiExpectedSchema
-- ma mai mappati da mapPipelineFieldsToReview/mapReviewFieldsToDb, colonne
-- mai create — vedi docs/gap-reports/GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md)
-- + throat_test_mm (gola/throat dichiarata sul verbale, giunti FW, Tabella 8
-- ISO 15614-1 — prima non estratta affatto, solo hint calcolato).
-- Aggiunge SOLO colonne mancanti a wpqr_records (idempotente).
-- Tutte le colonne sono NULLABLE — nessun impatto sui record esistenti.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='preheat_temp')
    ALTER TABLE wpqr_records ADD preheat_temp NVARCHAR(60);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='interpass_temp')
    ALTER TABLE wpqr_records ADD interpass_temp NVARCHAR(60);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='throat_test_mm')
    ALTER TABLE wpqr_records ADD throat_test_mm DECIMAL(10,2);

PRINT 'Migration 141 completata — colonne preheat_temp/interpass_temp/throat_test_mm verificate/aggiunte su wpqr_records';

-- VERIFICA FINALE
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'wpqr_records'
  AND COLUMN_NAME IN ('preheat_temp', 'interpass_temp', 'throat_test_mm')
ORDER BY COLUMN_NAME;
