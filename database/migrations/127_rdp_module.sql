-- Migration 127: Modulo RDP (Rapporto di Prova — Scenario 4, cliente Mason)
-- Rif. roadmap: docs/PROJECT_ROADMAP.md sezione "Modulo RDP - Rapporto di Prova (Scenario 4 - Mason)"
-- Template cliente (non normativo): Check List Audit/RDP_MSN-260127-01_REV_0.docx
--
-- Contenuto:
--   1) document_type su audits (infrastruttura condivisa audit/sal/rdp prevista da roadmap;
--      il modulo RDP di questa slice usa tabelle dedicate rdp_* — vedi nota sotto)
--   2) rdp_reports  (testata rapporto — 1 per visita ispettiva)
--   3) rdp_sections (raggruppamento domande per area, es. "GESTIONE QUALITA'")
--   4) rdp_tests    (singola prova/domanda con esito e valutazione numerica)
--   5) attachments.rdp_test_id (foto per singola prova — pattern identico a ndt_report_item_id)
--
-- Nota architetturale: la colonna document_type su audits resta per coerenza con la
-- roadmap (ADR-009) e con scenari futuri (registro documentale unificato). Il modello
-- dati operativo di RDP in questa slice segue invece il pattern gia' collaudato di
-- ndt_reports/ndt_report_items (tabelle dedicate, CRUD diretto) perche' RDP non richiede
-- il motore offline-first di audits (IndexedDB/sync/lock) e replicarlo qui avrebbe
-- introdotto debito e rischio non necessari per un MVP.
-- Idempotente: ogni blocco verifica esistenza prima di creare/alterare.

SET NOCOUNT ON;

-- =====================================================================
-- 1) audits.document_type — CHECK IN ('audit','sal','rdp'), default 'audit'
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.audits') AND name = 'document_type'
)
BEGIN
    ALTER TABLE dbo.audits
        ADD document_type NVARCHAR(20) NOT NULL DEFAULT 'audit';
    PRINT 'Colonna document_type aggiunta a dbo.audits.';
END
ELSE
    PRINT 'Colonna document_type gia'' esistente su dbo.audits — skip.';

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CK_audits_doc_type'
)
BEGIN
    ALTER TABLE dbo.audits
        ADD CONSTRAINT CK_audits_doc_type
        CHECK (document_type IN ('audit', 'sal', 'rdp'));
    PRINT 'Constraint CK_audits_doc_type aggiunto.';
END
ELSE
    PRINT 'Constraint CK_audits_doc_type gia'' esistente — skip.';

-- =====================================================================
-- 2) TABELLA PADRE: rdp_reports
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rdp_reports')
BEGIN
    CREATE TABLE rdp_reports (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        uuid                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        organization_id         INT           NOT NULL,
        company_id              INT           NULL,       -- committente (es. Manitou) da anagrafica companies

        -- Numerazione automatica: RDP-2026-001 (progressiva per organization_id)
        report_number           NVARCHAR(30)  NULL,
        report_year             INT           NOT NULL DEFAULT YEAR(GETDATE()),

        -- Dati generali intervento (da template RDP_MSN)
        client                  NVARCHAR(200) NULL,      -- committente sul certificato (es. Manitou)
        supplier_name           NVARCHAR(200) NULL,      -- fornitore ispezionato (sede visitata)
        project_name            NVARCHAR(300) NULL,      -- "Descrizione/Intervento tecnico" (es. Audit progetto saldatura Manitou)
        purpose                 NVARCHAR(500) NULL,      -- "Scopo della visita ispettiva"
        welded_element_type     NVARCHAR(300) NULL,      -- "Tipologia elemento saldato"
        drawing_reference       NVARCHAR(300) NULL,      -- "Disegno/i di riferimento"

        inspection_date         DATE          NULL,      -- "Data visita ispettiva"
        mason_inspector         NVARCHAR(200) NULL,      -- "Ispettore Mason Srl" (auto-fill utente loggato)
        client_inspector         NVARCHAR(200) NULL,      -- "Ispettore [Cliente]"

        average_score           DECIMAL(4,2)  NULL,      -- "Media Valutazione Finale" (calcolata lato backend)
        notes                   NVARCHAR(MAX) NULL,

        status                  NVARCHAR(20)  NOT NULL DEFAULT 'draft',
            -- 'draft' | 'completed' | 'approved'

        is_deleted              BIT           NOT NULL DEFAULT 0,
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        created_by              INT           NULL
    );

    CREATE INDEX IX_rdp_reports_org ON rdp_reports (organization_id);
    CREATE INDEX IX_rdp_reports_company ON rdp_reports (company_id);
    CREATE INDEX IX_rdp_reports_status ON rdp_reports (status, is_deleted);
    CREATE UNIQUE INDEX UX_rdp_reports_uuid ON rdp_reports (uuid);
    CREATE UNIQUE INDEX UX_rdp_reports_org_number ON rdp_reports (organization_id, report_number) WHERE report_number IS NOT NULL;

    PRINT 'Tabella rdp_reports creata.';
END
ELSE
    PRINT 'Tabella rdp_reports gia'' esistente — skip.';

-- =====================================================================
-- 3) TABELLA FIGLIA: rdp_sections (raggruppamento per area, es. "ISPEZIONE IN CAMPO")
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rdp_sections')
BEGIN
    CREATE TABLE rdp_sections (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        report_id               INT           NOT NULL,  -- FK rdp_reports.id
        sort_order              INT           NOT NULL DEFAULT 0,
        title                   NVARCHAR(300) NOT NULL,
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_rdp_sections_report ON rdp_sections (report_id, sort_order);

    PRINT 'Tabella rdp_sections creata.';
END
ELSE
    PRINT 'Tabella rdp_sections gia'' esistente — skip.';

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_rdp_sections_report'
)
BEGIN
    ALTER TABLE rdp_sections
        ADD CONSTRAINT FK_rdp_sections_report
        FOREIGN KEY (report_id) REFERENCES rdp_reports (id);
    PRINT 'FK_rdp_sections_report aggiunta.';
END

-- =====================================================================
-- 4) TABELLA NIPOTE: rdp_tests (singola prova/quesito con esito)
-- =====================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rdp_tests')
BEGIN
    CREATE TABLE rdp_tests (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        section_id              INT           NOT NULL,  -- FK rdp_sections.id
        sort_order              INT           NOT NULL DEFAULT 0,

        reference_code          NVARCHAR(100) NULL,      -- "Rif. Proc." (es. PQ 08.02, STD-DO-QU-016)
        test_name                NVARCHAR(MAX) NOT NULL,  -- "Quesito" (testo prova/domanda tecnica)
        expected_value           NVARCHAR(500) NULL,      -- valore/criterio atteso (se applicabile)
        measured_value           NVARCHAR(500) NULL,      -- valore/esito misurato (se applicabile)
        evidence_notes           NVARCHAR(MAX) NULL,      -- "Valutazione/Evidenze" (narrativa)

        score                   DECIMAL(3,1)  NULL,      -- valutazione numerica 1.0-5.0 (scala Mason)
        result_code              NVARCHAR(10)  NULL,      -- esito qualitativo — stesso vocabolario conformity_status

        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_rdp_tests_section ON rdp_tests (section_id, sort_order);

    PRINT 'Tabella rdp_tests creata.';
END
ELSE
    PRINT 'Tabella rdp_tests gia'' esistente — skip.';

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_rdp_tests_section'
)
BEGIN
    ALTER TABLE rdp_tests
        ADD CONSTRAINT FK_rdp_tests_section
        FOREIGN KEY (section_id) REFERENCES rdp_sections (id);
    PRINT 'FK_rdp_tests_section aggiunta.';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_rdp_tests_result_code'
)
BEGIN
    ALTER TABLE rdp_tests
        ADD CONSTRAINT CK_rdp_tests_result_code
        CHECK (result_code IS NULL OR result_code IN ('C', 'NC', 'OSS', 'OM', 'NA', 'NV'));
    PRINT 'Constraint CK_rdp_tests_result_code aggiunto.';
END

-- =====================================================================
-- 5) attachments.rdp_test_id — foto per singola prova (obbligatorie in UI)
--    Pattern identico a ndt_report_item_id (migration 108): FK indipendente,
--    non richiede audit_id/question_id.
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'rdp_test_id'
)
BEGIN
    ALTER TABLE dbo.attachments
        ADD rdp_test_id INT NULL;
    PRINT 'Colonna rdp_test_id aggiunta a dbo.attachments.';
END
ELSE
    PRINT 'Colonna rdp_test_id gia'' esistente su dbo.attachments — skip.';

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_attachments_rdp_test_id'
)
BEGIN
    ALTER TABLE dbo.attachments
        ADD CONSTRAINT FK_attachments_rdp_test_id
        FOREIGN KEY (rdp_test_id) REFERENCES dbo.rdp_tests(id);
    PRINT 'FK_attachments_rdp_test_id aggiunta.';
END
ELSE
    PRINT 'FK_attachments_rdp_test_id gia'' esistente — skip.';

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_attachments_rdp_test_id' AND object_id = OBJECT_ID('dbo.attachments')
)
BEGIN
    CREATE INDEX IX_attachments_rdp_test_id
        ON dbo.attachments (rdp_test_id)
        WHERE rdp_test_id IS NOT NULL;
    PRINT 'Indice IX_attachments_rdp_test_id creato.';
END
ELSE
    PRINT 'Indice IX_attachments_rdp_test_id gia'' esistente — skip.';

PRINT 'Migration 127 completata.';
