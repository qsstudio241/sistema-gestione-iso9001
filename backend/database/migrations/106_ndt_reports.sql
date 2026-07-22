-- Migration 103: Verbali CND (Visual Testing, MT, PT, UT, ...)
-- Tabella padre ndt_reports + tabella figlio ndt_report_items

-- =====================================================================
-- TABELLA PADRE: ndt_reports
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ndt_reports')
BEGIN
    CREATE TABLE ndt_reports (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        uuid                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        organization_id         INT           NOT NULL,
        company_id              INT           NULL,       -- azienda committente del verbale

        -- Tipo metodo CND
        report_type             NVARCHAR(5)   NOT NULL DEFAULT 'VT',
            -- 'VT' | 'MT' | 'PT' | 'UT' | 'RT' | 'ET'

        -- Numerazione automatica: VT-2026-001
        report_number           NVARCHAR(30)  NULL,      -- generato dal backend al primo salvataggio
        report_year             INT           NOT NULL DEFAULT YEAR(GETDATE()),

        -- Dati generali (testata)
        client                  NVARCHAR(200) NULL,
        job_order               NVARCHAR(200) NULL,      -- COMMESSA/ORDINE
        wps_number              NVARCHAR(100) NULL,      -- SPECIFICA N./WPS Nr
        wps_id                  INT           NULL,      -- FK welding_procedures (opzionale)

        base_material           NVARCHAR(200) NULL,
        material_standard       NVARCHAR(100) NULL,      -- es. 'UNI EN ISO 10025-2'
        joint_type              NVARCHAR(300) NULL DEFAULT 'SALDATURA AD ANGOLO MONO E MULTI PASSATA',
        quality_level           NVARCHAR(100) NULL DEFAULT 'UNI EN ISO 5817 Lev.C',

        -- Parametri specifici per metodo (JSON)
        method_params           NVARCHAR(MAX) NULL,
        -- VT: {"illuminance_min":350,"illuminance_max":500,"illuminance_measured":null,"power_w":null,"wavelength":null}
        -- MT: {"magnetic_field_strength":null,"technique":null}
        -- PT: {"penetrant_type":null,"developer_type":null,"dwell_time_min":null}
        -- UT: {"frequency_mhz":null,"probe_type":null,"couplant":null}

        -- Note e certificazione
        notes                   NVARCHAR(MAX) NULL DEFAULT 'NULLA DA SEGNALARE, L''ESITO E'' DA RITENERSI SODDISFACENTE.',

        -- Date e firme (ufficializzazione)
        inspection_date         DATE          NULL,      -- data controllo
        certificate_date        DATE          NULL,      -- data emissione certificato
        responsible             NVARCHAR(200) NULL,      -- IL RESPONSABILE
        inspector               NVARCHAR(200) NULL,      -- L'ISPETTORE
        client_representative   NVARCHAR(200) NULL,      -- IL CLIENTE (rappresentante)

        -- Snapshot dati normativi al momento della firma (immutabilità storica)
        wps_snapshot            NVARCHAR(MAX) NULL,      -- JSON con dati WPS al momento della firma

        -- Stato del verbale
        status                  NVARCHAR(20)  NOT NULL DEFAULT 'draft',
            -- 'draft' | 'completed' | 'approved'

        is_deleted              BIT           NOT NULL DEFAULT 0,
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        created_by              INT           NULL
    );

    CREATE INDEX IX_ndt_reports_org ON ndt_reports (organization_id);
    CREATE INDEX IX_ndt_reports_company ON ndt_reports (company_id);
    CREATE INDEX IX_ndt_reports_type_year ON ndt_reports (report_type, report_year);
    CREATE INDEX IX_ndt_reports_status ON ndt_reports (status, is_deleted);
    CREATE UNIQUE INDEX UX_ndt_reports_uuid ON ndt_reports (uuid);
    CREATE UNIQUE INDEX UX_ndt_reports_org_number ON ndt_reports (organization_id, report_number) WHERE report_number IS NOT NULL;

    PRINT 'Tabella ndt_reports creata.';
END
ELSE
    PRINT 'Tabella ndt_reports gia'' esistente — skip.';

-- =====================================================================
-- TABELLA FIGLIA: ndt_report_items (Elenco Marche)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ndt_report_items')
BEGIN
    CREATE TABLE ndt_report_items (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        report_id               INT           NOT NULL,  -- FK ndt_reports.id
        sort_order              INT           NOT NULL DEFAULT 0,

        -- Dati riga Elenco Marche
        position_code           NVARCHAR(100) NULL,      -- Pos./Codice
        quantity                NVARCHAR(20)  NULL,      -- Q.ta' (stringa per flessibilita')
        description             NVARCHAR(500) NULL,      -- Descrizione

        examined_part           NVARCHAR(100) NULL DEFAULT 'SALDATURA',
        surface_condition       NVARCHAR(5)   NULL DEFAULT 'M/S',
            -- 'S'=come saldato | 'U'=lavorato macchina | 'G'=grezzo | 'M'=molato | 'L'=laminato
        inspection_percentage   INT           NULL DEFAULT 100,
        defects                 NVARCHAR(200) NULL DEFAULT 'NESSUNO',
            -- 'NESSUNO' oppure codici UNI EN ISO 6520 (1-10)
        evaluation              NVARCHAR(5)   NULL DEFAULT 'A',
            -- 'A'=accettabile | 'R'=da riparare | 'S'=scarto

        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_ndt_report_items_report ON ndt_report_items (report_id, sort_order);

    PRINT 'Tabella ndt_report_items creata.';
END
ELSE
    PRINT 'Tabella ndt_report_items gia'' esistente — skip.';

-- FK ndt_report_items -> ndt_reports
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ndt_report_items_report'
)
BEGIN
    ALTER TABLE ndt_report_items
        ADD CONSTRAINT FK_ndt_report_items_report
        FOREIGN KEY (report_id) REFERENCES ndt_reports (id);
    PRINT 'FK_ndt_report_items_report aggiunta.';
END

-- =====================================================================
-- TABELLA JUNCTION: ndt_report_instruments (strumenti usati per rapporto)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ndt_report_instruments')
BEGIN
    CREATE TABLE ndt_report_instruments (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        report_id       INT           NOT NULL,  -- FK ndt_reports.id
        asset_id        INT           NOT NULL,  -- FK equipment_assets.id
        instrument_role NVARCHAR(50)  NULL,      -- 'gauge' | 'luxmeter' | 'lamp' | 'probe' | 'other'
        measured_value  NVARCHAR(500) NULL,      -- JSON: {"lux_measured":420} oppure {"frequency_mhz":4.0}
        created_at      DATETIME2     NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_ndt_report_instruments_report ON ndt_report_instruments (report_id);
    CREATE INDEX IX_ndt_report_instruments_asset ON ndt_report_instruments (asset_id);

    PRINT 'Tabella ndt_report_instruments creata.';
END
ELSE
    PRINT 'Tabella ndt_report_instruments gia'' esistente — skip.';

-- FK ndt_report_instruments -> ndt_reports
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ndt_instruments_report'
)
BEGIN
    ALTER TABLE ndt_report_instruments
        ADD CONSTRAINT FK_ndt_instruments_report
        FOREIGN KEY (report_id) REFERENCES ndt_reports (id);
    PRINT 'FK_ndt_instruments_report aggiunta.';
END

-- FK ndt_report_instruments -> equipment_assets
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ndt_instruments_asset'
)
BEGIN
    ALTER TABLE ndt_report_instruments
        ADD CONSTRAINT FK_ndt_instruments_asset
        FOREIGN KEY (asset_id) REFERENCES equipment_assets (id);
    PRINT 'FK_ndt_instruments_asset aggiunta.';
END
