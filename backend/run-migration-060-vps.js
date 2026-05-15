const sql = require('/var/www/sgq-backend/node_modules/mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '11043'),
  database: process.env.DB_DATABASE || 'SGQ_ISO9001',
  user: process.env.DB_USER || 'pascarella',
  password: process.env.DB_PASSWORD || '#Gestione2025@',
  options: {
    encrypt: (process.env.DB_ENCRYPT || 'true') === 'true',
    trustServerCertificate: (process.env.DB_TRUST_SERVER_CERTIFICATE || 'true') === 'true'
  }
};

async function run() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('Connesso al DB');

    const sqlFile = fs.readFileSync(
      path.join('/var/www/sgq-backend/database/migrations/060_norm_document_sources.sql'),
      'utf8'
    );

    const batches = sqlFile.split(/\nGO\b/i).map(b => b.trim()).filter(b => b.length > 0);

    for (let i = 0; i < batches.length; i++) {
      console.log(`Esecuzione batch ${i + 1}/${batches.length}...`);
      await pool.request().query(batches[i]);
      console.log(`Batch ${i + 1} OK`);
    }

    console.log('Migrazione 060 completata con successo!');
  } catch (err) {
    console.error('ERRORE migrazione:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

run();
