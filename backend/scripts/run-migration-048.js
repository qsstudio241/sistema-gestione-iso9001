/**
 * run-migration-048.js
 * Applica migration 048: temporal table su audit_custom_checklist_responses
 * Uso: node scripts/run-migration-048.js
 * Richiede .env con credenziali DB oppure variabili d'ambiente:
 *   DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD
 */
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const cfgs = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'config', 'database.json'), 'utf8')
);

let c = cfgs.production;
if (process.env.DB_SERVER) {
  c = {
    ...c,
    server:   process.env.DB_SERVER,
    port:     parseInt(process.env.DB_PORT   || c.port, 10),
    database: process.env.DB_DATABASE || c.database,
    user:     process.env.DB_USER     || c.user,
    password: process.env.DB_PASSWORD || c.password,
  };
}

const sql     = require('mssql');
const sqlFile = path.join(
  __dirname, '..', '..', 'database', 'migrations',
  '048_temporal_tables_custom_checklist_responses.sql'
);
const sqlText = fs.readFileSync(sqlFile, 'utf8');

sql.connect({
  server:   c.server,
  port:     c.port || 1433,
  database: c.database,
  user:     c.user,
  password: c.password,
  options:  { trustServerCertificate: true, encrypt: true },
}).then(async (pool) => {
  console.log('Connesso al DB. Esecuzione migration 048...\n');

  // Esegui statement separati da GO (ignorare righe GO isolate)
  const statements = sqlText
    .split(/\r?\nGO\s*(?:\r?\n|$)/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await pool.request().query(stmt);
  }

  console.log('\n=== Migration 048 completata con successo ===');
  await pool.close();
}).catch((err) => {
  console.error('Errore migration 048:', err.message);
  process.exit(1);
});
