/**
 * Backfill schizzi WPQR sul VPS. Solo TEST.
 *
 *   scp -P 1122 backend/src/services/wpqrSketchBackfill.service.js \
 *     backend/scripts/backfill-wpqr-sketches-vps.js \
 *     spascarella@sistemi.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test DRY_RUN=1 node /tmp/backfill-wpqr-sketches-vps.js'
 *   ssh -p 1122 spascarella@sistemi.fr-busato.it \
 *     'SGQ_MIGRATION_TARGET=test APPLY=1 node /tmp/backfill-wpqr-sketches-vps.js'
 *
 * SGQ_MIGRATION_TARGET=prod è rifiutato. Default = dry-run (nessuna scrittura).
 */

const fs = require('fs');

const TEST_BACKEND_ROOT = '/var/www/sgq-backend-test';
const TEST_DB = '2026-06-18_SGQ_ISO9001';
const TAG = '[wpqr-sketch-backfill]';

function resolveTarget(env = process.env) {
    const raw = env.SGQ_MIGRATION_TARGET;
    if (raw !== 'test') {
        throw new Error(
            `SGQ_MIGRATION_TARGET deve essere esattamente "test" (ricevuto: ${
                raw === undefined ? '<non impostata>' : JSON.stringify(raw)
            }). Produzione rifiutata.`
        );
    }
    const apply = env.APPLY === '1' || env.APPLY === 'true';
    const dryRun = !apply;
    return {
        target: 'test',
        backendRoot: TEST_BACKEND_ROOT,
        envFile: `${TEST_BACKEND_ROOT}/.env.test`,
        expectedDb: TEST_DB,
        dryRun,
        sheetPath: env.SHEET_PATH || '/tmp/wpqr-sketch-backfill-contact.png',
    };
}

function defaultLoadBackend(backendRoot, envFile) {
    process.chdir(backendRoot);
    require(`${backendRoot}/node_modules/dotenv`).config({ path: envFile });
    return {
        getPool: require(`${backendRoot}/src/config/database`).getPool,
        backfill: requireService(backendRoot),
    };
}

function requireService(backendRoot) {
    const dest = `${backendRoot}/src/services/wpqrSketchBackfill.service.js`;
    const tmpCopy = '/tmp/wpqrSketchBackfill.service.js';
    if (!fs.existsSync(dest) && fs.existsSync(tmpCopy)) {
        fs.copyFileSync(tmpCopy, dest);
    }
    if (!fs.existsSync(dest)) {
        throw new Error(`wpqrSketchBackfill.service.js non trovato (${dest})`);
    }
    return require(dest);
}

async function run({ env = process.env, loadBackend = defaultLoadBackend } = {}) {
    let cfg;
    try {
        cfg = resolveTarget(env);
    } catch (e) {
        console.error(TAG, 'ERRORE:', e.message);
        return 1;
    }

    console.log(`${TAG} target=test env=${cfg.envFile} dryRun=${cfg.dryRun ? 'yes' : 'no'}`);
    let pool;
    let exitCode = 0;
    try {
        const loaded = loadBackend(cfg.backendRoot, cfg.envFile);
        pool = await loaded.getPool();
        const dbRow = await pool.request().query('SELECT DB_NAME() AS db_name');
        const dbName = dbRow.recordset[0] && dbRow.recordset[0].db_name;
        if (String(dbName || '').trim() !== TEST_DB) {
            throw new Error(`database "${dbName || ''}" diverso da ${TEST_DB} — abort`);
        }
        console.log(`${TAG} database=${dbName}`);

        const { backfillWpqrSketches, composeContactSheet, collectSheetItems } = loaded.backfill;
        const out = await backfillWpqrSketches({
            dryRun: cfg.dryRun,
            log: {
                info: (m) => console.log(m),
                warn: (m) => console.warn(m),
            },
        });
        console.log(`${TAG} SUMMARY ${JSON.stringify(out.summary)}`);

        if (!cfg.dryRun) {
            const items = collectSheetItems(out.results);
            const sheet = composeContactSheet(items);
            if (sheet) {
                fs.writeFileSync(cfg.sheetPath, sheet);
                console.log(`${TAG} contact_sheet=${cfg.sheetPath} bytes=${sheet.length} tiles=${items.length}`);
            } else {
                console.log(`${TAG} contact_sheet=none (nessun PNG bozza)`);
            }
        }
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
    TEST_DB,
    TEST_BACKEND_ROOT,
};

if (require.main === module) {
    run().then((code) => process.exit(code));
}
