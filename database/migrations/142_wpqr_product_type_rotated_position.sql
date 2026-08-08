-- ============================================================
-- Migration 142: WPQR — product_type (piastra/tubo) + rotated_position
--                (gap analysis 08/08/2026, chiusura regola piastra->tubo
--                 diametro, ISO 15614-1 par.8.3.3 — vedi
--                 GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md)
-- Aggiunge SOLO colonne mancanti a wpqr_records (idempotente).
-- Tutte le colonne sono NULLABLE — nessun impatto sui record esistenti.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='product_type')
    ALTER TABLE wpqr_records ADD product_type NVARCHAR(5);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='rotated_position')
    ALTER TABLE wpqr_records ADD rotated_position BIT NOT NULL CONSTRAINT DF_wpqr_records_rotated_position DEFAULT 0;

PRINT 'Migration 142 completata — colonne product_type/rotated_position verificate/aggiunte su wpqr_records';

-- VERIFICA FINALE
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'wpqr_records'
  AND COLUMN_NAME IN ('product_type', 'rotated_position')
ORDER BY COLUMN_NAME;
