/**
 * Migration 180 (VPS) — tabella dbo.project_inspection_items.
 * Additiva. Nessun UPDATE delle righe esistenti. Solo TEST.
 *
 *   scp -P 1122 database/migrations/180_project_inspection_items.sql \
 *     backend/scripts/run-migration-180-vps.js spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node /tmp/run-migration-180-vps.js'
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test node /tmp/run-migration-180-vps.js'
 *
 * Sul VPS lo script va in /tmp insieme al file SQL (il cloud non raggiunge SQL Server).
 * SGQ_MIGRATION_TARGET=prod è rifiutato: questa slice non si applica in produzione.
 * Non rilancia 177, 178, 179.
 */

const fs = require('fs');

const TEST_BACKEND_ROOT = '/var/www/sgq-backend-test';
const TEST_DB = '2026-06-18_SGQ_ISO9001';
const SQL_FILE = '180_project_inspection_items.sql';
const TAG = '[180]';
const COUNT_TABLES = ['projects', 'ndt_reports', 'qualifications', 'commercial_cases'];

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

async function tableExists(pool, name) {
    const row = await pool.request().query(`
        SELECT OBJECT_ID(N'dbo.${name}', N'U') AS oid
    `);
    return Boolean(row.recordset[0] && row.recordset[0].oid);
}

async function countRows(pool, name) {
    if (!(await tableExists(pool, name))) return null;
    const row = await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.${name}`);
    return Number(row.recordset[0].n);
}

async function snapshotCounts(pool) {
    const counts = {};
    for (const name of COUNT_TABLES) {
        counts[name] = await countRows(pool, name);
    }
    return counts;
}

function countsEqual(before, after) {
    return COUNT_TABLES.every((name) => before[name] === after[name]);
}

async function schemaState(pool) {
    const present = await tableExists(pool, 'project_inspection_items');
    if (!present) {
        return { table: false, fkProject: false, fkOrg: false, cascade: false };
    }
    const fk = await pool.request().query(`
        SELECT name, delete_referential_action_desc AS on_delete
        FROM sys.foreign_keys
        WHERE parent_object_id = OBJECT_ID(N'dbo.project_inspection_items')
          AND name IN (N'FK_project_inspection_items_project', N'FK_project_inspection_items_org')
    `);
    const rows = fk.recordset || [];
    const project = rows.find((r) => r.name === 'FK_project_inspection_items_project');
    const org = rows.find((r) => r.name === 'FK_project_inspection_items_org');
    const cascade = rows.some((r) => String(r.on_delete || '').toUpperCase() !== 'NO_ACTION');
    return {
        table: true,
        fkProject: Boolean(project),
        fkOrg: Boolean(org),
        cascade,
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

        const before = await snapshotCounts(pool);
        const schemaBefore = await schemaState(pool);
        console.log(`${TAG} conteggi prima ${JSON.stringify(before)}`);

        if (cfg.checkOnly) {
            console.log(`${TAG} CHECK_ONLY: tabella=${schemaBefore.table} fkProject=${schemaBefore.fkProject}`);
            console.log(`${TAG} CHECK_ONLY: nessun DDL eseguito.`);
            return 0;
        }

        const { path: sqlPath, text } = readSql(fsImpl, cfg.backendRoot, SQL_FILE);
        const batches = splitGoBatches(text);
        if (batchesWithUse(batches).length > 0) {
            throw new Error('istruzione USE vietata — nessun batch eseguito');
        }
        console.log(`${TAG} SQL ${sqlPath} batch=${batches.length}`);
        for (let i = 0; i < batches.length; i++) {
            await pool.request().query(batches[i]);
            console.log(`${TAG} batch ${i + 1}/${batches.length} OK`);
        }

        const after = await snapshotCounts(pool);
        console.log(`${TAG} conteggi dopo ${JSON.stringify(after)}`);
        if (!countsEqual(before, after)) {
            throw new Error(`conteggi cambiati: prima=${JSON.stringify(before)} dopo=${JSON.stringify(after)}`);
        }
        const schema = await schemaState(pool);
        if (!schema.table || !schema.fkProject || schema.cascade) {
            throw new Error(
                `schema incompleto: tabella=${schema.table} fkProject=${schema.fkProject} cascade=${schema.cascade}`
            );
        }
        console.log(`${TAG} OK tabella presente, FK senza ON DELETE, conteggi invariati.`);
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
    countsEqual,
    SQL_FILE,
    TEST_DB,
    COUNT_TABLES,
};

if (require.main === module) {
    run().then((code) => process.exit(code));
}
