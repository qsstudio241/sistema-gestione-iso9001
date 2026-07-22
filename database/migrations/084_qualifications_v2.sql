-- Migration 084: Estensione tabella qualifications v2
-- Aggiunge colonne per workflow approvazione, storico rinnovi, campi specializzati per tipo
-- Idempotente: ogni ALTER usa IF NOT EXISTS sul sys.columns

-- ?? Storico rinnovi ???????????????????????????????????????????????????????????
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'previous_qualification_id')
BEGIN
    ALTER TABLE qualifications ADD previous_qualification_id INT NULL;
    PRINT 'Colonna previous_qualification_id aggiunta.';
END

-- ?? Workflow approvazione ?????????????????????????????????????????????????????
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'approval_status')
BEGIN
    ALTER TABLE qualifications ADD approval_status NVARCHAR(20) NOT NULL DEFAULT 'bozza';
    PRINT 'Colonna approval_status aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'approved_by')
BEGIN
    ALTER TABLE qualifications ADD approved_by INT NULL;
    PRINT 'Colonna approved_by aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'approved_at')
BEGIN
    ALTER TABLE qualifications ADD approved_at DATETIME2 NULL;
    PRINT 'Colonna approved_at aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'rejection_reason')
BEGIN
    ALTER TABLE qualifications ADD rejection_reason NVARCHAR(500) NULL;
    PRINT 'Colonna rejection_reason aggiunta.';
END

-- ?? Allegato certificato ??????????????????????????????????????????????????????
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'certificate_file_url')
BEGIN
    ALTER TABLE qualifications ADD certificate_file_url NVARCHAR(500) NULL;
    PRINT 'Colonna certificate_file_url aggiunta.';
END

-- ?? Saldatori ISO 9606 / ISO 14732 ????????????????????????????????????????????
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'joint_type')
BEGIN
    ALTER TABLE qualifications ADD joint_type NVARCHAR(20) NULL;
    PRINT 'Colonna joint_type aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'thickness_range')
BEGIN
    ALTER TABLE qualifications ADD thickness_range NVARCHAR(50) NULL;
    PRINT 'Colonna thickness_range aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'pipe_diameter')
BEGIN
    ALTER TABLE qualifications ADD pipe_diameter NVARCHAR(50) NULL;
    PRINT 'Colonna pipe_diameter aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'filler_material')
BEGIN
    ALTER TABLE qualifications ADD filler_material NVARCHAR(100) NULL;
    PRINT 'Colonna filler_material aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'shielding_gas')
BEGIN
    ALTER TABLE qualifications ADD shielding_gas NVARCHAR(50) NULL;
    PRINT 'Colonna shielding_gas aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'equipment_type')
BEGIN
    ALTER TABLE qualifications ADD equipment_type NVARCHAR(100) NULL;
    PRINT 'Colonna equipment_type aggiunta.';
END

-- ?? NDT ISO 9712 ??????????????????????????????????????????????????????????????
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'ndt_sector')
BEGIN
    ALTER TABLE qualifications ADD ndt_sector NVARCHAR(50) NULL;
    PRINT 'Colonna ndt_sector aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'certification_scheme')
BEGIN
    ALTER TABLE qualifications ADD certification_scheme NVARCHAR(50) NULL;
    PRINT 'Colonna certification_scheme aggiunta.';
END

-- ?? Coordinatori ISO 14731 ????????????????????????????????????????????????????
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'coordinator_title')
BEGIN
    ALTER TABLE qualifications ADD coordinator_title NVARCHAR(20) NULL;
    PRINT 'Colonna coordinator_title aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'diploma_number')
BEGIN
    ALTER TABLE qualifications ADD diploma_number NVARCHAR(100) NULL;
    PRINT 'Colonna diploma_number aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'cpd_valid_until')
BEGIN
    ALTER TABLE qualifications ADD cpd_valid_until DATE NULL;
    PRINT 'Colonna cpd_valid_until aggiunta.';
END

-- ?? PES/PAV ???????????????????????????????????????????????????????????????????
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'patent_type')
BEGIN
    ALTER TABLE qualifications ADD patent_type NVARCHAR(50) NULL;
    PRINT 'Colonna patent_type aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'training_body')
BEGIN
    ALTER TABLE qualifications ADD training_body NVARCHAR(200) NULL;
    PRINT 'Colonna training_body aggiunta.';
END

-- ?? Generico ??????????????????????????????????????????????????????????????????
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'course_name')
BEGIN
    ALTER TABLE qualifications ADD course_name NVARCHAR(200) NULL;
    PRINT 'Colonna course_name aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'training_hours')
BEGIN
    ALTER TABLE qualifications ADD training_hours INT NULL;
    PRINT 'Colonna training_hours aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('qualifications') AND name = 'examiner_body')
BEGIN
    ALTER TABLE qualifications ADD examiner_body NVARCHAR(200) NULL;
    PRINT 'Colonna examiner_body aggiunta.';
END

-- ?? Check constraint approval_status (separato) ???????????????????????????????
IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('qualifications') AND name = 'CK_qualifications_approval_status'
)
BEGIN
    ALTER TABLE qualifications
    ADD CONSTRAINT CK_qualifications_approval_status
        CHECK (approval_status IN ('bozza','in_revisione','approvata','rifiutata'));
    PRINT 'Constraint CK_qualifications_approval_status aggiunto.';
END

-- ?? Index approval_status per lookup frequente ????????????????????????????????
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('qualifications') AND name = 'IX_qualifications_approval_status')
BEGIN
    CREATE INDEX IX_qualifications_approval_status ON qualifications (organization_id, approval_status);
    PRINT 'Indice IX_qualifications_approval_status creato.';
END

PRINT 'Migration 084 completata.';
