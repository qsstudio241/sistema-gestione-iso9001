/**
 * Migration 184 (VPS) — range passate di validità su wpqr_test_runs.
 * Additiva. Nessun UPDATE delle righe. Solo TEST. PROD rifiutato.
 *
 *   scp -P 1122 database/migrations/184_wpqr_run_ranges.sql \
 *     database/migrations/184_verify.sql \
 *     backend/scripts/run-migration-184-vps.js spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node /tmp/run-migration-184-vps.js'
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test node /tmp/run-migration-184-vps.js'
 */

const fs = require('fs');

const TEST_BACKEND_ROOT = '/var/www/sgq-backend-test';
const TEST_DB = '2026-06-18_SGQ_ISO9001';
const SQL_FILE = '184_wpqr_run_ranges.sql';
const TAG = '[184]';
const RANGE_COLUMNS = [
    'current_a_min', 'current_a_max',
    'voltage_v_min', 'voltage_v_max',
    'travel_speed_min', 'travel_speed_max',
    'heat_input_value_min', 'heat_input_value_max',
];

function resolveTarget(env = process.env) {
    const raw = env.SGQ_MIGRATION_TARGET;
    if (raw !== 'test') {
        throw new Error(
            `SGQ_MIGRATION_TARGET deve essere esattamente "test" (ricevuto: ${
                raw === undefined ? '<non impostata>' : JSON.stringify(raw)
            }). Produzione rifiutata.`
        );
    }
    return {
        target: 'test',
        backendRoot: TEST_BACKEND_ROOT,
        envFile: `${TEST_BACKEND_ROOT}/.env.test`,
        expectedDb: TEST_DB,
        checkOnly: env.CHECK_ONLY === '1' || env.CHECK_ONLY === 'true',
    };
}

function splitGoBatches(sqlText) {
    return String(sqlText)
        .replace(/^\uFEFF/, '')
        .split(/^\s*GO\s*$/gim)
        .map((chunk) => chunk.trim())
        .filter(Boolean);
}

function stripSqlComments(sqlText) {
    return String(sqlText).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

function batchesWithUse(batches) {
    return batches.filter((b) => /(^|[\s;])USE\s+[\[\w"]/i.test(stripSqlComments(b)));
}

function candidatePaths(backendRoot, file) {
    return [`${backendRoot}/database/migrations/${file}`, `/tmp/${file}`];
}

function readSql(fsImpl, backendRoot, file) {
    const found = candidatePaths(backendRoot, file).find((p) => fsImpl.existsSync(p));
    if (!found) throw new Error(`${file} non trovato`);
    return { path: found, text: fsImpl.readFileSync(found, 'utf8') };
}

async function schemaState(pool) {
    const col = await pool.request().query(`
        SELECT c.name AS name
        FROM sys.columns c
        WHERE c.object_id = OBJECT_ID(N'dbo.wpqr_test_runs')
          AND c.name IN (${RANGE_COLUMNS.map((n) => `N'${n}'`).join(', ')})
    `);
    const names = new Set((col.recordset || []).map((r) => r.name));
    return {
        present: RANGE_COLUMNS.filter((n) => names.has(n)),
        missing: RANGE_COLUMNS.filter((n) => !names.has(n)),
        complete: names.size === RANGE_COLUMNS.length,
    };
}

function defaultLoadBackend(backendRoot, envFile) {
    require(`${backendRoot}/node_modules/dotenv`).config({ path: envFile });
    return require(`${backendRoot}/src/config/database`);
}

async function run({ env = process.env, loadBackend = defaultLoadBackend, fsImpl = fs } = {}) {
    let cfg;
    try {
        cfg = resolveTarget(env);
    } catch (e) {
        console.error(TAG, 'ERRORE:', e.message);
        return 1;
    }

    console.log(`${TAG} target=test env=${cfg.envFile} checkOnly=${cfg.checkOnly ? 'yes' : 'no'}`);
    let pool;
    let exitCode = 0;
    try {
        const { getPool } = loadBackend(cfg.backendRoot, cfg.envFile);
        pool = await getPool();
        const dbRow = await pool.request().query('SELECT DB_NAME() AS db_name');
        const dbName = dbRow.recordset[0] && dbRow.recordset[0].db_name;
        if (String(dbName || '').trim() !== TEST_DB) {
            throw new Error(`database "${dbName || ''}" diverso da ${TEST_DB} — abort senza DDL`);
        }
        const beforeCount = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.wpqr_test_runs');
        const nBefore = Number(beforeCount.recordset[0].n);
        const before = await schemaState(pool);
        if (cfg.checkOnly) {
            console.log(`${TAG} CHECK_ONLY: complete=${before.complete} mancano=${before.missing.join(',') || '(none)'} righe=${nBefore}`);
            return 0;
        }
        const { path: sqlPath, text } = readSql(fsImpl, cfg.backendRoot, SQL_FILE);
        const batches = splitGoBatches(text);
        if (batchesWithUse(batches).length > 0) throw new Error('istruzione USE vietata — nessun batch eseguito');
        if (/\b(UPDATE|DELETE|INSERT|MERGE)\b/i.test(stripSqlComments(text))) {
            throw new Error('SQL non additivo — nessun batch eseguito');
        }
        for (let i = 0; i < batches.length; i += 1) {
            await pool.request().query(batches[i]);
            console.log(`${TAG} batch ${i + 1}/${batches.length} OK (${sqlPath})`);
        }
        const afterCount = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.wpqr_test_runs');
        const nAfter = Number(afterCount.recordset[0].n);
        if (nBefore !== nAfter) throw new Error(`conteggio wpqr_test_runs cambiato: prima=${nBefore} dopo=${nAfter}`);
        const after = await schemaState(pool);
        if (!after.complete) throw new Error(`schema incompleto: mancano ${after.missing.join(', ')}`);
        console.log(`${TAG} OK 8 colonne range nullable, righe invariate (${nAfter}).`);
    } catch (e) {
        console.error(TAG, 'ERRORE:', e.message);
        exitCode = 1;
    } finally {
        if (pool) await pool.close().catch(() => {});
    }
    return exitCode;
}

module.exports = {
    run,
    resolveTarget,
    splitGoBatches,
    batchesWithUse,
    SQL_FILE,
    TEST_DB,
    RANGE_COLUMNS,
};

if (require.main === module) {
    run().then((code) => process.exit(code));
}
