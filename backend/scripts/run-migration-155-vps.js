/**
 * Migration 155 (VPS) — rdp_reports.project_id + ndt_reports.project_id (ISO-7).
 *
 *   scp -P 1122 database/migrations/155_rdp_ndt_project_id.sql \
 *     spascarella@sistemi.fr-busato.it:/var/www/sgq-backend/database/migrations/
 *   scp -P 1122 backend/scripts/run-migration-155-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test node /tmp/run-migration-155-vps.js'
 */
const fs = require('fs');

const IS_TEST = process.env.SGQ_MIGRATION_TARGET === 'test';
const BACKEND_ROOT = IS_TEST ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
const ENV_FILE = IS_TEST ? `${BACKEND_ROOT}/.env.test` : `${BACKEND_ROOT}/.env`;

require(`${BACKEND_ROOT}/node_modules/dotenv`).config({ path: ENV_FILE });
const { getPool } = require(`${BACKEND_ROOT}/src/config/database`);

const SQL_CANDIDATES = [
  `${BACKEND_ROOT}/database/migrations/155_rdp_ndt_project_id.sql`,
  '/tmp/155_rdp_ndt_project_id.sql',
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
    throw new Error('SQL 155 non trovato. Copia 155_rdp_ndt_project_id.sql in ' + SQL_CANDIDATES.join(' oppure '));
  }
  return found;
}

async function run() {
  const sqlPath = resolveSqlPath();
  const steps = splitIdempotentSteps(fs.readFileSync(sqlPath, 'utf8'));
  if (steps.length < 6) {
    throw new Error(`Attesi 6 step idempotenti, trovati ${steps.length} in ${sqlPath}`);
  }
  const pool = await getPool();
  try {
    console.log(`[155] target=${IS_TEST ? 'test' : 'prod'} SQL: ${sqlPath} — ${steps.length} step`);
    for (let i = 0; i < steps.length; i++) {
      await pool.request().query(steps[i]);
      console.log(`[155] Step ${i + 1}/${steps.length} OK`);
    }
    const cols = await pool.request().query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND COLUMN_NAME = 'project_id'
        AND TABLE_NAME IN ('rdp_reports', 'ndt_reports')
    `);
    const names = (cols.recordset || []).map((r) => r.TABLE_NAME).sort();
    if (names.length < 2) {
      console.error('[155] ERRORE: manca project_id su rdp_reports o ndt_reports', names);
      process.exitCode = 1;
      return;
    }
    console.log('[155] Migration completata.', names.join(', '));
  } catch (e) {
    console.error('[155] ERRORE:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

run();
