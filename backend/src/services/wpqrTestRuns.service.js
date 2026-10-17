'use strict';

/**
 * wpqrTestRuns.service.js — passate di prova della WPQR (tabella `wpqr_test_runs`, migrazione 173).
 *
 * Una riga per passata (ISO 15614-1 Annex B pag. 2, 15614-2 Annex A, 14555 Annex C). Contratto delle colonne:
 * docs/agent-tasks/PLAN_VERIFICA_WPQR_SLICES.md § 2.2; contratto di rete: `WpqrTestRunsEditor` + `apiService`
 * (GET/PUT `/welding/wpqr/:id/test-runs`, body `{ runs }`, risposta `{ runs }`).
 *
 * Isolamento multi-tenant: ogni statement filtra `organization_id` dal JWT e `wpqr_id`; il `wpqr_id` è accettato
 * solo dopo aver verificato che la WPQR appartenga al tenant. `id`, `organization_id`, `company_id`, `wpqr_id`
 * inviati dal client sono ignorati (company_id e organization_id derivano dalla WPQR).
 *
 * Tolleranza allo schema: finché la migrazione 173 non è applicata la tabella non esiste. Lettura → `available:false`;
 * scrittura → errore esplicito `WPQR_TEST_RUNS_UNAVAILABLE`; cancellazioni → nessuna operazione sulla tabella assente.
 *
 * I limiti numerici sono protezioni da overflow/refusi di digitazione, NON soglie normative.
 */

const { query, getPool } = require('../config/database');
const logger = require('../utils/logger');
const { logEntityChange } = require('./entityChangeLog.service');
const {
    ensureCompanyAccessLoaded,
    hasCompanyAccessRows,
    assertCompanyRead,
    assertMutatingAllowed,
} = require('../services/companyAccess.service');
const { toNumericOrNull } = require('../utils/numericSanitizer');

const MAX_RUNS = 60;
const SOURCES = ['ai', 'manual'];

const UNITS = {
    travel_speed_unit: ['mm/min', 'mm/s', 'cm/min'],
    heat_input_unit: ['kJ/mm', 'J/mm', 'kJ/cm'],
    wire_feed_unit: ['m/min', 'mm/s'],
};

/** Coppie valore + unità: l'unità è obbligatoria quando il valore c'è (l'apporto termico è dichiarato, non ricalcolato). */
const UNIT_PAIRS = [
    { value: 'travel_speed', unit: 'travel_speed_unit' },
    { value: 'heat_input_value', unit: 'heat_input_unit' },
    { value: 'wire_feed_speed', unit: 'wire_feed_unit' },
];

const NUMERIC_FIELDS = {
    filler_diameter_mm: { min: 0, max: 50 },
    current_a: { min: 0, max: 5000 },
    voltage_v: { min: 0, max: 1000 },
    wire_feed_speed: { min: 0, max: 1000 },
    travel_speed: { min: 0, max: 100000 },
    heat_input_value: { min: 0, max: 100000 },
    weld_time_ms: { min: 0, max: 1000000 },
    protrusion_mm: { min: 0, max: 100 },
    lift_mm: { min: 0, max: 100 },
    capacitance_mf: { min: 0, max: 1000 },
    charging_voltage_v: { min: 0, max: 2000 },
    gap_lift_mm: { min: 0, max: 100 },
    spring_force_n: { min: 0, max: 100000 },
};

const TEXT_FIELDS = {
    run_label: 20,
    welding_process: 50,
    filler_designation: 100,
    filler_make: 100,
    current_polarity: 40,
    metal_transfer: 40,
    remarks: 200,
};

const INT_FIELDS = { run_no: { min: 0, max: 1000 } };

/** Colonne scritte, nell'ordine dell'INSERT (id/organization_id/company_id/wpqr_id/created_at/updated_at gestiti a parte). */
const WRITABLE_COLUMNS = [
    'run_no', 'run_label', 'welding_process', 'filler_diameter_mm', 'filler_designation', 'filler_make',
    'current_a', 'voltage_v', 'current_polarity', 'wire_feed_speed', 'wire_feed_unit',
    'travel_speed', 'travel_speed_unit', 'heat_input_value', 'heat_input_unit', 'metal_transfer',
    'weld_time_ms', 'protrusion_mm', 'lift_mm',
    'capacitance_mf', 'charging_voltage_v', 'gap_lift_mm', 'spring_force_n',
    'remarks', 'source',
];

const READ_COLUMNS = ['id', 'wpqr_id', ...WRITABLE_COLUMNS];

class TestRunsError extends Error {
    constructor(status, code, message, details) {
        super(message);
        this.name = 'TestRunsError';
        this.status = status;
        this.code = code;
        if (details) this.details = details;
    }
}

function isBlank(v) {
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

/** Intero positivo da parametro di rotta; «12abc», «0», negativi, decimali → null (mai `parseInt` permissivo). */
function parseId(raw) {
    const s = String(raw === undefined || raw === null ? '' : raw).trim();
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const NOT_APPLICABLE = new Set(['n.a.', 'n.a', 'na', 'n/a', 'n.d.', 'n.d', 'nd', 'n/d', '-', '--', '/']);

/** Numero pulito (virgola o punto) oppure `null` per vuoto/«N.A.»; testo non numerico o ambiguo («3-6») → `NaN`. */
function parseStrictNumber(raw) {
    if (isBlank(raw)) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
    if (typeof raw !== 'string') return NaN;
    const direct = raw.trim().replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(direct)) return toNumericOrNull(direct);
    const token = raw.trim().toLowerCase();
    return NOT_APPLICABLE.has(token) ? null : NaN;
}

function normalizeText(raw, maxLen, field, errors) {
    if (isBlank(raw)) return null;
    if (typeof raw !== 'string' && typeof raw !== 'number') {
        errors.push({ field, message: 'Valore di testo non valido.' });
        return null;
    }
    const text = String(raw).trim();
    if (text.length > maxLen) {
        errors.push({ field, message: `Massimo ${maxLen} caratteri.` });
        return null;
    }
    return text;
}

/**
 * Valida e normalizza una passata. Ritorna `{ value, errors }`; `errors` vuoto = riga scrivibile.
 * Solo i campi noti passano; qualunque altra chiave (id, organization_id, …) è scartata.
 */
function normalizeRun(raw) {
    const errors = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { value: null, errors: [{ field: null, message: 'Riga passata non valida.' }] };
    }
    const value = {};

    for (const [field, spec] of Object.entries(NUMERIC_FIELDS)) {
        const n = parseStrictNumber(raw[field]);
        if (Number.isNaN(n)) {
            errors.push({ field, message: 'Inserire un numero.' });
            value[field] = null;
        } else if (n !== null && (n < spec.min || n > spec.max)) {
            errors.push({ field, message: `Valore fuori intervallo (${spec.min}–${spec.max}).` });
            value[field] = null;
        } else {
            value[field] = n;
        }
    }

    for (const [field, spec] of Object.entries(INT_FIELDS)) {
        const n = parseStrictNumber(raw[field]);
        if (Number.isNaN(n) || (n !== null && !Number.isInteger(n))) {
            errors.push({ field, message: 'Inserire un numero intero.' });
            value[field] = null;
        } else if (n !== null && (n < spec.min || n > spec.max)) {
            errors.push({ field, message: `Valore fuori intervallo (${spec.min}–${spec.max}).` });
            value[field] = null;
        } else {
            value[field] = n;
        }
    }

    for (const [field, maxLen] of Object.entries(TEXT_FIELDS)) {
        value[field] = normalizeText(raw[field], maxLen, field, errors);
    }

    for (const [unitField, allowed] of Object.entries(UNITS)) {
        const unit = normalizeText(raw[unitField], 10, unitField, errors);
        if (unit !== null && !allowed.includes(unit)) {
            errors.push({ field: unitField, message: `Unità non ammessa (${allowed.join(', ')}).` });
            value[unitField] = null;
        } else {
            value[unitField] = unit;
        }
    }

    for (const { value: valueField, unit } of UNIT_PAIRS) {
        if (value[valueField] !== null && value[unit] === null && !errors.some((e) => e.field === unit)) {
            errors.push({ field: unit, message: "Selezionare l'unità di misura." });
        }
    }

    if (value.run_no === null) {
        const m = /\d+/.exec(value.run_label || '');
        value.run_no = m ? Number(m[0]) : null;
    }

    value.source = SOURCES.includes(raw.source) ? raw.source : 'manual';
    return { value, errors };
}

/**
 * @param {unknown} runs
 * @returns {{ rows: object[], errors: {row:number, field:string|null, message:string}[] }}
 */
function normalizeRuns(runs) {
    if (!Array.isArray(runs)) {
        throw new TestRunsError(400, 'VALIDATION_ERROR', 'Il corpo deve contenere `runs` come elenco.');
    }
    if (runs.length > MAX_RUNS) {
        throw new TestRunsError(400, 'VALIDATION_ERROR', `Massimo ${MAX_RUNS} passate per WPQR.`);
    }
    const rows = [];
    const errors = [];
    runs.forEach((raw, idx) => {
        const { value, errors: rowErrors } = normalizeRun(raw);
        rowErrors.forEach((e) => errors.push({ row: idx + 1, field: e.field, message: e.message }));
        if (value) rows.push(value);
    });
    return { rows, errors };
}

/**
 * Colonne di testata di `wpqr_records` aggiunte dalla migrazione 173 (condizioni di prova, gruppo A e B del piano § 2.2).
 * Tutte nullable; i limiti sono protezioni da overflow/refusi, non soglie normative.
 */
const HEADER_NUMERIC = {
    diameter_test_mm: { min: 0, max: 5000 },
    deposited_thickness_mm: { min: 0, max: 1000 },
    thickness_t2_test_mm: { min: 0, max: 1000 },
    heat_input_range_min: { min: 0, max: 99999 },
    heat_input_range_max: { min: 0, max: 99999 },
    heat_input_tol_minus_pct: { min: 0, max: 100 },
    heat_input_tol_plus_pct: { min: 0, max: 100 },
    preheat_temp_test: { min: -50, max: 1000 },
    interpass_temp_test: { min: -50, max: 1000 },
    shielding_gas_flow_l_min_min: { min: 0, max: 100 },
    shielding_gas_flow_l_min_max: { min: 0, max: 100 },
    nozzle_diameter_mm: { min: 0, max: 100 },
    contact_tube_distance_mm_min: { min: 0, max: 500 },
    contact_tube_distance_mm_max: { min: 0, max: 500 },
    torch_angle_deg: { min: 0, max: 360 },
};
const HEADER_BOOLEAN = ['heat_input_plus_unlimited'];
const HEADER_TEXT = {
    welding_position_test: 40,
    filler_make: 100,
    filler_size: 50,
    backing_gas: 100,
    post_heating: 100,
    pwht_details: 300,
    range_standard_reference: 100,
    tungsten_electrode: 50,
    joint_preparation: 100,
    cleaning_method: 100,
    other_test_info: 500,
};
const HEADER_ENUM = {
    heat_input_kind: ['heat_input', 'arc_energy'],
    heat_input_range_unit: UNITS.heat_input_unit,
    heat_input_range_basis: ['absolute', 'relative'],
    bead_technique: ['stringer', 'weave', 'both'],
    electrode_count: ['single', 'multiple'],
};
const HEADER_MIN_MAX_PAIRS = [
    ['heat_input_range_min', 'heat_input_range_max'],
    ['shielding_gas_flow_l_min_min', 'shielding_gas_flow_l_min_max'],
    ['contact_tube_distance_mm_min', 'contact_tube_distance_mm_max'],
];
const WPQR_TEST_HEADER_FIELDS = [
    ...Object.keys(HEADER_NUMERIC), ...HEADER_BOOLEAN, ...Object.keys(HEADER_TEXT), ...Object.keys(HEADER_ENUM),
];
/** Ultima colonna aggiunta dalla 173: se manca, la migrazione non è stata applicata. */
const HEADER_MARKER_COLUMN = 'other_test_info';

/**
 * Valida i campi di testata presenti nel body (solo le chiavi inviate; `''`/`null` = svuota).
 * @returns {{ fields: Object<string, *>, errors: {field: string, message: string}[] }}
 */
function normalizeTestHeader(body) {
    const src = body && typeof body === 'object' ? body : {};
    const fields = {};
    const errors = [];
    const has = (f) => src[f] !== undefined;

    for (const [field, spec] of Object.entries(HEADER_NUMERIC)) {
        if (!has(field)) continue;
        const n = parseStrictNumber(src[field]);
        if (Number.isNaN(n)) errors.push({ field, message: 'Inserire un numero.' });
        else if (n !== null && (n < spec.min || n > spec.max)) {
            errors.push({ field, message: `Valore fuori intervallo (${spec.min}–${spec.max}).` });
        } else fields[field] = n;
    }
    for (const field of HEADER_BOOLEAN) {
        if (!has(field)) continue;
        const v = src[field];
        if (v === null || v === '') fields[field] = null;
        else if (v === true || v === 1 || v === '1') fields[field] = 1;
        else if (v === false || v === 0 || v === '0') fields[field] = 0;
        else errors.push({ field, message: 'Valore booleano non valido.' });
    }
    for (const [field, maxLen] of Object.entries(HEADER_TEXT)) {
        if (!has(field)) continue;
        const e = [];
        const text = normalizeText(src[field], maxLen, field, e);
        if (e.length) errors.push(...e); else fields[field] = text;
    }
    for (const [field, allowed] of Object.entries(HEADER_ENUM)) {
        if (!has(field)) continue;
        const e = [];
        const text = normalizeText(src[field], 20, field, e);
        if (e.length) errors.push(...e);
        else if (text !== null && !allowed.includes(text)) {
            errors.push({ field, message: `Valore non ammesso (${allowed.join(', ')}).` });
        } else fields[field] = text;
    }
    for (const [lo, hi] of HEADER_MIN_MAX_PAIRS) {
        if (fields[lo] != null && fields[hi] != null && fields[lo] > fields[hi]) {
            errors.push({ field: hi, message: 'Il massimo deve essere maggiore o uguale al minimo.' });
        }
    }
    return { fields, errors };
}

/** `true` se la migrazione 173 (colonne di testata) risulta applicata. */
async function testHeaderColumnsAvailable() {
    const r = await query(`SELECT COL_LENGTH(N'dbo.wpqr_records', N'${HEADER_MARKER_COLUMN}') AS len`);
    const row = r && r.recordset && r.recordset[0];
    return Boolean(row && row.len != null);
}

async function tableExists(name) {
    const r = await query(`SELECT OBJECT_ID(N'dbo.${name}', N'U') AS object_id`);
    const row = r && r.recordset && r.recordset[0];
    return Boolean(row && row.object_id);
}

/** WPQR del tenant (mai un id dal client senza scope). `null` se non esiste o appartiene ad altro tenant. */
async function findWpqrInTenant(wpqrId, organizationId) {
    const r = await query(
        `SELECT wq.id, wq.organization_id, wq.company_id, w.company_id AS wps_company_id
         FROM wpqr_records wq
         LEFT JOIN welding_procedures w
           ON w.id = wq.wps_id AND w.organization_id = wq.organization_id
         WHERE wq.id = @wpqr_id AND wq.organization_id = @organization_id AND wq.deleted_at IS NULL
           AND (wq.wps_id IS NULL OR w.deleted_at IS NULL)`,
        { wpqr_id: wpqrId, organization_id: organizationId }
    );
    return r.recordset.length ? r.recordset[0] : null;
}

function requireTenant(organizationId) {
    if (!Number.isInteger(organizationId) || organizationId <= 0) {
        throw new TestRunsError(403, 'FORBIDDEN', 'Organizzazione non valida.');
    }
}

async function assertWpqrCompany(user, wpqr, level) {
    if (!user) return;
    const accessList = await ensureCompanyAccessLoaded(user);
    if (!hasCompanyAccessRows(accessList)) {
        if (level !== 'write') return;
        const denied = await assertMutatingAllowed(user, {});
        if (denied) {
            throw new TestRunsError(denied.status, denied.body.code || 'FORBIDDEN', denied.body.error);
        }
        return;
    }
    const companyId = (wpqr.company_id != null && wpqr.company_id !== '')
        ? wpqr.company_id
        : wpqr.wps_company_id;
    if (companyId == null || companyId === '') {
        throw new TestRunsError(403, 'FORBIDDEN', 'Accesso non consentito');
    }
    const denied = level === 'write'
        ? await assertMutatingAllowed(user, { companyId })
        : await assertCompanyRead(user, companyId);
    if (denied) {
        throw new TestRunsError(denied.status, denied.body.code || 'FORBIDDEN', denied.body.error);
    }
}

async function listTestRuns({ wpqrId, organizationId, user }) {
    requireTenant(organizationId);
    const wpqr = await findWpqrInTenant(wpqrId, organizationId);
    if (!wpqr) throw new TestRunsError(404, 'WPQR_NOT_FOUND', 'WPQR non trovato');
    await assertWpqrCompany(user, wpqr, 'read');
    if (!(await tableExists('wpqr_test_runs'))) return { runs: [], available: false };
    const r = await query(
        `SELECT ${READ_COLUMNS.join(', ')}
         FROM wpqr_test_runs
         WHERE wpqr_id = @wpqr_id AND organization_id = @organization_id AND deleted_at IS NULL
         ORDER BY id`,
        { wpqr_id: wpqrId, organization_id: organizationId }
    );
    return { runs: r.recordset, available: true };
}

/**
 * Replace-set in transazione: sostituisce le passate attive della WPQR.
 * Non è l'Elimina: le righe sostituite escono dal set e non finiscono nel cestino,
 * altrimenti un Ripristina le rimetterebbe accanto a quelle nuove.
 */
async function replaceTestRuns({ wpqrId, organizationId, runs, user }) {
    requireTenant(organizationId);
    const wpqr = await findWpqrInTenant(wpqrId, organizationId);
    if (!wpqr) throw new TestRunsError(404, 'WPQR_NOT_FOUND', 'WPQR non trovato');
    await assertWpqrCompany(user, wpqr, 'write');

    const { rows, errors } = normalizeRuns(runs);
    if (errors.length > 0) {
        throw new TestRunsError(400, 'VALIDATION_ERROR', 'Passate non valide.', errors);
    }
    if (!(await tableExists('wpqr_test_runs'))) {
        throw new TestRunsError(
            503,
            'WPQR_TEST_RUNS_UNAVAILABLE',
            'Archivio passate non ancora disponibile: migrazione database non applicata.'
        );
    }

    const previous = await query(
        `SELECT id FROM wpqr_test_runs
         WHERE wpqr_id = @wpqr_id AND organization_id = @organization_id AND deleted_at IS NULL`,
        { wpqr_id: wpqrId, organization_id: organizationId }
    );
    const previousIds = (previous.recordset || []).map((row) => row.id);
    const actorUserId = user && user.user_id ? user.user_id : null;

    const pool = await getPool();
    const tx = pool.transaction();
    await tx.begin();
    try {
        const run = async (sqlText, params) => {
            const request = tx.request();
            Object.entries(params).forEach(([k, v]) => request.input(k, v));
            return request.query(sqlText);
        };
        await run(
            `DELETE FROM wpqr_test_runs
             WHERE wpqr_id = @wpqr_id AND organization_id = @organization_id AND deleted_at IS NULL`,
            { wpqr_id: wpqrId, organization_id: organizationId }
        );
        const columns = ['organization_id', 'company_id', 'wpqr_id', ...WRITABLE_COLUMNS, 'created_at', 'updated_at'];
        const values = [
            '@organization_id', '@company_id', '@wpqr_id',
            ...WRITABLE_COLUMNS.map((c) => `@${c}`), 'GETDATE()', 'GETDATE()',
        ];
        for (const row of rows) {
            await run(
                `INSERT INTO wpqr_test_runs (${columns.join(', ')}) VALUES (${values.join(', ')})`,
                {
                    ...row,
                    organization_id: wpqr.organization_id,
                    company_id: wpqr.company_id === undefined ? null : wpqr.company_id,
                    wpqr_id: wpqr.id,
                }
            );
        }
        await tx.commit();
    } catch (err) {
        await tx.rollback().catch(() => {});
        logger.error('WPQR test runs replace failed', { wpqr_id: wpqrId, organization_id: organizationId, error: err.message });
        throw new TestRunsError(500, 'WPQR_TEST_RUNS_SAVE_ERROR', "Errore durante il salvataggio delle passate");
    }

    await logEntityChange({
        organizationId,
        entityTable: 'wpqr_test_runs',
        entityId: wpqrId,
        actionType: 'updated',
        actorUserId,
        changes: [{
            fieldName: 'replace_set',
            oldValue: { active_ids: previousIds },
            newValue: { run_count: rows.length },
        }],
    });

    logger.info('WPQR test runs replaced', { wpqr_id: wpqrId, organization_id: organizationId, count: rows.length });
    return listTestRuns({ wpqrId, organizationId });
}

/**
 * Cancellazione delle dipendenze di una o più WPQR (passate e link WPS↔WPQR) PRIMA di cancellare le WPQR:
 * le FK 173/174 non hanno ON DELETE. Tabelle assenti (migrazioni non applicate) → saltate.
 * `wpqrIds` deve provenire da query già filtrate per tenant; ogni DELETE ripete comunque `organization_id`.
 */
async function deleteWpqrDependents({ organizationId, wpqrIds, actorUserId = null }) {
    const ids = [...new Set((wpqrIds || []).map(Number))].filter((n) => Number.isSafeInteger(n) && n > 0);
    if (ids.length === 0) return;
    requireTenant(organizationId);
    const list = ids.join(',');
    if (await tableExists('wpqr_test_runs')) {
        await query(
            `UPDATE wpqr_test_runs SET deleted_at = SYSUTCDATETIME(), deleted_by = @actor_user_id WHERE organization_id = @organization_id AND deleted_at IS NULL AND wpqr_id IN (${list})`,
            { organization_id: organizationId, actor_user_id: actorUserId }
        );
    }
    if (await tableExists('wps_wpqr_links')) {
        await query(
            `UPDATE wps_wpqr_links SET deleted_at = SYSUTCDATETIME(), deleted_by = @actor_user_id WHERE organization_id = @organization_id AND deleted_at IS NULL AND wpqr_id IN (${list})`,
            { organization_id: organizationId, actor_user_id: actorUserId }
        );
    }
}

/** Link di una WPS (da cancellare prima della WPS stessa). */
async function deleteWpsLinks({ organizationId, wpsId, actorUserId = null }) {
    const id = Number(wpsId);
    if (!Number.isSafeInteger(id) || id <= 0) return;
    requireTenant(organizationId);
    if (await tableExists('wps_wpqr_links')) {
        await query(
            `UPDATE wps_wpqr_links SET deleted_at = SYSUTCDATETIME(), deleted_by = @actor_user_id WHERE organization_id = @organization_id AND wps_id = @wps_id AND deleted_at IS NULL`,
            { organization_id: organizationId, wps_id: id, actor_user_id: actorUserId }
        );
    }
}

/**
 * Ingest / rielaborazione: inserisce le passate AI solo se la WPQR non ne ha già
 * (mai sovrascrive passate manuali). Ritorna il numero di righe inserite.
 */
async function insertAiTestRunsIfEmpty({ wpqrId, organizationId, companyId = null, runs = [] }) {
    requireTenant(organizationId);
    const list = Array.isArray(runs) ? runs.filter((r) => r && typeof r === 'object' && !Array.isArray(r)) : [];
    if (!list.length) return 0;
    if (!(await tableExists('wpqr_test_runs'))) return 0;
    const existing = await query(
        `SELECT TOP 1 id FROM wpqr_test_runs
         WHERE wpqr_id = @wpqr_id AND organization_id = @organization_id AND deleted_at IS NULL`,
        { wpqr_id: wpqrId, organization_id: organizationId }
    );
    if (existing.recordset && existing.recordset.length) return 0;

    const columns = ['organization_id', 'company_id', 'wpqr_id', ...WRITABLE_COLUMNS, 'created_at', 'updated_at'];
    const values = [
        '@organization_id', '@company_id', '@wpqr_id',
        ...WRITABLE_COLUMNS.map((c) => `@${c}`), 'GETDATE()', 'GETDATE()',
    ];
    let inserted = 0;
    for (const raw of list) {
        const row = { ...raw, source: 'ai' };
        for (const col of WRITABLE_COLUMNS) {
            if (row[col] === undefined) row[col] = null;
        }
        await query(
            `INSERT INTO wpqr_test_runs (${columns.join(', ')}) VALUES (${values.join(', ')})`,
            {
                ...row,
                organization_id: organizationId,
                company_id: companyId == null ? null : companyId,
                wpqr_id: wpqrId,
            }
        );
        inserted += 1;
    }
    return inserted;
}

module.exports = {
    MAX_RUNS,
    UNITS,
    NUMERIC_FIELDS,
    TEXT_FIELDS,
    WRITABLE_COLUMNS,
    TestRunsError,
    parseId,
    parseStrictNumber,
    normalizeRun,
    normalizeRuns,
    WPQR_TEST_HEADER_FIELDS,
    normalizeTestHeader,
    testHeaderColumnsAvailable,
    listTestRuns,
    replaceTestRuns,
    deleteWpqrDependents,
    deleteWpsLinks,
    insertAiTestRunsIfEmpty,
};
