/**
 * Migration 161 (VPS) — snapshot report gap capacità su commercial_cases (VC-1).
 *
 *   scp -P 1122 database/migrations/161_commercial_cases_capability_gap_report.sql \
 *     spascarella@sistemi.fr-busato.it:/var/www/sgq-backend/database/migrations/
 *   scp -P 1122 backend/scripts/run-migration-161-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it 'node /tmp/run-migration-161-vps.js'
 *
 * Test DB: SGQ_MIGRATION_TARGET=test node /tmp/run-migration-161-vps.js
 */
const fs = require('fs');

const IS_TEST = process.env.SGQ_MIGRATION_TARGET === 'test';
const BACKEND_ROOT = IS_TEST ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
const ENV_FILE = IS_TEST ? `${BACKEND_ROOT}/.env.test` : `${BACKEND_ROOT}/.env`;

require(`${BACKEND_ROOT}/node_modules/dotenv`).config({ path: ENV_FILE });
const { getPool } = require(`${BACKEND_ROOT}/src/config/database`);

const SQL_CANDIDATES = [
  `${BACKEND_ROOT}/database/migrations/161_commercial_cases_capability_gap_report.sql`,
  '/tmp/161_commercial_cases_capability_gap_report.sql',
];

function splitIdempotentSteps(sqlText) {
  const withoutBom = String(sqlText).replace(/^\uFEFF/, '');
  return withoutBom
    .split(/\n(?=IF (?:NOT )?EXISTS)/i)
    .map((chunk) => chunk.trim())
    .filter((chunk) => /^IF (?:NOT )?EXISTS/i.test(chunk));
}

function resolveSqlPath() {
  const found = SQL_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      'SQL 161 non trovato. Copia 161_commercial_cases_capability_gap_report.sql in ' +
        SQL_CANDIDATES.join(' oppure ')
    );
  }
  return found;
}

async function run() {
  const sqlPath = resolveSqlPath();
  const steps = splitIdempotentSteps(fs.readFileSync(sqlPath, 'utf8'));
  if (steps.length < 2) {
    throw new Error(`Attesi 2 step idempotenti, trovati ${steps.length} in ${sqlPath}`);
  }
  const pool = await getPool();
  try {
    console.log(`[161] target=${IS_TEST ? 'test' : 'prod'} SQL: ${sqlPath} — ${steps.length} step`);
    for (let i = 0; i < steps.length; i++) {
      await pool.request().query(steps[i]);
      console.log(`[161] Step ${i + 1}/${steps.length} OK`);
    }
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'commercial_cases'
        AND COLUMN_NAME IN ('capability_gap_report_json', 'capability_gap_report_at')
      ORDER BY COLUMN_NAME
    `);
    const names = (cols.recordset || []).map((r) => r.COLUMN_NAME);
    if (!names.includes('capability_gap_report_json') || !names.includes('capability_gap_report_at')) {
      console.error('[161] ERRORE: colonne attese assenti', names);
      process.exitCode = 1;
      return;
    }
    console.log('[161] Verifica:', JSON.stringify(cols.recordset, null, 2));
    console.log('[161] Migration completata.');
  } catch (e) {
    console.error('[161] ERRORE:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

run();
