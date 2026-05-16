/**
 * Esegue la migrazione 064 sul VPS.
 * Legge database.json dal backend e forza server=localhost.
 */
const sql = require('/var/www/sgq-backend/node_modules/mssql');
const fs = require('fs');

const dbJson = JSON.parse(
  fs.readFileSync('/var/www/sgq-backend/config/database.json', 'utf8')
);
const env = dbJson.production || dbJson.development;

const config = {
  server: 'localhost',
  port: env.port || 11043,
  database: env.database,
  user: env.user,
  password: env.password,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function run() {
  let pool;
  try {
    console.log(`Connecting to ${config.server}:${config.port}/${config.database}...`);
    pool = await sql.connect(config);
    const sqlContent = fs.readFileSync('/tmp/064_ai_usage_log.sql', 'utf8');
    await pool.request().query(sqlContent);
    console.log('Migration 064 completata con successo');
  } catch (err) {
    console.error('ERRORE migrazione 064:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
    process.exit(0);
  }
}

run();
