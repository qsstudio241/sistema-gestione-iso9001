/**
 * @jest-environment node
 *
 * L1 — hardening runner VPS 158/159: target obbligatorio, .env per target,
 * guard DB, CHECK_ONLY senza scritture. Nessuna connessione reale: pool finto iniettato.
 */
const fs = require('fs');
const path = require('path');

const RUNNERS = [
    { n: 158, expectedMissing: 6, sample: 'thickness_t1_min' },
    { n: 159, expectedMissing: 3, sample: 'qualifying_element' },
].map((r) => ({
    ...r,
    file: path.join(__dirname, `run-migration-${r.n}-vps.js`),
    mod: require(`./run-migration-${r.n}-vps.js`),
}));

function fakePool({ dbName, existingColumns = [] }) {
    const queries = [];
    const pool = {
        queries,
        close: jest.fn().mockResolvedValue(undefined),
        request: () => ({
            query: async (sql) => {
                queries.push(sql);
                if (/DB_NAME\(\)/i.test(sql)) return { recordset: [{ db_name: dbName }] };
                const m = /COLUMN_NAME = '([^']+)'/.exec(sql);
                if (m && /SELECT 1 AS x/i.test(sql)) {
                    return { recordset: existingColumns.includes(m[1]) ? [{ x: 1 }] : [] };
                }
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

describe.each(RUNNERS)('runner migrazione $n', ({ n, file, mod, expectedMissing, sample }) => {
    let errSpy;
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    it('target mancante: exit 1 senza caricare backend né aprire connessioni', async () => {
        const { loadBackend, getPool } = makeLoader(fakePool({ dbName: 'x' }));
        const code = await mod.run({ env: {}, loadBackend });
        expect(code).toBe(1);
        expect(loadBackend).not.toHaveBeenCalled();
        expect(getPool).not.toHaveBeenCalled();
        expect(errSpy.mock.calls.flat().join(' ')).toMatch(/SGQ_MIGRATION_TARGET/);
    });

    it.each(['', 'staging', 'PROD', 'Test', ' prod', 'production', '1'])(
        'target non ammesso %j: exit 1 senza connessione',
        async (bad) => {
            const { loadBackend, getPool } = makeLoader(fakePool({ dbName: 'x' }));
            const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: bad }, loadBackend });
            expect(code).toBe(1);
            expect(loadBackend).not.toHaveBeenCalled();
            expect(getPool).not.toHaveBeenCalled();
        }
    );

    it('prod e test selezionano root e .env diversi', () => {
        const prod = mod.resolveTarget({ SGQ_MIGRATION_TARGET: 'prod' });
        const test = mod.resolveTarget({ SGQ_MIGRATION_TARGET: 'test' });
        expect(prod.envFile).toBe('/var/www/sgq-backend/.env');
        expect(test.envFile).toBe('/var/www/sgq-backend-test/.env.test');
        expect(prod.backendRoot).not.toBe(test.backendRoot);
        expect(prod.checkOnly).toBe(false);
    });

    it('run() passa a loadBackend i path del target scelto', async () => {
        for (const [target, root, envFile, db] of [
            ['test', '/var/www/sgq-backend-test', '/var/www/sgq-backend-test/.env.test', 'SGQ_ISO9001_Test'],
            ['prod', '/var/www/sgq-backend', '/var/www/sgq-backend/.env', 'SGQ_ISO9001'],
        ]) {
            const { loadBackend } = makeLoader(fakePool({ dbName: db }));
            const code = await mod.run({
                env: { SGQ_MIGRATION_TARGET: target, CHECK_ONLY: '1' },
                loadBackend,
            });
            expect(code).toBe(0);
            expect(loadBackend).toHaveBeenCalledWith(root, envFile);
        }
    });

    it('guard DB: mismatch target/DB → exit 1 prima di qualsiasi DDL', async () => {
        const cases = [
            ['prod', 'SGQ_ISO9001_Test'],
            ['test', 'SGQ_ISO9001'],
        ];
        for (const [target, db] of cases) {
            const pool = fakePool({ dbName: db });
            const { loadBackend } = makeLoader(pool);
            const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: target }, loadBackend });
            expect(code).toBe(1);
            expect(pool.queries.some((q) => /ALTER\s+TABLE/i.test(q))).toBe(false);
            expect(pool.close).toHaveBeenCalled();
        }
    });

    it.each(['1', 'true'])('CHECK_ONLY=%s: solo SELECT, nessun DDL/DML, exit 0, elenca le mancanti', async (v) => {
        const pool = fakePool({ dbName: 'SGQ_ISO9001_Test' });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({
            env: { SGQ_MIGRATION_TARGET: 'test', CHECK_ONLY: v },
            loadBackend,
        });
        expect(code).toBe(0);
        expect(pool.queries.length).toBeGreaterThan(0);
        pool.queries.forEach((q) => {
            expect(q.trim()).toMatch(/^SELECT\b/i);
            expect(q).not.toMatch(/\b(ALTER|CREATE|DROP|INSERT|UPDATE|DELETE|EXEC|MERGE)\b/i);
        });
        const out = console.log.mock.calls.flat().join('\n');
        expect(out).toContain(`mancano ${expectedMissing} colonne`);
        expect(out).toContain(sample);
        expect(out).toMatch(/nessun DDL eseguito/);
    });

    it('CHECK_ONLY con colonne già presenti: exit 0 e nessuna mancante', async () => {
        const pool = fakePool({ dbName: 'SGQ_ISO9001_Test', existingColumns: mod.COLUMNS.map((c) => c.name) });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({
            env: { SGQ_MIGRATION_TARGET: 'test', CHECK_ONLY: '1' },
            loadBackend,
        });
        expect(code).toBe(0);
        expect(console.log.mock.calls.flat().join('\n')).toMatch(/nessuna colonna mancante/);
    });

    it('senza CHECK_ONLY esegue i DDL solo per le colonne mancanti (idempotenza)', async () => {
        const present = mod.COLUMNS.slice(0, 1).map((c) => c.name);
        const pool = fakePool({ dbName: 'SGQ_ISO9001_Test', existingColumns: present });
        const { loadBackend } = makeLoader(pool);
        const code = await mod.run({ env: { SGQ_MIGRATION_TARGET: 'test' }, loadBackend });
        expect(code).toBe(0);
        const ddl = pool.queries.filter((q) => /ALTER\s+TABLE/i.test(q));
        expect(ddl).toHaveLength(mod.COLUMNS.length - 1);
    });

    it('nessun path PROD hardcoded fuori dalle costanti del target', () => {
        const src = fs.readFileSync(file, 'utf8');
        expect(src.match(/'\/var\/www\/sgq-backend'/g)).toHaveLength(1);
        expect(src).not.toMatch(/require\(\s*['"`]\/var\/www/);
        expect(src).toContain(`node /tmp/run-migration-${n}-vps.js`);
        expect(src).toContain('CHECK_ONLY=1');
    });
});
