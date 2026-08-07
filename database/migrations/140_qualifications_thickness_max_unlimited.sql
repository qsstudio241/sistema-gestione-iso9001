-- ============================================================
-- Migration 140: Qualifiche saldatori — flag "range spessore senza limite superiore"
--                (audit strutturale 07/08/2026 — bug attivo in qualificationCoverage.js:
--                 un thickness_max_mm NULL veniva sempre trattato come "nessun limite"
--                 anche quando il dato era semplicemente assente/non estratto, con
--                 rischio di dichiarare idoneo un saldatore per uno spessore non
--                 realmente qualificato — ISO 3834-2 §8.2)
-- Aggiunge SOLO la colonna mancante a qualifications (idempotente).
-- Colonna NOT NULL DEFAULT 0 — nessun impatto sui record esistenti: il default
-- "false" preserva il comportamento più prudente (dato ambiguo → 'unverifiable',
-- mai più 'ok' automatico) per tutte le qualifiche già in DB.
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qualifications' AND COLUMN_NAME='thickness_max_unlimited')
    ALTER TABLE qualifications ADD thickness_max_unlimited BIT NOT NULL CONSTRAINT DF_qualifications_thickness_max_unlimited DEFAULT 0;

PRINT 'Migration 140 completata — colonna thickness_max_unlimited verificata/aggiunta su qualifications';

-- VERIFICA FINALE
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'qualifications'
  AND COLUMN_NAME = 'thickness_max_unlimited';
