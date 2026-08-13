/**
 * L1 — migrazione 145 company_profile (ADR-018 S1).
 * Verifica statica: catalogo campi presente nel SQL, idempotenza, nessun ALTER su companies.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SQL_PATH = path.join(ROOT, 'database/migrations/145_company_profile.sql');
const VPS_PATH = path.join(ROOT, 'backend/scripts/run-migration-145-vps.js');
const CATALOG_PATH = path.join(ROOT, 'docs/specs/COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md');

const CATALOG_FIELDS = [
    'legal_name', 'vat_number', 'fiscal_code', 'ateco_primary', 'ateco_primary_desc',
    'ateco_secondary', 'legal_form', 'rea_number', 'cciaa', 'pec',
    'registered_street', 'registered_cap', 'registered_city', 'registered_province',
    'registered_country', 'local_units_summary', 'share_capital', 'company_status',
    'legal_rep_name', 'website', 'phone', 'email',
    'employees_count', 'employees_note', 'sites_count', 'sites_description',
    'collective_agreement', 'has_construction_sites', 'has_third_party_sites',
    'has_dvr', 'rspp_name', 'competent_doctor', 'rls_name', 'inail_pat',
    'main_hazards', 'uses_hazardous_agents', 'has_work_at_height', 'has_night_shifts',
    'equipment_summary', 'produces_waste', 'waste_cer_summary', 'waste_broker_or_self',
    'has_water_discharge', 'has_air_emissions', 'has_aua_or_aia', 'authorization_refs',
    'uses_fuel_plants', 'energy_carriers', 'noise_external_relevant',
    'hazardous_substances_env', 'notes', 'profile_version_label',
];

const META_FIELDS = [
    'company_id', 'organization_id', 'source_meta', 'profile_completeness',
    'created_at', 'updated_at', 'updated_by_user_id',
];

function readUtf8(filePath) {
    const buf = fs.readFileSync(filePath);
    expect(buf[0]).not.toBe(0xef);
    return buf.toString('utf8');
}

describe('migration 145 company_profile', () => {
    let sql;
    let vps;
    let catalog;

    beforeAll(() => {
        sql = readUtf8(SQL_PATH);
        vps = readUtf8(VPS_PATH);
        catalog = readUtf8(CATALOG_PATH);
    });

    it('file SQL e script VPS esistono e sono UTF-8 senza BOM', () => {
        expect(sql.length).toBeGreaterThan(200);
        expect(vps.length).toBeGreaterThan(200);
    });

    it('script VPS usa il require database sul VPS', () => {
        expect(vps).toContain("require('/var/www/sgq-backend/src/config/database')");
    });

    it('CREATE TABLE è idempotente (IF NOT EXISTS su tabella, FK, indice)', () => {
        expect(sql).toMatch(/IF NOT EXISTS[\s\S]*company_profile[\s\S]*type = 'U'/);
        expect(sql).toContain("name = 'FK_company_profile_company'");
        expect(sql).toContain("name = 'FK_company_profile_org'");
        expect(sql).toContain("name = 'IX_company_profile_organization_id'");
        expect(vps).toMatch(/IF NOT EXISTS[\s\S]*company_profile[\s\S]*type = 'U'/);
        expect(vps).toContain("name = 'FK_company_profile_company'");
        expect(vps).toContain("name = 'IX_company_profile_organization_id'");
    });

    it('PK è company_id; indice su organization_id; source_meta NVARCHAR(MAX)', () => {
        expect(sql).toMatch(/CONSTRAINT PK_company_profile PRIMARY KEY CLUSTERED \(company_id\)/);
        expect(sql).toMatch(/INDEX IX_company_profile_organization_id[\s\S]*\(organization_id\)/);
        expect(sql).toMatch(/source_meta\s+NVARCHAR\(MAX\)/);
        expect(sql).toMatch(/profile_completeness\s+TINYINT/);
    });

    it('nessun ALTER su companies (solo FK dalla nuova tabella)', () => {
        expect(sql).not.toMatch(/ALTER TABLE\s+(dbo\.)?companies\b/i);
        expect(vps).not.toMatch(/ALTER TABLE\s+(dbo\.)?companies\b/i);
        expect(sql).toMatch(/FOREIGN KEY \(company_id\) REFERENCES dbo\.companies\(id\)/);
    });

    it('tutti i campi del catalogo sono colonne nel SQL e nello script VPS', () => {
        const missingSql = CATALOG_FIELDS.filter((f) => !new RegExp(`\\b${f}\\b`).test(sql));
        const missingVps = CATALOG_FIELDS.filter((f) => !new RegExp(`\\b${f}\\b`).test(vps));
        expect(missingSql).toEqual([]);
        expect(missingVps).toEqual([]);
        META_FIELDS.forEach((f) => {
            expect(sql).toMatch(new RegExp(`\\b${f}\\b`));
            expect(vps).toMatch(new RegExp(`\\b${f}\\b`));
        });
    });

    it('il catalogo spec elenca gli stessi field_key (nessun campo catalogo dimenticato)', () => {
        const missingFromCatalog = CATALOG_FIELDS.filter((f) => !catalog.includes('`' + f + '`'));
        expect(missingFromCatalog).toEqual([]);
    });
});
