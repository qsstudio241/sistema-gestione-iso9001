-- ============================================================
-- Migration 129: Livello ISO 3834 dichiarato/scelto dall'azienda (§5 ISO 3834-1)
-- Data: 2026-07-23
-- Additiva, nullable, basso rischio.
-- ============================================================

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'companies' AND type = 'U')
   AND NOT EXISTS (
       SELECT 1 FROM sys.columns
       WHERE object_id = OBJECT_ID('companies') AND name = 'iso3834_level'
   )
BEGIN
    ALTER TABLE companies ADD iso3834_level NVARCHAR(10) NULL;
    PRINT 'Colonna companies.iso3834_level aggiunta.';
END
ELSE
    PRINT 'Colonna companies.iso3834_level gia presente.';

PRINT 'Migration 129 completata.';
