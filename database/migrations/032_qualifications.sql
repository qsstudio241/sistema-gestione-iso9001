-- Migration 032: Modulo Qualifiche
-- Registro qualifiche personale (saldatori, NDT, patentini vari)
-- Compatibile con ISO 9606, ISO 9712, EN 473, ASNT, e qualifiche generiche.
-- Puramente additivo. Idempotente.

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'qualifications' AND type = 'U'
)
BEGIN
    CREATE TABLE qualifications (
        id                  INT IDENTITY(1,1) NOT NULL,
        -- Tenant isolation
        organization_id     INT            NOT NULL,
        company_id          INT            NULL,

        -- Persona
        person_name         NVARCHAR(200)  NOT NULL,
        person_code         NVARCHAR(50)   NULL,    -- matricola / codice interno
        department          NVARCHAR(100)  NULL,

        -- Qualifica
        qualification_type  NVARCHAR(100)  NOT NULL, -- es. 'Saldatore ISO 9606', 'NDT VT Livello 2', 'Patentino PES'
        standard_ref        NVARCHAR(100)  NULL,     -- es. 'ISO 9606-1', 'ISO 9712', 'CEI 11-27'
        scope_detail        NVARCHAR(300)  NULL,     -- es. 'MIG/MAG, acciaio al carbonio, spessore 3-40mm'
        certificate_number  NVARCHAR(100)  NULL,     -- numero patentino / certificato
        issuing_body        NVARCHAR(200)  NULL,     -- ente certificatore (es. 'IIS', 'Bureau Veritas')

        -- Date
        issue_date          DATE           NULL,
        expiry_date         DATE           NULL,     -- NULL = valida indeterminatamente
        last_renewal_date   DATE           NULL,

        -- Stato
        status              NVARCHAR(30)   NOT NULL DEFAULT 'valida'
            CONSTRAINT CK_qualif_status CHECK (
                status IN ('valida','in_scadenza','scaduta','sospesa','revocata')
            ),

        -- Note
        notes               NVARCHAR(1000) NULL,

        -- Audit trail
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        created_by          INT            NULL,

        CONSTRAINT PK_qualifications PRIMARY KEY (id),
        CONSTRAINT FK_qualif_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
        CONSTRAINT FK_qualif_company FOREIGN KEY (company_id)  REFERENCES companies(id)
    );

    CREATE INDEX IX_qualif_org      ON qualifications(organization_id);
    CREATE INDEX IX_qualif_expiry   ON qualifications(expiry_date);
    CREATE INDEX IX_qualif_company  ON qualifications(company_id);
END
