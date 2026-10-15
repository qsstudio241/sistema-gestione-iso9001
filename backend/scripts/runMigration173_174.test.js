/**
 * @jest-environment node
 *
 * L1 — runner VPS 173 (wpqr_test_runs + colonne di testata) e 174 (wps_wpqr_links): target obbligatorio,
 * guard DB, CHECK_ONLY a sole SELECT con precondizioni, apply a batch GO senza USE, verify PASS,
 * righe invariate, rollback mai eseguito. Più analisi statica dei .sql reali (letti, mai eseguiti).
 * Nessuna connessione reale: pool finto iniettato.
 */
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

const RUNNERS = [173, 174].map((n) => {
    const mod = require(`./run-migration-${n}-vps.js`);
    return {
        n,
        mod,
        file: path.join(__dirname, `run-migration-${n}-vps.js`),
        sqlFile: mod.SQL_FILE,
        verifyFile: mod.VERIFY_FILE,
        rollbackFile: `${n}_rollback.sql`,
        newTables: Object.keys(mod.EXPECTED).filter((t) => !mod.BASE_TABLES.includes(t)),
    };
});

function readMigration(name) {
    return fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8');
}

function fakeFs(overrides = {}) {
    const files = {};
    for (const { sqlFile, verifyFile } of RUNNERS) {
        files[sqlFile] = readMigration(sqlFile);
        files[verifyFile] = readMigration(verifyFile);
    }
    Object.assign(files, overrides);
    const lookup = (p) => files[path.basename(p)];
    return {
        existsSync: (p) => lookup(p) !== undefined,
        readFileSync: (p) => {
            const v = lookup(p);
            if (v === undefined) throw new Error(`ENOENT ${p}`);
            return v;
        },
    };
}

/**
 * Pool finto. `state.tables[t]` = { columns, indexes, foreignKeys, keyConstraints }.
 * Le tabelle base nascono con PK id INT e organization_id; gli oggetti nuovi sono assenti finché non si passa `existing`.
 */
function fakePool({
    dbName,
    tables,
    pk = { wpqr_records: 'int', welding_procedures: 'int' },
    orgColumn = true,
    counts = { wpqr_records: 13, welding_procedures: 0 },
    countsAfterDdl,
    verifyEsito = 'PASS',
}) {
    const state = {
        tables: tables || {
            wpqr_records: { columns: ['id', 'organization_id'], indexes: [], foreignKeys: [], keyConstraints: [] },
            welding_procedures: { columns: ['id', 'organization_id'], indexes: [], foreignKeys: [], keyConstraints: [] },
        },
    };
    const queries = [];
    let ddlRun = false;
    const tableOf = (sql) => {
        const m = /dbo\.([a-z_]+)/i.exec(sql);
        return m ? m[1] : null;
    };
    const pool = {
        queries,
        close: jest.fn().mockResolvedValue(undefined),
        request: () => ({
            query: async (sql) => {
                queries.push(sql);
                if (/DB_NAME\(\)/i.test(sql)) return { recordset: [{ db_name: dbName }] };
                if (/AS esito/i.test(sql)) return { recordset: [{ esito: verifyEsito }] };
                const t = tableOf(sql);
                if (/^\s*SELECT\s+OBJECT_ID\(/i.test(sql)) {
                    return { recordset: [{ object_id: state.tables[t] ? 1234 : null }] };
                }
                if (/is_primary_key = 1/i.test(sql)) {
                    return { recordset: pk[t] ? [{ type_name: pk[t] }] : [] };
                }
                if (/COL_LENGTH\(/i.test(sql)) return { recordset: [{ len: orgColumn ? 4 : null }] };
                if (/FROM sys\.columns/i.test(sql)) return { recordset: ((state.tables[t] || {}).columns || []).map((name) => ({ name })) };
                if (/FROM sys\.indexes/i.test(sql)) return { recordset: ((state.tables[t] || {}).indexes || []).map((name) => ({ name })) };
                if (/FROM sys\.foreign_keys/i.test(sql)) return { recordset: ((state.tables[t] || {}).foreignKeys || []).map((name) => ({ name })) };
                if (/FROM sys\.key_constraints/i.test(sql)) return { recordset: ((state.tables[t] || {}).keyConstraints || []).map((name) => ({ name })) };
                if (/COUNT\(\*\)/i.test(sql)) {
                    const c = ddlRun && countsAfterDdl ? countsAfterDdl : counts;
                    return { recordset: [{ n: c[t] }] };
                }
                ddlRun = true;
                return { recordset: [] };
            },
        }),
    };
    return pool;
}

function makeLoader(pool) {
    const getPool = jest.fn().mockResolvedValue(pool);
    const loadBackend = jest.fn().mockReturnValue({ getPool });
    return { loadBackend, getPool };
}

const TEST_DB = '2026-06-18_SGQ_ISO9001';
const isDdlOrBatch = (q) => !/^\s*SELECT\b/i.test(q);

describe.each(RUNNERS)('runner migrazione $n', ({ n, file, mod, sqlFile, verifyFile, rollbackFile, newTables }) => {
    let errSpy;
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    const logOut = () => console.log.mock.calls.flat().join('\n');

    it('target mancante: exit 1 senza caricare backend né aprire connessioni', async () => {
        const { loadBackend, getPool } = makeLoader(fakePool({ dbName: 'x' }));
        const code = await mod.run({ env: {}, loadBackend, fsImpl: fakeFs() });
        expect(code).toBe(1);
        expect(loadBackend).not.toHaveBeenCalled();
        expect(getPool).not.toHaveBeenCalled();
        expect(errSpy.mock.calls.flat().join(' ')).toMatch(/SGQ_MIGRATION_TARGET/);
    });

    it.each(['', 'staging', 'PROD', 'Test', ' prod', 'production', '1'])(
        'target non ammesso %j: exit 1 senza connessione',
        async (bad) => {
            const { loadBackend, getPool } = makeLoader(fakePool({ dbName: 'x' }));
            const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: bad }, loadBackend, fsImpl: fakeFs() });
            expect(code).toBe(1);
            expect(loadBackend).not.toHaveBeenCalled();
            expect(getPool).not.toHaveBeenCalled();
        }
    );

    it('prod e test selezionano root e .env diversi; nessun default', () => {
        const prod = mod.resolveTarget({ SGQ_MIGRATION_TARGET: 'prod' });
        const test = mod.resolveTarget({ SGQ_MIGRATION_TARGET: 'test' });
        expect(prod.envFile).toBe('/var/www/sgq-backend/.env');
        expect(test.envFile).toBe('/var/www/sgq-backend-test/.env.test');
        expect(prod.backendRoot).not.toBe(test.backendRoot);
        expect(prod.checkOnly).toBe(false);
        expect(() => mod.resolveTarget({})).toThrow(/Nessun default/);
    });

    it('run() passa a loadBackend i path del target scelto', async () => {
        for (const [target, root, envFile, db] of [
            ['test', '/var/www/sgq-backend-test', '/var/www/sgq-backend-test/.env.test', TEST_DB],
            ['prod', '/var/www/sgq-backend', '/var/www/sgq-backend/.env', 'SGQ_ISO9001'],
        ]) {
            const { loadBackend } = makeLoader(fakePool({ dbName: db }));
            const code = await mod.run({
                env: { SGQ_MIGRATION_TARGET: target, CHECK_ONLY: '1' },
                loadBackend,
                fsImpl: fakeFs(),
            });
            expect(code).toBe(0);
            expect(loadBackend).toHaveBeenCalledWith(root, envFile);
        }
    });

    it('guard DB: mismatch target/DB → exit 1 prima di qualsiasi DDL e prima di ogni altra query', async () => {
        const cases = [
            ['prod', TEST_DB],
            ['test', 'SGQ_ISO9001'],
            ['prod', 'SGQ_ISO9001_Test'],
            ['test', 'SGQ_ISO9001_Test'],
            ['prod', ''],
        ];
        for (const [target, db] of cases) {
            const pool = fakePool({ dbName: db });
            const { loadBackend } = makeLoader(pool);
            const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: target }, loadBackend, fsImpl: fakeFs() });
            expect(code).toBe(1);
            expect(pool.queries).toHaveLength(1);
            expect(pool.queries[0]).toMatch(/DB_NAME\(\)/i);
            expect(pool.close).toHaveBeenCalled();
        }
    });

    it.each(['1', 'true'])('CHECK_ONLY=%s: sole SELECT, exit 0, elenca oggetti mancanti e precondizioni ok', async (v) => {
        const pool = fakePool({ dbName: TEST_DB });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: 'test', CHECK_ONLY: v }, loadBackend, fsImpl: fakeFs() });
        expect(code).toBe(0);
        expect(pool.queries.length).toBeGreaterThan(0);
        pool.queries.forEach((q) => {
            expect(q.trim()).toMatch(/^SELECT\b/i);
            expect(q).not.toMatch(/\b(DECLARE|IF|EXEC|ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|MERGE)\b/i);
        });
        const out = logOut();
        expect(out).toMatch(/precondizioni ok/);
        expect(out).toMatch(/mancano \d+ oggetti/);
        newTables.forEach((t) => expect(out).toContain(`tabella ${t}`));
        expect(out).toMatch(/nessun DDL eseguito/);
    });

    it('CHECK_ONLY con SGQ_MIGRATION_CHECK_ONLY=1 è equivalente', async () => {
        const pool = fakePool({ dbName: TEST_DB });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({
            env: { SGQ_MIGRATION_TARGET: 'test', SGQ_MIGRATION_CHECK_ONLY: '1' },
            loadBackend,
            fsImpl: fakeFs(),
        });
        expect(code).toBe(0);
        pool.queries.forEach((q) => expect(q.trim()).toMatch(/^SELECT\b/i));
    });

    it('CHECK_ONLY con tutto presente: nessun oggetto mancante', async () => {
        const tables = {
            wpqr_records: { columns: ['id', 'organization_id'], indexes: [], foreignKeys: [], keyConstraints: [] },
            welding_procedures: { columns: ['id', 'organization_id'], indexes: [], foreignKeys: [], keyConstraints: [] },
        };
        for (const [t, spec] of Object.entries(mod.EXPECTED)) {
            tables[t] = {
                columns: [...(tables[t] ? tables[t].columns : []), ...spec.columns],
                indexes: spec.indexes,
                foreignKeys: spec.foreignKeys,
                keyConstraints: spec.keyConstraints,
            };
        }
        const pool = fakePool({ dbName: TEST_DB, tables });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: 'test', CHECK_ONLY: '1' }, loadBackend, fsImpl: fakeFs() });
        expect(code).toBe(0);
        expect(logOut()).toMatch(/nessun oggetto mancante/);
    });

    it('CHECK_ONLY segnala una precondizione PK assente (exit 0, nessun DDL)', async () => {
        const pool = fakePool({ dbName: TEST_DB, pk: { wpqr_records: null, welding_procedures: 'int' } });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: 'test', CHECK_ONLY: '1' }, loadBackend, fsImpl: fakeFs() });
        expect(code).toBe(0);
        expect(logOut()).toMatch(/precondizioni NON soddisfatte/);
        expect(logOut()).toMatch(/wpqr_records: nessuna PRIMARY KEY su id/);
        pool.queries.forEach((q) => expect(q.trim()).toMatch(/^SELECT\b/i));
    });

    it('apply: precondizione PK assente → exit 1 prima di ogni batch', async () => {
        const pool = fakePool({ dbName: TEST_DB, pk: { wpqr_records: null, welding_procedures: 'int' } });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: 'test' }, loadBackend, fsImpl: fakeFs() });
        expect(code).toBe(1);
        expect(pool.queries.filter(isDdlOrBatch)).toHaveLength(0);
        expect(errSpy.mock.calls.flat().join(' ')).toMatch(/PRIMARY KEY/);
    });

    it('apply: PK non INT o organization_id assente → rifiutato', async () => {
        for (const opts of [{ pk: { wpqr_records: 'bigint', welding_procedures: 'int' } }, { orgColumn: false }]) {
            const pool = fakePool({ dbName: TEST_DB, ...opts });
            const { loadBackend } = makeLoader(pool);
            const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: 'test' }, loadBackend, fsImpl: fakeFs() });
            expect(code).toBe(1);
            expect(pool.queries.filter(isDdlOrBatch)).toHaveLength(0);
        }
    });

    it('apply: tabella base assente (ambiente disallineato) → exit 1 senza batch', async () => {
        const pool = fakePool({ dbName: TEST_DB, tables: { other: { columns: [] } } });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: 'test' }, loadBackend, fsImpl: fakeFs() });
        expect(code).toBe(1);
        expect(pool.queries.filter(isDdlOrBatch)).toHaveLength(0);
    });

    it('apply: esegue i batch GO in ordine, poi il verify PASS, righe invariate, rollback mai eseguito', async () => {
        const pool = fakePool({ dbName: TEST_DB });
        const { loadBackend } = makeLoader(pool);
        const sqlText = readMigration(sqlFile);
        const expectedBatches = mod.splitGoBatches(sqlText);
        const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: 'test' }, loadBackend, fsImpl: fakeFs() });
        expect(code).toBe(0);
        const writes = pool.queries.filter(isDdlOrBatch);
        expect(writes.slice(0, expectedBatches.length)).toEqual(expectedBatches);
        const verifyIdx = pool.queries.findIndex((q) => /AS esito/i.test(q));
        expect(verifyIdx).toBeGreaterThan(pool.queries.indexOf(expectedBatches[expectedBatches.length - 1]));
        expect(pool.queries.join('\n')).not.toMatch(/DROP\s+(TABLE|COLUMN|CONSTRAINT|INDEX)/i);
        expect(logOut()).toMatch(/verify PASS/);
        expect(logOut()).toContain(rollbackFile);
        expect(pool.close).toHaveBeenCalled();
    });

    it('apply: esito verify diverso da PASS → exit 1', async () => {
        const pool = fakePool({ dbName: TEST_DB, verifyEsito: 'FAIL' });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: 'test' }, loadBackend, fsImpl: fakeFs() });
        expect(code).toBe(1);
        expect(errSpy.mock.calls.flat().join(' ')).toMatch(/atteso PASS/);
    });

    it('apply: riga di verify assente → exit 1', async () => {
        const pool = fakePool({ dbName: TEST_DB });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({
            env: { SGQ_MIGRATION_TARGET: 'test' },
            loadBackend,
            fsImpl: fakeFs({ [verifyFile]: 'SELECT 1;' }),
        });
        expect(code).toBe(1);
    });

    it('apply: conteggio righe cambiato → exit 1', async () => {
        const pool = fakePool({
            dbName: TEST_DB,
            counts: { wpqr_records: 13, welding_procedures: 0 },
            countsAfterDdl: { wpqr_records: 12, welding_procedures: 0 },
        });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: 'test' }, loadBackend, fsImpl: fakeFs() });
        expect(code).toBe(1);
        expect(errSpy.mock.calls.flat().join(' ')).toMatch(/conteggio righe/);
    });

    it('apply: USE in un batch → rifiuto senza eseguire alcun batch', async () => {
        const pool = fakePool({ dbName: TEST_DB });
        const { loadBackend } = makeLoader(pool);
        const bad = `${readMigration(sqlFile)}\nGO\nUSE [SGQ_ISO9001];\nGO\n`;
        const code = await mod.run({
            env: { SGQ_MIGRATION_TARGET: 'test' },
            loadBackend,
            fsImpl: fakeFs({ [sqlFile]: bad }),
        });
        expect(code).toBe(1);
        expect(pool.queries.filter(isDdlOrBatch)).toHaveLength(0);
        expect(errSpy.mock.calls.flat().join(' ')).toMatch(/USE vietata/);
    });

    it('USE dentro un commento non è un rifiuto', () => {
        expect(mod.batchesWithUse(['-- USE [x]\nSELECT 1', '/* USE y */ SELECT 2'])).toHaveLength(0);
        expect(mod.batchesWithUse(['SELECT 1;\nUSE [x];'])).toHaveLength(1);
    });

    it('nessun path PROD hardcoded fuori dalla costante; il runner non referenzia mai il rollback come file da eseguire', () => {
        const src = fs.readFileSync(file, 'utf8');
        expect(src.match(/'\/var\/www\/sgq-backend'/g)).toHaveLength(1);
        expect(src).not.toMatch(/require\(\s*['"`]\/var\/www/);
        expect(src).toContain(`node /tmp/run-migration-${n}-vps.js`);
        expect(src).toContain('CHECK_ONLY=1');
        const withoutDoc = src.replace(/\/\*\*[\s\S]*?\*\//g, '');
        expect(withoutDoc).not.toMatch(/readSql\([^)]*rollback/i);
        expect(withoutDoc).not.toMatch(/\b(DROP|DELETE|UPDATE)\b\s+(TABLE|FROM|COLUMN|CONSTRAINT|INDEX|dbo)/i);
    });
});

function maskComments(sql) {
    return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

describe.each(RUNNERS)('analisi statica SQL migrazione $n', ({ n, sqlFile, verifyFile, rollbackFile }) => {
    const apply = maskComments(readMigration(sqlFile));
    const verify = maskComments(readMigration(verifyFile));
    const rollback = maskComments(readMigration(rollbackFile));

    it('apply: additiva, nessun DROP/UPDATE/DELETE/ALTER COLUMN/ON DELETE/USE', () => {
        expect(apply).not.toMatch(/\bDROP\b/i);
        expect(apply).not.toMatch(/\bUPDATE\b/i);
        expect(apply).not.toMatch(/\bDELETE\b/i);
        expect(apply).not.toMatch(/\bINSERT\b/i);
        expect(apply).not.toMatch(/ALTER\s+COLUMN/i);
        expect(apply).not.toMatch(/ON\s+DELETE/i);
        expect(apply).not.toMatch(/ON\s+UPDATE/i);
        expect(apply).not.toMatch(/CASCADE/i);
        expect(apply).not.toMatch(/(^|[\s;])USE\s+[\[\w]/i);
        expect(apply).not.toMatch(/SET\s+(PARSEONLY|NOEXEC)/i);
        expect(apply).not.toMatch(/\bSGQ_ISO9001\b/);
    });

    it('apply: ogni FK è in un ALTER TABLE ... ADD CONSTRAINT separato dal CREATE TABLE', () => {
        const createBlocks = apply.match(/CREATE\s+TABLE[\s\S]*?\n\s*\);/gi) || [];
        createBlocks.forEach((b) => expect(b).not.toMatch(/FOREIGN\s+KEY|REFERENCES/i));
        const fkStatements = apply.match(/ADD\s+CONSTRAINT\s+\w+\s+FOREIGN\s+KEY/gi) || [];
        expect(fkStatements.length).toBe(n === 173 ? 1 : 2);
    });

    it('apply: ogni CREATE TABLE / CREATE INDEX / ADD è protetto da OBJECT_ID, sys.* o COL_LENGTH e batch separati da GO', () => {
        const batches = apply.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
        const mutating = batches.filter((b) => /\b(CREATE|ALTER)\b/i.test(b));
        expect(mutating.length).toBeGreaterThan(0);
        mutating.forEach((b) => {
            expect(b).toMatch(/OBJECT_ID|COL_LENGTH|sys\.(indexes|foreign_keys|key_constraints)/i);
            expect(b).toMatch(/^IF\b/i);
        });
    });

    it('apply: wpqr_records / welding_procedures assenti → no-op documentato (apply-on-empty)', () => {
        expect(apply).toMatch(/OBJECT_ID\(N'dbo\.wpqr_records', N'U'\) IS (NOT )?NULL/i);
        expect(readMigration(sqlFile)).toMatch(/apply-on-empty/);
    });

    it('verify: sole SELECT/DECLARE/SET, con colonna esito PASS|FAIL', () => {
        expect(verify).toMatch(/AS esito/);
        expect(verify).toMatch(/N'PASS'/);
        expect(verify).toMatch(/N'FAIL'/);
        expect(verify).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC)\b/i);
    });

    it('rollback: presente, idempotente (ogni statement protetto), tocca solo oggetti di questa migrazione', () => {
        const batches = rollback.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
        const destructive = batches.filter((b) => /\bDROP\b/i.test(b));
        expect(destructive.length).toBeGreaterThan(0);
        destructive.forEach((b) => expect(b).toMatch(/^IF\b[\s\S]*(OBJECT_ID|COL_LENGTH)/i));
        expect(rollback).not.toMatch(/CASCADE/i);
        expect(rollback).not.toMatch(/\b(DELETE|UPDATE|TRUNCATE)\b/i);
        if (n === 174) expect(rollback).not.toMatch(/wpqr_test_runs|DROP\s+COLUMN/i);
        if (n === 173) expect(rollback).not.toMatch(/wps_wpqr_links/i);
    });

    it('intestazione contratto (TYPE additive / BACKFILL none / VERIFY / ROLLBACK) e UTF-8 senza BOM', () => {
        const raw = readMigration(sqlFile);
        expect(raw.startsWith('-- TYPE: additive')).toBe(true);
        expect(raw).toMatch(/^-- BACKFILL: none$/m);
        expect(raw).toContain(`-- VERIFY: ${verifyFile}`);
        expect(raw).toContain(`-- ROLLBACK: ${rollbackFile}`);
        [sqlFile, verifyFile, rollbackFile].forEach((f) => {
            const buf = fs.readFileSync(path.join(MIGRATIONS_DIR, f));
            expect(buf[0]).not.toBe(0xef);
            expect(buf.toString('utf8')).not.toContain('\uFFFD');
        });
    });
});

describe('coerenza fra le due migrazioni e i runner', () => {
    it('173 elenca nel verify e nel rollback le stesse colonne di testata e di passata del runner', () => {
        const mod = RUNNERS[0].mod;
        const verify = readMigration('173_verify.sql');
        const rollback = readMigration('173_rollback.sql');
        const apply = readMigration('173_wpqr_test_data.sql');
        mod.EXPECTED.wpqr_records.columns.forEach((c) => {
            expect(verify).toContain(`N'${c}'`);
            expect(rollback).toContain(`DROP COLUMN ${c};`);
            expect(apply).toContain(`ADD ${c} `);
        });
        mod.EXPECTED.wpqr_test_runs.columns.forEach((c) => {
            expect(verify).toContain(`N'${c}'`);
            expect(apply).toMatch(new RegExp(`\\n\\s+${c}\\s+`));
        });
    });

    it('173: nessuna colonna rendimento/lunghezze/pwps_ref (esclusioni dichiarate nel piano)', () => {
        const apply = readMigration('173_wpqr_test_data.sql');
        expect(apply).not.toMatch(/pwps_ref|efficiency|rendimento|bead_length|electrode_length/i);
        expect(apply).not.toMatch(/ALTER TABLE dbo\.wpqr_records ADD (wps_id|preheat_temp|interpass_temp|current_type|metal_transfer|heat_input_note)\b/);
    });

    it('174: colonne esattamente come D9 e nessun backfill', () => {
        const apply = readMigration('174_wps_wpqr_links.sql');
        ['id', 'organization_id', 'wps_id', 'wpqr_id', 'role', 'created_at', 'created_by'].forEach((c) => {
            expect(apply).toMatch(new RegExp(`\\n\\s+${c}\\s+`));
        });
        expect(apply).toContain('UNIQUE (wps_id, wpqr_id)');
        expect(apply).toContain('(organization_id, wpqr_id)');
        expect(apply).toMatch(/role\s+NVARCHAR\(20\) NULL/);
    });

    it('numeri 173/174 unici nel repo (nessuna collisione con altre migrazioni)', () => {
        const mains = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^17[34]_/.test(f) && !/_(verify|rollback)\.sql$/.test(f));
        expect(mains.sort()).toEqual(['173_wpqr_test_data.sql', '174_wps_wpqr_links.sql']);
    });
});
