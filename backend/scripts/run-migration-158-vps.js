/**
 * Migration 158 (VPS) — thickness_t1_min/max e thickness_t2_min/max su wpqr_records
 * (WPQR-T1T2, Mason 25/08/2026).
 * Variabili: SGQ_MIGRATION_TARGET=test|prod (OBBLIGATORIA, nessun default: se manca o è diversa → exit 1
 *   prima di ogni connessione); CHECK_ONLY=1 = dry-run (solo INFORMATION_SCHEMA, nessun DDL, exit 0).
 * Uso (solo su VPS, via SSH; file copiato da solo in /tmp, quindi senza helper condivisi):
 *   Verifica test: SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node /tmp/run-migration-158-vps.js
 *   Apply test:    SGQ_MIGRATION_TARGET=test node /tmp/run-migration-158-vps.js
 *   Apply prod:    SGQ_MIGRATION_TARGET=prod node /tmp/run-migration-158-vps.js  (solo dopo OK esplicito)
 */
const PROD_BACKEND_ROOT = '/var/www/sgq-backend';
const TEST_BACKEND_ROOT = '/var/www/sgq-backend-test';
const DB_NAME_BY_TARGET = { prod: 'SGQ_ISO9001', test: '2026-06-18_SGQ_ISO9001' };

const TABLE = 'wpqr_records';
const COLUMNS = [
    { name: 'thickness_t1_min', ddl: 'ALTER TABLE wpqr_records ADD thickness_t1_min DECIMAL(8,2)' },
    { name: 'thickness_t1_max', ddl: 'ALTER TABLE wpqr_records ADD thickness_t1_max DECIMAL(8,2)' },
    {
        name: 'thickness_t1_max_unlimited',
        ddl: 'ALTER TABLE wpqr_records ADD thickness_t1_max_unlimited BIT NOT NULL CONSTRAINT DF_wpqr_records_thickness_t1_max_unlimited DEFAULT 0',
    },
    { name: 'thickness_t2_min', ddl: 'ALTER TABLE wpqr_records ADD thickness_t2_min DECIMAL(8,2)' },
    { name: 'thickness_t2_max', ddl: 'ALTER TABLE wpqr_records ADD thickness_t2_max DECIMAL(8,2)' },
    {
        name: 'thickness_t2_max_unlimited',
        ddl: 'ALTER TABLE wpqr_records ADD thickness_t2_max_unlimited BIT NOT NULL CONSTRAINT DF_wpqr_records_thickness_t2_max_unlimited DEFAULT 0',
    },
];

function resolveTarget(env = process.env) {
    const raw = env.SGQ_MIGRATION_TARGET;
    if (raw !== 'test' && raw !== 'prod') {
        throw new Error(
            `SGQ_MIGRATION_TARGET obbligatoria, valori ammessi esattamente "test" o "prod" (ricevuto: ${
                raw === undefined ? '<non impostata>' : JSON.stringify(raw)
            }). Nessun default.`
        );
    }
    const backendRoot = raw === 'test' ? TEST_BACKEND_ROOT : PROD_BACKEND_ROOT;
    return {
        target: raw,
        backendRoot,
        envFile: raw === 'test' ? `${backendRoot}/.env.test` : `${backendRoot}/.env`,
        checkOnly:
            env.CHECK_ONLY === '1' || env.CHECK_ONLY === 'true' || env.SGQ_MIGRATION_CHECK_ONLY === '1',
    };
}

function assertDbMatchesTarget(target, dbName) {
    const expected = DB_NAME_BY_TARGET[target];
    const name = String(dbName || '').trim();
    if (!expected || name !== expected) {
        throw new Error(
            `Mismatch: target=${target} richiede il database "${expected}" ma la connessione punta a "${name || '<sconosciuto>'}" — abort.`
        );
    }
}

async function columnExists(pool, table, column) {
    const check = await pool.request().query(`
        SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
    `);
    return check.recordset.length > 0;
}

async function findMissingColumns(pool) {
    const missing = [];
    for (const col of COLUMNS) {
        if (!(await columnExists(pool, TABLE, col.name))) missing.push(col);
    }
    return missing;
}

async function ensureColumn(pool, table, column, ddl) {
    if (!(await columnExists(pool, table, column))) {
        await pool.request().query(ddl);
        console.log(`[158] Colonna ${column} aggiunta`);
    } else {
        console.log(`[158] Colonna ${column} gia esistente — skip`);
    }
}

function defaultLoadBackend(backendRoot, envFile) {
    require(`${backendRoot}/node_modules/dotenv`).config({ path: envFile });
    return require(`${backendRoot}/src/config/database`);
}

async function run({ env = process.env, loadBackend = defaultLoadBackend } = {}) {
    let cfg;
    try {
        cfg = resolveTarget(env);
    } catch (e) {
        console.error('[158] ERRORE:', e.message);
        return 1;
    }

    console.log(`[158] target=${cfg.target} env=${cfg.envFile} checkOnly=${cfg.checkOnly ? 'yes' : 'no'}`);
    let pool;
    let exitCode = 0;
    try {
        const { getPool } = loadBackend(cfg.backendRoot, cfg.envFile);
        pool = await getPool();

        const dbRow = await pool.request().query('SELECT DB_NAME() AS db_name');
        const dbName = dbRow.recordset[0] && dbRow.recordset[0].db_name;
        assertDbMatchesTarget(cfg.target, dbName);
        console.log(`[158] database=${dbName}`);

        if (cfg.checkOnly) {
            const missing = await findMissingColumns(pool);
            if (missing.length === 0) {
                console.log('[158] CHECK_ONLY: nessuna colonna mancante, migrazione non necessaria.');
            } else {
                console.log(`[158] CHECK_ONLY: mancano ${missing.length} colonne su ${TABLE}:`);
                missing.forEach((c) => console.log(`[158]   - ${c.name}`));
            }
            console.log('[158] CHECK_ONLY: nessun DDL eseguito.');
            return 0;
        }

        for (const col of COLUMNS) {
            await ensureColumn(pool, TABLE, col.name, col.ddl);
        }

        const verify = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'wpqr_records'
              AND COLUMN_NAME IN (
                'thickness_t1_min', 'thickness_t1_max', 'thickness_t1_max_unlimited',
                'thickness_t2_min', 'thickness_t2_max', 'thickness_t2_max_unlimited'
              )
            ORDER BY COLUMN_NAME
        `);
        console.log('[158] Verifica:', JSON.stringify(verify.recordset, null, 2));
        console.log('[158] Migration completata.');
    } catch (e) {
        console.error('[158] ERRORE:', e.message);
        exitCode = 1;
    } finally {
        if (pool) await pool.close().catch(() => {});
    }
    return exitCode;
}

module.exports = { resolveTarget, assertDbMatchesTarget, findMissingColumns, run, COLUMNS };

if (require.main === module) {
    run().then((code) => process.exit(code));
}
