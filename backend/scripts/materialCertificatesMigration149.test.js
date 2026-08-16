/**
 * L1 — migrazione 149 material_certificates (MC-1).
 * Verifica statica: spec DATA_MODEL, idempotenza, CASCADE solo checks→certificato.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SQL_PATH = path.join(ROOT, 'database/migrations/149_material_certificates.sql');
const VPS_PATH = path.join(ROOT, 'backend/scripts/run-migration-149-vps.js');
const SPEC_PATH = path.join(ROOT, 'docs/specs/MATERIAL_COMPLIANCE_DATA_MODEL.md');

const CERT_COLUMNS = [
  'id',
  'organization_id',
  'company_id',
  'import_job_id',
  'import_job_file_id',
  'document_registry_id',
  'project_id',
  'storage_path',
  'ddt_no',
  'ddt_date',
  'certificate_no',
  'material_role',
  'designation',
  'heat_or_lot_no',
  'product_form',
  'dimensions',
  'material_standard',
  'manufacturer_works',
  'inspection_document_type',
  'workflow_status',
  'extracted_text',
  'text_extract_reason',
  'extracted_json',
  'corrected_json',
  'evaluate_result_json',
  'kb_snapshot_hash',
  'kb_snapshot_json',
  'ai_model',
  'created_by',
  'reviewed_by',
  'reviewed_at',
  'review_notes',
  'created_at',
  'updated_at',
];

const CHECK_COLUMNS = [
  'id',
  'organization_id',
  'certificate_id',
  'requirement_key',
  'source_level',
  'source_ref',
  'required_value',
  'actual_value',
  'result',
  'explanation',
  'created_at',
];

const INDEXES = [
  'IX_mc_cert_org_company',
  'IX_mc_cert_org_status',
  'IX_mc_cert_org_role',
  'IX_mc_cert_org_ddt',
  'IX_mc_checks_certificate',
  'IX_mc_checks_org_result',
];

const WORKFLOW_STATUSES = [
  'received',
  'text_ready',
  'extracted',
  'pending_review',
  'compliant',
  'non_compliant',
  'archived',
  'ocr_running',
];

function readUtf8(filePath) {
  const buf = fs.readFileSync(filePath);
  expect(buf[0]).not.toBe(0xef);
  return buf.toString('utf8');
}

function splitIdempotentSteps(sqlText) {
  return String(sqlText)
    .replace(/^\uFEFF/, '')
    .split(/\n(?=IF (?:NOT )?EXISTS)/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /^IF (?:NOT )?EXISTS/i.test(chunk));
}

describe('migration 149 material_certificates (MC-1)', () => {
  let sql;
  let vps;
  let spec;

  beforeAll(() => {
    sql = readUtf8(SQL_PATH);
    vps = readUtf8(VPS_PATH);
    spec = readUtf8(SPEC_PATH);
  });

  it('file SQL e script VPS esistono, UTF-8 senza BOM, niente GO', () => {
    expect(sql.length).toBeGreaterThan(400);
    expect(vps.length).toBeGreaterThan(400);
    expect(sql).not.toMatch(/^\s*GO\s*$/m);
    expect(vps).not.toMatch(/^\s*GO\s*$/m);
  });

  it('script VPS usa database sul VPS e legge il SQL 149', () => {
    expect(vps).toContain("require(`${BACKEND_ROOT}/src/config/database`)");
    expect(vps).toContain('/database/migrations/149_material_certificates.sql');
    expect(vps).toContain("SGQ_MIGRATION_TARGET === 'test'");
    expect(vps).toContain('splitIdempotentSteps');
  });

  it('SQL è idempotente e lo splitter produce abbastanza step', () => {
    const steps = splitIdempotentSteps(sql);
    expect(steps.length).toBeGreaterThanOrEqual(18);
    expect(sql).toMatch(/IF NOT EXISTS[\s\S]*material_certificates[\s\S]*type = 'U'/);
    expect(sql).toMatch(/IF NOT EXISTS[\s\S]*material_certificate_checks[\s\S]*type = 'U'/);
  });

  it('colonne certificato e checks coincidono con la spec MC-0', () => {
    CERT_COLUMNS.forEach((col) => {
      expect(sql).toMatch(new RegExp(`\\b${col}\\b`));
      expect(spec).toMatch(new RegExp(`\`${col}\``));
    });
    CHECK_COLUMNS.forEach((col) => {
      expect(sql).toMatch(new RegExp(`\\b${col}\\b`));
    });
    expect(sql).toMatch(/company_id\s+INT\s+NOT NULL/);
    expect(sql).toMatch(/material_role\s+NVARCHAR\(16\)\s+NOT NULL/);
    expect(sql).toMatch(/workflow_status\s+NVARCHAR\(32\)\s+NOT NULL/);
  });

  it('CHECK ruolo, tipo documento EN 10204, stati ADR-024, result pass|fail|skip', () => {
    expect(sql).toContain("N'base'");
    expect(sql).toContain("N'filler'");
    expect(sql).toContain("N'2.1'");
    expect(sql).toContain("N'3.2'");
    WORKFLOW_STATUSES.forEach((st) => {
      expect(sql).toContain(`N'${st}'`);
    });
    expect(sql).toContain("N'pass'");
    expect(sql).toContain("N'fail'");
    expect(sql).toContain("N'skip'");
  });

  it('indici della spec e FK SET NULL verso job/registry/commessa', () => {
    INDEXES.forEach((name) => {
      expect(sql).toContain(name);
      expect(vps).toContain(name);
    });
    expect(sql).toMatch(/FK_mc_cert_import_job[\s\S]*ON DELETE SET NULL/);
    expect(sql).toMatch(/FK_mc_cert_document_registry[\s\S]*ON DELETE SET NULL/);
    expect(sql).toMatch(/FK_mc_cert_project[\s\S]*ON DELETE SET NULL/);
  });

  it('CASCADE solo su FK_mc_checks_certificate; niente FK sul file job (cascade path)', () => {
    const cascadeMatches = sql.match(/ON DELETE CASCADE/gi) || [];
    expect(cascadeMatches).toHaveLength(1);
    expect(sql).toMatch(/FK_mc_checks_certificate[\s\S]*ON DELETE CASCADE/);
    expect(sql).toMatch(/import_job_file_id\s+INT\s+NULL/);
    expect(sql).not.toMatch(/ADD CONSTRAINT FK_mc_cert_import_job_file/);
    expect(sql).toMatch(/DROP CONSTRAINT FK_mc_cert_import_job_file/);
    expect(sql).not.toMatch(/ON DELETE CASCADE[\s\S]*import_jobs/);
    expect(sql).not.toMatch(/ON DELETE CASCADE[\s\S]*document_registry/);
  });

  it('nessun file in backend/database/migrations (cartella fantasma)', () => {
    const ghost = path.join(ROOT, 'backend/database/migrations/149_material_certificates.sql');
    expect(fs.existsSync(ghost)).toBe(false);
  });
});
