'use strict';

/**
 * wpsWpqrLinks.service.js — legame WPS↔WPQR scritto dall'ingest (D9, tabella `wps_wpqr_links`, migrazione 174).
 *
 * Regola di sicurezza: un legame nasce SOLO da una corrispondenza univoca nello stesso tenant
 * (organization_id uguale; company_id uguale oppure assente sul record creato a mano) tra il numero dichiarato nel documento e il numero normalizzato
 * del record. Assente o ambigua → nessun legame, nessuna scelta a caso: l'esito è una segnalazione
 * «da verificare» mostrata in revisione. Ogni query ripete organization_id; gli id dei record non arrivano mai
 * dal client ma dalla ricerca stessa o dall'INSERT appena fatto.
 * Migrazione 174 applicata su PROD (2026-10): i legami si scrivono. Se la tabella
 * manca (TEST non allineato / rollback), nessuna scrittura e avviso esplicito.
 */

const { query } = require('../config/database');
const { normalizeWpqrRef, normalizeWpsRef } = require('../utils/wpqrSupportRefs');

const ROLES = Object.freeze({ PRIMARY: 'primary', SUPPORTING: 'supporting' });
const MAX_CANDIDATES = 50;

const FLAG = Object.freeze({
    NOT_FOUND: 'not_found',
    AMBIGUOUS: 'ambiguous',
    LINKS_UNAVAILABLE: 'links_unavailable',
    RESOLVE_ERROR: 'resolve_error',
});
const ROLE_RANK = Object.freeze({ [ROLES.SUPPORTING]: 1, [ROLES.PRIMARY]: 2 });

function requireTenant(organizationId) {
    if (!Number.isSafeInteger(Number(organizationId)) || Number(organizationId) <= 0) {
        const err = new Error('Organizzazione non valida');
        err.code = 'INVALID_TENANT';
        throw err;
    }
    return Number(organizationId);
}

/** Tratto numerico più lungo del riferimento: filtro LIKE per limitare i candidati (il confronto vero è in JS). */
function digitCore(ref) {
    const runs = String(ref || '').match(/\d+/g) || [];
    return runs.reduce((best, cur) => (cur.length > best.length ? cur : best), '');
}

/**
 * Filtro azienda: stessa company, oppure record creato a mano senza company
 * (stesso tenant). Non prende mai il record di un'altra azienda.
 * @param {string} [alias] prefisso colonna (`w`, `q`) — replace singolo non basta se c'è OR.
 */
function companyClause(companyId, params, alias = '') {
    const col = alias ? `${alias}.company_id` : 'company_id';
    if (companyId == null || companyId === '') return `${col} IS NULL`;
    params.company_id = Number(companyId);
    return `(${col} = @company_id OR ${col} IS NULL)`;
}

async function tableExists(name) {
    const r = await query(`SELECT OBJECT_ID(N'dbo.${name}', N'U') AS object_id`);
    const row = r && r.recordset && r.recordset[0];
    return Boolean(row && row.object_id);
}

function uniqueIds(rows) {
    return [...new Set(rows.map((r) => r.id))];
}

function notFoundFlag(label, ref) {
    return { ref, status: FLAG.NOT_FOUND, message: `${label} ${ref}: nessun record corrispondente nell'archivio — da verificare.` };
}

function ambiguousFlag(label, ref, count) {
    return {
        ref,
        status: FLAG.AMBIGUOUS,
        message: `${label} ${ref}: ${count} record corrispondenti — legame non creato, da verificare.`,
    };
}

/**
 * Cerca la WPQR del tenant con numero normalizzato = `ref`.
 * @returns {Promise<{ status: 'matched', wpqr_id: number } | { status: 'not_found' } | { status: 'ambiguous', count: number }>}
 */
async function findWpqrByRef({ organizationId, companyId, ref }) {
    const org = requireTenant(organizationId);
    const key = normalizeWpqrRef(ref);
    const core = digitCore(key);
    if (!key || !core) return { status: FLAG.NOT_FOUND };

    const params = { organization_id: org, like: `%${core}%` };
    const company = companyClause(companyId, params);
    const r = await query(
        `SELECT TOP ${MAX_CANDIDATES} id, wpqr_code, reference_number, certificate_number
         FROM wpqr_records
         WHERE organization_id = @organization_id
           AND ${company}
           AND (wpqr_code LIKE @like OR reference_number LIKE @like OR certificate_number LIKE @like)`,
        params
    );
    const hits = (r.recordset || []).filter((row) =>
        [row.wpqr_code, row.reference_number, row.certificate_number].some((v) => normalizeWpqrRef(v) === key));
    const ids = uniqueIds(hits);
    if (ids.length === 1) return { status: 'matched', wpqr_id: ids[0] };
    if (ids.length === 0) return { status: FLAG.NOT_FOUND };
    return { status: FLAG.AMBIGUOUS, count: ids.length };
}

/** Come `findWpqrByRef`, sulle WPS del tenant (`wps_code` normalizzato senza suffisso rev). */
async function findWpsByRef({ organizationId, companyId, ref }) {
    const org = requireTenant(organizationId);
    const key = normalizeWpsRef(ref);
    const core = digitCore(key);
    if (!key || !core) return { status: FLAG.NOT_FOUND };

    const params = { organization_id: org, like: `%${core}%` };
    const company = companyClause(companyId, params);
    const r = await query(
        `SELECT TOP ${MAX_CANDIDATES} id, wps_code
         FROM welding_procedures
         WHERE organization_id = @organization_id
           AND ${company}
           AND wps_code LIKE @like`,
        params
    );
    const ids = uniqueIds((r.recordset || []).filter((row) => normalizeWpsRef(row.wps_code) === key));
    if (ids.length === 1) return { status: 'matched', wps_id: ids[0] };
    if (ids.length === 0) return { status: FLAG.NOT_FOUND };
    return { status: FLAG.AMBIGUOUS, count: ids.length };
}

/**
 * Sola lettura (anteprima in revisione e pre-commit): per ogni numero di supporto dice se c'è un match sicuro.
 * @returns {Promise<{ matches: {ref: string, wpqr_id: number}[], flags: object[] }>}
 */
async function resolveSupportingWpqrRefs({ organizationId, companyId, refs }) {
    const matches = [];
    const flags = [];
    const matchedIds = new Set();
    for (const ref of refs || []) {
        const found = await findWpqrByRef({ organizationId, companyId, ref });
        if (found.status === 'matched') {
            if (!matchedIds.has(found.wpqr_id)) {
                matchedIds.add(found.wpqr_id);
                matches.push({ ref, wpqr_id: found.wpqr_id });
            }
        } else if (found.status === FLAG.AMBIGUOUS) {
            flags.push(ambiguousFlag('WPQR di supporto', ref, found.count));
        } else {
            flags.push(notFoundFlag('WPQR di supporto', ref));
        }
    }
    return { matches, flags };
}

/** Sola lettura: WPS citata da una WPQR (`wps_ref`). Riferimento assente → nessun match e nessuna segnalazione. */
async function resolveWpsRef({ organizationId, companyId, ref }) {
    if (ref == null || String(ref).trim() === '') return { match: null, flags: [] };
    const found = await findWpsByRef({ organizationId, companyId, ref });
    if (found.status === 'matched') return { match: { ref: String(ref).trim(), wps_id: found.wps_id }, flags: [] };
    const text = String(ref).trim();
    return {
        match: null,
        flags: [found.status === FLAG.AMBIGUOUS ? ambiguousFlag('WPS', text, found.count) : notFoundFlag('WPS', text)],
    };
}

/**
 * Scrive un legame. L'INSERT parte dalle due tabelle genitrici filtrate per tenant e company: se uno dei due id
 * non appartiene al tenant (o le company differiscono) non inserisce nulla. Idempotente su (wps_id, wpqr_id).
 * @returns {Promise<{ created: boolean, available: boolean }>}
 */
async function insertLink({ organizationId, companyId, wpsId, wpqrId, role, userId = null }) {
    const org = requireTenant(organizationId);
    const wps = Number(wpsId);
    const wpqr = Number(wpqrId);
    if (!Number.isSafeInteger(wps) || wps <= 0 || !Number.isSafeInteger(wpqr) || wpqr <= 0) {
        return { created: false, available: true };
    }
    if (!(await tableExists('wps_wpqr_links'))) return { created: false, available: false };

    const params = { organization_id: org, wps_id: wps, wpqr_id: wpqr, role, created_by: userId };
    const wpsCompany = companyClause(companyId, params, 'w');
    const wpqrCompany = companyClause(companyId, params, 'q');
    const r = await query(
        `INSERT INTO wps_wpqr_links (organization_id, wps_id, wpqr_id, role, created_by)
         OUTPUT INSERTED.id
         SELECT @organization_id, w.id, q.id, @role, @created_by
         FROM welding_procedures w
         JOIN wpqr_records q ON q.id = @wpqr_id AND q.organization_id = @organization_id AND ${wpqrCompany}
         WHERE w.id = @wps_id AND w.organization_id = @organization_id AND ${wpsCompany}
           AND NOT EXISTS (
               SELECT 1 FROM wps_wpqr_links l
               WHERE l.organization_id = @organization_id AND l.wps_id = w.id AND l.wpqr_id = q.id
           )`,
        params
    );
    if (r && r.recordset && r.recordset.length > 0) {
        return { created: true, updated: false, available: true };
    }
    // Coppia già presente: `primary` (WPQR→WPS) vince su `supporting` (WPS→WPQR). Mai il contrario.
    const newRank = ROLE_RANK[role] || 0;
    if (newRank < ROLE_RANK[ROLES.PRIMARY]) {
        return { created: false, updated: false, available: true };
    }
    const u = await query(
        `UPDATE l
         SET role = @role
         OUTPUT INSERTED.id
         FROM wps_wpqr_links l
         INNER JOIN welding_procedures w ON w.id = l.wps_id AND w.organization_id = @organization_id AND ${wpsCompany}
         INNER JOIN wpqr_records q ON q.id = l.wpqr_id AND q.organization_id = @organization_id AND ${wpqrCompany}
         WHERE l.organization_id = @organization_id AND l.wps_id = @wps_id AND l.wpqr_id = @wpqr_id
           AND l.role <> @role`,
        params
    );
    return { created: false, updated: Boolean(u && u.recordset && u.recordset.length > 0), available: true };
}

/**
 * Dopo l'INSERT della WPS: legami `supporting` verso le WPQR con match sicuro.
 * @returns {Promise<{ linked: {ref: string, wpqr_id: number}[], flags: object[] }>}
 */
async function linkWpsToSupportingWpqr({ organizationId, companyId, wpsId, matches, userId = null }) {
    const linked = [];
    const flags = [];
    for (const m of matches || []) {
        const res = await insertLink({
            organizationId, companyId, wpsId, wpqrId: m.wpqr_id, role: ROLES.SUPPORTING, userId,
        });
        if (!res.available) {
            flags.push({
                ref: m.ref,
                status: FLAG.LINKS_UNAVAILABLE,
                message: 'Legami WPS-WPQR non ancora disponibili (migrazione database non applicata) — da verificare.',
            });
            break;
        }
        if (res.created || res.updated) linked.push(m);
    }
    return { linked, flags };
}

/** Dopo l'INSERT della WPQR: legame `primary` verso la WPS citata, solo se univoca. */
async function linkWpqrToWps({ organizationId, companyId, wpqrId, match, userId = null }) {
    if (!match) return { linked: [], flags: [] };
    const res = await insertLink({
        organizationId, companyId, wpsId: match.wps_id, wpqrId, role: ROLES.PRIMARY, userId,
    });
    if (!res.available) {
        return {
            linked: [],
            flags: [{
                ref: match.ref,
                status: FLAG.LINKS_UNAVAILABLE,
                message: 'Legami WPS-WPQR non ancora disponibili (migrazione database non applicata) — da verificare.',
            }],
        };
    }
    return { linked: (res.created || res.updated) ? [match] : [], flags: [] };
}

/**
 * SQL per COUNT delle WPQR legate a una WPS: colonna legacy `wpqr_records.wps_id`
 * unita a `wps_wpqr_links` (D9). `wpsExpr` è un identificatore SQL già sicuro
 * (alias colonna, mai input utente).
 */
function wpqrLinkedToWpsCountSql(wpsExpr, orgParam = '@organization_id') {
    return `(SELECT COUNT(*) FROM wpqr_records wq
             WHERE wq.organization_id = ${orgParam} AND wq.deleted_at IS NULL
               AND (wq.wps_id = ${wpsExpr} OR EXISTS (
                   SELECT 1 FROM wps_wpqr_links l
                   WHERE l.organization_id = ${orgParam}
                     AND l.wps_id = ${wpsExpr}
                     AND l.wpqr_id = wq.id
                     AND l.deleted_at IS NULL
               )))`;
}

/** Lettori WPS: unione legame D9 + colonna legacy `wps_id`. Tabella 174 assente → solo legacy. */
async function listWpqrRecordsForWps({ organizationId, wpsId }) {
    const org = requireTenant(organizationId);
    const wps = Number(wpsId);
    if (!Number.isSafeInteger(wps) || wps <= 0) return [];
    const hasLinks = await tableExists('wps_wpqr_links');
    const sql = hasLinks
        ? `SELECT q.*
           FROM wpqr_records q
           WHERE q.organization_id = @organization_id
             AND q.deleted_at IS NULL
             AND (
               q.wps_id = @wps_id
               OR EXISTS (
                 SELECT 1 FROM wps_wpqr_links l
                 WHERE l.organization_id = @organization_id
                   AND l.wps_id = @wps_id
                   AND l.wpqr_id = q.id
                   AND l.deleted_at IS NULL
               )
             )
           ORDER BY q.test_date DESC`
        : `SELECT q.*
           FROM wpqr_records q
           WHERE q.organization_id = @organization_id
             AND q.deleted_at IS NULL
             AND q.wps_id = @wps_id
           ORDER BY q.test_date DESC`;
    const r = await query(sql, { organization_id: org, wps_id: wps });
    return r.recordset || [];
}

async function linksAvailable() {
    return tableExists('wps_wpqr_links');
}

module.exports = {
    ROLES,
    FLAG,
    findWpqrByRef,
    findWpsByRef,
    resolveSupportingWpqrRefs,
    resolveWpsRef,
    insertLink,
    linkWpsToSupportingWpqr,
    linkWpqrToWps,
    listWpqrRecordsForWps,
    wpqrLinkedToWpsCountSql,
    linksAvailable,
};
