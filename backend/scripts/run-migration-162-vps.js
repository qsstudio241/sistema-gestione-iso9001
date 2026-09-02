/**
 * Migration 162 (VPS) — template checklist Riesame requisiti (ING-4).
 *
 *   scp -P 1122 database/migrations/162_commercial_checklist_templates.sql \
 *     spascarella@sistemi.fr-busato.it:/var/www/sgq-backend/database/migrations/
 *   scp -P 1122 backend/scripts/run-migration-162-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it 'node /tmp/run-migration-162-vps.js'
 *
 * Test DB: SGQ_MIGRATION_TARGET=test node /tmp/run-migration-162-vps.js
 */
const fs = require('fs');

const IS_TEST = process.env.SGQ_MIGRATION_TARGET === 'test';
const BACKEND_ROOT = IS_TEST ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
const ENV_FILE = IS_TEST ? `${BACKEND_ROOT}/.env.test` : `${BACKEND_ROOT}/.env`;

require(`${BACKEND_ROOT}/node_modules/dotenv`).config({ path: ENV_FILE });
const { getPool } = require(`${BACKEND_ROOT}/src/config/database`);

const SQL_CANDIDATES = [
  `${BACKEND_ROOT}/database/migrations/162_commercial_checklist_templates.sql`,
  '/tmp/162_commercial_checklist_templates.sql',
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
      'SQL 162 non trovato. Copia 162_commercial_checklist_templates.sql in ' +
        SQL_CANDIDATES.join(' oppure ')
    );
  }
  return found;
}

async function run() {
  const sqlPath = resolveSqlPath();
  const steps = splitIdempotentSteps(fs.readFileSync(sqlPath, 'utf8'));
  if (steps.length < 2) {
    throw new Error(`Attesi almeno 2 step idempotenti, trovati ${steps.length} in ${sqlPath}`);
  }
  const pool = await getPool();
  try {
    console.log(`[162] target=${IS_TEST ? 'test' : 'prod'} SQL: ${sqlPath} — ${steps.length} step`);
    for (let i = 0; i < steps.length; i++) {
      await pool.request().query(steps[i]);
      console.log(`[162] Step ${i + 1}/${steps.length} OK`);
    }
    const tables = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME IN ('commercial_checklist_templates', 'commercial_checklist_template_items')
      ORDER BY TABLE_NAME
    `);
    const names = (tables.recordset || []).map((r) => r.TABLE_NAME);
    if (
      !names.includes('commercial_checklist_templates') ||
      !names.includes('commercial_checklist_template_items')
    ) {
      console.error('[162] ERRORE: tabelle attese assenti', names);
      process.exitCode = 1;
      return;
    }
    console.log('[162] Verifica:', JSON.stringify(tables.recordset, null, 2));
    console.log('[162] Migration completata.');
  } catch (e) {
    console.error('[162] ERRORE:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

run();
