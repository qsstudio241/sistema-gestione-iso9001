/**
 * Merge credenziali DB: file locale `config/database.json` + override variabili d'ambiente DB_*.
 * Stesse regole usate da `src/config/database.js` (mantenere allineate).
 */

const fs = require('fs');
const path = require('path');

function mergeDbEnvFromProcessEnv(dbConfig) {
  if (!dbConfig) return dbConfig;
  const merged = { ...dbConfig };
  if (process.env.DB_SERVER) merged.server = process.env.DB_SERVER;
  if (process.env.DB_PORT) merged.port = parseInt(process.env.DB_PORT, 10);
  if (process.env.DB_DATABASE) merged.database = process.env.DB_DATABASE;
  if (process.env.DB_USER) merged.user = process.env.DB_USER;
  if (process.env.DB_PASSWORD) merged.password = process.env.DB_PASSWORD;
  return merged;
}

function loadDatabaseJsonConfigs() {
  const configPath = path.join(__dirname, '..', 'config', 'database.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(
      'Manca backend/config/database.json. Copia backend/config/database.json.example in database.json ' +
        'e compila host/utente/password, oppure imposta DB_SERVER, DB_PORT, DB_DATABASE, DB_USER, DB_PASSWORD.'
    );
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

/**
 * @param {string} envName es. 'development' | 'production' | 'test'
 */
function resolveDbSection(envName) {
  const configs = loadDatabaseJsonConfigs();
  const section = configs[envName] || configs.development;
  if (!section) {
    throw new Error(`Ambiente "${envName}" non definito in database.json`);
  }
  return mergeDbEnvFromProcessEnv(section);
}

module.exports = {
  mergeDbEnvFromProcessEnv,
  loadDatabaseJsonConfigs,
  resolveDbSection,
};
