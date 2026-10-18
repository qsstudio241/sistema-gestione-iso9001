/**
 * Migration 179 (VPS) — colonna nullable ndt_reports.inspector_qualification_id.
 * Additiva. Nessun UPDATE delle righe esistenti. Solo TEST.
 *
 *   SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node backend/scripts/run-migration-179-vps.js
 *   SGQ_MIGRATION_TARGET=test node backend/scripts/run-migration-179-vps.js
 *
 * Sul VPS lo script va in /tmp insieme al file SQL (il cloud non raggiunge SQL Server).
 * SGQ_MIGRATION_TARGET=prod è rifiutato: questa slice non si applica in produzione.
 */

const fs = require('fs');

const TEST_BACKEND_ROOT = '/var/www/sgq-backend-test';
const TEST_DB = '2026-06-18_SGQ_ISO9001';
const SQL_FILE = '179_ndt_reports_inspector_qualification.sql';
const TAG = '[179]';

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
        checkOnly:
            env.CHECK_ONLY === '1' || env.CHECK_ONLY === 'true' || env.SGQ_MIGRATION_CHECK_ONLY === '1',
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

async function columnState(pool) {
    const col = await pool.request().query(`
        SELECT c.is_nullable
        FROM sys.columns c
        WHERE c.object_id = OBJECT_ID(N'dbo.ndt_reports')
          AND c.name = N'inspector_qualification_id'
    `);
    const row = col.recordset[0];
    return {
        column: Boolean(row),
        nullable: Boolean(row && row.is_nullable),
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
        console.log(`${TAG} database=${dbName}`);

        const beforeCount = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.ndt_reports');
        const nBefore = Number(beforeCount.recordset[0].n);
        const before = await columnState(pool);

        if (cfg.checkOnly) {
            console.log(`${TAG} CHECK_ONLY: colonna=${before.column} nullable=${before.nullable} righe=${nBefore}`);
            console.log(`${TAG} CHECK_ONLY: nessun DDL eseguito.`);
            return 0;
        }

        const { path: sqlPath, text } = readSql(fsImpl, cfg.backendRoot, SQL_FILE);
        const batches = splitGoBatches(text);
        if (batchesWithUse(batches).length > 0) {
            throw new Error('istruzione USE vietata — nessun batch eseguito');
        }
        console.log(`${TAG} righe prima=${nBefore} SQL ${sqlPath} batch=${batches.length}`);
        for (let i = 0; i < batches.length; i++) {
            await pool.request().query(batches[i]);
            console.log(`${TAG} batch ${i + 1}/${batches.length} OK`);
        }
        const afterCount = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.ndt_reports');
        const nAfter = Number(afterCount.recordset[0].n);
        if (nBefore !== nAfter) {
            throw new Error(`conteggio ndt_reports cambiato: prima=${nBefore} dopo=${nAfter}`);
        }
        const after = await columnState(pool);
        if (!after.column || !after.nullable) {
            throw new Error(`schema incompleto: colonna=${after.column} nullable=${after.nullable}`);
        }
        console.log(`${TAG} OK colonna nullable presente, righe invariate (${nAfter}).`);
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
