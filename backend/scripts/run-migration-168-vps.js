/**
 * Migration 168 (VPS) — qualifications: colonne prova vs validità ISO 9606-1 (fetta 1).
 * Additive, nullable, idempotente. Nessun ON DELETE CASCADE. Nessun restart Node.
 *
 *   scp -P 1122 database/migrations/168_qualifications_test_validity_9606.sql \
 *     spascarella@sistemi.fr-busato.it:/var/www/sgq-backend/database/migrations/
 *   scp -P 1122 backend/scripts/run-migration-168-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'node /tmp/run-migration-168-vps.js'
 *
 * Test DB: SGQ_MIGRATION_TARGET=test node /tmp/run-migration-168-vps.js
 * Solo verifica colonne: SGQ_MIGRATION_CHECK_ONLY=1 node /tmp/run-migration-168-vps.js
 */
const fs = require('fs');

const IS_TEST = process.env.SGQ_MIGRATION_TARGET === 'test';
const CHECK_ONLY = process.env.SGQ_MIGRATION_CHECK_ONLY === '1';
const BACKEND_ROOT = IS_TEST ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
const ENV_FILE = IS_TEST ? `${BACKEND_ROOT}/.env.test` : `${BACKEND_ROOT}/.env`;

require(`${BACKEND_ROOT}/node_modules/dotenv`).config({ path: ENV_FILE });
const { getPool } = require(`${BACKEND_ROOT}/src/config/database`);

const SQL_CANDIDATES = [
  `${BACKEND_ROOT}/database/migrations/168_qualifications_test_validity_9606.sql`,
  '/tmp/168_qualifications_test_validity_9606.sql',
];

const EXPECTED_COLUMNS = [
  'welding_process_test',
  'welding_processes_validity',
  'welding_position_test',
  'thickness_s_test_mm',
  'thickness_t_test_mm',
  'pipe_diameter_test_mm',
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
      'SQL 168 non trovato. Copia 168_qualifications_test_validity_9606.sql in ' +
        SQL_CANDIDATES.join(' oppure ')
    );
  }
  return found;
}

async function listExpectedColumns(pool) {
  const result = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = N'qualifications'
      AND COLUMN_NAME IN (
        N'welding_process_test', N'welding_processes_validity', N'welding_position_test',
        N'thickness_s_test_mm', N'thickness_t_test_mm', N'pipe_diameter_test_mm',
        N'qualification_designation'
      )
    ORDER BY COLUMN_NAME
  `);
  return result.recordset || [];
}

function missingExpected(rows) {
  const present = new Set(rows.map((r) => r.COLUMN_NAME));
  return EXPECTED_COLUMNS.filter((name) => !present.has(name));
}

async function run() {
  const pool = await getPool();
  try {
    console.log(`[168] target=${IS_TEST ? 'test' : 'prod'} checkOnly=${CHECK_ONLY ? 'yes' : 'no'}`);
    const before = await listExpectedColumns(pool);
    console.log('[168] Colonne prima:', JSON.stringify(before));
    const missing = missingExpected(before);
    if (missing.length === 0) {
      console.log('[168] Migrazione non necessaria: le 6 colonne prova/validità 9606 sono già su qualifications.');
      process.exitCode = 0;
      return;
    }
    console.log('[168] Colonne mancanti:', missing.join(', '));
    if (CHECK_ONLY) {
      console.log('[168] CHECK_ONLY: nessun ALTER eseguito.');
      process.exitCode = 0;
      return;
    }
    const sqlPath = resolveSqlPath();
    const steps = splitIdempotentSteps(fs.readFileSync(sqlPath, 'utf8'));
    if (steps.length < 6) {
      throw new Error(`Attesi 6 step IF NOT EXISTS, trovati ${steps.length} in ${sqlPath}`);
    }
    console.log(`[168] SQL: ${sqlPath} — ${steps.length} step`);
    for (let i = 0; i < steps.length; i++) {
      await pool.request().query(steps[i]);
      console.log(`[168] Step ${i + 1}/${steps.length} OK`);
    }
    const after = await listExpectedColumns(pool);
    console.log('[168] Colonne dopo:', JSON.stringify(after));
    const stillMissing = missingExpected(after);
    if (stillMissing.length) {
      console.error('[168] ERRORE: colonne ancora assenti:', stillMissing.join(', '));
      process.exitCode = 1;
      return;
    }
    console.log('[168] Migration completata. Colonne prova/validità 9606 presenti.');
  } catch (e) {
    console.error('[168] ERRORE:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

run();
