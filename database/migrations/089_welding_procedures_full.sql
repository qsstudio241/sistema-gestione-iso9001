-- ============================================================
-- Migration 089: Welding Procedures full schema (WPS + WPQR + wps_welders)
-- Data: 2026-06-11
-- Crea le tabelle se non esistono, aggiunge colonne mancanti
-- se le tabelle esistono già con lo schema ridotto.
-- Idempotente: sicuro rieseguire.
-- ============================================================

-- ============================================================
-- TABELLA welding_procedures (WPS)
-- ============================================================
IF OBJECT_ID('welding_procedures', 'U') IS NULL
BEGIN
    CREATE TABLE welding_procedures (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        organization_id         INT NOT NULL,
        company_id              INT,
        wps_code                NVARCHAR(100) NOT NULL,
        revision                NVARCHAR(20),
        welding_process         NVARCHAR(50),
        material_group          NVARCHAR(50),
        base_material_group     NVARCHAR(50),
        filler_material         NVARCHAR(100),
        shielding_gas           NVARCHAR(100),
        joint_type              NVARCHAR(20),
        position                NVARCHAR(100),
        welding_positions       NVARCHAR(100),
        thickness_range_min     DECIMAL(8,2),
        thickness_range_max     DECIMAL(8,2),
        thickness_range         NVARCHAR(50),
        pipe_diameter_min       DECIMAL(8,2),
        preheat_temp            NVARCHAR(50),
        interpass_temp          NVARCHAR(50),
        pwht                    NVARCHAR(100),
        qualification_standard  NVARCHAR(100),
        issue_date              DATE,
        expiry_date             DATE,
        examiner_body           NVARCHAR(200),
        certificate_file_url    NVARCHAR(500),
        certificate_original_url NVARCHAR(500),
        approval_status         NVARCHAR(20) DEFAULT 'bozza',
        rejection_reason        NVARCHAR(500),
        status                  NVARCHAR(20) DEFAULT 'bozza',
        notes                   NVARCHAR(2000),
        created_by              INT,
        created_at              DATETIME2 DEFAULT GETDATE(),
        updated_at              DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Tabella welding_procedures creata';
END
ELSE
BEGIN
    PRINT 'Tabella welding_procedures gia presente - verifico colonne mancanti';
END

-- Aggiungi colonne mancanti a welding_procedures (idempotente)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='welding_procedures' AND COLUMN_NAME='base_material_group')
    ALTER TABLE welding_procedures ADD base_material_group NVARCHAR(50);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='welding_procedures' AND COLUMN_NAME='welding_positions')
    ALTER TABLE welding_procedures ADD welding_positions NVARCHAR(100);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='welding_procedures' AND COLUMN_NAME='thickness_range')
    ALTER TABLE welding_procedures ADD thickness_range NVARCHAR(50);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='welding_procedures' AND COLUMN_NAME='issue_date')
    ALTER TABLE welding_procedures ADD issue_date DATE;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='welding_procedures' AND COLUMN_NAME='expiry_date')
    ALTER TABLE welding_procedures ADD expiry_date DATE;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='welding_procedures' AND COLUMN_NAME='examiner_body')
    ALTER TABLE welding_procedures ADD examiner_body NVARCHAR(200);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='welding_procedures' AND COLUMN_NAME='certificate_file_url')
    ALTER TABLE welding_procedures ADD certificate_file_url NVARCHAR(500);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='welding_procedures' AND COLUMN_NAME='certificate_original_url')
    ALTER TABLE welding_procedures ADD certificate_original_url NVARCHAR(500);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='welding_procedures' AND COLUMN_NAME='approval_status')
    ALTER TABLE welding_procedures ADD approval_status NVARCHAR(20) DEFAULT 'bozza';

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='welding_procedures' AND COLUMN_NAME='rejection_reason')
    ALTER TABLE welding_procedures ADD rejection_reason NVARCHAR(500);

-- Allinea material_group ? base_material_group (sinonimo computato):
-- Se material_group esiste ma base_material_group ha dati NULL, copia i valori
UPDATE welding_procedures
SET base_material_group = material_group
WHERE base_material_group IS NULL AND material_group IS NOT NULL;

-- ============================================================
-- TABELLA wpqr_records (WPQR qualification records)
-- ============================================================
IF OBJECT_ID('wpqr_records', 'U') IS NULL
BEGIN
    CREATE TABLE wpqr_records (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        organization_id         INT NOT NULL,
        company_id              INT,
        wps_id                  INT,
        reference_number        NVARCHAR(100),
        wpqr_code               NVARCHAR(100),
        test_date               DATE,
        testing_body            NVARCHAR(200),
        examiner_body           NVARCHAR(200),
        welder_name             NVARCHAR(200),
        base_material_group     NVARCHAR(50),
        welding_process         NVARCHAR(50),
        filler_material         NVARCHAR(100),
        thickness_tested        DECIMAL(8,2),
        thickness_min           DECIMAL(8,2),
        thickness_max           DECIMAL(8,2),
        diameter_min            DECIMAL(8,2),
        diameter_max            DECIMAL(8,2),
        welding_positions       NVARCHAR(100),
        pwht                    BIT DEFAULT 0,
        -- Test results (NDT)
        vt_result               NVARCHAR(10) DEFAULT 'NA',
        rt_result               NVARCHAR(10) DEFAULT 'NA',
        ut_result               NVARCHAR(10) DEFAULT 'NA',
        mt_result               NVARCHAR(10) DEFAULT 'NA',
        pt_result               NVARCHAR(10) DEFAULT 'NA',
        tensile_result          NVARCHAR(10) DEFAULT 'NA',
        bend_result             NVARCHAR(10) DEFAULT 'NA',
        impact_result           NVARCHAR(10) DEFAULT 'NA',
        hardness_result         NVARCHAR(10) DEFAULT 'NA',
        macro_result            NVARCHAR(10) DEFAULT 'NA',
        -- Expiry / certification
        issue_date              DATE,
        expiry_date             DATE,
        certificate_number      NVARCHAR(100),
        certificate_file_url    NVARCHAR(500),
        certificate_original_url NVARCHAR(500),
        -- Approval workflow
        approval_status         NVARCHAR(20) DEFAULT 'bozza',
        rejection_reason        NVARCHAR(500),
        -- Status
        status                  NVARCHAR(20) DEFAULT 'attiva',
        notes                   NVARCHAR(2000),
        created_by              INT,
        created_at              DATETIME2 DEFAULT GETDATE(),
        updated_at              DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Tabella wpqr_records creata';
END
ELSE
BEGIN
    PRINT 'Tabella wpqr_records gia presente - verifico colonne mancanti';
END

-- Aggiungi colonne mancanti a wpqr_records
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='company_id')
    ALTER TABLE wpqr_records ADD company_id INT;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='reference_number')
    ALTER TABLE wpqr_records ADD reference_number NVARCHAR(100);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='examiner_body')
    ALTER TABLE wpqr_records ADD examiner_body NVARCHAR(200);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='base_material_group')
    ALTER TABLE wpqr_records ADD base_material_group NVARCHAR(50);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='welding_process')
    ALTER TABLE wpqr_records ADD welding_process NVARCHAR(50);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='filler_material')
    ALTER TABLE wpqr_records ADD filler_material NVARCHAR(100);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='thickness_tested')
    ALTER TABLE wpqr_records ADD thickness_tested DECIMAL(8,2);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='thickness_min')
    ALTER TABLE wpqr_records ADD thickness_min DECIMAL(8,2);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='thickness_max')
    ALTER TABLE wpqr_records ADD thickness_max DECIMAL(8,2);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='diameter_min')
    ALTER TABLE wpqr_records ADD diameter_min DECIMAL(8,2);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='diameter_max')
    ALTER TABLE wpqr_records ADD diameter_max DECIMAL(8,2);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='welding_positions')
    ALTER TABLE wpqr_records ADD welding_positions NVARCHAR(100);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='pwht')
    ALTER TABLE wpqr_records ADD pwht BIT DEFAULT 0;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='issue_date')
    ALTER TABLE wpqr_records ADD issue_date DATE;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='certificate_file_url')
    ALTER TABLE wpqr_records ADD certificate_file_url NVARCHAR(500);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='certificate_original_url')
    ALTER TABLE wpqr_records ADD certificate_original_url NVARCHAR(500);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='approval_status')
    ALTER TABLE wpqr_records ADD approval_status NVARCHAR(20) DEFAULT 'bozza';

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='rejection_reason')
    ALTER TABLE wpqr_records ADD rejection_reason NVARCHAR(500);

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wpqr_records' AND COLUMN_NAME='status')
    ALTER TABLE wpqr_records ADD status NVARCHAR(20) DEFAULT 'attiva';

-- Allinea testing_body ? examiner_body
UPDATE wpqr_records
SET examiner_body = testing_body
WHERE examiner_body IS NULL AND testing_body IS NOT NULL;

-- Allinea wpqr_code ? reference_number
UPDATE wpqr_records
SET reference_number = wpqr_code
WHERE reference_number IS NULL AND wpqr_code IS NOT NULL;

-- ============================================================
-- TABELLA wps_welders (assegnazione saldatori a WPS)
-- ============================================================
IF OBJECT_ID('wps_welders', 'U') IS NULL
BEGIN
    CREATE TABLE wps_welders (
        id               INT IDENTITY(1,1) PRIMARY KEY,
        organization_id  INT NOT NULL,
        wps_id           INT NOT NULL,
        qualification_id INT NOT NULL,
        assigned_date    DATE,
        notes            NVARCHAR(500),
        created_at       DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Tabella wps_welders creata';
END
ELSE
    PRINT 'Tabella wps_welders gia presente';

-- ============================================================
-- INDICI utili per performance
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_welding_procedures_org_company' AND object_id=OBJECT_ID('welding_procedures'))
    CREATE INDEX IX_welding_procedures_org_company ON welding_procedures(organization_id, company_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_welding_procedures_approval' AND object_id=OBJECT_ID('welding_procedures'))
    CREATE INDEX IX_welding_procedures_approval ON welding_procedures(organization_id, approval_status, status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_wpqr_records_org_company' AND object_id=OBJECT_ID('wpqr_records'))
    CREATE INDEX IX_wpqr_records_org_company ON wpqr_records(organization_id, company_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_wpqr_records_approval' AND object_id=OBJECT_ID('wpqr_records'))
    CREATE INDEX IX_wpqr_records_approval ON wpqr_records(organization_id, approval_status, status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_wpqr_records_expiry' AND object_id=OBJECT_ID('wpqr_records'))
    CREATE INDEX IX_wpqr_records_expiry ON wpqr_records(organization_id, expiry_date);

PRINT 'Migration 089 completata';

-- VERIFICA FINALE
SELECT
    'welding_procedures' AS tabella,
    COUNT(*) AS righe
FROM welding_procedures
UNION ALL
SELECT
    'wpqr_records',
    COUNT(*)
FROM wpqr_records
UNION ALL
SELECT
    'wps_welders',
    COUNT(*)
FROM wps_welders;
