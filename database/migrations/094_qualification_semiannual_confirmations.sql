-- Migration 094: registro conferme semestrali qualifiche ISO 9606 + coordinatore primario
-- Idempotente: colonne/tabella/FK solo se assenti.

-- Coordinatore saldatura responsabile primario (un solo primario per azienda — logica applicativa)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('company_personnel') AND name = 'is_primary_welding_coordinator'
)
BEGIN
    ALTER TABLE company_personnel ADD is_primary_welding_coordinator BIT NOT NULL DEFAULT 0;
    PRINT 'Colonna is_primary_welding_coordinator aggiunta.';
END
ELSE
    PRINT 'Colonna is_primary_welding_coordinator già presente — skip.';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'qualification_confirmations' AND type = 'U'
)
BEGIN
    CREATE TABLE qualification_confirmations (
        id                  INT IDENTITY(1,1) NOT NULL,
        qualification_id    INT            NOT NULL,
        organization_id     INT            NOT NULL,
        company_id          INT            NOT NULL,
        confirmed_at        DATE           NOT NULL,
        confirmed_by        INT            NULL,
        confirmer_name      NVARCHAR(200)  NOT NULL,
        confirmer_title     NVARCHAR(200)  NULL,
        notes               NVARCHAR(500)  NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_qualification_confirmations PRIMARY KEY (id)
    );
    CREATE INDEX IX_qualification_confirmations_qual
        ON qualification_confirmations (qualification_id);
    CREATE INDEX IX_qualification_confirmations_company_date
        ON qualification_confirmations (company_id, confirmed_at);
    PRINT 'Tabella qualification_confirmations creata.';
END
ELSE
    PRINT 'Tabella qualification_confirmations già esistente — skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qual_confirmations_qualification')
    ALTER TABLE qualification_confirmations
    ADD CONSTRAINT FK_qual_confirmations_qualification
        FOREIGN KEY (qualification_id) REFERENCES qualifications(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qual_confirmations_org')
    ALTER TABLE qualification_confirmations
    ADD CONSTRAINT FK_qual_confirmations_org
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qual_confirmations_company')
    ALTER TABLE qualification_confirmations
    ADD CONSTRAINT FK_qual_confirmations_company
        FOREIGN KEY (company_id) REFERENCES companies(id);
GO

PRINT 'Migration 094 completata.';
GO
