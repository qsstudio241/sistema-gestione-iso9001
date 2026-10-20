/**
 * Migration 181 (VPS) — sette colonne nullable ISO 15609-1 su welding_procedures.
 * Additiva. Nessun UPDATE delle righe esistenti. Solo TEST.
 *
 *   scp -P 1122 database/migrations/181_wps_iso15609_content.sql \
 *     database/migrations/181_verify.sql \
 *     backend/scripts/run-migration-181-vps.js spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node /tmp/run-migration-181-vps.js'
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test node /tmp/run-migration-181-vps.js'
 *
 * Sul VPS lo script va in /tmp insieme al file SQL (il cloud non raggiunge SQL Server).
 * SGQ_MIGRATION_TARGET=prod è rifiutato: questa slice non si applica in produzione.
 * Non rilancia 177–180.
 */

const fs = require('fs');

const TEST_BACKEND_ROOT = '/var/www/sgq-backend-test';
const TEST_DB = '2026-06-18_SGQ_ISO9001';
const SQL_FILE = '181_wps_iso15609_content.sql';
const TAG = '[181]';
const ISO_COLUMNS = [
    'wpqr_ref', 'parent_material_a', 'parent_material_b',
    'heat_input', 'current_range', 'voltage_range', 'metal_transfer',
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
        SELECT c.name AS name
        FROM sys.columns c
        WHERE c.object_id = OBJECT_ID(N'dbo.welding_procedures')
          AND c.name IN (N'wpqr_ref', N'parent_material_a', N'parent_material_b',
                         N'heat_input', N'current_range', N'voltage_range', N'metal_transfer')
    `);
    const names = new Set((col.recordset || []).map((r) => r.name));
    return {
        present: ISO_COLUMNS.filter((n) => names.has(n)),
        missing: ISO_COLUMNS.filter((n) => !names.has(n)),
        complete: names.size === ISO_COLUMNS.length,
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

        const beforeCount = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.welding_procedures');
        const nBefore = Number(beforeCount.recordset[0].n);
        const before = await columnState(pool);

        if (cfg.checkOnly) {
            console.log(`${TAG} CHECK_ONLY: complete=${before.complete} present=${before.present.join(',') || '(none)'} righe=${nBefore}`);
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
        const afterCount = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.welding_procedures');
        const nAfter = Number(afterCount.recordset[0].n);
        if (nBefore !== nAfter) {
            throw new Error(`conteggio welding_procedures cambiato: prima=${nBefore} dopo=${nAfter}`);
        }
        const after = await columnState(pool);
        if (!after.complete) {
            throw new Error(`schema incompleto: mancano ${after.missing.join(', ')}`);
        }
        console.log(`${TAG} OK 7 colonne nullable presenti, righe invariate (${nAfter}).`);
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
    ISO_COLUMNS,
};

if (require.main === module) {
    run().then((code) => process.exit(code));
}
