-- Migration 110: Welding Book ISO 3834 (IOF — istruzione operativa di fabbricazione)
-- Tabelle: welding_books, welding_book_equipment, welding_book_welds

-- =====================================================================
-- TABELLA PADRE: welding_books
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'welding_books')
BEGIN
    CREATE TABLE welding_books (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        uuid                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        organization_id         INT           NOT NULL,
        company_id              INT           NULL,

        book_number             NVARCHAR(30)  NULL,
        book_year               INT           NOT NULL DEFAULT YEAR(GETDATE()),

        -- Prodotto / commessa
        project_id              INT           NULL,
        product_code            NVARCHAR(100) NULL,
        product_description     NVARCHAR(500) NULL,
        job_order               NVARCHAR(200) NULL,
        client_name             NVARCHAR(200) NULL,
        drawing_ref             NVARCHAR(200) NULL,
        drawing_revision        NVARCHAR(50)  NULL,

        -- Riferimenti procedurali
        wps_id                  INT           NULL,
        wpqr_id                 INT           NULL,
        wps_code                NVARCHAR(100) NULL,
        wpqr_code               NVARCHAR(100) NULL,

        -- Materiali e processo (testata)
        base_material           NVARCHAR(200) NULL,
        filler_material         NVARCHAR(200) NULL,
        welding_process         NVARCHAR(50)  NULL,

        coordinator_name        NVARCHAR(200) NULL,
        document_revision       NVARCHAR(20)  NULL DEFAULT '0',
        notes                   NVARCHAR(MAX) NULL,

        status                  NVARCHAR(20)  NOT NULL DEFAULT 'draft',
            -- 'draft' | 'released'

        is_deleted              BIT           NOT NULL DEFAULT 0,
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        created_by              INT           NULL
    );

    CREATE INDEX IX_welding_books_org ON welding_books (organization_id);
    CREATE INDEX IX_welding_books_company ON welding_books (company_id);
    CREATE INDEX IX_welding_books_status ON welding_books (status, is_deleted);
    CREATE UNIQUE INDEX UX_welding_books_uuid ON welding_books (uuid);
    CREATE UNIQUE INDEX UX_welding_books_number ON welding_books (book_number) WHERE book_number IS NOT NULL;

    PRINT 'Tabella welding_books creata.';
END
ELSE
    PRINT 'Tabella welding_books gia'' esistente — skip.';

-- =====================================================================
-- JUNCTION: welding_book_equipment (attrezzature utilizzate)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'welding_book_equipment')
BEGIN
    CREATE TABLE welding_book_equipment (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        book_id             INT           NOT NULL,
        asset_id            INT           NOT NULL,
        equipment_role      NVARCHAR(50)  NULL DEFAULT 'other',
            -- 'welding_source' | 'wire_feed' | 'gas' | 'parameter_recorder' | 'positioner' | 'other'
        sort_order          INT           NOT NULL DEFAULT 0,
        notes               NVARCHAR(500) NULL,
        created_at          DATETIME2     NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_wb_equipment_book ON welding_book_equipment (book_id);
    CREATE INDEX IX_wb_equipment_asset ON welding_book_equipment (asset_id);

    PRINT 'Tabella welding_book_equipment creata.';
END
ELSE
    PRINT 'Tabella welding_book_equipment gia'' esistente — skip.';

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wb_equipment_book')
BEGIN
    ALTER TABLE welding_book_equipment
        ADD CONSTRAINT FK_wb_equipment_book
        FOREIGN KEY (book_id) REFERENCES welding_books (id);
    PRINT 'FK_wb_equipment_book aggiunta.';
END

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wb_equipment_asset')
AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'equipment_assets')
BEGIN
    ALTER TABLE welding_book_equipment
        ADD CONSTRAINT FK_wb_equipment_asset
        FOREIGN KEY (asset_id) REFERENCES equipment_assets (id);
    PRINT 'FK_wb_equipment_asset aggiunta.';
END

-- =====================================================================
-- TABELLA FIGLIA: welding_book_welds (sequenza saldature)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'welding_book_welds')
BEGIN
    CREATE TABLE welding_book_welds (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        book_id             INT           NOT NULL,
        sort_order          INT           NOT NULL DEFAULT 0,

        sequence_no         NVARCHAR(20)  NULL,
        joint_code          NVARCHAR(100) NULL,
        joint_description   NVARCHAR(500) NULL,

        wps_id              INT           NULL,
        welder_name         NVARCHAR(200) NULL,
        weld_date           DATE          NULL,

        -- Parametri essenziali (valori prescritti o trascritti in campo)
        weld_params         NVARCHAR(MAX) NULL,
        -- JSON: {"current_a":"","voltage_v":"","travel_speed":"","passes":"","preheat_c":"","interpass_c":"","filler":"","gas":"","notes":""}

        notes               NVARCHAR(MAX) NULL,

        created_at          DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2     NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_wb_welds_book ON welding_book_welds (book_id, sort_order);

    PRINT 'Tabella welding_book_welds creata.';
END
ELSE
    PRINT 'Tabella welding_book_welds gia'' esistente — skip.';

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wb_welds_book')
BEGIN
    ALTER TABLE welding_book_welds
        ADD CONSTRAINT FK_wb_welds_book
        FOREIGN KEY (book_id) REFERENCES welding_books (id);
    PRINT 'FK_wb_welds_book aggiunta.';
END
