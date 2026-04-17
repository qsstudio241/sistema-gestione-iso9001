/**
 * Test Connessione Database SQL Server
 * Verifica se il backend riesce a connettersi al database
 */

require('dotenv').config();
const sql = require('mssql');
const path = require('path');
const { resolveDbSection } = require(path.join(__dirname, 'scripts', 'mergeDbEnv'));

const env = process.env.NODE_ENV || 'development';
const base = resolveDbSection(env);

const config = {
  server: base.server,
  port: base.port || 1433,
  database: base.database,
  user: base.user,
  password: base.password,
  options: base.options || {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
};

async function testConnection() {
  console.log('============================================');
  console.log('TEST CONNESSIONE DATABASE SQL SERVER');
  console.log('============================================\n');

  console.log('Configurazione:');
  console.log(`  Server: ${config.server}:${config.port}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  User: ${config.user}\n`);

  console.log('Tentativo connessione...');

  try {
    const pool = await sql.connect(config);
    console.log('✅ CONNESSIONE RIUSCITA!\n');

    console.log('Esecuzione query di test...');
    const result = await pool.request().query(`
      SELECT 
        (SELECT COUNT(*) FROM audits) as total_audits,
        (SELECT COUNT(*) FROM checklist_questions WHERE standard_id = 1) as total_questions,
        (SELECT COUNT(*) FROM checklist_sections WHERE standard_id = 1) as total_sections
    `);

    console.log('✅ QUERY ESEGUITA CON SUCCESSO!\n');
    console.log('Risultati:');
    console.log(`  - Audit nel database: ${result.recordset[0].total_audits}`);
    console.log(`  - Domande ISO 9001: ${result.recordset[0].total_questions}`);
    console.log(`  - Sezioni ISO 9001: ${result.recordset[0].total_sections}\n`);

    await pool.close();
    console.log('✅ TEST COMPLETATO - Database funzionante!\n');
    console.log('============================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERRORE CONNESSIONE:\n');
    console.error('Messaggio:', err.message);
    console.error('Codice:', err.code);
    console.error('\nDettagli completi:');
    console.error(err);
    console.log('\n============================================');
    console.log('TROUBLESHOOTING:\n');
    console.log('1. Verifica backend/config/database.json (copia da database.json.example) o variabili DB_*');
    console.log('2. Verifica firewall del server SQL');
    console.log('3. Verifica che il database esista');
    console.log('============================================\n');
    process.exit(1);
  }
}

testConnection();
