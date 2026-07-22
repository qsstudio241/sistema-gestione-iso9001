-- Migration 086: Aggiunge certificate_original_url alla tabella qualifications
-- Conserva il path del PDF originale prima del timbro di approvazione SGQ.
-- Idempotente: usa IF NOT EXISTS su sys.columns

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'certificate_original_url')
BEGIN
    ALTER TABLE qualifications ADD certificate_original_url NVARCHAR(500) NULL;
    PRINT 'Colonna certificate_original_url aggiunta.';
END
ELSE
BEGIN
    PRINT 'Colonna certificate_original_url già presente — nessuna modifica.';
END
