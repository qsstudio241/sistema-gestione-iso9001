/**
 * Harness di test: esegue l'SQL REALE dei controller Qualifiche/Alert su un SQLite in memoria,
 * cosi' i test verificano i risultati (quali righe cadono in quale tab / bucket), non solo il testo.
 * Traduce soltanto i costrutti T-SQL usati da qualificationExpirySql e dai filtri tab:
 * GETDATE/DATEADD, prefisso N'', concatenazione e LIKE con classi su collation BIN (-> GLOB),
 * OFFSET/FETCH. Richiede node:sqlite (Node >= 22.5); altrimenti `available` e' false e i test saltano.
 */

'use strict';

let sqlite = null;
try {
    // eslint-disable-next-line global-require
    sqlite = require('node:sqlite');
} catch (_) {
    sqlite = null;
}

const available = Boolean(sqlite);
const DAY_MS = 86400000;

const isoDay = (offsetDays = 0) => new Date(Math.floor(Date.now() / DAY_MS) * DAY_MS + offsetDays * DAY_MS)
    .toISOString().slice(0, 10);
const TODAY = isoDay(0);

/** Pattern LIKE -> GLOB senza distinzione di maiuscole (le lettere fuori dalle classi [..] diventano [xX]). */
function likeToGlobCi(pattern) {
    let out = '';
    let inClass = false;
    for (const ch of pattern) {
        if (inClass) { out += ch; if (ch === ']') inClass = false; continue; }
        if (ch === '[') { inClass = true; out += ch; continue; }
        if (ch === '%') { out += '*'; continue; }
        out += /[A-Za-z]/.test(ch) ? `[${ch.toLowerCase()}${ch.toUpperCase()}]` : ch;
    }
    return out;
}

function toSqlite(sql, params = {}) {
    return sql
        .replace(/\(N' ' \+ q\.qualification_type \+ N' '\) COLLATE Latin1_General_CI_AS LIKE '([^']*)'/g,
            (_m, p) => `(' ' || q.qualification_type || ' ') GLOB '${likeToGlobCi(p)}'`)
        .replace(/\(N' ' \+ q\.qualification_type \+ N' '\) COLLATE Latin1_General_BIN LIKE '([^']*)'/g,
            (_m, p) => `(' ' || q.qualification_type || ' ') GLOB '${p.replace(/%/g, '*')}'`)
        .replace(/CAST\(GETDATE\(\) AS DATE\)/g, `date('${TODAY}')`)
        .replace(/DATEADD\(day, (-?\d+|@\w+), date\('[^']+'\)\)/g, (_m, n) => {
            const v = n.startsWith('@') ? Number(params[n.slice(1)]) : Number(n);
            return `date('${TODAY}', '${v >= 0 ? '+' : ''}${v} day')`;
        })
        .replace(/(?<=[\s(,=])N'/g, "'")
        .replace(/OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY/g, 'LIMIT @lim OFFSET @off');
}

function createDb(rows = []) {
    const db = new sqlite.DatabaseSync(':memory:');
    db.exec(`
        CREATE TABLE qualifications (
            id INTEGER PRIMARY KEY, organization_id INTEGER, company_id INTEGER, person_name TEXT,
            qualification_type TEXT, status TEXT, expiry_date TEXT, next_confirmation_due TEXT,
            cpd_valid_until TEXT, certificate_number TEXT, approval_status TEXT, approved_by INTEGER
        );
        CREATE TABLE companies (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE users (user_id INTEGER PRIMARY KEY, full_name TEXT);
        CREATE TABLE document_registry (organization_id INTEGER, company_id INTEGER, status TEXT, expiry_date TEXT);
    `);
    const ins = db.prepare(`INSERT INTO qualifications
        (id, organization_id, company_id, person_name, qualification_type, status, expiry_date,
         next_confirmation_due, cpd_valid_until, certificate_number, approval_status)
        VALUES (@id, @organization_id, @company_id, @person_name, @qualification_type, @status, @expiry_date,
         @next_confirmation_due, @cpd_valid_until, @certificate_number, @approval_status)`);
    rows.forEach((r, i) => ins.run({
        id: r.id ?? i + 1,
        organization_id: r.organization_id ?? 1,
        company_id: r.company_id ?? 1,
        person_name: r.person_name ?? `Persona ${i + 1}`,
        qualification_type: r.qualification_type ?? 'Saldatore ISO 9606-1',
        status: r.status ?? 'valida',
        expiry_date: r.expiry_date ?? null,
        next_confirmation_due: r.next_confirmation_due ?? null,
        cpd_valid_until: r.cpd_valid_until ?? null,
        certificate_number: r.certificate_number ?? null,
        approval_status: r.approval_status ?? 'approvata',
    }));
    return db;
}

/** Pool compatibile con `pool.request().input().query()` che esegue su SQLite. */
function makePool(db) {
    return {
        request() {
            const params = {};
            const req = {
                input(k, v) { params[k] = v; return req; },
                async query(sql) {
                    const translated = toSqlite(sql, params);
                    const used = {};
                    for (const m of translated.matchAll(/@(\w+)/g)) used[m[1]] = params[m[1]] ?? null;
                    return { recordset: db.prepare(translated).all(used) };
                },
            };
            return req;
        },
    };
}

module.exports = { available, createDb, makePool, isoDay, TODAY };
