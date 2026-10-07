/**
 * @jest-environment node
 *
 * L1 — runner migrazioni solo-TEST: target hardcoded, doppia conferma, guard config/DB_NAME,
 * gestione USE e 3-part names, allowlist, errore bloccante, check senza scritture.
 * Nessuna connessione reale: pool finto iniettato, .sql fittizi in cartella temporanea.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const runner = require('./run-migrations-test-only');

const { run, MIGRATIONS, TEST_DB, PROD_DB, analyzeSqlFile } = runner;
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const VALID_CFG = {
    test: { server: 'test-host', port: 11043, database: TEST_DB, user: 'sgq_user', password: 'S3cretPw!x', options: {} },
    productions: [{ server: 'prod-host', port: 1433, database: PROD_DB, user: 'sgq_user', password: 'S3cretPw!x' }],
};

const SQL_3_BATCH = [
    'CREATE TABLE t_alpha (id INT);',
    'GO',
    'ALTER TABLE t_alpha ADD col_b INT NULL;',
    'GO',
    'CREATE INDEX IX_alpha_b ON t_alpha (col_b);',
].join('\n');

let tmp;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-only-'));
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
});

function writeSql(files) {
    for (const [num, sqlText] of Object.entries(files)) {
        fs.writeFileSync(path.join(tmp, path.basename(MIGRATIONS[num].file)), sqlText, 'utf8');
    }
}

/**
 * Pool finto che emula PARSEONLY. Registra tutto; `violations` raccoglie ogni scrittura
 * o batch ricevuto fuori da PARSEONLY quando `readOnly` e' true.
 */
function fakePool({ dbName = TEST_DB, readOnly = false, exists = true, failBatchMatching = null, parseErrorMatching = null, probeBroken = false, dbNameAfterWrites = null } = {}) {
    const state = {
        parseOnly: false,
        calls: [],
        queries: [],
        parsed: [],
        writes: [],
        violations: [],
        closed: false,
    };
    const currentDb = () => (dbNameAfterWrites !== null && state.writes.length > 0 ? dbNameAfterWrites : dbName);
    const pool = {
        state,
        close: jest.fn(async () => {
            state.closed = true;
        }),
        request: () => ({
            query: async (sqlText) => {
                state.calls.push({ type: 'query', sql: sqlText });
                state.queries.push(sqlText);
                if (!/^\s*SELECT\b/i.test(sqlText)) state.violations.push(sqlText);
                if (/DB_NAME\(\)/i.test(sqlText)) return { recordset: [{ db_name: currentDb() }] };
                return { recordset: exists ? [{ x: 1 }] : [] };
            },
            batch: async (sqlText) => {
                state.calls.push({ type: 'batch', sql: sqlText });
                if (/^SET PARSEONLY ON$/i.test(sqlText.trim())) {
                    state.parseOnly = true;
                    return { recordset: [] };
                }
                if (/^SET PARSEONLY OFF$/i.test(sqlText.trim())) {
                    state.parseOnly = false;
                    return { recordset: [] };
                }
                if (state.parseOnly) {
                    if (/parse_probe/.test(sqlText)) return { recordset: probeBroken ? [{ parse_probe: 1 }] : [] };
                    state.parsed.push(sqlText);
                    if (parseErrorMatching && parseErrorMatching.test(sqlText)) throw new Error('Incorrect syntax near x');
                    return { recordset: [] };
                }
                if (readOnly) state.violations.push(sqlText);
                if (/XACT_ABORT|@@TRANCOUNT/.test(sqlText)) return { recordset: [] };
                state.writes.push(sqlText);
                if (failBatchMatching && failBatchMatching.test(sqlText)) throw new Error('boom SQL error');
                return { recordset: [] };
            },
        }),
    };
    return pool;
}

function harness(poolOpts, cfg = VALID_CFG) {
    const pool = fakePool(poolOpts);
    const connect = jest.fn().mockResolvedValue(pool);
    const loadConfig = jest.fn().mockReturnValue(cfg);
    return { pool, connect, loadConfig };
}

const out = () => console.log.mock.calls.flat().join('\n');
const errOut = () => console.error.mock.calls.flat().join('\n');

function exec(h, argv, env = {}) {
    return run({ argv, env, connect: h.connect, loadConfig: h.loadConfig, repoRoot: REPO_ROOT });
}

const APPLY_ENV = { SGQ_CONFIRM_TEST_APPLY: TEST_DB };

describe('guard prima di ogni connessione', () => {
    it.each(['prod', '', 'production', 'TEST', 'staging'])('SGQ_MIGRATION_TARGET=%j (diverso da test): exit 1 senza connessioni', async (bad) => {
        writeSql({ 124: SQL_3_BATCH });
        const h = harness();
        const code = await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`], { SGQ_MIGRATION_TARGET: bad });
        expect(code).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
        expect(h.loadConfig).not.toHaveBeenCalled();
    });

    it('SGQ_MIGRATION_TARGET=test e ammessa', async () => {
        writeSql({ 124: SQL_3_BATCH });
        const h = harness({ readOnly: true });
        const code = await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`], { SGQ_MIGRATION_TARGET: 'test' });
        expect(code).toBe(0);
    });

    it.each([[[]], [['--migrations=124']], [['--mode=prod', '--migrations=124']], [['--mode=', '--migrations=124']]])('mode assente o non valido %j: exit 1', async (argv) => {
        const h = harness();
        expect(await exec(h, argv)).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
    });

    it.each([[['--prod']], [['--target=prod']], [['--env=production']], [['--mode=apply']]])('flag non ammesso o ripetuto %j: exit 1', async (extra) => {
        const h = harness();
        expect(await exec(h, ['--mode=check', '--migrations=124', ...extra], APPLY_ENV)).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
    });

    it.each([[{}], [{ SGQ_CONFIRM_TEST_APPLY: '' }], [{ SGQ_CONFIRM_TEST_APPLY: PROD_DB }], [{ SGQ_CONFIRM_TEST_APPLY: `${TEST_DB}_x` }], [{ SGQ_CONFIRM_TEST_APPLY: 'yes' }], [{ SGQ_CONFIRM_TEST_APPLY: TEST_DB.toLowerCase() }]])(
        'apply con conferma %j: exit 1 prima di aprire connessioni',
        async (env) => {
            writeSql({ 124: SQL_3_BATCH });
            const h = harness();
            const code = await exec(h, ['--mode=apply', '--migrations=124', `--file-dir=${tmp}`], env);
            expect(code).toBe(1);
            expect(h.connect).not.toHaveBeenCalled();
            expect(h.loadConfig).not.toHaveBeenCalled();
            expect(errOut()).toMatch(/SGQ_CONFIRM_TEST_APPLY/);
        }
    );

    it('check non richiede la conferma di apply', async () => {
        writeSql({ 124: SQL_3_BATCH });
        const h = harness({ readOnly: true });
        expect(await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`])).toBe(0);
    });
});

describe('guard configurazione e DB_NAME', () => {
    it('config test identica a production (server+database): exit 1 senza connessioni', async () => {
        writeSql({ 124: SQL_3_BATCH });
        const same = { test: { ...VALID_CFG.test }, productions: [{ ...VALID_CFG.test }] };
        const h = harness({}, same);
        expect(await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`])).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
        expect(errOut()).toMatch(/coincide con production/);
    });

    it.each([PROD_DB, 'SGQ_ISO9001_Test', `${TEST_DB}_x`, 'prod_test', TEST_DB.toLowerCase(), ''])('database della sezione test %j diverso dall atteso: exit 1', async (db) => {
        writeSql({ 124: SQL_3_BATCH });
        const cfg = { test: { ...VALID_CFG.test, database: db }, productions: VALID_CFG.productions };
        const h = harness({}, cfg);
        expect(await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`])).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
    });

    it('sezione test assente o config non caricabile: exit 1', async () => {
        writeSql({ 124: SQL_3_BATCH });
        const h1 = harness({}, { productions: [] });
        expect(await exec(h1, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`])).toBe(1);
        const h2 = harness();
        h2.loadConfig.mockImplementation(() => {
            throw new Error('Manca backend/config/database.json');
        });
        expect(await exec(h2, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`])).toBe(1);
        expect(h1.connect).not.toHaveBeenCalled();
        expect(h2.connect).not.toHaveBeenCalled();
    });

    it.each([
        ['x'],
        [PROD_DB],
        [`${TEST_DB}_x`],
        ['prod_test'],
        ['2026-06-18_sgq_iso9001'],
        [''],
    ])('DB_NAME() = %j: exit 1 prima di ogni query di scrittura, in apply e check', async (dbName) => {
        writeSql({ 124: SQL_3_BATCH });
        for (const mode of ['apply', 'check']) {
            const h = harness({ dbName });
            const code = await exec(h, [`--mode=${mode}`, '--migrations=124', `--file-dir=${tmp}`], APPLY_ENV);
            expect(code).toBe(1);
            expect(h.pool.state.calls.every((c) => c.type === 'query' && /^SELECT DB_NAME\(\)/.test(c.sql))).toBe(true);
            expect(h.pool.state.writes).toEqual([]);
            expect(h.pool.state.closed).toBe(true);
        }
    });

    it('DB_NAME() = SGQ_ISO9001 (PROD): messaggio esplicito su PROD', async () => {
        writeSql({ 124: SQL_3_BATCH });
        const h = harness({ dbName: PROD_DB });
        expect(await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`])).toBe(1);
        expect(errOut()).toMatch(/PROD/);
    });

    it('DB_NAME() ricontrollato prima di ogni batch: cambio di contesto a meta apply ferma tutto', async () => {
        writeSql({ 124: SQL_3_BATCH });
        const h = harness({ dbNameAfterWrites: PROD_DB });
        const code = await exec(h, ['--mode=apply', '--migrations=124', `--file-dir=${tmp}`], APPLY_ENV);
        expect(code).toBe(1);
        expect(h.pool.state.writes).toHaveLength(1);
        const types = h.pool.state.calls.map((c) => (c.type === 'query' && /DB_NAME/.test(c.sql) ? 'db' : c.type === 'batch' && !/XACT_ABORT|TRANCOUNT/.test(c.sql) ? 'write' : 'tx'));
        const firstWrite = types.indexOf('write');
        expect(types[firstWrite - 1] === 'tx' && types[firstWrite - 2] === 'db').toBe(true);
    });

    it('una sola connessione per esecuzione e pool limitato a 1', async () => {
        writeSql({ 124: SQL_3_BATCH, 145: SQL_3_BATCH });
        const h = harness();
        await exec(h, ['--mode=apply', '--migrations=124,145', `--file-dir=${tmp}`], APPLY_ENV);
        expect(h.connect).toHaveBeenCalledTimes(1);
        const cfg = h.connect.mock.calls[0][0];
        expect(cfg.pool.max).toBe(1);
        expect(cfg.database).toBe(TEST_DB);
    });

    it('nessun segreto nei log, anche quando il driver li include nell errore', async () => {
        writeSql({ 124: SQL_3_BATCH });
        const h = harness();
        h.connect.mockRejectedValue(new Error("Login failed for user 'sgq_user' password S3cretPw!x host test-host"));
        const code = await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`]);
        expect(code).toBe(1);
        const all = `${out()}\n${errOut()}`;
        expect(all).not.toMatch(/S3cretPw|sgq_user|test-host/);
    });
});

describe('USE e nomi a 3 parti', () => {
    it.each([
        ['USE SGQ_ISO9001;'],
        ['use [SGQ_ISO9001]\n'],
        ['/* nota */ USE [sgq_iso9001] -- commento ;'],
        ['  USE   SGQ_ISO9001'],
    ])('apply: USE verso PROD strippato con log e conteggio (%j)', async (useLine) => {
        writeSql({ 124: `${useLine}\nGO\nCREATE TABLE t_alpha (id INT);\nGO\nALTER TABLE t_alpha ADD col_b INT NULL;` });
        const h = harness();
        const code = await exec(h, ['--mode=apply', '--migrations=124', `--file-dir=${tmp}`], APPLY_ENV);
        expect(code).toBe(0);
        expect(out()).toMatch(/USE SGQ_ISO9001 rimosso \(non eseguito su TEST\)/);
        expect(out()).toMatch(/USE SGQ_ISO9001 rimossi 1,/);
        expect(h.pool.state.writes.some((w) => /\bUSE\b/i.test(w))).toBe(false);
        expect(h.pool.state.writes).toHaveLength(2);
    });

    it('check: USE SGQ_ISO9001 segnalato e mai inviato al server', async () => {
        writeSql({ 124: `USE SGQ_ISO9001;\nGO\nCREATE TABLE t_alpha (id INT);` });
        const h = harness({ readOnly: true });
        const code = await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`]);
        expect(code).toBe(0);
        expect(out()).toMatch(/USE SGQ_ISO9001 rilevato/);
        expect(h.pool.state.parsed.some((p) => /\bUSE\b/i.test(p))).toBe(false);
        expect(h.pool.state.violations).toEqual([]);
    });

    it('USE verso il database TEST stesso e ammesso', async () => {
        writeSql({ 124: `USE [${TEST_DB}];\nGO\nCREATE TABLE t_alpha (id INT);` });
        const h = harness();
        expect(await exec(h, ['--mode=apply', '--migrations=124', `--file-dir=${tmp}`], APPLY_ENV)).toBe(0);
    });

    it.each([
        ['USE [altro_db];'],
        ['USE altro_db'],
        ['USE master;'],
        [`USE [${TEST_DB}_x];`],
        [`USE ${TEST_DB.toLowerCase().replace(/-/g, '_')}`],
        ["EXEC('USE [altro_db]');"],
        ["EXEC('USE SGQ_ISO9001; SELECT 1');"],
    ])('USE non ammesso %j: bloccato, nessuna connessione', async (useLine) => {
        writeSql({ 124: `${useLine}\nGO\nCREATE TABLE t_alpha (id INT);` });
        for (const mode of ['apply', 'check']) {
            const h = harness();
            const code = await exec(h, [`--mode=${mode}`, '--migrations=124', `--file-dir=${tmp}`], APPLY_ENV);
            expect(code).toBe(1);
            expect(h.connect).not.toHaveBeenCalled();
            expect(errOut()).toMatch(/riga 1/);
        }
    });

    it.each([
        ['SELECT * FROM [SGQ_ISO9001].dbo.attachments;'],
        ['SELECT * FROM SGQ_ISO9001.dbo.attachments;'],
        ['SELECT * FROM sgq_iso9001..attachments;'],
        ['INSERT INTO [SGQ_ISO9001].[dbo].[t] (a) VALUES (1);'],
        ["EXEC('SELECT * FROM SGQ_ISO9001.dbo.t');"],
    ])('3-part name verso SGQ_ISO9001 %j: bloccato con numero di riga', async (stmt) => {
        writeSql({ 124: `CREATE TABLE t_alpha (id INT);\nGO\n${stmt}` });
        const h = harness();
        const code = await exec(h, ['--mode=apply', '--migrations=124', `--file-dir=${tmp}`], APPLY_ENV);
        expect(code).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
        expect(errOut()).toMatch(/riga 3: nome a 3 parti verso SGQ_ISO9001/);
    });

    it('il nome del DB TEST (che contiene SGQ_ISO9001) non e scambiato per PROD', () => {
        const a = analyzeSqlFile(`SELECT * FROM [${TEST_DB}].dbo.t;\nSELECT DB_ID('${TEST_DB}');`);
        expect(a.findings).toEqual([]);
    });

    it('USE solo in commenti o hint di query non e un finding', () => {
        const a = analyzeSqlFile("-- USE altro_db\n/* USE master */\nSELECT 1 OPTION (USE HINT('FORCE_LEGACY_CARDINALITY_ESTIMATION'));\nPRINT 'ok';");
        expect(a.findings).toEqual([]);
    });

    it.each([
        ['SET PARSEONLY OFF;'],
        ['SET NOEXEC OFF;'],
        ['EXEC xp_cmdshell \'dir\';'],
        ['BACKUP DATABASE x TO DISK = \'y\';'],
        ['ALTER DATABASE x SET OFFLINE;'],
    ])('comando di sessione/server non ammesso %j: bloccato', async (stmt) => {
        writeSql({ 124: `CREATE TABLE t_alpha (id INT);\nGO\n${stmt}` });
        const h = harness();
        expect(await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`])).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
    });

    it('GO <n> e commenti non terminati sono bloccati', async () => {
        writeSql({ 124: 'SELECT 1;\nGO 5\n' });
        const h = harness();
        expect(await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`])).toBe(1);
        writeSql({ 124: 'SELECT 1; /* aperto' });
        expect(await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`])).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
    });

    it('GO e riconosciuto case-insensitive e non dentro commenti o stringhe', () => {
        const a = analyzeSqlFile("SELECT 1;\ngo\nSELECT 2;\n/*\nGO\n*/\nSELECT '\nGO\n';\n  GO  -- fine\nSELECT 3;");
        expect(a.batches.map((b) => b.empty)).toEqual([false, false, false]);
    });
});

describe('allowlist e dipendenze', () => {
    it.each([['167'], ['999'], ['001'], ['162'], ['163']])('numero %s fuori allowlist: exit 1 senza connessioni', async (n) => {
        const h = harness();
        expect(await exec(h, ['--mode=check', `--migrations=${n}`, `--file-dir=${tmp}`])).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
        expect(errOut()).toMatch(/fuori allowlist/);
    });

    it.each(['../../etc/passwd', '110;DROP', 'abc', '1100', ''])('valore --migrations non numerico %j: exit 1', async (v) => {
        const h = harness();
        expect(await exec(h, ['--mode=check', `--migrations=${v}`])).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
    });

    it.each(['112', '113'])('migrazione %s missing_sql: errore chiaro senza eseguire nulla', async (n) => {
        writeSql({ 124: SQL_3_BATCH });
        for (const mode of ['check', 'apply']) {
            const h = harness();
            const code = await exec(h, [`--mode=${mode}`, `--migrations=124,${n}`, `--file-dir=${tmp}`], APPLY_ENV);
            expect(code).toBe(1);
            expect(h.connect).not.toHaveBeenCalled();
            expect(errOut()).toMatch(new RegExp(`${n}: \\.sql mancante: serve estrazione dal runner`));
        }
    });

    it('dipendenza violata (118 prima di 098): exit 1 senza connessioni', async () => {
        writeSql({ 118: SQL_3_BATCH, '098': SQL_3_BATCH });
        const h = harness();
        expect(await exec(h, ['--mode=check', '--migrations=118,098', `--file-dir=${tmp}`])).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
        expect(errOut()).toMatch(/118 richiede 098/);
    });

    it('ordine corretto 098,118 accettato; ordine fuori batch solo WARNING', async () => {
        writeSql({ 118: SQL_3_BATCH, '098': SQL_3_BATCH, 107: SQL_3_BATCH });
        const ok = harness({ readOnly: true });
        expect(await exec(ok, ['--mode=check', '--migrations=098,118', `--file-dir=${tmp}`])).toBe(0);
        const warn = harness({ readOnly: true });
        expect(await exec(warn, ['--mode=check', '--migrations=107,098', `--file-dir=${tmp}`])).toBe(0);
        expect(out()).toMatch(/WARNING ordine: 098 \(batch B1\) dopo 107 \(batch C\)/);
    });

    it('esegue nell ordine di --migrations', async () => {
        writeSql({ 124: 'CREATE TABLE first_t (id INT);', 145: 'CREATE TABLE second_t (id INT);' });
        const h = harness();
        expect(await exec(h, ['--mode=apply', '--migrations=145,124', `--file-dir=${tmp}`], APPLY_ENV)).toBe(0);
        expect(h.pool.state.writes).toEqual(['CREATE TABLE second_t (id INT);', 'CREATE TABLE first_t (id INT);']);
    });

    it('file .sql assente in --file-dir: exit 1 senza connessioni', async () => {
        const h = harness();
        expect(await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`])).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
    });

    it('i .sql non vengono mai modificati', async () => {
        writeSql({ 117: 'USE SGQ_ISO9001;\nGO\nCREATE TABLE t_alpha (id INT);' });
        const file = path.join(tmp, path.basename(MIGRATIONS['117'].file));
        const before = fs.readFileSync(file, 'utf8');
        await exec(harness(), ['--mode=apply', '--migrations=117', `--file-dir=${tmp}`], APPLY_ENV);
        expect(fs.readFileSync(file, 'utf8')).toBe(before);
    });
});

describe('esecuzione apply', () => {
    it('errore SQL a meta: stop immediato, rollback, nessun batch successivo, exit 1', async () => {
        writeSql({ 124: SQL_3_BATCH, 145: SQL_3_BATCH });
        const h = harness({ failBatchMatching: /ALTER TABLE t_alpha ADD col_b/ });
        const code = await exec(h, ['--mode=apply', '--migrations=124,145', `--file-dir=${tmp}`], APPLY_ENV);
        expect(code).toBe(1);
        expect(h.pool.state.writes).toHaveLength(2);
        expect(h.pool.state.writes.some((w) => /CREATE INDEX/.test(w))).toBe(false);
        expect(h.pool.state.calls.some((c) => /ROLLBACK TRANSACTION/.test(c.sql))).toBe(true);
        expect(errOut()).toMatch(/errore SQL al batch 2\/3/);
        expect(out()).not.toMatch(/apply completato|apply 124: batch eseguiti/);
        expect(h.pool.state.closed).toBe(true);
    });

    it('ogni batch gira in transazione con DB_NAME() ricontrollato subito prima', async () => {
        writeSql({ 124: SQL_3_BATCH });
        const h = harness();
        expect(await exec(h, ['--mode=apply', '--migrations=124', `--file-dir=${tmp}`], APPLY_ENV)).toBe(0);
        const c = h.pool.state.calls;
        const idx = c.map((x, i) => (x.type === 'batch' && /BEGIN TRANSACTION/.test(x.sql) ? i : -1)).filter((i) => i >= 0);
        expect(idx).toHaveLength(3);
        for (const i of idx) {
            expect(c[i - 1].sql).toMatch(/DB_NAME\(\)/);
            expect(c[i + 2].sql).toMatch(/COMMIT TRANSACTION/);
        }
    });

    it('stampa solo conteggi e sha256, non il testo SQL ne dati', async () => {
        writeSql({ 124: 'CREATE TABLE t_alpha (id INT); -- contenuto_riservato_xyz' });
        const h = harness();
        expect(await exec(h, ['--mode=apply', '--migrations=124', `--file-dir=${tmp}`], APPLY_ENV)).toBe(0);
        expect(out()).toMatch(/apply 124: batch eseguiti 1\/1, USE SGQ_ISO9001 rimossi 0, oggetti verificati 1\/1/);
        expect(out()).toMatch(/sha256=[0-9a-f]{64}/);
        expect(out()).not.toMatch(/contenuto_riservato_xyz|CREATE TABLE/);
    });

    it('verifica post-apply fallita (oggetto atteso assente): exit 1, nessun successo', async () => {
        writeSql({ 124: 'CREATE TABLE t_alpha (id INT);', 145: 'CREATE TABLE t_beta (id INT);' });
        const h = harness({ exists: false });
        const code = await exec(h, ['--mode=apply', '--migrations=124,145', `--file-dir=${tmp}`], APPLY_ENV);
        expect(code).toBe(1);
        expect(errOut()).toMatch(/verifica fallita, mancano tabella t_alpha/);
        expect(h.pool.state.writes).toHaveLength(1);
        expect(out()).not.toMatch(/apply completato/);
    });

    it('batch vuoti (solo USE rimosso o commenti) non vengono eseguiti', async () => {
        writeSql({ 124: 'USE SGQ_ISO9001;\nGO\n-- solo commento\nGO\nCREATE TABLE t_alpha (id INT);\nGO\n' });
        const h = harness();
        expect(await exec(h, ['--mode=apply', '--migrations=124', `--file-dir=${tmp}`], APPLY_ENV)).toBe(0);
        expect(h.pool.state.writes).toEqual(['CREATE TABLE t_alpha (id INT);\n']);
    });
});

describe('modalita check', () => {
    it('non esegue mai query di scrittura: ogni batch arriva solo sotto SET PARSEONLY ON, il resto sono SELECT', async () => {
        writeSql({ 124: SQL_3_BATCH, 117: `USE SGQ_ISO9001;\nGO\n${SQL_3_BATCH}` });
        const h = harness({ readOnly: true, exists: false });
        const code = await exec(h, ['--mode=check', '--migrations=124,117', `--file-dir=${tmp}`]);
        expect(code).toBe(0);
        const s = h.pool.state;
        expect(s.violations).toEqual([]);
        expect(s.writes).toEqual([]);
        expect(s.parsed).toHaveLength(6);
        expect(s.parseOnly).toBe(false);
        s.queries.forEach((q) => expect(q.trim()).toMatch(/^SELECT\b/i));
        const batches = s.calls.filter((c) => c.type === 'batch').map((c) => c.sql);
        expect(batches.filter((b) => /^SET PARSEONLY (ON|OFF)$/.test(b))).toHaveLength(12);
        expect(out()).toMatch(/oggetti attesi 3, mancanti 3 \(tabella t_alpha; colonna t_alpha\.col_b; indice IX_alpha_b\)/);
        expect(out()).toMatch(/nessun DDL\/DML eseguito/);
    });

    it('il pool finto di sola lettura rileva davvero una scrittura (sanity del test)', async () => {
        const pool = fakePool({ readOnly: true });
        await pool.request().batch('CREATE TABLE x (id INT)');
        expect(pool.state.violations).toHaveLength(1);
    });

    it('errore di sintassi in parse: exit 1, gli altri batch vengono comunque verificati, nessuna scrittura', async () => {
        writeSql({ 124: SQL_3_BATCH });
        const h = harness({ readOnly: true, parseErrorMatching: /ALTER TABLE/ });
        const code = await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`]);
        expect(code).toBe(1);
        expect(h.pool.state.parsed).toHaveLength(3);
        expect(h.pool.state.violations).toEqual([]);
        expect(errOut()).toMatch(/batch 2 \(riga 3\)/);
    });

    it('PARSEONLY non effettivo (probe restituisce righe): abort prima di inviare il batch', async () => {
        writeSql({ 124: SQL_3_BATCH });
        const h = harness({ readOnly: true, probeBroken: true });
        const code = await exec(h, ['--mode=check', '--migrations=124', `--file-dir=${tmp}`]);
        expect(code).toBe(1);
        expect(h.pool.state.parsed).toEqual([]);
        expect(h.pool.state.violations).toEqual([]);
        expect(errOut()).toMatch(/PARSEONLY non attivo/);
    });
});

describe('analisi statica dei file reali (senza eseguirli)', () => {
    const planNumbers = ['110', '124', '145', '117', '122', '136', '138', '128', '112', '098', '118', '113', '121', '125', '134', '135', '153', '107', '109', '126', '119', '108'];
    const withSql = Object.entries(MIGRATIONS).filter(([, e]) => e.file);

    it('l allowlist copre tutte le migrazioni dei batch A, B1, B2, C del piano e nulla di piu', () => {
        expect(Object.keys(MIGRATIONS).sort()).toEqual([...planNumbers].sort());
    });

    it('missing_sql esattamente 112 e 113, con motivo', () => {
        const missing = Object.entries(MIGRATIONS).filter(([, e]) => !e.file);
        expect(missing.map(([n]) => n).sort()).toEqual(['112', '113']);
        missing.forEach(([, e]) => expect(e.missingReason).toMatch(/runner/));
    });

    it.each(withSql.map(([n, e]) => [n, e.file]))('migrazione %s: %s esiste nel repo', (n, file) => {
        expect(fs.existsSync(path.join(REPO_ROOT, file))).toBe(true);
        expect(file).toMatch(/^(backend\/)?database\/migrations\/\d{3}_[\w]+\.sql$/);
        expect(path.basename(file).slice(0, 3)).toBe(n);
    });

    it.each(withSql.map(([n, e]) => [n, e.file]))('migrazione %s: nessun finding bloccante', (n, file) => {
        const a = analyzeSqlFile(fs.readFileSync(path.join(REPO_ROOT, file), 'utf8'));
        const blocking = a.findings.filter((f) => !['use_prod', 'use_test'].includes(f.kind));
        expect(blocking).toEqual([]);
        expect(a.batches.some((b) => !b.empty)).toBe(true);
    });

    it.each(['117', '118', '134', '135', '138'])('migrazione %s: USE SGQ_ISO9001 riconosciuto, strippato e non eseguito', (n) => {
        const a = analyzeSqlFile(fs.readFileSync(path.join(REPO_ROOT, MIGRATIONS[n].file), 'utf8'));
        expect(a.findings.filter((f) => f.kind === 'use_prod')).toHaveLength(1);
        expect(a.useRemoved).toBe(1);
        a.batches.forEach((b) => expect(analyzeSqlFile(b.text).findings).toEqual([]));
    });

    it('i file senza USE non producono alcun finding', () => {
        const noUse = withSql.map(([n]) => n).filter((n) => !['117', '118', '134', '135', '138'].includes(n));
        for (const n of noUse) {
            const a = analyzeSqlFile(fs.readFileSync(path.join(REPO_ROOT, MIGRATIONS[n].file), 'utf8'));
            expect(a.findings).toEqual([]);
        }
    });

    it('check sui file reali con pool finto: nessuna scrittura (ramo 098 -> 118 con USE)', async () => {
        const h = harness({ readOnly: true });
        const code = await run({
            argv: ['--mode=check', '--migrations=098,118,117,134,135,138,110'],
            env: {},
            connect: h.connect,
            loadConfig: h.loadConfig,
            repoRoot: REPO_ROOT,
        });
        expect(code).toBe(0);
        expect(h.pool.state.violations).toEqual([]);
        expect(h.pool.state.parsed.some((p) => /\bUSE\s+\[?SGQ_ISO9001/i.test(p))).toBe(false);
        expect((out().match(/USE SGQ_ISO9001 rilevato/g) || []).length).toBe(5);
    });
});

describe('igiene del sorgente del runner', () => {
    const src = fs.readFileSync(path.join(__dirname, 'run-migrations-test-only.js'), 'utf8');

    it('nessun sqlcmd, child_process, path VPS o flag prod', () => {
        expect(src).not.toMatch(/child_process|sqlcmd|spawn\(|execSync/);
        expect(src).not.toMatch(/\/var\/www/);
        expect(src).not.toMatch(/--prod|'prod'|"prod"/);
    });

    it('il nome del DB PROD compare solo come costante di guard', () => {
        expect(src.match(/const PROD_DB = 'SGQ_ISO9001';/g)).toHaveLength(1);
        expect(src).toContain("const TEST_DB = '2026-06-18_SGQ_ISO9001';");
    });

    it('confronto DB_NAME esatto, non includes', () => {
        expect(src).toMatch(/name === TEST_DB/);
        expect(src).not.toMatch(/\.includes\(\s*TEST_DB|\.includes\(\s*PROD_DB/);
    });
});
