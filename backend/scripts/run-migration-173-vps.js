/**
 * Migration 173 (VPS) — dati di prova WPQR: tabella wpqr_test_runs + colonne di testata su wpqr_records.
 * Additiva e idempotente; nessun DROP/UPDATE/DELETE, nessun ON DELETE. Il rollback è un file separato
 * (173_rollback.sql) che QUESTO runner non esegue mai.
 *
 * Variabili: SGQ_MIGRATION_TARGET=test|prod (OBBLIGATORIA, nessun default: valore assente o diverso → exit 1 prima
 *   di ogni connessione); CHECK_ONLY=1 | CHECK_ONLY=true | SGQ_MIGRATION_CHECK_ONLY=1 = sole SELECT, exit 0.
 * Guard: subito dopo la connessione SELECT DB_NAME() deve combaciare con il DB del target, altrimenti exit 1 senza DDL.
 * Esecuzione SOLO su VPS via SSH, con sì esplicito del committente (mai dal Cloud, mai automatica):
 *   scp -P 1122 database/migrations/173_wpqr_test_data.sql database/migrations/173_verify.sql \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   scp -P 1122 backend/scripts/run-migration-173-vps.js spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test CHECK_ONLY=1 node /tmp/run-migration-173-vps.js'
 *   Apply test:  SGQ_MIGRATION_TARGET=test node /tmp/run-migration-173-vps.js
 *   Apply prod:  SGQ_MIGRATION_TARGET=prod node /tmp/run-migration-173-vps.js  (solo con un secondo sì dedicato)
 * Il file è copiato da solo in /tmp: nessun helper condiviso.
 */
const fs = require('fs');

const PROD_BACKEND_ROOT = '/var/www/sgq-backend';
const TEST_BACKEND_ROOT = '/var/www/sgq-backend-test';
const DB_NAME_BY_TARGET = { prod: 'SGQ_ISO9001', test: '2026-06-18_SGQ_ISO9001' };

const SQL_FILE = '173_wpqr_test_data.sql';
const VERIFY_FILE = '173_verify.sql';
const TAG = '[173]';

/** Tabelle che devono già esistere (con PK `id` INT e organization_id): su TEST/PROD una tabella assente = ambiente disallineato. */
const BASE_TABLES = ['wpqr_records'];
/** Tabelle di cui il conteggio righe deve restare invariato. */
const COUNTED_TABLES = ['wpqr_records'];
/** Oggetti attesi dopo l'apply (tabelle nuove e colonne aggiunte a tabelle esistenti). */
const EXPECTED = {
    wpqr_test_runs: {
        columns: [
            'id', 'organization_id', 'company_id', 'wpqr_id', 'run_no', 'run_label', 'welding_process',
            'filler_diameter_mm', 'filler_designation', 'filler_make', 'current_a', 'voltage_v',
            'current_polarity', 'wire_feed_speed', 'wire_feed_unit', 'travel_speed', 'travel_speed_unit',
            'heat_input_value', 'heat_input_unit', 'metal_transfer', 'weld_time_ms', 'protrusion_mm',
            'lift_mm', 'capacitance_mf', 'charging_voltage_v', 'gap_lift_mm', 'spring_force_n', 'remarks',
            'source', 'created_at', 'updated_at',
        ],
        indexes: ['IX_wpqr_test_runs_org_wpqr'],
        foreignKeys: ['FK_wpqr_test_runs_wpqr'],
        keyConstraints: [],
    },
    wpqr_records: {
        columns: [
            'welding_position_test', 'diameter_test_mm', 'deposited_thickness_mm', 'thickness_t2_test_mm',
            'filler_make', 'filler_size', 'backing_gas', 'heat_input_kind', 'heat_input_range_min',
            'heat_input_range_max', 'heat_input_range_unit', 'heat_input_range_basis',
            'heat_input_tol_minus_pct', 'heat_input_tol_plus_pct', 'heat_input_plus_unlimited',
            'preheat_temp_test', 'interpass_temp_test', 'post_heating', 'pwht_details',
            'range_standard_reference', 'shielding_gas_flow_l_min_min', 'shielding_gas_flow_l_min_max',
            'nozzle_diameter_mm', 'contact_tube_distance_mm_min', 'contact_tube_distance_mm_max',
            'tungsten_electrode', 'torch_angle_deg', 'joint_preparation', 'cleaning_method',
            'bead_technique', 'electrode_count', 'other_test_info',
        ],
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
            if (!BASE_TABLES.includes(table)) continue;
        }
        spec.columns.filter((c) => !inv.columns.includes(c)).forEach((c) => missing.push(`colonna ${table}.${c}`));
        spec.indexes.filter((i) => !inv.indexes.includes(i)).forEach((i) => missing.push(`indice ${table}.${i}`));
        spec.foreignKeys.filter((f) => !inv.foreignKeys.includes(f)).forEach((f) => missing.push(`FK ${table}.${f}`));
        spec.keyConstraints.filter((k) => !inv.keyConstraints.includes(k)).forEach((k) => missing.push(`vincolo ${table}.${k}`));
    }
    return missing;
}

/** Precondizioni: PK reale su `id` INT e colonna organization_id nelle tabelle base (089 può averle create con schema ridotto). */
async function checkPreconditions(pool) {
    const problems = [];
    for (const table of BASE_TABLES) {
        const obj = `OBJECT_ID(N'dbo.${table}', N'U')`;
        const exists = await pool.request().query(`SELECT ${obj} AS object_id`);
        if (!(exists.recordset[0] && exists.recordset[0].object_id)) {
            problems.push(`tabella ${table} assente`);
            continue;
        }
        const pk = await pool.request().query(`
            SELECT t.name AS type_name
            FROM sys.indexes i
            INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
            WHERE i.is_primary_key = 1 AND i.object_id = ${obj} AND c.name = N'id'
        `);
        const row = pk.recordset[0];
        if (!row) problems.push(`${table}: nessuna PRIMARY KEY su id`);
        else if (String(row.type_name).toLowerCase() !== 'int') problems.push(`${table}.id non è INT (${row.type_name})`);
        const org = await pool.request().query(`SELECT COL_LENGTH(N'dbo.${table}', N'organization_id') AS len`);
        if (!(org.recordset[0] && org.recordset[0].len != null)) problems.push(`${table}: colonna organization_id assente`);
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
            if (problems.length === 0) console.log(`${TAG} CHECK_ONLY: precondizioni ok (PK id INT e organization_id presenti).`);
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
        console.log(`${TAG} Migration completata, verify PASS. Rollback (NON eseguito): ${candidatePaths(cfg.backendRoot, '173_rollback.sql')[0]}`);
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
};

if (require.main === module) {
    run().then((code) => process.exit(code));
}
