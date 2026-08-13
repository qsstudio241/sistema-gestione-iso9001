-- =============================================================================
-- Migration 145 — company_profile (ADR-018, slice S1)
-- Tabella 1:1 opzionale per profilo conformità legislativa (14001/45001).
-- companies resta minima: nessun ALTER su companies, solo FK dalla nuova tabella.
-- Assenza di riga = comportamento attuale (S2: GET 200 + defaults vuoti).
-- Idempotente: IF NOT EXISTS su tabella, FK e indice.
-- =============================================================================

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'company_profile' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.company_profile (
        company_id                  INT            NOT NULL,
        organization_id             INT            NOT NULL,

        -- Livello A — anagrafica recuperabile (visura / Excel)
        legal_name                  NVARCHAR(255)  NULL,
        vat_number                  NVARCHAR(50)   NULL,
        fiscal_code                 NVARCHAR(50)   NULL,
        ateco_primary               NVARCHAR(20)   NULL,
        ateco_primary_desc          NVARCHAR(500)  NULL,
        ateco_secondary             NVARCHAR(500)  NULL,
        legal_form                  NVARCHAR(100)  NULL,
        rea_number                  NVARCHAR(50)   NULL,
        cciaa                       NVARCHAR(50)   NULL,
        pec                         NVARCHAR(320)  NULL,
        registered_street           NVARCHAR(255)  NULL,
        registered_cap              NVARCHAR(10)   NULL,
        registered_city             NVARCHAR(100)  NULL,
        registered_province         NVARCHAR(2)    NULL,
        registered_country          NVARCHAR(2)    NULL,
        local_units_summary         NVARCHAR(MAX)  NULL,
        share_capital               NVARCHAR(50)   NULL,
        company_status              NVARCHAR(50)   NULL,
        legal_rep_name              NVARCHAR(200)  NULL,
        website                     NVARCHAR(255)  NULL,
        phone                       NVARCHAR(50)   NULL,
        email                       NVARCHAR(320)  NULL,

        -- Livello B — dimensione / SSL / ambiente (inserimento studio)
        employees_count             INT            NULL,
        employees_note              NVARCHAR(500)  NULL,
        sites_count                 INT            NULL,
        sites_description           NVARCHAR(MAX)  NULL,
        collective_agreement        NVARCHAR(200)  NULL,
        has_construction_sites      BIT            NULL,
        has_third_party_sites       BIT            NULL,
        has_dvr                     BIT            NULL,
        rspp_name                   NVARCHAR(200)  NULL,
        competent_doctor            NVARCHAR(200)  NULL,
        rls_name                    NVARCHAR(200)  NULL,
        inail_pat                   NVARCHAR(50)   NULL,
        main_hazards                NVARCHAR(MAX)  NULL,
        uses_hazardous_agents       BIT            NULL,
        has_work_at_height          BIT            NULL,
        has_night_shifts            BIT            NULL,
        equipment_summary           NVARCHAR(MAX)  NULL,
        produces_waste              BIT            NULL,
        waste_cer_summary           NVARCHAR(MAX)  NULL,
        waste_broker_or_self        NVARCHAR(200)  NULL,
        has_water_discharge         BIT            NULL,
        has_air_emissions           BIT            NULL,
        has_aua_or_aia              BIT            NULL,
        authorization_refs          NVARCHAR(MAX)  NULL,
        uses_fuel_plants            BIT            NULL,
        energy_carriers             NVARCHAR(200)  NULL,
        noise_external_relevant     BIT            NULL,
        hazardous_substances_env    NVARCHAR(MAX)  NULL,
        notes                       NVARCHAR(MAX)  NULL,
        profile_version_label       NVARCHAR(50)   NULL,

        -- Meta
        source_meta                 NVARCHAR(MAX)  NULL,
        profile_completeness        TINYINT        NULL,
        created_at                  DATETIME2      NOT NULL CONSTRAINT DF_company_profile_created_at DEFAULT SYSUTCDATETIME(),
        updated_at                  DATETIME2      NOT NULL CONSTRAINT DF_company_profile_updated_at DEFAULT SYSUTCDATETIME(),
        updated_by_user_id          INT            NULL,

        CONSTRAINT PK_company_profile PRIMARY KEY CLUSTERED (company_id)
    );
    PRINT 'Tabella company_profile creata.';
END
ELSE
    PRINT 'Tabella company_profile gia presente — skip.';

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_profile_company')
    ALTER TABLE dbo.company_profile
    ADD CONSTRAINT FK_company_profile_company
        FOREIGN KEY (company_id) REFERENCES dbo.companies(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_profile_org')
    ALTER TABLE dbo.company_profile
    ADD CONSTRAINT FK_company_profile_org
        FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_profile_updated_by')
    ALTER TABLE dbo.company_profile
    ADD CONSTRAINT FK_company_profile_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES dbo.users(user_id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_company_profile_organization_id'
      AND object_id = OBJECT_ID('dbo.company_profile')
)
    CREATE NONCLUSTERED INDEX IX_company_profile_organization_id
        ON dbo.company_profile (organization_id);

PRINT 'Migration 145 completata.';
