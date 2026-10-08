#!/usr/bin/env node
'use strict';

/**
 * Runner migrazioni SOLO-TEST (riusabile, versionato).
 *
 * Applica (o verifica) i `.sql` di una allowlist esplicita sul database TEST
 * `2026-06-18_SGQ_ISO9001`. Il target e' hardcoded: non esiste un flag per PROD.
 *
 *   node backend/scripts/run-migrations-test-only.js --mode=check --migrations=110,124,145
 *   SGQ_CONFIRM_TEST_APPLY=2026-06-18_SGQ_ISO9001 \
 *     node backend/scripts/run-migrations-test-only.js --mode=apply --migrations=110,124 [--file-dir=<dir>]
 *
 * - `--mode` obbligatorio (check | apply). `apply` richiede SGQ_CONFIRM_TEST_APPLY uguale al DB atteso.
 * - `--migrations`: numeri in allowlist (ordine di esecuzione = ordine indicato).
 * - `--file-dir`: cartella con i `.sql` estratti da origin/main (layout repo o piatta, per nome file);
 *   senza il flag si leggono i file del checkout. Mai path arbitrari: i nomi vengono solo dalla allowlist.
 * - SGQ_MIGRATION_TARGET, se impostata, deve valere `test`.
 * - Connessione: `backend/config/database.json` sezione `test` (come l'app, con override DB_*); una sola connessione.
 *
 * `check` non esegue DDL/DML: `SET PARSEONLY ON` batch per batch + SELECT su INFORMATION_SCHEMA/sys.*.
 * `apply` esegue un batch GO alla volta in transazione (SET XACT_ABORT ON, BEGIN/COMMIT): ogni statement
 * ammesso dal filtro (niente BACKUP/ALTER DATABASE/ecc.) e' transazionale in SQL Server, quindi un errore
 * annulla il batch e il runner si ferma. Un errore SQL non produce mai un esito di successo.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEST_DB = '2026-06-18_SGQ_ISO9001';
const PROD_DB = 'SGQ_ISO9001';
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LOG = '[migrazioni-test-only]';

const MIG = 'database/migrations/';
const BMIG = 'backend/database/migrations/';
const BATCH_RANK = { A: 0, B1: 1, B2: 2, C: 3, D: 4 };

/**
 * Allowlist: numero -> sorgente. `file` = percorso relativo alla root del repo;
 * `missingReason` = nessun `.sql` nel repo (non si inventa SQL). `after` = dipendenze dure
 * (devono precedere se entrambe richieste). `batch` = ordine del piano
 * docs/reference/PIANO_ALLINEAMENTO_SCHEMA_TEST_2026-10-07.md.
 * 112 e 113: `.sql` versionati in database/migrations/ (DDL dai runner 112 e 113).
 */
const MIGRATIONS = {
    '110': { batch: 'A', file: `${BMIG}110_welding_books.sql` },
    '124': { batch: 'A', file: `${MIG}124_context_factors_interested_parties.sql` },
    '145': { batch: 'A', file: `${MIG}145_company_profile.sql` },
    '117': { batch: 'A', file: `${MIG}117_sal_gap_implementation_status.sql` },
    '122': { batch: 'A', file: `${MIG}122_qualifications_14732_fields.sql` },
    '136': { batch: 'A', file: `${MIG}136_qualifications_transfer_mode.sql` },
    '138': { batch: 'A', file: `${MIG}138_custom_checklist_sections_legal_reference.sql` },
    '128': { batch: 'A', file: `${MIG}128_projects_technical_review_checklist.sql` },
    '112': { batch: 'A', file: `${MIG}112_management_reviews_input_monitoring.sql` },
    '098': { batch: 'B1', file: `${MIG}098_nc_action_plan.sql` },
    '118': { batch: 'B1', file: `${MIG}118_nc_source_category_sal_gap.sql`, after: ['098'] },
    '113': { batch: 'B2', file: `${MIG}113_nc_management_review_id.sql` },
    '121': { batch: 'B2', file: `${MIG}121_nc_correction_gate.sql` },
    '125': { batch: 'B2', file: `${MIG}125_nc_source_risk_id.sql` },
    '134': { batch: 'B2', file: `${MIG}134_nc_company_scope.sql` },
    '135': { batch: 'B2', file: `${MIG}135_nc_effectiveness_verification.sql` },
    '153': { batch: 'B2', file: `${MIG}153_nc_project_id.sql` },
    '107': { batch: 'C', file: `${BMIG}107_ndt_report_items_notes.sql` },
    '109': { batch: 'C', file: `${BMIG}109_ndt_reports_supplier.sql` },
    '126': { batch: 'C', file: `${MIG}126_ndt_reports_number_index_fix.sql` },
    '119': { batch: 'C', file: `${BMIG}119_norm_title_widen.sql` },
    '108': { batch: 'C', file: `${BMIG}108_attachments_ndt_item.sql` },
    '120': { batch: 'D', file: `${MIG}120_ingest_reference_patterns.sql` },
    '144': { batch: 'D', file: `${MIG}144_auditor_orgs_email_unique.sql` },
    '170': { batch: 'D', file: `${MIG}170_attachments_ndt_item_index.sql` },
    '171': { batch: 'D', file: `${MIG}171_management_reviews_input_columns.sql` },
};

class FatalRunnerError extends Error {}

const IDENT = '(?:\\[(?:[^\\]]|\\]\\])+\\]|"[^"]+"|[A-Za-z0-9_$#@]+)';
const CROSS_DB_PROD_RE = /(?<![\w\-@#$])\[?SGQ_ISO9001\]?\s*\.\s*\[?[\w$#@]*\]?\s*\./gi;
const FORBIDDEN_RES = [
    ['session_set', /\bSET\s+(?:PARSEONLY|NOEXEC|FMTONLY)\b/gi],
    ['forbidden', /\b(?:xp_cmdshell|sp_configure|sp_addlinkedserver|OPENROWSET|OPENDATASOURCE|OPENQUERY|RECONFIGURE|SHUTDOWN|DBCC)\b/gi],
    ['forbidden', /\b(?:BACKUP|RESTORE)\s+(?:DATABASE|LOG)\b/gi],
    ['forbidden', /\b(?:ALTER|CREATE|DROP)\s+DATABASE\b/gi],
];

function unbracket(raw) {
    if (raw.startsWith('[') && raw.endsWith(']')) return raw.slice(1, -1).replace(/\]\]/g, ']');
    if (raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
    return raw;
}

/**
 * Maschera commenti (-- e annidati) e contenuto dei letterali con spazi, preservando offset e newline.
 * Gli identificatori fra parentesi quadre restano visibili.
 */
function scanSql(text) {
    const out = text.split('');
    const literals = [];
    const n = text.length;
    let unterminated = false;
    const blank = (from, to) => {
        for (let k = from; k < to; k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
    };
    let i = 0;
    while (i < n) {
        const c = text[i];
        const d = text[i + 1];
        if (c === '-' && d === '-') {
            let j = i;
            while (j < n && text[j] !== '\n') j++;
            blank(i, j);
            i = j;
        } else if (c === '/' && d === '*') {
            let depth = 1;
            let j = i + 2;
            while (j < n && depth > 0) {
                if (text[j] === '/' && text[j + 1] === '*') {
                    depth++;
                    j += 2;
                } else if (text[j] === '*' && text[j + 1] === '/') {
                    depth--;
                    j += 2;
                } else j++;
            }
            if (depth > 0) unterminated = true;
            blank(i, j);
            i = j;
        } else if (c === "'") {
            let j = i + 1;
            let closed = false;
            while (j < n) {
                if (text[j] === "'") {
                    if (text[j + 1] === "'") {
                        j += 2;
                        continue;
                    }
                    closed = true;
                    break;
                }
                j++;
            }
            if (!closed) unterminated = true;
            literals.push({ start: i + 1, content: text.slice(i + 1, j) });
            blank(i + 1, j);
            i = closed ? j + 1 : n;
        } else if (c === '[') {
            let j = i + 1;
            while (j < n) {
                if (text[j] === ']') {
                    if (text[j + 1] === ']') {
                        j += 2;
                        continue;
                    }
                    break;
                }
                j++;
            }
            i = j + 1;
        } else {
            i++;
        }
    }
    return { masked: out.join(''), literals, unterminated };
}

function lineAt(text, index) {
    let line = 1;
    for (let k = 0; k < index && k < text.length; k++) if (text[k] === '\n') line++;
    return line;
}

/** Split su `GO` a inizio riga (case-insensitive, fuori da commenti/letterali). */
function splitBatches(text, masked) {
    const batches = [];
    const findings = [];
    let start = 0;
    let offset = 0;
    const lines = masked.split('\n');
    const push = (end) => {
        batches.push({ text: text.slice(start, end), masked: masked.slice(start, end), startIndex: start });
    };
    lines.forEach((ln, idx) => {
        const m = /^\s*GO(?:\s+(\d+))?\s*$/i.exec(ln);
        if (m) {
            if (m[1]) findings.push({ kind: 'go_count', line: idx + 1 });
            push(offset);
            start = offset + ln.length + 1;
        }
        offset += ln.length + 1;
    });
    push(text.length);
    return { batches, findings };
}

function isEmptyBatch(batchText) {
    const { masked } = scanSql(batchText);
    return masked.replace(/[\s;]/g, '').length === 0;
}

const BLOCKING_KINDS = new Set([
    'use_other',
    'use_dynamic',
    'cross_db_prod',
    'session_set',
    'forbidden',
    'go_count',
    'unterminated',
    'encoding',
]);

const KIND_LABEL = {
    use_other: 'USE verso database diverso dal TEST',
    use_dynamic: 'USE in SQL dinamico',
    cross_db_prod: 'nome a 3 parti verso SGQ_ISO9001 (PROD)',
    session_set: 'SET PARSEONLY/NOEXEC/FMTONLY non ammesso',
    forbidden: 'comando di server/database non ammesso',
    go_count: 'GO <n> non supportato',
    unterminated: 'commento o stringa non terminati',
    encoding: 'file non UTF-8 (NUL presenti)',
};

/**
 * Analizza un file .sql: batch, findings (USE, 3-part, comandi vietati) e testo ripulito dagli USE verso PROD.
 * Non esegue nulla.
 */
function analyzeSqlFile(rawText) {
    const text = rawText.replace(/^\uFEFF/, '');
    const findings = [];
    if (text.includes('\u0000')) {
        return { batches: [], findings: [{ kind: 'encoding', line: 1 }], useRemoved: 0, useTest: 0 };
    }
    const scanned = scanSql(text);
    if (scanned.unterminated) findings.push({ kind: 'unterminated', line: 1 });
    const split = splitBatches(text, scanned.masked);
    findings.push(...split.findings);

    for (const lit of scanned.literals) {
        const line = lineAt(text, lit.start);
        if (new RegExp(CROSS_DB_PROD_RE.source, 'i').test(lit.content)) findings.push({ kind: 'cross_db_prod', line, dynamic: true });
        if (new RegExp(`(?:^|[;\\n])\\s*USE\\s+${IDENT}\\s*(?:;|$)`, 'i').test(lit.content)) {
            findings.push({ kind: 'use_dynamic', line });
        }
        for (const [kind, re] of FORBIDDEN_RES) {
            if (new RegExp(re.source, 'i').test(lit.content)) findings.push({ kind, line });
        }
    }

    let useRemoved = 0;
    let useTest = 0;
    const batches = [];
    for (const b of split.batches) {
        let sanitized = b.text;
        const edits = [];
        const useRe = new RegExp(`\\bUSE\\s+(${IDENT})`, 'gi');
        let m;
        while ((m = useRe.exec(b.masked)) !== null) {
            const name = unbracket(m[1]);
            if (/^(HINT|PLAN)$/i.test(name)) continue;
            const line = lineAt(text, b.startIndex + m.index);
            if (name.toLowerCase() === PROD_DB.toLowerCase()) {
                edits.push({ from: m.index, to: m.index + m[0].length });
                useRemoved++;
                findings.push({ kind: 'use_prod', line, db: name });
            } else if (name === TEST_DB) {
                useTest++;
                findings.push({ kind: 'use_test', line, db: name });
            } else {
                findings.push({ kind: 'use_other', line });
            }
        }
        for (const e of edits.sort((x, y) => y.from - x.from)) {
            sanitized = sanitized.slice(0, e.from) + ' '.repeat(e.to - e.from) + sanitized.slice(e.to);
        }
        const crossRe = new RegExp(CROSS_DB_PROD_RE.source, 'gi');
        while ((m = crossRe.exec(b.masked)) !== null) {
            findings.push({ kind: 'cross_db_prod', line: lineAt(text, b.startIndex + m.index) });
        }
        for (const [kind, re] of FORBIDDEN_RES) {
            const r = new RegExp(re.source, 'gi');
            while ((m = r.exec(b.masked)) !== null) {
                findings.push({ kind, line: lineAt(text, b.startIndex + m.index) });
            }
        }
        batches.push({
            text: sanitized,
            masked: b.masked,
            startLine: lineAt(text, b.startIndex),
            empty: isEmptyBatch(sanitized),
        });
    }
    return { batches, findings, useRemoved, useTest };
}

const OBJ_NAME_RE = /^[A-Za-z0-9_]+$/;

/** Oggetti che la migrazione dovrebbe creare, ricavati staticamente (tabelle, colonne, vincoli, indici). */
function extractExpectedObjects(batches) {
    const found = new Map();
    const add = (o) => found.set(`${o.type}:${o.table || ''}:${o.name}`, o);
    const tbl = `(?:\\[?dbo\\]?\\s*\\.\\s*)?\\[?([A-Za-z0-9_]+)\\]?`;
    for (const b of batches) {
        let m;
        const createTable = new RegExp(`\\bCREATE\\s+TABLE\\s+${tbl}`, 'gi');
        while ((m = createTable.exec(b.masked)) !== null) add({ type: 'table', name: m[1] });
        const alterAdd = new RegExp(
            `\\bALTER\\s+TABLE\\s+${tbl}\\s+(?:WITH\\s+(?:NO)?CHECK\\s+)?ADD\\s+(?:CONSTRAINT\\s+\\[?([A-Za-z0-9_]+)\\]?|\\[?([A-Za-z0-9_]+)\\]?\\s+[A-Za-z])`,
            'gi'
        );
        while ((m = alterAdd.exec(b.masked)) !== null) {
            if (m[2]) add({ type: 'constraint', table: m[1], name: m[2] });
            else if (!/^(PRIMARY|FOREIGN|UNIQUE|CHECK|DEFAULT)$/i.test(m[3])) add({ type: 'column', table: m[1], name: m[3] });
        }
        const createIndex = new RegExp(
            `\\bCREATE\\s+(?:UNIQUE\\s+)?(?:(?:NON)?CLUSTERED\\s+)?INDEX\\s+\\[?([A-Za-z0-9_]+)\\]?\\s+ON\\s+${tbl}`,
            'gi'
        );
        while ((m = createIndex.exec(b.masked)) !== null) add({ type: 'index', name: m[1], table: m[2] });
    }
    return [...found.values()].filter((o) => OBJ_NAME_RE.test(o.name) && (!o.table || OBJ_NAME_RE.test(o.table)));
}

function objectProbeSql(o) {
    if (o.type === 'table') return `SELECT 1 AS x FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${o.name}'`;
    if (o.type === 'column') {
        return `SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${o.table}' AND COLUMN_NAME = '${o.name}'`;
    }
    if (o.type === 'constraint') return `SELECT 1 AS x FROM sys.objects WHERE name = '${o.name}' AND type IN ('C', 'D', 'F', 'PK', 'UQ')`;
    return `SELECT 1 AS x FROM sys.indexes WHERE name = '${o.name}' AND object_id = OBJECT_ID('${o.table}')`;
}

function describeObject(o) {
    if (o.type === 'table') return `tabella ${o.name}`;
    if (o.type === 'column') return `colonna ${o.table}.${o.name}`;
    if (o.type === 'constraint') return `vincolo ${o.name}`;
    return `indice ${o.name}`;
}

function parseArgs(argv) {
    const opts = {};
    const errors = [];
    for (const a of argv) {
        const m = /^--(mode|migrations|file-dir)=(.*)$/.exec(a);
        if (!m) {
            errors.push(`argomento non ammesso: ${String(a).split('=')[0]} (ammessi: --mode, --migrations, --file-dir)`);
            continue;
        }
        if (Object.prototype.hasOwnProperty.call(opts, m[1])) errors.push(`--${m[1]} ripetuto`);
        opts[m[1]] = m[2];
    }
    return { opts, errors };
}

function parseMigrationList(raw) {
    const errors = [];
    const nums = [];
    const parts = String(raw || '').split(',').map((s) => s.trim());
    if (parts.length === 0 || parts.every((p) => p === '')) return { nums, errors: ['--migrations obbligatorio (es. 110,124)'] };
    for (const p of parts) {
        if (!/^\d{1,3}$/.test(p)) {
            errors.push(`numero migrazione non valido: ${JSON.stringify(p)}`);
            continue;
        }
        const num = p.padStart(3, '0');
        if (nums.includes(num)) errors.push(`migrazione ${num} ripetuta`);
        else nums.push(num);
    }
    return { nums, errors };
}

function checkOrder(nums, allowlist) {
    const errors = [];
    const warnings = [];
    nums.forEach((num, idx) => {
        const entry = allowlist[num];
        if (!entry) return;
        for (const dep of entry.after || []) {
            const depIdx = nums.indexOf(dep);
            if (depIdx > idx) errors.push(`dipendenza violata: ${num} richiede ${dep} prima (piano di allineamento)`);
        }
        const prev = nums.slice(0, idx).find((p) => allowlist[p] && BATCH_RANK[allowlist[p].batch] > BATCH_RANK[entry.batch]);
        if (prev) warnings.push(`WARNING ordine: ${num} (batch ${entry.batch}) dopo ${prev} (batch ${allowlist[prev].batch}); il piano prevede A, B1, B2, C, D`);
    });
    return { errors, warnings };
}

function resolveSqlPath(entry, fileDir, repoRoot) {
    if (!fileDir) return path.join(repoRoot, entry.file);
    const candidates = [path.join(fileDir, entry.file), path.join(fileDir, path.basename(entry.file))];
    return candidates.find((c) => fs.existsSync(c)) || candidates[0];
}

function normId(v) {
    return String(v === undefined || v === null ? '' : v).trim().toLowerCase();
}

function validateConfig(cfg) {
    const errors = [];
    const test = cfg && cfg.test;
    if (!test || typeof test !== 'object') return ["sezione 'test' assente in config/database.json"];
    if (test.database !== TEST_DB) {
        errors.push(`il database della sezione test deve essere esattamente "${TEST_DB}" (trovato: ${JSON.stringify(test.database === undefined ? null : test.database)})`);
    }
    for (const k of ['server', 'user', 'password']) {
        if (!test[k]) errors.push(`sezione test: campo ${k} mancante`);
    }
    for (const p of (cfg.productions || []).filter(Boolean)) {
        for (const t of [test, cfg.rawTest].filter(Boolean)) {
            if (normId(p.server) === normId(t.server) && normId(p.database) === normId(t.database)) {
                errors.push('la configurazione test coincide con production (stesso server e database): rifiutato');
                return errors;
            }
        }
    }
    if (normId(test.database) === normId(PROD_DB)) errors.push('la sezione test punta al database di PROD: rifiutato');
    return errors;
}

/**
 * `test` con override DB_* (come l'app); `productions` = sezione production cosi com'e nel file:
 * l'override DB_* vale per il solo target TEST, altrimenti un DB_SERVER/DB_DATABASE valido renderebbe
 * test e production sempre uguali. `rawTest` = sezione test senza override (anche questa non deve
 * coincidere con production).
 */
function defaultLoadConfig() {
    const { loadDatabaseJsonConfigs, mergeDbEnvFromProcessEnv } = require('./mergeDbEnv');
    const all = loadDatabaseJsonConfigs();
    return {
        test: all.test ? mergeDbEnvFromProcessEnv(all.test) : undefined,
        rawTest: all.test,
        productions: all.production ? [all.production] : [],
    };
}

async function defaultConnect(config) {
    const sql = require('mssql');
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    return pool;
}

function buildConnectionConfig(test) {
    return {
        server: test.server,
        port: test.port || 1433,
        database: TEST_DB,
        user: test.user,
        password: test.password,
        options: { ...(test.options || {}) },
        connectionTimeout: 30000,
        requestTimeout: 120000,
        pool: { max: 1, min: 1, idleTimeoutMillis: 3600000 },
    };
}

function makeRedactor(test) {
    const secrets = [test && test.password, test && test.user, test && test.server].filter((s) => typeof s === 'string' && s.length > 2);
    return (msg) => secrets.reduce((acc, s) => acc.split(s).join('***'), String(msg));
}

async function selectRows(pool, sqlText) {
    if (!/^\s*SELECT\b/i.test(sqlText)) throw new FatalRunnerError('guardia lettura: ammesse solo SELECT');
    const r = await pool.request().query(sqlText);
    return (r && r.recordset) || [];
}

function assertDbName(name) {
    if (name === TEST_DB) return;
    if (normId(name) === normId(PROD_DB)) {
        throw new FatalRunnerError('la connessione punta al database di PROD: abort, nessuna query di scrittura eseguita');
    }
    throw new FatalRunnerError(
        `DB_NAME() deve essere esattamente "${TEST_DB}" (trovato: "${name || '<sconosciuto>'}"): abort, nessuna query di scrittura eseguita`
    );
}

async function guardDb(pool) {
    const rows = await selectRows(pool, 'SELECT DB_NAME() AS db_name');
    assertDbName(rows[0] && rows[0].db_name);
}

async function parseOnlyBatch(pool, batchText) {
    await pool.request().batch('SET PARSEONLY ON');
    let failure = null;
    try {
        const probe = await pool.request().batch('SELECT 1 AS parse_probe');
        if (probe && probe.recordset && probe.recordset.length > 0) {
            throw new FatalRunnerError('SET PARSEONLY non attivo sulla connessione: abort prima di parsare il batch');
        }
        await pool.request().batch(batchText);
    } catch (e) {
        failure = e;
    }
    try {
        await pool.request().batch('SET PARSEONLY OFF');
    } catch (e) {
        throw new FatalRunnerError('impossibile riportare PARSEONLY a OFF: connessione chiusa');
    }
    if (failure) throw failure;
}

async function applyBatch(pool, batchText) {
    await pool.request().batch('SET XACT_ABORT ON; BEGIN TRANSACTION;');
    try {
        await pool.request().batch(batchText);
        await pool.request().batch('IF @@TRANCOUNT > 0 COMMIT TRANSACTION;');
    } catch (e) {
        await pool.request().batch('IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;').catch(() => {});
        throw e;
    }
}

async function missingObjects(pool, objects) {
    const missing = [];
    for (const o of objects) {
        const rows = await selectRows(pool, objectProbeSql(o));
        if (rows.length === 0) missing.push(o);
    }
    return missing;
}

async function run({
    argv = process.argv.slice(2),
    env = process.env,
    connect = defaultConnect,
    loadConfig = defaultLoadConfig,
    repoRoot = REPO_ROOT,
    allowlist = MIGRATIONS,
} = {}) {
    const log = (m) => console.log(`${LOG} ${m}`);
    const fail = (list) => {
        list.forEach((m) => console.error(`${LOG} ERRORE: ${m}`));
        return 1;
    };

    if (env.SGQ_MIGRATION_TARGET !== undefined && env.SGQ_MIGRATION_TARGET !== 'test') {
        return fail(['SGQ_MIGRATION_TARGET impostata e diversa da "test": questo runner opera solo su TEST']);
    }

    const { opts, errors: argErrors } = parseArgs(argv);
    if (argErrors.length) return fail(argErrors);
    if (opts.mode !== 'check' && opts.mode !== 'apply') return fail(['--mode obbligatorio: check | apply (nessun default)']);
    const mode = opts.mode;
    if (mode === 'apply' && env.SGQ_CONFIRM_TEST_APPLY !== TEST_DB) {
        return fail([`apply richiede SGQ_CONFIRM_TEST_APPLY=${TEST_DB} (doppia conferma): nessuna connessione aperta`]);
    }

    const { nums, errors: listErrors } = parseMigrationList(opts.migrations);
    if (listErrors.length) return fail(listErrors);

    const errors = [];
    for (const num of nums) {
        const entry = Object.prototype.hasOwnProperty.call(allowlist, num) ? allowlist[num] : null;
        if (!entry) errors.push(`migrazione ${num} fuori allowlist`);
        else if (!entry.file) errors.push(`migrazione ${num}: .sql mancante: serve estrazione dal runner (${entry.missingReason})`);
    }
    if (errors.length) return fail(errors);

    const order = checkOrder(nums, allowlist);
    if (order.errors.length) return fail(order.errors);
    order.warnings.forEach((w) => log(w));

    let fileDir = null;
    if (opts['file-dir'] !== undefined) {
        fileDir = path.resolve(opts['file-dir']);
        if (!fs.existsSync(fileDir) || !fs.statSync(fileDir).isDirectory()) return fail(['--file-dir non e una cartella esistente']);
    }

    const prepared = [];
    for (const num of nums) {
        const entry = allowlist[num];
        const abs = resolveSqlPath(entry, fileDir, repoRoot);
        if (!fs.existsSync(abs)) {
            errors.push(`migrazione ${num}: file ${path.basename(entry.file)} non trovato`);
            continue;
        }
        const buf = fs.readFileSync(abs);
        const analysis = analyzeSqlFile(buf.toString('utf8'));
        const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
        const name = path.basename(entry.file);
        for (const f of analysis.findings) {
            if (BLOCKING_KINDS.has(f.kind)) {
                errors.push(`migrazione ${num} (${name}) riga ${f.line}: ${KIND_LABEL[f.kind]}`);
            } else if (f.kind === 'use_prod') {
                log(
                    mode === 'apply'
                        ? `migrazione ${num} (${name}) riga ${f.line}: USE SGQ_ISO9001 rimosso (non eseguito su TEST)`
                        : `migrazione ${num} (${name}) riga ${f.line}: USE SGQ_ISO9001 rilevato (in apply verra rimosso, non eseguito su TEST)`
                );
            }
        }
        prepared.push({ num, name, sha256, analysis, objects: extractExpectedObjects(analysis.batches) });
    }
    if (errors.length) return fail(errors);

    let cfg;
    try {
        cfg = loadConfig(env);
    } catch (e) {
        return fail([`configurazione database non caricabile: ${e.message}`]);
    }
    const cfgErrors = validateConfig(cfg);
    if (cfgErrors.length) return fail(cfgErrors);
    if (!(cfg.productions || []).filter(Boolean).length) {
        log('WARNING: sezione production assente in config/database.json, confronto test/production non eseguibile (restano i guard su DB_NAME)');
    }

    const redact = makeRedactor(cfg.test);
    log(`mode=${mode} target=test database=${TEST_DB} migrazioni=${nums.join(',')}`);

    let pool = null;
    let exitCode = 0;
    try {
        pool = await connect(buildConnectionConfig(cfg.test));
        let poolError = null;
        if (typeof pool.on === 'function') pool.on('error', (e) => { poolError = e; });
        await guardDb(pool);
        log(`DB_NAME() verificato: ${TEST_DB}`);

        for (const mig of prepared) {
            const batches = mig.analysis.batches.filter((b) => !b.empty);
            log(`${mode} ${mig.num} ${mig.name} sha256=${mig.sha256} batch=${batches.length}`);
            if (mode === 'check') {
                let parsed = 0;
                const parseErrors = [];
                for (const [i, b] of batches.entries()) {
                    await guardDb(pool);
                    try {
                        await parseOnlyBatch(pool, b.text);
                        parsed++;
                    } catch (e) {
                        if (e instanceof FatalRunnerError) throw e;
                        parseErrors.push(`batch ${i + 1} (riga ${b.startLine}): ${redact(e.message)}`);
                    }
                }
                const missing = await missingObjects(pool, mig.objects);
                log(`check ${mig.num}: batch parse OK ${parsed}/${batches.length}, USE SGQ_ISO9001 da rimuovere ${mig.analysis.useRemoved}`);
                log(
                    `check ${mig.num}: oggetti attesi ${mig.objects.length}, mancanti ${missing.length}` +
                        (missing.length ? ` (${missing.map(describeObject).join('; ')})` : '')
                );
                if (parseErrors.length) {
                    exitCode = 1;
                    parseErrors.forEach((m) => console.error(`${LOG} ERRORE parse ${mig.num}: ${m}`));
                }
            } else {
                let executed = 0;
                for (const [i, b] of batches.entries()) {
                    if (poolError) throw new FatalRunnerError('errore di connessione durante apply');
                    await guardDb(pool);
                    try {
                        await applyBatch(pool, b.text);
                    } catch (e) {
                        if (e instanceof FatalRunnerError) throw e;
                        throw new FatalRunnerError(
                            `migrazione ${mig.num}: errore SQL al batch ${i + 1}/${batches.length} (riga ${b.startLine}): ${redact(e.message)}. Eseguiti ${executed} batch, stop.`
                        );
                    }
                    executed++;
                }
                const missing = await missingObjects(pool, mig.objects);
                log(
                    `apply ${mig.num}: batch eseguiti ${executed}/${batches.length}, USE SGQ_ISO9001 rimossi ${mig.analysis.useRemoved}, ` +
                        `oggetti verificati ${mig.objects.length - missing.length}/${mig.objects.length}`
                );
                if (missing.length) {
                    throw new FatalRunnerError(
                        `migrazione ${mig.num}: verifica fallita, mancano ${missing.map(describeObject).join('; ')}. Stop.`
                    );
                }
            }
        }
        log(mode === 'check' ? 'check completato: nessun DDL/DML eseguito.' : `apply completato: ${prepared.length} migrazioni.`);
        if (mode === 'check' && exitCode !== 0) log('check terminato con errori di parse.');
    } catch (e) {
        exitCode = 1;
        console.error(`${LOG} ERRORE: ${redact(e.message)}`);
    } finally {
        if (pool && typeof pool.close === 'function') await pool.close().catch(() => {});
    }
    return exitCode;
}

module.exports = {
    run,
    MIGRATIONS,
    TEST_DB,
    PROD_DB,
    analyzeSqlFile,
    extractExpectedObjects,
    scanSql,
    validateConfig,
    parseArgs,
    resolveSqlPath,
};

if (require.main === module) {
    run().then((code) => process.exit(code));
}
