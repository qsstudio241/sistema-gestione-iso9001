/**
 * Migration 178 (VPS) — due DATE nullable sul certificato oculistico.
 * Additiva e idempotente; nessun DROP/UPDATE/DELETE. Il rollback è un file separato
 * che QUESTO runner non esegue mai.
 *
 * Variabili: SGQ_MIGRATION_TARGET=test|prod (OBBLIGATORIA, nessun default).
 * Guard: SELECT DB_NAME() deve combaciare col target, altrimenti exit 1 senza DDL.
 * Questa slice applica solo test. prod resta nel resolver per il controllo del nome
 * database, e non va lanciato senza un sì dedicato.
 *
 *   scp -P 1122 database/migrations/178_qualifications_vision_clocks.sql \
 *     database/migrations/178_verify.sql backend/scripts/run-migration-178-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node /tmp/run-migration-178-vps.js'
 *   Apply test: SGQ_MIGRATION_TARGET=test node /tmp/run-migration-178-vps.js
 */
const fs = require('fs');

const PROD_BACKEND_ROOT = '/var/www/sgq-backend';
const TEST_BACKEND_ROOT = '/var/www/sgq-backend-test';
const DB_NAME_BY_TARGET = { prod: 'SGQ_ISO9001', test: '2026-06-18_SGQ_ISO9001' };

const SQL_FILE = '178_qualifications_vision_clocks.sql';
const VERIFY_FILE = '178_verify.sql';
const TAG = '[178]';

const BASE_TABLES = ['qualifications'];
const COUNTED_TABLES = ['qualifications'];
const EXPECTED = {
    qualifications: {
        columns: ['near_vision_expiry_date', 'colour_vision_expiry_date'],
        indexes: [],
        foreignKeys: [],
        keyConstraints: [],
    },
};

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
    if (!found) throw new Error(`${file} non trovato in ${candidatePaths(backendRoot, file).join(' né in ')}`);
    return { path: found, text: fsImpl.readFileSync(found, 'utf8') };
}

async function names(pool, sqlText) {
    const r = await pool.request().query(sqlText);
    return (r.recordset || []).map((row) => String(row.name));
}

async function inventory(pool, table) {
    const obj = `OBJECT_ID(N'dbo.${table}', N'U')`;
    const exists = await pool.request().query(`SELECT ${obj} AS object_id`);
    const present = Boolean(exists.recordset[0] && exists.recordset[0].object_id);
    if (!present) return { present, columns: [], indexes: [], foreignKeys: [], keyConstraints: [] };
    return {
        present,
        columns: await names(pool, `SELECT name FROM sys.columns WHERE object_id = ${obj}`),
        indexes: await names(pool, `SELECT name FROM sys.indexes WHERE object_id = ${obj} AND name IS NOT NULL`),
        foreignKeys: await names(pool, `SELECT name FROM sys.foreign_keys WHERE parent_object_id = ${obj}`),
        keyConstraints: await names(pool, `SELECT name FROM sys.key_constraints WHERE parent_object_id = ${obj}`),
    };
}

async function findMissing(pool) {
    const missing = [];
    for (const [table, spec] of Object.entries(EXPECTED)) {
        const inv = await inventory(pool, table);
        if (!inv.present) {
            missing.push(`tabella ${table}`);
            continue;
        }
        spec.columns.filter((c) => !inv.columns.includes(c)).forEach((c) => missing.push(`colonna ${table}.${c}`));
    }
    return missing;
}

async function checkPreconditions(pool) {
    const problems = [];
    for (const table of BASE_TABLES) {
        const obj = `OBJECT_ID(N'dbo.${table}', N'U')`;
        const exists = await pool.request().query(`SELECT ${obj} AS object_id`);
        if (!(exists.recordset[0] && exists.recordset[0].object_id)) {
            problems.push(`tabella ${table} assente`);
        }
    }
    return problems;
}

async function countRows(pool) {
    const counts = {};
    for (const table of COUNTED_TABLES) {
        const r = await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.${table}`);
        counts[table] = Number(r.recordset[0].n);
    }
    return counts;
}

async function runVerify(pool, fsImpl, backendRoot) {
    const { path: verifyPath, text } = readSql(fsImpl, backendRoot, VERIFY_FILE);
    let lastRow = null;
    for (const batch of splitGoBatches(text)) {
        const result = await pool.request().query(batch);
        if (result.recordset && result.recordset.length) lastRow = result.recordset[0];
    }
    return { verifyPath, row: lastRow };
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

    console.log(`${TAG} target=${cfg.target} env=${cfg.envFile} checkOnly=${cfg.checkOnly ? 'yes' : 'no'}`);
    let pool;
    let exitCode = 0;
    try {
        const { getPool } = loadBackend(cfg.backendRoot, cfg.envFile);
        pool = await getPool();

        const dbRow = await pool.request().query('SELECT DB_NAME() AS db_name');
        const dbName = dbRow.recordset[0] && dbRow.recordset[0].db_name;
        assertDbMatchesTarget(cfg.target, dbName);
        console.log(`${TAG} database=${dbName}`);

        const problems = await checkPreconditions(pool);

        if (cfg.checkOnly) {
            if (problems.length === 0) console.log(`${TAG} CHECK_ONLY: precondizioni ok.`);
            else {
                console.log(`${TAG} CHECK_ONLY: precondizioni NON soddisfatte (${problems.length}):`);
                problems.forEach((p) => console.log(`${TAG}   ! ${p}`));
            }
            const missing = await findMissing(pool);
            if (missing.length === 0) console.log(`${TAG} CHECK_ONLY: nessun oggetto mancante, migrazione non necessaria.`);
            else {
                console.log(`${TAG} CHECK_ONLY: mancano ${missing.length} oggetti:`);
                missing.forEach((m) => console.log(`${TAG}   - ${m}`));
            }
            console.log(`${TAG} CHECK_ONLY: nessun DDL eseguito.`);
            return 0;
        }

        if (problems.length > 0) {
            throw new Error(`precondizioni non soddisfatte, nessun batch eseguito: ${problems.join('; ')}`);
        }

        const { path: sqlPath, text } = readSql(fsImpl, cfg.backendRoot, SQL_FILE);
        const batches = splitGoBatches(text);
        if (batches.length < 2) throw new Error(`attesi almeno 2 batch GO in ${sqlPath}, trovati ${batches.length}`);
        const withUse = batchesWithUse(batches);
        if (withUse.length > 0) throw new Error(`${sqlPath}: istruzione USE vietata (${withUse.length} batch) — nessun batch eseguito`);

        const before = await countRows(pool);
        console.log(`${TAG} righe prima: ${JSON.stringify(before)} — SQL ${sqlPath}, ${batches.length} batch`);
        for (let i = 0; i < batches.length; i++) {
            await pool.request().query(batches[i]);
            console.log(`${TAG} batch ${i + 1}/${batches.length} OK`);
        }

        const after = await countRows(pool);
        console.log(`${TAG} righe dopo: ${JSON.stringify(after)}`);
        for (const table of COUNTED_TABLES) {
            if (before[table] !== after[table]) {
                throw new Error(`conteggio righe di ${table} cambiato: prima=${before[table]} dopo=${after[table]}`);
            }
        }

        const verify = await runVerify(pool, fsImpl, cfg.backendRoot);
        console.log(`${TAG} verify: ${JSON.stringify(verify.row)}`);
        if (!verify.row || verify.row.esito !== 'PASS') {
            throw new Error(`${VERIFY_FILE} esito=${verify.row && verify.row.esito} (atteso PASS)`);
        }
        console.log(`${TAG} Migration completata, verify PASS.`);
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
    assertDbMatchesTarget,
    splitGoBatches,
    batchesWithUse,
    findMissing,
    checkPreconditions,
    EXPECTED,
    BASE_TABLES,
    COUNTED_TABLES,
    SQL_FILE,
    VERIFY_FILE,
    DB_NAME_BY_TARGET,
};

if (require.main === module) {
    run().then((code) => process.exit(code));
}
