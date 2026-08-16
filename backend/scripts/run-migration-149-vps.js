/**
 * Migration 149 (VPS PROD) — tabelle Material Compliance (MC-1).
 * Additive: material_certificates + material_certificate_checks.
 *
 * Uso (Cloud Agent, dopo SCP del .sql nella cartella migrazioni VPS):
 *   scp -P 1122 database/migrations/149_material_certificates.sql \
 *     spascarella@sistemi.fr-busato.it:/var/www/sgq-backend/database/migrations/
 *   scp -P 1122 backend/scripts/run-migration-149-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it 'node /tmp/run-migration-149-vps.js'
 *   ssh -p 1122 ... 'SGQ_MIGRATION_TARGET=test node /tmp/run-migration-149-vps.js'
 */
const fs = require('fs');

const IS_TEST = process.env.SGQ_MIGRATION_TARGET === 'test';
const BACKEND_ROOT = IS_TEST ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
const ENV_FILE = IS_TEST ? `${BACKEND_ROOT}/.env.test` : `${BACKEND_ROOT}/.env`;

require(`${BACKEND_ROOT}/node_modules/dotenv`).config({ path: ENV_FILE });
const { getPool } = require(`${BACKEND_ROOT}/src/config/database`);

const SQL_CANDIDATES = [
  `${BACKEND_ROOT}/database/migrations/149_material_certificates.sql`,
  '/var/www/sgq-backend/database/migrations/149_material_certificates.sql',
  '/tmp/149_material_certificates.sql',
];

function splitIdempotentSteps(sqlText) {
  const withoutBom = String(sqlText).replace(/^\uFEFF/, '');
  return withoutBom
    .split(/\n(?=IF NOT EXISTS)/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /^IF NOT EXISTS/i.test(chunk));
}

function resolveSqlPath() {
  const found = SQL_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      'SQL 149 non trovato. Copia 149_material_certificates.sql in ' +
        SQL_CANDIDATES.join(' oppure ')
    );
  }
  return found;
}

async function run() {
  const sqlPath = resolveSqlPath();
  const sqlText = fs.readFileSync(sqlPath, 'utf8');
  const steps = splitIdempotentSteps(sqlText);
  if (steps.length < 18) {
    throw new Error(`Attesi almeno 18 step idempotenti, trovati ${steps.length} in ${sqlPath}`);
  }

  const pool = await getPool();
  try {
    console.log(`[149] target=${IS_TEST ? 'test' : 'prod'} SQL: ${sqlPath} — ${steps.length} step`);
    for (let i = 0; i < steps.length; i++) {
      await pool.request().query(steps[i]);
      const head = steps[i].replace(/\s+/g, ' ').slice(0, 90);
      console.log(`[149] Step ${i + 1}/${steps.length} OK — ${head}`);
    }

    const tables = await pool.request().query(`
      SELECT name FROM sys.tables
      WHERE name IN ('material_certificates', 'material_certificate_checks')
      ORDER BY name
    `);
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'material_certificates'
      ORDER BY ORDINAL_POSITION
    `);
    const fks = await pool.request().query(`
      SELECT fk.name, fk.delete_referential_action_desc
      FROM sys.foreign_keys fk
      WHERE fk.parent_object_id IN (
        OBJECT_ID('dbo.material_certificates'),
        OBJECT_ID('dbo.material_certificate_checks')
      )
      ORDER BY fk.name
    `);
    const idx = await pool.request().query(`
      SELECT i.name, OBJECT_NAME(i.object_id) AS table_name
      FROM sys.indexes i
      WHERE i.name IN (
        'IX_mc_cert_org_company',
        'IX_mc_cert_org_status',
        'IX_mc_cert_org_role',
        'IX_mc_cert_org_ddt',
        'IX_mc_checks_certificate',
        'IX_mc_checks_org_result'
      )
      ORDER BY i.name
    `);
    const checks = await pool.request().query(`
      SELECT name FROM sys.check_constraints
      WHERE parent_object_id IN (
        OBJECT_ID('dbo.material_certificates'),
        OBJECT_ID('dbo.material_certificate_checks')
      )
      ORDER BY name
    `);

    const tableNames = (tables.recordset || []).map((r) => r.name);
    const colNames = (cols.recordset || []).map((r) => r.COLUMN_NAME);
    const companyCol = (cols.recordset || []).find((r) => r.COLUMN_NAME === 'company_id');
    const fkNames = (fks.recordset || []).map((r) => r.name);
    const idxNames = (idx.recordset || []).map((r) => r.name);
    const checkNames = (checks.recordset || []).map((r) => r.name);

    console.log('[149] Tabelle:', tableNames.join(', '));
    console.log('[149] Colonne certificato:', colNames.length, colNames.join(','));
    console.log('[149] FK:', JSON.stringify(fks.recordset));
    console.log('[149] Indici:', idxNames.join(', '));
    console.log('[149] CHECK:', checkNames.join(', '));

    if (tableNames.length !== 2) {
      console.error('[149] ERRORE: attese 2 tabelle');
      process.exitCode = 1;
      return;
    }
    if (!companyCol || companyCol.IS_NULLABLE !== 'NO') {
      console.error('[149] ERRORE: company_id deve essere NOT NULL');
      process.exitCode = 1;
      return;
    }
    const requiredCols = [
      'ddt_no',
      'material_role',
      'workflow_status',
      'extracted_json',
      'kb_snapshot_hash',
      'text_extract_reason',
    ];
    const missingCols = requiredCols.filter((c) => !colNames.includes(c));
    if (missingCols.length) {
      console.error('[149] ERRORE: colonne mancanti', missingCols.join(','));
      process.exitCode = 1;
      return;
    }
    if (!fkNames.includes('FK_mc_checks_certificate')) {
      console.error('[149] ERRORE: manca FK_mc_checks_certificate');
      process.exitCode = 1;
      return;
    }
    const cascadeFks = (fks.recordset || []).filter(
      (r) => r.delete_referential_action_desc === 'CASCADE'
    );
    if (cascadeFks.length !== 1 || cascadeFks[0].name !== 'FK_mc_checks_certificate') {
      console.error('[149] ERRORE: CASCADE consentito solo su FK_mc_checks_certificate', cascadeFks);
      process.exitCode = 1;
      return;
    }
    if (idxNames.length !== 6) {
      console.error('[149] ERRORE: attesi 6 indici, trovati', idxNames.length);
      process.exitCode = 1;
      return;
    }
    if (!checkNames.includes('CK_mc_cert_workflow_status') || !checkNames.includes('CK_mc_checks_result')) {
      console.error('[149] ERRORE: CHECK workflow/result assenti');
      process.exitCode = 1;
      return;
    }
    console.log('[149] Migration completata.');
  } catch (e) {
    console.error('[149] ERRORE:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

run();
