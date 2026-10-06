/**
 * verifyRecordLoader.js — lettura (solo SELECT) dei record `qualifications` per la verifica vs norma.
 *
 * Tollerante alle colonne assenti: la migrazione 168 (colonne di prova/validità) NON è assunta
 * applicata. Le colonne realmente presenti si leggono da INFORMATION_SCHEMA (cache di processo,
 * con scadenza) e la SELECT contiene solo quelle: una colonna mancante diventa `null` nella riga,
 * quindi le regole di ricalcolo rispondono `non_verificabile_dato_mancante` invece di un errore SQL.
 *
 * Nessuna scrittura, nessuna migrazione, nessun accesso a file: solo lettura da DB.
 */

'use strict';

const { query } = require('../../config/database');

/** Colonne di base della tabella (migrazione 032): sempre presenti. */
const CORE_COLUMNS = Object.freeze([
    'id', 'organization_id', 'person_name', 'qualification_type', 'status',
]);

/** Colonne lette dalla vista canonica `qualificationRecordView` (ingresso `db`). */
const OPTIONAL_COLUMNS = Object.freeze([
    'standard_ref', 'certificate_number', 'issuing_body', 'examiner_body',
    'joint_type', 'product_type', 'welding_process', 'material_group', 'filler_material',
    'shielding_gas', 'weld_details', 'transfer_mode', 'position_range',
    'qualification_designation',
    'thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited', 'thickness_range',
    'pipe_diameter_min_mm', 'pipe_diameter_max_mm',
    'exam_date', 'issue_date', 'expiry_date',
    'last_confirmation_date', 'next_confirmation_due', 'revalidation_date',
    // Colonne di prova/validità (migrazione 168): possono non esistere sul DB.
    'welding_process_test', 'welding_processes_validity', 'welding_position_test',
    'thickness_s_test_mm', 'thickness_t_test_mm', 'pipe_diameter_test_mm',
]);

/** Tetto di sicurezza sui record letti per una singola scansione. */
const DEFAULT_MAX_ROWS = 5000;
const COLUMNS_CACHE_TTL_MS = 10 * 60 * 1000;

let columnsCache = null;

function resetColumnsCache() {
    columnsCache = null;
}

async function readExistingColumns() {
    const result = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'qualifications'",
    );
    const names = new Set((result.recordset || []).map((r) => String(r.COLUMN_NAME).toLowerCase()));
    if (names.size === 0) {
        throw new Error('Struttura della tabella qualifications non leggibile (INFORMATION_SCHEMA vuoto)');
    }
    return names;
}

/**
 * Insieme (lowercase) delle colonne esistenti su `qualifications`.
 * Un errore di lettura non viene messo in cache.
 */
async function getQualificationColumns({ now = Date.now() } = {}) {
    if (columnsCache && now - columnsCache.at < COLUMNS_CACHE_TTL_MS) return columnsCache.columns;
    const columns = await readExistingColumns();
    columnsCache = { at: now, columns };
    return columns;
}

/**
 * @returns {Promise<{selected: string[], missing: string[]}>} colonne da selezionare e colonne opzionali assenti
 */
async function resolveSelectableColumns(options) {
    const existing = await getQualificationColumns(options);
    const missingCore = CORE_COLUMNS.filter((c) => !existing.has(c));
    if (missingCore.length) {
        throw new Error(`Colonne di base assenti su qualifications: ${missingCore.join(', ')}`);
    }
    const optionalPresent = OPTIONAL_COLUMNS.filter((c) => existing.has(c));
    const missing = OPTIONAL_COLUMNS.filter((c) => !existing.has(c));
    return { selected: [...CORE_COLUMNS, ...optionalPresent], missing };
}

/**
 * Carica i record non revocati da verificare, ordinati per id.
 * @param {{qualTypeLike?: string|null, orgId?: number|null, maxRows?: number}} [opts]
 * @returns {Promise<{rows: object[], truncated: boolean, missingColumns: string[]}>}
 */
async function loadQualificationsForVerify({ qualTypeLike = null, orgId = null, maxRows = DEFAULT_MAX_ROWS } = {}) {
    const cap = Math.max(1, Math.floor(Number(maxRows)) || DEFAULT_MAX_ROWS);
    const { selected, missing } = await resolveSelectableColumns();

    const conditions = ["status != 'revocata'"];
    const params = {};
    if (qualTypeLike) {
        conditions.push('qualification_type LIKE @qualTypeLike');
        params.qualTypeLike = qualTypeLike;
    }
    if (orgId) {
        conditions.push('organization_id = @orgId');
        params.orgId = orgId;
    }

    const result = await query(`
        SELECT TOP ${cap + 1} ${selected.join(', ')}
        FROM qualifications
        WHERE ${conditions.join(' AND ')}
        ORDER BY id
    `, params);

    const all = result.recordset || [];
    const truncated = all.length > cap;
    const rows = truncated ? all.slice(0, cap) : all;
    return { rows, truncated, missingColumns: missing };
}

module.exports = {
    CORE_COLUMNS,
    OPTIONAL_COLUMNS,
    DEFAULT_MAX_ROWS,
    COLUMNS_CACHE_TTL_MS,
    getQualificationColumns,
    resolveSelectableColumns,
    loadQualificationsForVerify,
    resetColumnsCache,
};
