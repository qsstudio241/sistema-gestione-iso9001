/**
 * Migration 066: organizations.ai_context_notes
 * Eseguire: cd backend && node scripts/run-migration-066.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { resolveDbSection } = require('./mergeDbEnv');
const sql = require('mssql');

const env = process.env.NODE_ENV || 'development';
const c = resolveDbSection(env);

const config = {
  server: c.server,
  port: c.port || 1433,
  database: c.database,
  user: c.user,
  password: c.password,
  options: c.options || { trustServerCertificate: true, encrypt: true },
};

const SQL_066 = fs.readFileSync(
  path.join(__dirname, '../database/migrations/066_organization_ai_context_notes.sql'),
  'utf8'
);

async function main() {
  console.log(`[066] Connessione a ${config.server}:${config.port}/${config.database}...`);
  const pool = await sql.connect(config);
  try {
    await pool.request().query(SQL_066);
    console.log('[066] OK — colonna ai_context_notes su organizations');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[066] ERRORE:', err.message);
  process.exit(1);
});
