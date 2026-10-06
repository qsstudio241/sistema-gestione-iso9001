/**
 * Migration 169 (VPS) — DROP wpqr_records.expiry_date (ISO 15614/15613/14555).
 * Destructive, idempotente. Nessun ON DELETE CASCADE. Nessun restart Node.
 * NON tocca qualifications.expiry_date (ISO 9606) né welding_procedures.expiry_date (WPS).
 *
 * Eseguire ON the VPS (credenziali da .env del backend, non dal cloud — porta 11043 chiusa):
 *   scp -P 1122 database/migrations/169_wpqr_drop_expiry_date.sql \
 *     database/migrations/169_verify.sql \
 *     spascarella@sistemi.fr-busato.it:/var/www/sgq-backend/database/migrations/
 *   scp -P 1122 backend/scripts/run-migration-169-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'node /tmp/run-migration-169-vps.js'
 *
 * Test DB: SGQ_MIGRATION_TARGET=test node /tmp/run-migration-169-vps.js
 * Solo pre-count/colonna: CHECK_ONLY=1 node /tmp/run-migration-169-vps.js
 */
const fs = require('fs');

const TARGET_RAW = String(process.env.SGQ_MIGRATION_TARGET || 'prod').toLowerCase();
const IS_TEST = TARGET_RAW === 'test';
const CHECK_ONLY =
  process.env.CHECK_ONLY === '1' ||
  process.env.CHECK_ONLY === 'true' ||
  process.env.SGQ_MIGRATION_CHECK_ONLY === '1';
const BACKEND_ROOT = IS_TEST ? '/var/www/sgq-backend-test' : '/var/www/sgq-backend';
const ENV_FILE = IS_TEST ? `${BACKEND_ROOT}/.env.test` : `${BACKEND_ROOT}/.env`;

require(`${BACKEND_ROOT}/node_modules/dotenv`).config({ path: ENV_FILE });
const { getPool } = require(`${BACKEND_ROOT}/src/config/database`);

const APPLY_CANDIDATES = [
  `${BACKEND_ROOT}/database/migrations/169_wpqr_drop_expiry_date.sql`,
  '/tmp/169_wpqr_drop_expiry_date.sql',
];
const VERIFY_CANDIDATES = [
  `${BACKEND_ROOT}/database/migrations/169_verify.sql`,
  '/tmp/169_verify.sql',
];

function splitGoBatches(sqlText) {
  const withoutBom = String(sqlText).replace(/^\uFEFF/, '');
  return withoutBom
    .split(/^\s*GO\s*$/gim)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function resolveSqlPath(candidates, label) {
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(`${label} non trovato. Copia in ${candidates.join(' oppure ')}`);
  }
  return found;
}

async function schemaSnapshot(pool) {
  const result = await pool.request().query(`
    SELECT
      OBJECT_ID(N'dbo.wpqr_records', N'U') AS wpqr_table_id,
      COL_LENGTH(N'dbo.wpqr_records', N'expiry_date') AS wpqr_expiry_len,
      COL_LENGTH(N'dbo.qualifications', N'expiry_date') AS qual_expiry_len,
      COL_LENGTH(N'dbo.welding_procedures', N'expiry_date') AS wps_expiry_len,
      CASE WHEN EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wpqr_records_expiry'
          AND object_id = OBJECT_ID(N'dbo.wpqr_records')
      ) THEN 1 ELSE 0 END AS ix_expiry_present
  `);
  return result.recordset[0] || {};
}

async function preDropCounts(pool, snap) {
  if (!snap.wpqr_table_id) {
    return { wpqr_totali: 0, wpqr_con_expiry: 0, table_present: false, col_present: false };
  }
  if (snap.wpqr_expiry_len == null) {
    const r = await pool.request().query(`SELECT COUNT(*) AS wpqr_totali FROM dbo.wpqr_records`);
    return {
      wpqr_totali: r.recordset[0].wpqr_totali,
      wpqr_con_expiry: null,
      table_present: true,
      col_present: false,
    };
  }
  const r = await pool.request().query(`
    SELECT
      COUNT(*) AS wpqr_totali,
      SUM(CASE WHEN expiry_date IS NOT NULL THEN 1 ELSE 0 END) AS wpqr_con_expiry
    FROM dbo.wpqr_records
  `);
  const row = r.recordset[0];
  return {
    wpqr_totali: row.wpqr_totali,
    wpqr_con_expiry: row.wpqr_con_expiry,
    table_present: true,
    col_present: true,
  };
}

function assertUntouchedExpiryColumns(snap, phase) {
  if (snap.qual_expiry_len == null) {
    throw new Error(`[169] SICUREZZA ${phase}: qualifications.expiry_date assente — abort.`);
  }
  if (snap.wps_expiry_len == null) {
    throw new Error(`[169] SICUREZZA ${phase}: welding_procedures.expiry_date assente — abort.`);
  }
}

async function runVerify(pool) {
  const verifyPath = resolveSqlPath(VERIFY_CANDIDATES, 'SQL 169_verify');
  const verifySql = fs.readFileSync(verifyPath, 'utf8');
  const batches = splitGoBatches(verifySql);
  let lastRow = null;
  for (const batch of batches) {
    const result = await pool.request().query(batch);
    if (result.recordset && result.recordset.length) {
      lastRow = result.recordset[0];
    }
  }
  return { verifyPath, row: lastRow };
}

async function run() {
  const pool = await getPool();
  try {
    console.log(`[169] target=${IS_TEST ? 'test' : 'prod'} checkOnly=${CHECK_ONLY ? 'yes' : 'no'}`);
    const beforeSnap = await schemaSnapshot(pool);
    assertUntouchedExpiryColumns(beforeSnap, 'pre');
    const pre = await preDropCounts(pool, beforeSnap);
    console.log(
      `[169] PRE-DROP wpqr_totali=${pre.wpqr_totali} wpqr_con_expiry=${pre.wpqr_con_expiry} ` +
        `col_present=${pre.col_present} ix_present=${beforeSnap.ix_expiry_present}`
    );

    if (!pre.col_present && Number(beforeSnap.ix_expiry_present) === 0) {
      const verifyAlready = await runVerify(pool);
      console.log('[169] Verify (già applicata):', JSON.stringify(verifyAlready.row));
      if (!verifyAlready.row || verifyAlready.row.esito !== 'PASS') {
        throw new Error('169_verify esito diverso da PASS');
      }
      console.log('[169] Migrazione non necessaria: colonna e indice già assenti.');
      process.exitCode = 0;
      return;
    }

    if (CHECK_ONLY) {
      console.log('[169] CHECK_ONLY: nessun DROP eseguito.');
      process.exitCode = 0;
      return;
    }

    const sqlPath = resolveSqlPath(APPLY_CANDIDATES, 'SQL 169');
    const batches = splitGoBatches(fs.readFileSync(sqlPath, 'utf8'));
    if (batches.length < 2) {
      throw new Error(`Attesi almeno 2 batch GO, trovati ${batches.length} in ${sqlPath}`);
    }
    console.log(`[169] SQL: ${sqlPath} — ${batches.length} batch`);
    for (let i = 0; i < batches.length; i++) {
      await pool.request().query(batches[i]);
      console.log(`[169] Batch ${i + 1}/${batches.length} OK`);
    }

    const afterSnap = await schemaSnapshot(pool);
    assertUntouchedExpiryColumns(afterSnap, 'post');
    const afterCount = await pool.request().query(`SELECT COUNT(*) AS wpqr_totali FROM dbo.wpqr_records`);
    const afterTotal = afterCount.recordset[0].wpqr_totali;
    console.log(`[169] POST-DROP wpqr_totali=${afterTotal} (pre=${pre.wpqr_totali})`);
    if (Number(afterTotal) !== Number(pre.wpqr_totali)) {
      throw new Error(`Conteggio righe cambiato: pre=${pre.wpqr_totali} post=${afterTotal}`);
    }
    if (afterSnap.wpqr_expiry_len != null) {
      throw new Error('COL_LENGTH(wpqr_records, expiry_date) ancora valorizzato dopo DROP');
    }

    const verify = await runVerify(pool);
    console.log('[169] Verify:', JSON.stringify(verify.row));
    if (!verify.row || verify.row.esito !== 'PASS') {
      throw new Error(`169_verify esito=${verify.row && verify.row.esito} (atteso PASS)`);
    }
    console.log('[169] Migration completata. verify esito=PASS. 9606/WPS expiry intatte.');
  } catch (e) {
    console.error('[169] ERRORE:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

run();
