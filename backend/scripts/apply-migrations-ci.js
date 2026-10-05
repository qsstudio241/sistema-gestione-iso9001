#!/usr/bin/env node
/**
 * Applica le migrazioni canoniche su un SQL Server vuoto (CI), poi seed anonimo e verify.
 *
 * Uso:
 *   DB_SERVER=localhost DB_USER=sa DB_PASSWORD=... DB_DATABASE=SGQ_ISO9001 \
 *     node backend/scripts/apply-migrations-ci.js
 *   SGQ_MIGRATIONS_DIR=/tmp/fixture  (solo test L1: cartella al posto di database/migrations/)
 *
 * Apply-on-empty (scelta A, issue #699): salta lo storico < 169 (nessuna baseline).
 * Applica + seed + verify solo da 169 in poi. Senza 169+: skip anche seed/verify, esce 0.
 * Esce 1 solo se una 169+, il seed o il verify fallisce (regressione reale).
 */
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const {
  HEADER_FROM_NUMBER,
  listSqlFilenames,
  resolveMigrationsDir,
  selectForEmptyDbApply,
  planEmptyDbApply,
  splitSqlBatches,
  collectVerifyFailures,
} = require('./migrationContract');

function seedPathFor(dir) {
  return path.resolve(dir, 'ci/seed_anonymous.sql');
}

function envConfig() {
  const database = process.env.DB_DATABASE || 'SGQ_ISO9001';
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error(`DB_DATABASE non valido: ${database}`);
  }
  const password = process.env.DB_PASSWORD;
  if (!password) {
    throw new Error('DB_PASSWORD mancante (nessuna password in repository).');
  }
  return {
    user: process.env.DB_USER || 'sa',
    password,
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database,
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    requestTimeout: 120000,
    connectionTimeout: 30000,
  };
}

async function ensureDatabase(config) {
  const masterCfg = { ...config, database: 'master' };
  const pool = await sql.connect(masterCfg);
  try {
    await pool.request().query(`
      IF DB_ID(N'${config.database}') IS NULL
      BEGIN
        CREATE DATABASE [${config.database}];
      END
    `);
    console.log(`[ci-mig] database ${config.database} pronto`);
  } finally {
    await pool.close();
  }
}

async function runBatches(pool, sqlText, label) {
  const batches = splitSqlBatches(sqlText);
  if (batches.length === 0) {
    console.log(`[ci-mig] ${label}: nessun batch (file vuoto)`);
    return [];
  }
  const allSets = [];
  for (let i = 0; i < batches.length; i++) {
    const result = await pool.request().query(batches[i]);
    if (result.recordsets && result.recordsets.length) {
      allSets.push(...result.recordsets);
    }
  }
  return allSets;
}

function writeGithubSummary({ skipped, apply, verifies, outcome }) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  const lines = [
    `## Apply-on-empty (da ${HEADER_FROM_NUMBER})`,
    '',
    `Storico < ${HEADER_FROM_NUMBER} saltato: **${skipped.length}** file (gap noto, nessuna baseline).`,
    `Apply >= ${HEADER_FROM_NUMBER}: **${apply.length}** file.`,
    `Verify >= ${HEADER_FROM_NUMBER}: **${verifies.length}** file.`,
    `Esito: **${outcome}**`,
    '',
    apply.length === 0
      ? `Nessuna migrazione >= ${HEADER_FROM_NUMBER}: skip apply/seed/verify. Job verde (solo gap pre-169).`
      : `Rosso solo se una ${HEADER_FROM_NUMBER}+, il seed o il verify fallisce.`,
    '',
    'Issue [#699](https://github.com/qsstudio241/sistema-gestione-iso9001/issues/699).',
    '',
  ];
  try {
    fs.appendFileSync(file, `${lines.join('\n')}\n`);
  } catch (err) {
    console.warn('[ci-mig] GITHUB_STEP_SUMMARY non scritto:', err.message);
  }
}

async function applySelected(pool, files, migrationsDir) {
  for (const filename of files) {
    const full = path.join(migrationsDir, filename);
    console.log(`[ci-mig] APPLY ${filename}`);
    try {
      await runBatches(pool, fs.readFileSync(full, 'utf8'), filename);
    } catch (err) {
      console.error(`[ci-mig] FAIL ${filename}: ${err.message}`);
      throw err;
    }
    console.log(`[ci-mig] OK   ${filename}`);
  }
}

async function applySeed(pool, seedPath) {
  if (!fs.existsSync(seedPath)) {
    throw new Error(`Seed anonimo mancante: ${seedPath}`);
  }
  console.log('[ci-mig] SEED database/migrations/ci/seed_anonymous.sql');
  await runBatches(pool, fs.readFileSync(seedPath, 'utf8'), 'seed');
  console.log('[ci-mig] OK   seed anonimo');
}

async function runVerifyFiles(pool, companions, migrationsDir) {
  if (companions.length === 0) {
    console.log(`[ci-mig] VERIFY: nessun NNN_verify.sql >= ${HEADER_FROM_NUMBER} (ok)`);
    return;
  }

  let failed = 0;
  for (const filename of companions) {
    const full = path.join(migrationsDir, filename);
    console.log(`[ci-mig] VERIFY ${filename}`);
    const recordsets = await runBatches(pool, fs.readFileSync(full, 'utf8'), filename);
    for (const rs of recordsets) {
      for (const row of rs) {
        console.log(`[ci-mig]   ${JSON.stringify(row)}`);
      }
    }
    const failures = collectVerifyFailures(recordsets);
    if (failures.length) {
      failed += 1;
      console.error(`[ci-mig] FAIL ${filename}: esito FAIL`);
    } else {
      console.log(`[ci-mig] OK   ${filename}`);
    }
  }
  if (failed) {
    throw new Error(`${failed} file verify con esito FAIL`);
  }
}

async function main() {
  const migrationsDir = resolveMigrationsDir();
  const selection = selectForEmptyDbApply(listSqlFilenames(migrationsDir));
  console.log(
    `[ci-mig] skip storico < ${selection.fromNumber}: ${selection.skipped.length} file (gap noto, issue #699)`
  );
  if (selection.skipped.length) {
    const preview = selection.skipped.slice(0, 5).join(', ');
    const extra =
      selection.skipped.length > 5 ? `, … (+${selection.skipped.length - 5})` : '';
    console.log(`[ci-mig]   esempi saltati: ${preview}${extra}`);
  }
  console.log(
    `[ci-mig] apply >= ${selection.fromNumber}: ${selection.apply.length} file`
  );

  const plan = planEmptyDbApply(selection);
  if (!plan.apply) {
    console.log(
      `[ci-mig] nessuna migrazione >= ${selection.fromNumber}: skip apply, seed e verify (verde, solo gap pre-169, niente regressione 169+)`
    );
    writeGithubSummary({ ...selection, outcome: 'VERDE (solo gap pre-169)' });
    console.log('[ci-mig] COMPLETATO');
    return;
  }

  const config = envConfig();
  console.log('[ci-mig] target', {
    server: config.server,
    port: config.port,
    database: config.database,
    user: config.user,
  });

  await ensureDatabase(config);
  const pool = await sql.connect(config);
  try {
    await applySelected(pool, selection.apply, migrationsDir);
    if (plan.seed) {
      await applySeed(pool, seedPathFor(migrationsDir));
    }
    if (plan.verify) {
      await runVerifyFiles(pool, selection.verifies, migrationsDir);
    }
    console.log('[ci-mig] COMPLETATO');
    writeGithubSummary({ ...selection, outcome: 'VERDE' });
  } finally {
    await pool.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[ci-mig] ESITO: FALLITO');
  console.error(err && err.message ? err.message : err);
  try {
    const selection = selectForEmptyDbApply(listSqlFilenames(resolveMigrationsDir()));
    writeGithubSummary({ ...selection, outcome: 'ROSSO (regressione 169+)' });
  } catch (_) {
    /* summary best-effort */
  }
  process.exit(1);
});
