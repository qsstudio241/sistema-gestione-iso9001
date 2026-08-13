/**
 * Migration 145 (VPS) — tabella company_profile (ADR-018, slice S1).
 * Estensione 1:1 opzionale: companies resta minima, nessun ALTER su companies.
 * Uso (solo su VPS, via SSH):
 *   node /tmp/run-migration-145-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const STEPS = [
    {
        name: 'CREATE TABLE company_profile',
        sql: `
IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'company_profile' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.company_profile (
        company_id                  INT            NOT NULL,
        organization_id             INT            NOT NULL,
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
        source_meta                 NVARCHAR(MAX)  NULL,
        profile_completeness        TINYINT        NULL,
        created_at                  DATETIME2      NOT NULL CONSTRAINT DF_company_profile_created_at DEFAULT SYSUTCDATETIME(),
        updated_at                  DATETIME2      NOT NULL CONSTRAINT DF_company_profile_updated_at DEFAULT SYSUTCDATETIME(),
        updated_by_user_id          INT            NULL,
        CONSTRAINT PK_company_profile PRIMARY KEY CLUSTERED (company_id)
    );
END
`,
    },
    {
        name: 'FK_company_profile_company',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_profile_company')
    ALTER TABLE dbo.company_profile
    ADD CONSTRAINT FK_company_profile_company
        FOREIGN KEY (company_id) REFERENCES dbo.companies(id)
`,
    },
    {
        name: 'FK_company_profile_org',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_profile_org')
    ALTER TABLE dbo.company_profile
    ADD CONSTRAINT FK_company_profile_org
        FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id)
`,
    },
    {
        name: 'FK_company_profile_updated_by',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_profile_updated_by')
    ALTER TABLE dbo.company_profile
    ADD CONSTRAINT FK_company_profile_updated_by
        FOREIGN KEY (updated_by_user_id) REFERENCES dbo.users(user_id)
`,
    },
    {
        name: 'IX_company_profile_organization_id',
        sql: `
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_company_profile_organization_id'
      AND object_id = OBJECT_ID('dbo.company_profile')
)
    CREATE NONCLUSTERED INDEX IX_company_profile_organization_id
        ON dbo.company_profile (organization_id)
`,
    },
];

async function run() {
    const pool = await getPool();
    try {
        for (let i = 0; i < STEPS.length; i++) {
            const step = STEPS[i];
            await pool.request().query(step.sql);
            console.log(`[145] Step ${i + 1}/${STEPS.length} OK — ${step.name}`);
        }

        const cols = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'company_profile'
            ORDER BY ORDINAL_POSITION
        `);
        const fks = await pool.request().query(`
            SELECT name FROM sys.foreign_keys
            WHERE parent_object_id = OBJECT_ID('dbo.company_profile')
            ORDER BY name
        `);
        const idx = await pool.request().query(`
            SELECT name FROM sys.indexes
            WHERE object_id = OBJECT_ID('dbo.company_profile')
              AND name = 'IX_company_profile_organization_id'
        `);
        const pk = await pool.request().query(`
            SELECT c.name AS column_name
            FROM sys.index_columns ic
            JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
            JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE i.object_id = OBJECT_ID('dbo.company_profile') AND i.is_primary_key = 1
        `);

        console.log('[145] Colonne:', cols.recordset.length, cols.recordset.map((r) => r.COLUMN_NAME).join(','));
        console.log('[145] PK:', JSON.stringify(pk.recordset));
        console.log('[145] FK:', JSON.stringify(fks.recordset));
        console.log('[145] Indice org:', JSON.stringify(idx.recordset));

        if (cols.recordset.length < 50) {
            console.error('[145] ERRORE: attese almeno 50 colonne, trovate', cols.recordset.length);
            process.exitCode = 1;
            return;
        }
        if (!pk.recordset.some((r) => r.column_name === 'company_id')) {
            console.error('[145] ERRORE: PK company_id assente');
            process.exitCode = 1;
            return;
        }
        if (fks.recordset.length < 2) {
            console.error('[145] ERRORE: FK insufficienti');
            process.exitCode = 1;
            return;
        }
        if (idx.recordset.length === 0) {
            console.error('[145] ERRORE: IX_company_profile_organization_id assente');
            process.exitCode = 1;
            return;
        }
        console.log('[145] Migration completata.');
    } catch (e) {
        console.error('[145] ERRORE:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.close().catch(() => {});
        process.exit(process.exitCode || 0);
    }
}

run();
