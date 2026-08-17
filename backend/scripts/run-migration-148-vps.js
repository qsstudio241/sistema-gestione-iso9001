/**
 * Migration 148 (VPS) — companies.risk_pg_max + CHECK P/G 1–5 (ROO-13).
 * Dipendenza di GET /risks (JOIN companies.risk_pg_max). Già su TEST; PROD era indietro.
 *
 *   scp -P 1122 database/migrations/148_companies_risk_pg_max.sql \
 *     spascarella@sistemi.fr-busato.it:/var/www/sgq-backend/database/migrations/
 *   scp -P 1122 backend/scripts/run-migration-148-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it 'node /tmp/run-migration-148-vps.js'
 *   ssh -p 1122 ... 'SGQ_MIGRATION_TARGET=test node /tmp/run-migration-148-vps.js'
 */
const fs = require('fs');

const IS_TEST = process.env.SGQ_MIGRATION_TARGET === 'test';
const BACKEND_ROOT = IS_TEST ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
const ENV_FILE = IS_TEST ? `${BACKEND_ROOT}/.env.test` : `${BACKEND_ROOT}/.env`;

require(`${BACKEND_ROOT}/node_modules/dotenv`).config({ path: ENV_FILE });
const { getPool } = require(`${BACKEND_ROOT}/src/config/database`);

const SQL_CANDIDATES = [
  `${BACKEND_ROOT}/database/migrations/148_companies_risk_pg_max.sql`,
  '/tmp/148_companies_risk_pg_max.sql',
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
      'SQL 148 non trovato. Copia 148_companies_risk_pg_max.sql in ' + SQL_CANDIDATES.join(' oppure ')
    );
  }
  return found;
}

async function run() {
  const sqlPath = resolveSqlPath();
  const steps = splitIdempotentSteps(fs.readFileSync(sqlPath, 'utf8'));
  if (steps.length < 5) {
    throw new Error(`Attesi almeno 5 step idempotenti, trovati ${steps.length} in ${sqlPath}`);
  }
  const pool = await getPool();
  try {
    console.log(`[148] target=${IS_TEST ? 'test' : 'prod'} SQL: ${sqlPath} — ${steps.length} step`);
    for (let i = 0; i < steps.length; i++) {
      await pool.request().query(steps[i]);
      console.log(`[148] Step ${i + 1}/${steps.length} OK`);
    }
    const col = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'companies' AND COLUMN_NAME = 'risk_pg_max'
    `);
    if (!(col.recordset || []).length) {
      console.error('[148] ERRORE: manca companies.risk_pg_max');
      process.exitCode = 1;
      return;
    }
    console.log('[148] Migration completata.');
  } catch (e) {
    console.error('[148] ERRORE:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

run();
