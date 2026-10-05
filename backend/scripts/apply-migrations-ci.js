#!/usr/bin/env node
/**
 * Applica le migrazioni canoniche su un SQL Server vuoto (CI), poi seed anonimo e verify.
 *
 * Uso:
 *   DB_SERVER=localhost DB_USER=sa DB_PASSWORD=... DB_DATABASE=SGQ_ISO9001 \
 *     node backend/scripts/apply-migrations-ci.js
 *
 * Esce 1 se una migrazione o un verify fallisce. Non maschera l'errore.
 * Lo storico (< 169) è stato scritto su DB già esistente: su DB vuoto la 003
 * alza RAISERROR. In quel caso il job CI è non-required (vedi ci-migrations.yml).
 */
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const {
  MIGRATIONS_DIR,
  HEADER_FROM_NUMBER,
  isCompanionSql,
  listMainMigrationSql,
  listSqlFilenames,
  numericPrefix,
  splitSqlBatches,
  collectVerifyFailures,
} = require('./migrationContract');

const SEED_PATH = path.resolve(MIGRATIONS_DIR, 'ci/seed_anonymous.sql');

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

async function applyAll(pool) {
  const files = listMainMigrationSql(MIGRATIONS_DIR);
  console.log(`[ci-mig] ${files.length} migrazioni principali da applicare`);
  for (const filename of files) {
    const full = path.join(MIGRATIONS_DIR, filename);
    const n = numericPrefix(filename);
    console.log(`[ci-mig] APPLY ${filename}`);
    try {
      await runBatches(pool, fs.readFileSync(full, 'utf8'), filename);
    } catch (err) {
      const hint =
        Number.isFinite(n) && n < HEADER_FROM_NUMBER
          ? ` [storico < ${HEADER_FROM_NUMBER}: manca baseline schema su DB vuoto — vedi docs/reference/DATABASE.md § Apply-on-empty]`
          : '';
      console.error(`[ci-mig] FAIL ${filename}: ${err.message}${hint}`);
      throw err;
    }
    console.log(`[ci-mig] OK   ${filename}`);
  }
}

async function applySeed(pool) {
  if (!fs.existsSync(SEED_PATH)) {
    throw new Error(`Seed anonimo mancante: ${SEED_PATH}`);
  }
  console.log('[ci-mig] SEED database/migrations/ci/seed_anonymous.sql');
  await runBatches(pool, fs.readFileSync(SEED_PATH, 'utf8'), 'seed');
  console.log('[ci-mig] OK   seed anonimo');
}

async function runVerifyFiles(pool) {
  const companions = listSqlFilenames(MIGRATIONS_DIR)
    .filter((f) => isCompanionSql(f) && /_verify\.sql$/i.test(f))
    .sort((a, b) => numericPrefix(a) - numericPrefix(b) || a.localeCompare(b));

  if (companions.length === 0) {
    console.log('[ci-mig] VERIFY: nessun NNN_verify.sql (ok finché non esiste una transform >= 169)');
    return;
  }

  let failed = 0;
  for (const filename of companions) {
    const full = path.join(MIGRATIONS_DIR, filename);
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
    await applyAll(pool);
    await applySeed(pool);
    await runVerifyFiles(pool);
    console.log('[ci-mig] COMPLETATO');
  } finally {
    await pool.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[ci-mig] ESITO: FALLITO');
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
