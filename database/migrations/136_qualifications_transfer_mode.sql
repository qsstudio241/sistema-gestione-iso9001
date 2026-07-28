-- Migration 136: metodo di trasferimento (transfer mode) su qualifiche saldatore
-- ISO 9606-1 §5.2/§9.3: variabile essenziale per i processi ad arco con filo
-- continuo (131 MIG, 135 MAG, 136/138 filo animato). Colonna singola, nullable,
-- valori enum applicativi: spray_arc | pulsed_arc | short_arc | globular.
-- Nessun impatto su record esistenti (colonna nuova, sempre NULL finora).
-- Idempotente: verifica esistenza colonna prima di ALTER.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'transfer_mode')
BEGIN
    ALTER TABLE qualifications ADD transfer_mode NVARCHAR(20) NULL;
    PRINT 'Colonna transfer_mode aggiunta a qualifications.';
END
ELSE
BEGIN
    PRINT 'Colonna transfer_mode gia'' presente su qualifications, nessuna azione.';
END

PRINT 'Migration 136 completata.';

-- VERIFICA FINALE
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'qualifications' AND COLUMN_NAME = 'transfer_mode';
