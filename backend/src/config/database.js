/**
 * Database Connection Pool - SQL Server
 * Sistema Gestione ISO 9001
 */

const sql = require('mssql');
const logger = require('../utils/logger');
const path = require('path');
const { mergeDbEnvFromProcessEnv, loadDatabaseJsonConfigs } = require(path.join(
  __dirname,
  '..',
  '..',
  'scripts',
  'mergeDbEnv.js',
));

let dbConfig;

try {
  const configs = loadDatabaseJsonConfigs();

  // Seleziona ambiente (development, production, test)
  const environment = process.env.NODE_ENV || 'development';
  dbConfig = configs[environment];

  if (!dbConfig) {
    throw new Error(`Configurazione per ambiente "${environment}" non trovata`);
  }

  // Override da DB_* (qualsiasi ambiente): preferito su VPS/CI per non mettere secret nel file.
  dbConfig = mergeDbEnvFromProcessEnv(dbConfig);

  logger.info(`📋 Configurazione database caricata per ambiente: ${environment}`);
} catch (error) {
  logger.error(`❌ Errore caricamento configurazione database: ${error.message}`);
  process.exit(1);
}

// Configurazione finale per mssql
const config = {
  server: dbConfig.server,
  port: dbConfig.port || 1433,
  database: dbConfig.database,
  user: dbConfig.user,
  password: dbConfig.password,
  options: dbConfig.options || {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    connectTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: dbConfig.pool || {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;

/**
 * Ottieni connection pool (singleton)
 */
async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(config);
      logger.info('✅ SQL Server connection pool established');

      // Handle pool errors
      pool.on('error', (err) => {
        logger.error('SQL Pool Error:', err);
        pool = null;
      });
    } catch (err) {
      logger.error('❌ Failed to connect to SQL Server:', err);
      throw err;
    }
  }
  return pool;
}

/**
 * Esegui query con gestione errori
 */
async function query(queryText, params = {}) {
  try {
    const pool = await getPool();
    const request = pool.request();

    // Bind parameters
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });

    const result = await request.query(queryText);
    return result;
  } catch (err) {
    logger.error('Database query error:', { query: queryText, error: err.message });
    throw err;
  }
}

/**
 * Esegui stored procedure
 */
async function execute(procedureName, params = {}) {
  try {
    const pool = await getPool();
    const request = pool.request();

    // Bind parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value.isOutput) {
        request.output(key, value.type);
      } else {
        request.input(key, value);
      }
    });

    const result = await request.execute(procedureName);
    return result;
  } catch (err) {
    logger.error('Stored procedure error:', { procedure: procedureName, error: err.message });
    throw err;
  }
}

/**
 * Chiudi connection pool
 */
async function closePool() {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      logger.info('SQL Server connection pool closed');
    } catch (err) {
      logger.error('Error closing SQL pool:', err);
    }
  }
}

/**
 * Health check database
 */
async function healthCheck() {
  try {
    const pool = await getPool();
    await pool.request().query('SELECT 1 AS health');
    return { healthy: true, message: 'Database connection OK' };
  } catch (err) {
    return { healthy: false, message: err.message };
  }
}

module.exports = {
  sql,
  getPool,
  query,
  execute,
  closePool,
  healthCheck,
};
