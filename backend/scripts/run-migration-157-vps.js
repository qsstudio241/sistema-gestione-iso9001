/**
 * Migration 157 (VPS) — CK_report_templates_scope include cnd + seed VT/PT/MT/UT.
 *
 *   scp -P 1122 database/migrations/157_report_templates_scope_cnd.sql \
 *     spascarella@sistemi.fr-busato.it:/var/www/sgq-backend/database/migrations/
 *   scp -P 1122 backend/scripts/run-migration-157-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test node /tmp/run-migration-157-vps.js'
 *   # produzione: stesso file senza TARGET=test
 *
 * SQL con GO: i batch vanno spezzati (mssql non accetta GO).
 */
const fs = require('fs');

const IS_TEST = process.env.SGQ_MIGRATION_TARGET === 'test';
const BACKEND_ROOT = IS_TEST ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
const ENV_FILE = IS_TEST ? `${BACKEND_ROOT}/.env.test` : `${BACKEND_ROOT}/.env`;

require(`${BACKEND_ROOT}/node_modules/dotenv`).config({ path: ENV_FILE });
const { getPool } = require(`${BACKEND_ROOT}/src/config/database`);

const SQL_CANDIDATES = [
  `${BACKEND_ROOT}/database/migrations/157_report_templates_scope_cnd.sql`,
  '/tmp/157_report_templates_scope_cnd.sql',
];

function splitGoBatches(sqlText) {
  const withoutBom = String(sqlText).replace(/^\uFEFF/, '');
  return withoutBom
    .split(/^\s*GO\s*$/gim)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function resolveSqlPath() {
  const found = SQL_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      'SQL 157 non trovato. Copia 157_report_templates_scope_cnd.sql in ' +
        SQL_CANDIDATES.join(' oppure ')
    );
  }
  return found;
}

async function run() {
  const sqlPath = resolveSqlPath();
  const batches = splitGoBatches(fs.readFileSync(sqlPath, 'utf8'));
  if (batches.length < 6) {
    throw new Error(`Attesi almeno 6 batch GO, trovati ${batches.length} in ${sqlPath}`);
  }
  const pool = await getPool();
  try {
    console.log(`[157] target=${IS_TEST ? 'test' : 'prod'} SQL: ${sqlPath} — ${batches.length} batch`);
    for (let i = 0; i < batches.length; i++) {
      await pool.request().query(batches[i]);
      console.log(`[157] Batch ${i + 1}/${batches.length} OK`);
    }
    const verify = await pool.request().query(`
      SELECT cc.definition
      FROM sys.check_constraints cc
      WHERE cc.name = 'CK_report_templates_scope'
        AND cc.parent_object_id = OBJECT_ID('dbo.report_templates')
    `);
    const def = verify.recordset[0]?.definition || '';
    const requiredScopes = ['audit', 'self_assessment', 'nc', 'cnd'];
    const missing = requiredScopes.filter((s) => !new RegExp(`'${s}'`, 'i').test(def));
    if (missing.length) {
      console.error('[157] ERRORE: CK_report_templates_scope manca:', missing.join(', '), def);
      process.exitCode = 1;
      return;
    }
    const seeds = await pool.request().query(`
      SELECT standard_key, name, file_path, is_system
      FROM dbo.report_templates
      WHERE organization_id IS NULL AND scope = N'cnd'
      ORDER BY standard_key
    `);
    const keys = (seeds.recordset || []).map((r) => String(r.standard_key || '').toUpperCase());
    const expected = ['MT', 'PT', 'UT', 'VT'];
    const missingKeys = expected.filter((k) => !keys.includes(k));
    if (missingKeys.length) {
      console.error('[157] ERRORE: seed CND sistema mancanti:', missingKeys.join(', '), keys);
      process.exitCode = 1;
      return;
    }
    console.log('[157] CK_report_templates_scope include cnd. Seed sistema:', keys.join(', '));
    (seeds.recordset || []).forEach((r) => {
      console.log(`  - ${r.standard_key} ${r.name} ${r.file_path} system=${r.is_system}`);
    });
    console.log('[157] Migration completata.');
  } catch (e) {
    console.error('[157] ERRORE:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

run();
