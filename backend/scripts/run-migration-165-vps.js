/**
 * Migration 165 (VPS) — attachments.welding_book_weld_id + CHK parent (ISO-5b).
 *
 *   scp -P 1122 database/migrations/165_attachments_welding_book_weld.sql \
 *     spascarella@sistemi.fr-busato.it:/var/www/sgq-backend/database/migrations/
 *   scp -P 1122 backend/scripts/run-migration-165-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test node /tmp/run-migration-165-vps.js'
 *   # produzione: stesso file senza TARGET=test
 */
const fs = require('fs');

const IS_TEST = process.env.SGQ_MIGRATION_TARGET === 'test';
const BACKEND_ROOT = IS_TEST ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
const ENV_FILE = IS_TEST ? `${BACKEND_ROOT}/.env.test` : `${BACKEND_ROOT}/.env`;

require(`${BACKEND_ROOT}/node_modules/dotenv`).config({ path: ENV_FILE });
const { getPool } = require(`${BACKEND_ROOT}/src/config/database`);

const SQL_CANDIDATES = [
  `${BACKEND_ROOT}/database/migrations/165_attachments_welding_book_weld.sql`,
  '/tmp/165_attachments_welding_book_weld.sql',
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
    throw new Error('SQL 165 non trovato. Copia 165_attachments_welding_book_weld.sql in ' + SQL_CANDIDATES.join(' oppure '));
  }
  return found;
}

async function run() {
  const sqlPath = resolveSqlPath();
  const steps = splitIdempotentSteps(fs.readFileSync(sqlPath, 'utf8'));
  if (steps.length < 4) {
    throw new Error(`Attesi 4 step idempotenti, trovati ${steps.length} in ${sqlPath}`);
  }
  const pool = await getPool();
  try {
    console.log(`[165] target=${IS_TEST ? 'test' : 'prod'} SQL: ${sqlPath} — ${steps.length} step`);
    for (let i = 0; i < steps.length; i++) {
      await pool.request().query(steps[i]);
      console.log(`[165] Step ${i + 1}/${steps.length} OK`);
    }
    const col = await pool.request().query(`
      SELECT 1 AS ok FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'welding_book_weld_id'
    `);
    if (!col.recordset.length) {
      console.error('[165] ERRORE: colonna welding_book_weld_id assente');
      process.exitCode = 1;
      return;
    }
    const verify = await pool.request().query(`
      SELECT definition
      FROM sys.check_constraints
      WHERE name = 'CHK_attachments_parent'
        AND parent_object_id = OBJECT_ID('dbo.attachments')
    `);
    const def = verify.recordset[0]?.definition || '';
    if (!/welding_book_weld_id/i.test(def)) {
      console.error('[165] ERRORE: CHK_attachments_parent non include welding_book_weld_id', def);
      process.exitCode = 1;
      return;
    }
    const parents = [
      'audit_id', 'nc_id', 'document_id', 'custom_item_id', 'commercial_case_id',
      'ndt_report_item_id', 'rdp_test_id', 'welding_book_weld_id',
    ];
    const missing = parents.filter((p) => !new RegExp(p, 'i').test(def));
    if (missing.length) {
      console.error('[165] ERRORE: parent esistenti persi dal CHECK:', missing.join(', '), def);
      process.exitCode = 1;
      return;
    }
    console.log('[165] Migration completata. attachments.welding_book_weld_id + CHK aggiornato.');
  } catch (e) {
    console.error('[165] ERRORE:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

run();
