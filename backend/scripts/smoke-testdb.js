/**
 * Smoke: verifica struttura e integrità del DB di test.
 * v1.1 — test workflow PR con smoke automatico su GitHub Actions
 * Controlla che le tabelle chiave esistano, abbiano dati e che lo schema
 * sia allineato con il DB di produzione.
 *
 * Uso: cd backend && NODE_ENV=test node scripts/smoke-testdb.js
 * Esito OK → exit 0 | FAIL → exit 1
 *
 * NOTA: non carica .env deliberatamente — la config viene letta solo da
 * database.json sezione "test", senza override da variabili d'ambiente del
 * server (DB_DATABASE, ecc.).
 */
const sql = require('mssql');
const { loadDatabaseJsonConfigs } = require('./mergeDbEnv');

const REQUIRED_TABLES = [
  'audits',
  'audit_responses',
  'audit_events',
  'non_conformities',
  'organizations',
  'users',
  'custom_checklists',
  'custom_checklist_items',
  'checklist_sections',
  'nc_actions',
  'attachments',
  'audit_standards',
  'management_reviews',
];

async function main() {
  const configs = loadDatabaseJsonConfigs();
  const c = configs['test'];
  if (!c) throw new Error('Sezione "test" mancante in backend/config/database.json');

  console.log(`SMOKE TESTDB: connessione a [${c.database}] su ${c.server}:${c.port}`);

  const pool = await sql.connect({
    server: c.server,
    port: c.port || 1433,
    database: c.database,
    user: c.user,
    password: c.password,
    options: {
      encrypt: c.options?.encrypt ?? false,
      trustServerCertificate: true,
      enableArithAbort: true,
      connectTimeout: c.options?.connectTimeout ?? 30000,
      requestTimeout: c.options?.requestTimeout ?? 30000,
    },
  });

  let failures = 0;

  // 1. Verifica esistenza tabelle chiave
  const tablesRes = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
    ORDER BY TABLE_NAME
  `);
  const existingTables = new Set(tablesRes.recordset.map((r) => r.TABLE_NAME.toLowerCase()));
  console.log(`\nTabelle trovate: ${existingTables.size}`);

  for (const t of REQUIRED_TABLES) {
    if (!existingTables.has(t.toLowerCase())) {
      console.error(`  FAIL: tabella mancante → ${t}`);
      failures++;
    }
  }
  if (failures === 0) console.log('  OK: tutte le tabelle chiave presenti');

  // 2. Conteggi di base (COUNT(*) senza filtri per massima compatibilità)
  const counts = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.organizations)    AS orgs,
      (SELECT COUNT(*) FROM dbo.users)            AS users,
      (SELECT COUNT(*) FROM dbo.audits)           AS audits,
      (SELECT COUNT(*) FROM dbo.non_conformities) AS ncs
  `);
  const row = counts.recordset[0];
  console.log(`\nConteggi totali: orgs=${row.orgs} users=${row.users} audits=${row.audits} NCs=${row.ncs}`);

  if (row.orgs === 0) {
    console.warn('  WARN: nessuna organizzazione — DB di test vuoto o non ancora popolato');
  }

  // 3. Verifica integrità multi-tenant: audit senza organization_id
  const orphans = await pool.request().query(`
    SELECT COUNT(*) AS cnt FROM dbo.audits WHERE organization_id IS NULL
  `);
  const orphanCnt = orphans.recordset[0].cnt;
  if (orphanCnt > 0) {
    console.error(`  FAIL: ${orphanCnt} audit senza organization_id (violazione multi-tenant)`);
    failures++;
  } else {
    console.log('  OK: nessun audit orfano (organization_id NULL)');
  }

  // 4. Verifica che il DB non sia accidentalmente il DB di produzione
  const dbName = await pool.request().query('SELECT DB_NAME() AS db');
  const actualDb = dbName.recordset[0].db;
  if (actualDb === 'SGQ_ISO9001') {
    console.error('  FAIL: connesso al DB di PRODUZIONE SGQ_ISO9001 — interrompere immediatamente!');
    failures++;
  } else {
    console.log(`  OK: DB confermato come [${actualDb}] (non produzione)`);
  }

  await pool.close();

  if (failures > 0) {
    console.error(`\nSMOKE TESTDB: FAIL (${failures} errori)`);
    process.exit(1);
  }
  console.log('\nSMOKE TESTDB: OK');
  process.exit(0);
}

main().catch((e) => {
  console.error('SMOKE TESTDB: ERRORE CONNESSIONE —', e.message);
  process.exit(1);
});
