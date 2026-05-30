/**
 * Migration 067: knowledge_chunks.standard_id
 * Eseguire: cd backend && node scripts/run-migration-067.js
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

const SQL_067 = fs.readFileSync(
  path.join(__dirname, '../database/migrations/067_knowledge_chunks_standard_id.sql'),
  'utf8'
);

async function main() {
  console.log(`[067] Connessione a ${config.server}:${config.port}/${config.database}...`);
  const pool = await sql.connect(config);
  try {
    await pool.request().query(SQL_067);
    console.log('[067] OK — colonna standard_id su knowledge_chunks');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[067] ERRORE:', err.message);
  process.exit(1);
});
