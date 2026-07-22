-- Migration 092: arricchimento campi qualifica saldatore ISO 9606-1 su qualifications
-- Aggiunge colonne numeriche min/max (spessore, diametro tubo), date di conferma/revalidazione,
-- data esame dedicata e campi norma (product_type, weld_details, qualification_designation).
-- Le colonne stringa legacy thickness_range / pipe_diameter restano per compatibilita' viste/griglie.
-- examiner_body esiste gia' (migration 084). Idempotente: ogni ALTER usa IF NOT EXISTS su sys.columns.

-- Spessore qualificato (range numerico, mm)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'thickness_min_mm')
BEGIN
    ALTER TABLE qualifications ADD thickness_min_mm DECIMAL(6,2) NULL;
    PRINT 'Colonna thickness_min_mm aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'thickness_max_mm')
BEGIN
    ALTER TABLE qualifications ADD thickness_max_mm DECIMAL(6,2) NULL;
    PRINT 'Colonna thickness_max_mm aggiunta.';
END

-- Diametro tubo qualificato (range numerico, mm)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'pipe_diameter_min_mm')
BEGIN
    ALTER TABLE qualifications ADD pipe_diameter_min_mm DECIMAL(7,2) NULL;
    PRINT 'Colonna pipe_diameter_min_mm aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'pipe_diameter_max_mm')
BEGIN
    ALTER TABLE qualifications ADD pipe_diameter_max_mm DECIMAL(7,2) NULL;
    PRINT 'Colonna pipe_diameter_max_mm aggiunta.';
END

-- Date di validita' (conferma semestrale, prossima conferma, revalidazione 3 anni, data esame dedicata)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'last_confirmation_date')
BEGIN
    ALTER TABLE qualifications ADD last_confirmation_date DATE NULL;
    PRINT 'Colonna last_confirmation_date aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'next_confirmation_due')
BEGIN
    ALTER TABLE qualifications ADD next_confirmation_due DATE NULL;
    PRINT 'Colonna next_confirmation_due aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'revalidation_date')
BEGIN
    ALTER TABLE qualifications ADD revalidation_date DATE NULL;
    PRINT 'Colonna revalidation_date aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'exam_date')
BEGIN
    ALTER TABLE qualifications ADD exam_date DATE NULL;
    PRINT 'Colonna exam_date aggiunta.';
END

-- Campi norma ISO 9606-1
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'product_type')
BEGIN
    ALTER TABLE qualifications ADD product_type NVARCHAR(5) NULL;
    PRINT 'Colonna product_type aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'weld_details')
BEGIN
    ALTER TABLE qualifications ADD weld_details NVARCHAR(50) NULL;
    PRINT 'Colonna weld_details aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'qualification_designation')
BEGIN
    ALTER TABLE qualifications ADD qualification_designation NVARCHAR(200) NULL;
    PRINT 'Colonna qualification_designation aggiunta.';
END

PRINT 'Migration 092 completata.';
