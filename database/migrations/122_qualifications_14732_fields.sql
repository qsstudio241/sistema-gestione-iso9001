-- Migration 122: campi specifici ISO 14732 (operatori/preparatori saldatura automatica/meccanizzata)
-- Completa l'integrazione di qualifica_14732 nel modulo Qualifiche (RC-8 follow-up).
-- Le colonne generiche gia' esistenti (welding_process, position_range, equipment_type,
-- exam_date, last_confirmation_date, next_confirmation_due, expiry_date) sono riusate.
-- Mancano solo i 3 campi non generalizzabili: tipo saldatura, tecnica passata, metodo qualificazione.
-- Idempotente: ogni ALTER usa IF NOT EXISTS su sys.columns.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'welding_type')
BEGIN
    ALTER TABLE qualifications ADD welding_type NVARCHAR(20) NULL; -- 'automatic' | 'mechanized'
    PRINT 'Colonna welding_type aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'single_multi_run')
BEGIN
    ALTER TABLE qualifications ADD single_multi_run NVARCHAR(20) NULL; -- 'single' | 'multi'
    PRINT 'Colonna single_multi_run aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'qualification_method')
BEGIN
    ALTER TABLE qualifications ADD qualification_method NVARCHAR(30) NULL; -- iso_15614|iso_15613|iso_9606|production_test
    PRINT 'Colonna qualification_method aggiunta.';
END

PRINT 'Migration 122 completata.';
