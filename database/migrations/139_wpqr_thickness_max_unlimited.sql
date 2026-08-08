-- ============================================================
-- Migration 139: WPQR — flag "range spessore senza limite superiore"
--                (gap analysis 07/08/2026, WPQR reale VB0377/23 "ADA",
--                 cliente Mason, giunto FW/angolo: "t1 = >=5 ; t2 => 5")
-- Aggiunge SOLO la colonna mancante a wpqr_records (idempotente).
-- Colonna NULLABLE, default 0 — nessun impatto sui record esistenti:
-- thickness_max resta l'unica fonte del valore massimo; questo flag
-- distingue "non dichiarato" (0/NULL) da "dichiarato come illimitato" (1),
-- evitando che un fallback calcolato sovrascriva un range aperto reale.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='thickness_max_unlimited')
    ALTER TABLE wpqr_records ADD thickness_max_unlimited BIT NOT NULL CONSTRAINT DF_wpqr_records_thickness_max_unlimited DEFAULT 0;

PRINT 'Migration 139 completata — colonna thickness_max_unlimited verificata/aggiunta su wpqr_records';

-- VERIFICA FINALE
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'wpqr_records'
  AND COLUMN_NAME = 'thickness_max_unlimited';
