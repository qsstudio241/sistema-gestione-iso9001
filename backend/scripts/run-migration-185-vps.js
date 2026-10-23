/**
 * Migration 185 (VPS) — avvisi di discrepanza.
 * Additiva. Nessun UPDATE delle WPQR esistenti. Solo TEST. PROD rifiutato.
 *
 * Prima del DDL: backup COPY_ONLY + CHECKSUM + RESTORE VERIFYONLY (fuori da questo script,
 * log del percorso nel report). Poi:
 *   SGQ_MIGRATION_TARGET=test node /tmp/run-migration-185-vps.js
 */

const fs = require('fs');

const TEST_BACKEND_ROOT = '/var/www/sgq-backend-test';
const TEST_DB = '2026-06-18_SGQ_ISO9001';
const SQL_FILE = '185_discrepancy_notices.sql';
const TAG = '[185]';

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
    const tab = await pool.request().query(`
        SELECT OBJECT_ID(N'dbo.discrepancy_notices', N'U') AS notices,
               COL_LENGTH(N'dbo.wpqr_records', N'material_group_range') AS material_group_range,
               COL_LENGTH(N'dbo.wpqr_records', N'fillet_throat_range') AS fillet_throat_range
    `);
    const row = tab.recordset[0] || {};
    return {
        notices: row.notices != null,
        material: row.material_group_range != null,
        fillet: row.fillet_throat_range != null,
        complete: row.notices != null && row.material_group_range != null && row.fillet_throat_range != null,
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
        const beforeCount = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.wpqr_records');
        const nBefore = Number(beforeCount.recordset[0].n);
        const before = await schemaState(pool);
        if (cfg.checkOnly) {
            console.log(`${TAG} CHECK_ONLY: complete=${before.complete} notices=${before.notices} righe_wpqr=${nBefore}`);
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
        const afterCount = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.wpqr_records');
        const nAfter = Number(afterCount.recordset[0].n);
        if (nBefore !== nAfter) throw new Error(`conteggio wpqr_records cambiato: prima=${nBefore} dopo=${nAfter}`);
        const after = await schemaState(pool);
        if (!after.complete) throw new Error('schema incompleto dopo la 185');
        console.log(`${TAG} OK tabella avvisi + 2 colonne nullable, righe WPQR invariate (${nAfter}).`);
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
};

if (require.main === module) {
    run().then((code) => process.exit(code));
}
