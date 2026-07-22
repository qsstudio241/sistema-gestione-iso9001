-- Migration 101: Anagrafica strumenti e attrezzature CND/SGQ
-- Tabella trasversale: studio + aziende clienti, tutti i sistemi di gestione

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'equipment_assets')
BEGIN
    CREATE TABLE equipment_assets (
        id                          INT IDENTITY(1,1) PRIMARY KEY,
        uuid                        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        organization_id             INT NOT NULL,        -- studio proprietario del dato
        company_id                  INT NULL,            -- NULL = asset dello studio; valorizzato = asset dell'azienda cliente

        -- Classificazione
        asset_category              NVARCHAR(50)  NOT NULL DEFAULT 'measuring_instrument',
            -- 'measuring_instrument' | 'welding_machine' | 'safety_equipment' | 'tool' | 'vehicle' | 'other'
        asset_subcategory           NVARCHAR(100) NULL,   -- es. 'calibro', 'luxmetro', 'saldatrice', 'DPI_respiratore'

        -- Identificazione
        name                        NVARCHAR(200) NOT NULL,
        manufacturer                NVARCHAR(200) NULL,
        model                       NVARCHAR(200) NULL,
        serial_number               NVARCHAR(100) NULL,
        internal_code               NVARCHAR(100) NULL,  -- codice interno aziendale

        -- Applicabilita' normativa (JSON arrays)
        applicable_systems          NVARCHAR(500) NULL,  -- JSON: ["9001","14001","45001","3834","CND"]
        applicable_methods          NVARCHAR(200) NULL,  -- JSON: ["VT","MT","PT","UT"] (solo per CND)

        -- Posizione e stato
        location                    NVARCHAR(200) NULL,
        status                      NVARCHAR(20)  NOT NULL DEFAULT 'active',
            -- CHECK ('active','calibrating','retired','lost')

        -- Taratura
        requires_calibration        BIT           NOT NULL DEFAULT 1,
        calibration_frequency_months INT          NULL,   -- ogni N mesi va ritarato
        last_calibration_date       DATE          NULL,   -- denorm. per scadenziario rapido
        next_calibration_date       DATE          NULL,   -- denorm. per alert scheduler

        -- Acquisto
        purchase_date               DATE          NULL,
        purchase_price              DECIMAL(10,2) NULL,

        notes                       NVARCHAR(MAX) NULL,
        is_deleted                  BIT           NOT NULL DEFAULT 0,
        created_at                  DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at                  DATETIME2     NOT NULL DEFAULT GETDATE(),
        created_by                  INT           NULL     -- FK users.user_id (no REFERENCES per pattern repo)
    );

    CREATE INDEX IX_equipment_assets_org ON equipment_assets (organization_id);
    CREATE INDEX IX_equipment_assets_company ON equipment_assets (company_id);
    CREATE INDEX IX_equipment_assets_status ON equipment_assets (status, is_deleted);
    CREATE INDEX IX_equipment_assets_calibration ON equipment_assets (next_calibration_date) WHERE requires_calibration = 1 AND is_deleted = 0;
    CREATE UNIQUE INDEX UX_equipment_assets_uuid ON equipment_assets (uuid);

    PRINT 'Tabella equipment_assets creata.';
END
ELSE
    PRINT 'Tabella equipment_assets gia'' esistente — skip.';
