/**
 * qualifications.controller.js — Registro Qualifiche v2
 *
 * Decisione di prodotto (28/07/2026): i patentini caricati sono certificati
 * già emessi e validi rilasciati da un ente terzo accreditato (es. TEC
 * Eurolab/Accredia) — il modulo serve a ESTRARRE e INTERROGARE i dati (chi è
 * qualificato per quale processo/giunto/spessore/posizione), non a gestire un
 * workflow di approvazione interna. Il gate manuale Approva/Rifiuta/Revoca è
 * stato rimosso: ogni qualifica è utilizzabile per le query di copertura non
 * appena creata. L'unico controllo automatico rimasto è basato su date
 * (expiry_date + conferma semestrale ISO 9606-1/ISO 14732, vedi
 * weldingCoordinatorAuth.service.js → isQualificationOperationallyActive).
 * Dettaglio: docs/GUIDA_CONSOLIDATA.md.
 *
 * Endpoints:
 *   GET    /qualifications              → lista con semaforo + filtri tipo
 *   GET    /qualifications/stats        → conteggi stato
 *   GET    /qualifications/coverage     → copertura commessa (?project_id=X)
 *   GET    /qualifications/coverage/domains → registry domini copertura (COV-1)
 *   POST   /qualifications/coverage/verify → verifica requisito↔capacità per dominio
 *   GET    /qualifications/vision-fitness-gaps → gap idoneità visiva NDT/VT
 *   GET    /qualifications/:id          → dettaglio
 *   POST   /qualifications              → crea (sempre attiva, approval_status=approvata)
 *   PUT    /qualifications/:id          → aggiorna
 *   DELETE /qualifications/:id          → stato di business revocata — non è il cestino
 *   DELETE /qualifications/:id/permanent → cestino (deleted_at): non è una cancellazione definitiva
 *   POST   /qualifications/:id/renew    → rinnovo → nuovo record con previous_qualification_id
 */

const path = require('path');
const fs   = require('fs');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');
const { normalizeApplicableWpsIds } = require('../utils/applicableWpsIds');
const { logEntityChange, trashedDetailHidden } = require('../services/entityChangeLog.service');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
    assertMutatingAllowed,
    assertCompanyRead,
    hasCompanyAccessRows,
    sendAccessDenied,
} = require('../services/companyAccess.service');

/** Utente con user_company_access: 403 fuori dalle aziende consentite.
 *  Studio senza aziende assegnate: lettura libera; scrittura no per il viewer. */
async function denyOutsideCompany(res, user, companyId, level = 'read') {
    const accessList = await ensureCompanyAccessLoaded(user);
    if (!hasCompanyAccessRows(accessList)) {
        if (level !== 'write') return false;
        const studioDenied = await assertMutatingAllowed(user, {});
        if (studioDenied) {
            sendAccessDenied(res, studioDenied);
            return true;
        }
        return false;
    }
    let denied;
    if (companyId == null || companyId === '') {
        denied = { status: 403, body: { error: 'Accesso non consentito', code: 'FORBIDDEN' } };
    } else if (level === 'write') {
        denied = await assertMutatingAllowed(user, { companyId });
    } else {
        denied = await assertCompanyRead(user, companyId);
    }
    if (denied) {
        sendAccessDenied(res, denied);
        return true;
    }
    return false;
}

/** Come denyOutsideCompany, senza scrivere la risposta. Serve a troncare una catena. */
async function isOutsideCompany(user, companyId, level = 'read') {
    const accessList = await ensureCompanyAccessLoaded(user);
    if (!hasCompanyAccessRows(accessList)) {
        if (level !== 'write') return false;
        return Boolean(await assertMutatingAllowed(user, {}));
    }
    if (companyId == null || companyId === '') return true;
    const denied = level === 'write'
        ? await assertMutatingAllowed(user, { companyId })
        : await assertCompanyRead(user, companyId);
    return Boolean(denied);
}
const { resolvePersonnelForQualification } = require('../services/personnelQualificationLink.service');
const {
    DUPLICATE_QUALIFICATION_MESSAGE,
    findQualificationDuplicate,
    isQualificationDuplicateIndexError,
    poolDb,
} = require('../services/qualificationDuplicate.service');
const { resolvePrintedDesignation } = require('../utils/weldingDesignation');
const { describeIngestFileError, redactFileNameForLog } = require('../utils/ingestErrorMessage');
const {
    validateCertificateFileUrl,
    expectedQualificationUrl,
    CERTIFICATE_FILE_URL_ERROR,
} = require('../services/certificateFileUrl.service');
const {
    isWelder9606Type,
    requiresSemiannualConfirmation,
    effectiveExpiryDate,
    addMonthsIso,
    canUserConfirmSemiannual,
} = require('../services/weldingCoordinatorAuth.service');
const {
    DAYS_WARNING,
    DAYS_URGENT,
    EFFECTIVE_SQL,
    SITUAZIONE_BUCKET_SQL,
    effectiveStatusFilterSql,
    expiringDaysFilterSql,
} = require('../services/qualificationExpirySql');
const { toNumericOrNull } = require('../utils/numericSanitizer');
const { FIELD_STATE, getFieldState, nullNotApplicableFields } = require('../data/jointTypeProfiles');
const { occupationalQualificationSqlInList, isVisionFitnessType } = require('../constants/occupationalQualificationTypes');
const { findVisionFitnessGaps } = require('../services/visionFitness.service');
const {
    computeWpsWelderCoverage,
    loadWelderQualificationsForProject,
} = require('../services/capabilityCoverage/wpsWelderCoverage');
const XLSX = require('xlsx');

/**
 * Campi qualifiche modificabili da form/API manuale (create/updateQualification)
 * — fonte unica, riusata anche dal test strutturale
 * `qualifications.controller.manualFieldsCompleteness.test.js` (verifica che ogni
 * campo degli schemi ingest patentino_saldatore/qualifica_14732/cert_ndt/
 * qualifica_14731 sia qui, stesso pattern del gap analysis WPQR 08/08/2026).
 * Esclusi di proposito: colonne di sistema, workflow di approvazione
 * (approval_status/approved_by/approved_at/rejection_reason — rimosso come gate
 * manuale, vedi header file), previous_qualification_id (gestito solo dal rinnovo),
 * certificate_original_url (link file, non testo).
 * NOTA: questa lista deve restare sincronizzata a mano con la query UPDATE in
 * updateQualification (non generata dinamicamente, a differenza di WPQR) — il
 * test strutturale segnala solo i campi ingest mancanti qui, non un disallineamento
 * con la query stessa.
 */
const QUALIFICATION_MANUAL_EDITABLE_FIELDS = [
    'company_id', 'person_name', 'person_code', 'personnel_id', 'department',
    'qualification_type', 'standard_ref', 'scope_detail', 'certificate_number', 'issuing_body',
    'issue_date', 'exam_date', 'expiry_date', 'last_renewal_date',
    'near_vision_expiry_date', 'colour_vision_expiry_date',
    'last_confirmation_date', 'next_confirmation_due', 'revalidation_date',
    'status', 'notes',
    'welding_process', 'material_group', 'position_range', 'ndt_method', 'ndt_level',
    'joint_type', 'product_type', 'weld_details', 'transfer_mode',
    'thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited',
    'pipe_diameter_min_mm', 'pipe_diameter_max_mm', 'thickness_range', 'pipe_diameter',
    'filler_material', 'shielding_gas', 'equipment_type',
    'welding_process_test', 'welding_processes_validity', 'welding_position_test',
    'thickness_s_test_mm', 'thickness_t_test_mm', 'pipe_diameter_test_mm',
    'qualification_designation',
    'welding_type', 'single_multi_run', 'qualification_method',
    'ndt_sector', 'certification_scheme',
    'coordinator_title', 'diploma_number', 'cpd_valid_until',
    'patent_type', 'training_body', 'course_name', 'training_hours',
    'examiner_body', 'certificate_file_url',
];

/**
 * Campi non applicabili per famiglia+edizione (ISO 14732 Annex C) a NULL nel body di create/update
 * manuale; solo con famiglia certa (vedi `getFieldApplicability`). Mai sentinelle ('NN').
 * `designationApplicable`: la designazione stampata non si ricalcola per i tipi che non la prevedono.
 */
function applyFieldApplicability(rawBody) {
    const input = rawBody && typeof rawBody === 'object' ? rawBody : {};
    const ctx = { qualificationType: input.qualification_type, standardReference: input.standard_ref };
    return {
        body: nullNotApplicableFields(input, ctx).fields,
        designationApplicable: getFieldState(ctx, 'qualification_designation') !== FIELD_STATE.NOT_APPLICABLE,
    };
}

/**
 * Converte un valore in numero finito o null (per colonne DECIMAL).
 * Alias locale su numericSanitizer.js — stessa policy usata dall'ingest AI
 * (bug produzione 27/07/2026: valori come "N.A." o range testuali su colonne
 * DECIMAL rompevano la INSERT/UPDATE con "Error converting data type nvarchar
 * to numeric"). Mantenuto come funzione locale per non toccare le ~15 chiamate
 * esistenti in questo file.
 */
function toNum(v) {
    return toNumericOrNull(v);
}

/** Converte in intero finito o null (per colonne INT: ndt_level, training_hours). */
/** Le due date oculistiche si salvano solo sul certificato visivo. Altri tipi: NULL. */
function persistedVisionClocks(qualificationType, near, colour) {
    if (!isVisionFitnessType(qualificationType)) return { near: null, colour: null };
    return { near: near || null, colour: colour || null };
}

function toIntOrNull(v) {
    const n = toNumericOrNull(v);
    return n != null ? Math.trunc(n) : null;
}

/**
 * Deriva la stringa legacy di range (es. "3-10mm") dai valori numerici min/max.
 * Se e' noto solo il minimo (max vuoto/null) restituisce "\u22653mm" (>=3mm): significa
 * "nessun limite superiore" (feedback cliente Studio Mason). V. gemella in
 * importJobs.controller.js — mantenere sincronizzate.
 */
function deriveRangeString(min, max, suffix = 'mm') {
    const a = toNum(min);
    const b = toNum(max);
    if (a == null && b == null) return null;
    if (a != null && b != null) return a === b ? `${a}${suffix}` : `${a}-${b}${suffix}`;
    if (a != null) return `\u2265${a}${suffix}`;
    return `${b}${suffix}`;
}

function semaforo(expiryDate, status) {
    if (status === 'sospesa' || status === 'revocata') return 'grigio';
    if (!expiryDate) return 'verde';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    const diffDays = Math.floor((expiry - today) / 86400000);
    if (diffDays < 0)              return 'rosso';
    if (diffDays <= DAYS_URGENT)   return 'arancione';
    if (diffDays <= DAYS_WARNING)  return 'giallo';
    return 'verde';
}

/** Calcola il semaforo usando la data effettiva (conferma periodica per i 9606). */
function semaforoForRow(q) {
    return semaforo(effectiveExpiryDate(q), q.status);
}

/** company_id da query string: vuoto = nessun filtro; non numerico = errore (400). */
function parseCompanyIdParam(raw) {
    const text = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!text) return { value: null };
    if (!/^\d{1,9}$/.test(text)) return { error: true };
    return { value: parseInt(text, 10) };
}

/**
 * Famiglia (tab) di ogni qualifica: una e una sola per riga, in ordine di priorita'. Lista e statistiche
 * filtrano sulla stessa espressione e "generico" e' il complemento, quindi ogni qualifica compare in
 * esattamente un tab specifico (oltre a "Tutti") e la somma dei tab = Totale. Le sigle di 2 lettere
 * (NDT VT/PT/MT/UT/RT/ET) valgono solo come parola intera e in maiuscolo; PES e PAV come parola intera
 * senza distinzione di maiuscole (un tipo "Abilitazione Pav" o "qualifica_pav" resta in PES/PAV).
 * Niente match per sottostringa in parole comuni ("Addetto antincendio", "Pavimentazione").
 */
const PADDED_TYPE_BIN = "(N' ' + q.qualification_type + N' ') COLLATE Latin1_General_BIN";
const PADDED_TYPE_CI = "(N' ' + q.qualification_type + N' ') COLLATE Latin1_General_CI_AS";
const QUALIFICATION_TAB_FAMILY_SQL = `(CASE
    WHEN q.qualification_type IN (${occupationalQualificationSqlInList()}) THEN 'salute_mansione'
    WHEN q.qualification_type LIKE '%14732%' THEN 'iso14732'
    WHEN q.qualification_type LIKE '%14731%' THEN 'iso14731'
    WHEN q.qualification_type LIKE '%9606-1%' THEN 'iso9606_1'
    WHEN q.qualification_type LIKE '%9606-2%' THEN 'iso9606_2'
    WHEN q.qualification_type LIKE '%9606%' OR LOWER(q.qualification_type) LIKE '%patentino_saldatore%' THEN 'iso9606_1'
    WHEN q.qualification_type LIKE '%NDT%' OR q.qualification_type LIKE '%9712%'
      OR ${PADDED_TYPE_BIN} LIKE '%[^A-Za-z][VMPUER]T[^A-Za-z]%' THEN 'ndt'
    WHEN q.qualification_type LIKE '%CEI 11-27%'
      OR ${PADDED_TYPE_CI} LIKE '%[^A-Za-z]PES[^A-Za-z]%'
      OR ${PADDED_TYPE_CI} LIKE '%[^A-Za-z]PAV[^A-Za-z]%' THEN 'pes_pav'
    ELSE 'generico'
END)`;
const QUALIFICATION_TAB_FAMILIES = Object.freeze([
    'iso9606_1', 'iso9606_2', 'iso14732', 'ndt', 'iso14731', 'pes_pav', 'salute_mansione', 'generico',
]);

// Chiavi non-tab (metodo NDT singolo, PES/PAV separati): stessa regola "parola intera" della partizione
// dei tab, non una sottostringa ("%PT%" ritroverebbe "Istruttore", "%UT%" "Attestato di frequenza ...").
const QUAL_TYPE_TOKEN_KEYS = Object.freeze({
    iso9712_vt: { token: 'VT', padded: PADDED_TYPE_BIN },
    iso9712_pt: { token: 'PT', padded: PADDED_TYPE_BIN },
    iso9712_mt: { token: 'MT', padded: PADDED_TYPE_BIN },
    iso9712_ut: { token: 'UT', padded: PADDED_TYPE_BIN },
    iso9712_rt: { token: 'RT', padded: PADDED_TYPE_BIN },
    iso9712_et: { token: 'ET', padded: PADDED_TYPE_BIN },
    pes:        { token: 'PES', padded: PADDED_TYPE_CI },
    pav:        { token: 'PAV', padded: PADDED_TYPE_CI },
});

/**
 * Filtro tab (qualification_type) condiviso da lista e statistiche: le card contano
 * esattamente le righe del tab attivo. Ritorna { clause, like } (like = valore del
 * parametro @qualType, solo per le chiavi sconosciute, cercate come testo letterale).
 */
function buildQualificationTypeScope(qualificationType) {
    const type = String(qualificationType || '').trim().slice(0, 100);
    if (!type) return { clause: null, like: null };
    if (QUALIFICATION_TAB_FAMILIES.includes(type)) {
        return { clause: `${QUALIFICATION_TAB_FAMILY_SQL} = N'${type}'`, like: null };
    }
    if (Object.prototype.hasOwnProperty.call(QUAL_TYPE_TOKEN_KEYS, type)) {
        const { token, padded } = QUAL_TYPE_TOKEN_KEYS[type];
        return { clause: `${padded} LIKE '%[^A-Za-z]${token}[^A-Za-z]%'`, like: null };
    }
    const escaped = type.replace(/[\\%_[]/g, (ch) => `\\${ch}`);
    return { clause: "q.qualification_type LIKE @qualType ESCAPE '\\'", like: `%${escaped}%` };
}

/** GET /qualifications */
async function listQualifications(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'q');
        const {
            search = '', company_id = '', status = '',
            approval_status = '',
            person_name = '', expiring_days = '',
            qualification_type = '', situazione = '',
            page = 1, limit = 50,
        } = req.query;

        const companyScope = parseCompanyIdParam(company_id);
        if (companyScope.error) {
            return res.status(400).json({ error: 'company_id non valido.', code: 'INVALID_COMPANY_ID' });
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 50));
        const offset = (pageNum - 1) * limitNum;
        let where = ['q.organization_id = @orgId', 'q.deleted_at IS NULL'];
        if (companyFilter.clause) where.push(companyFilter.clause);
        if (search) where.push("(q.person_name LIKE @search OR q.qualification_type LIKE @search OR q.certificate_number LIKE @search)");
        if (companyScope.value !== null) where.push('q.company_id = @companyId');
        // Stato effettivo (data), non colonna salvata: stessa logica di card e filtro situazione.
        const statusClause = status ? effectiveStatusFilterSql(status) : null;
        if (statusClause) where.push(statusClause);
        else if (status) where.push('q.status = @status');
        if (approval_status) where.push('q.approval_status = @approvalStatus');

        const typeScope = buildQualificationTypeScope(qualification_type);
        const qualTypeLike = typeScope.like;
        if (typeScope.clause) where.push(typeScope.clause);

        if (expiring_days) {
            where.push(expiringDaysFilterSql(parseInt(expiring_days)));
        }

        // Filtro "situazione" (card statistiche): stessi bucket di getStats (SITUAZIONE_BUCKET_SQL).
        if (situazione && SITUAZIONE_BUCKET_SQL[situazione]) {
            where.push(SITUAZIONE_BUCKET_SQL[situazione]);
        }

        const whereClause = where.join(' AND ');

        const bindListFilters = (request) => {
            Object.entries(companyFilter.params).forEach(([k, v]) => request.input(k, v));
            if (search) request.input('search', `%${search}%`);
            if (companyScope.value !== null) request.input('companyId', companyScope.value);
            if (status && !statusClause) request.input('status', status);
            if (approval_status) request.input('approvalStatus', approval_status);
            if (qualTypeLike) request.input('qualType', qualTypeLike);
            if (expiring_days) request.input('expDays', parseInt(expiring_days));
        };

        const r = pool.request().input('orgId', orgId).input('lim', limitNum).input('off', offset);
        bindListFilters(r);

        const countReq = pool.request().input('orgId', orgId);
        bindListFilters(countReq);
        const countResult = await countReq.query(`SELECT COUNT(*) AS total FROM qualifications q WHERE ${whereClause}`);

        const result = await r.query(`
            SELECT q.*,
                   c.name AS company_name,
                   u.full_name AS approved_by_name
            FROM qualifications q
            LEFT JOIN companies c ON c.id = q.company_id
            LEFT JOIN users u ON u.user_id = q.approved_by
            WHERE ${whereClause}
            ORDER BY
                CASE WHEN ${EFFECTIVE_SQL} IS NULL THEN 1 ELSE 0 END,
                ${EFFECTIVE_SQL} ASC,
                q.person_name ASC,
                q.id ASC
            OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
        `);

        const qualifications = result.recordset.map(q => ({
            ...q,
            effective_expiry_date: effectiveExpiryDate(q),
            semaforo: semaforoForRow(q),
        }));

        res.json({
            qualifications,
            total: countResult.recordset[0].total,
            page: pageNum,
            limit: limitNum,
        });
    } catch (err) {
        logger.error('listQualifications:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** GET /qualifications/stats[?company_id=&qualification_type=] — stesso scope (Ambito + tab) della lista. */
async function getStats(req, res) {
    try {
        const pool       = await getPool();
        const orgId      = req.user.organization_id;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'q');

        const companyScope = parseCompanyIdParam(req.query?.company_id);
        if (companyScope.error) {
            return res.status(400).json({ error: 'company_id non valido.', code: 'INVALID_COMPANY_ID' });
        }
        const typeScope = buildQualificationTypeScope(req.query?.qualification_type);

        const where = ['q.organization_id = @orgId', 'q.deleted_at IS NULL'];
        if (companyFilter.clause) where.push(companyFilter.clause);
        if (companyScope.value !== null) where.push('q.company_id = @companyId');
        if (typeScope.clause) where.push(typeScope.clause);

        const r = pool.request().input('orgId', orgId);
        Object.entries(companyFilter.params).forEach(([k, v]) => r.input(k, v));
        if (companyScope.value !== null) r.input('companyId', companyScope.value);
        if (typeScope.like) r.input('qualType', typeScope.like);

        const bucketCount = (bucket, alias) =>
            `COALESCE(SUM(CASE WHEN ${SITUAZIONE_BUCKET_SQL[bucket]} THEN 1 ELSE 0 END), 0) AS ${alias}`;
        const statsResult = await r.query(`
            SELECT
                COUNT(*) AS total,
                ${bucketCount('valide', 'valide')},
                ${bucketCount('in_scadenza_60', 'in_scadenza_60')},
                ${bucketCount('urgenti_30', 'in_scadenza_30')},
                ${bucketCount('scadute', 'scadute')},
                ${bucketCount('non_attive', 'non_attive')}
            FROM qualifications q
            WHERE ${where.join(' AND ')}
        `);

        const s = statsResult.recordset[0];
        res.json({
            total:          s.total,
            valide:         s.valide,
            in_scadenza_60: s.in_scadenza_60,
            in_scadenza_30: s.in_scadenza_30,
            scadute:        s.scadute,
            non_attive:     s.non_attive,
            urgent:         (s.in_scadenza_30 || 0) + (s.scadute || 0),
        });
    } catch (err) {
        logger.error('getQualifStats:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * GET /qualifications/vision-fitness-gaps?company_id=
 * Persone con NDT/VT attive senza certificato idoneità visiva valido (acuità+Ishihara).
 */
async function getVisionFitnessGaps(req, res) {
    try {
        const orgId = req.user.organization_id;
        const companyIdRaw = req.query.company_id;
        const companyId = companyIdRaw != null && companyIdRaw !== ''
            ? parseInt(companyIdRaw, 10)
            : null;

        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyOk = companyId != null && !Number.isNaN(companyId);
        if (companyOk && await denyOutsideCompany(res, req.user, companyId, 'read')) return;

        const result = await findVisionFitnessGaps(orgId, {
            companyId: companyOk ? companyId : null,
            companyIds: !companyOk && hasCompanyAccessRows(accessList)
                ? accessList.map((a) => a.company_id)
                : null,
        });
        res.json(result);
    } catch (err) {
        logger.error('getVisionFitnessGaps:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** GET /qualifications/coverage?project_id=X
 *  Query incrociata: qualifiche attive + WPS disponibili vs requisiti commessa.
 *  Il match è range-aware: processo + spessore + gruppo materiale + posizione.
 */
async function getCoverage(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const { project_id } = req.query;
        if (!project_id) return res.status(400).json({ error: 'project_id richiesto.' });

        // Carica progetto (con company_id per filtrare saldatori)
        const projResult = await pool.request()
            .input('projId', parseInt(project_id))
            .input('orgId', orgId)
            .query(`SELECT id, project_code, applicable_wps_ids, company_id FROM projects WHERE id=@projId AND organization_id=@orgId AND deleted_at IS NULL`);
        if (!projResult.recordset.length) return res.status(404).json({ error: 'Commessa non trovata.' });

        const project = projResult.recordset[0];
        if (await denyOutsideCompany(res, req.user, project.company_id, 'read')) return;
        const projectCompanyId = project.company_id || null;
        const wpsIds = normalizeApplicableWpsIds(project.applicable_wps_ids);

        // Carica WPS della commessa — include campi numerici per il match range-aware
        let wpsRows = [];
        if (wpsIds.length) {
            const ph = wpsIds.map((_, i) => `@wid${i}`).join(',');
            const wReq = pool.request().input('orgId', orgId);
            wpsIds.forEach((id, i) => wReq.input(`wid${i}`, id));
            const wRes = await wReq.query(`
                SELECT id, wps_code, welding_process,
                       base_material_group, material_group,
                       thickness_range_min, thickness_range_max, thickness_range,
                       welding_positions, position
                FROM welding_procedures
                WHERE id IN (${ph}) AND organization_id = @orgId AND status != 'annullata' AND deleted_at IS NULL
            `);
            wpsRows = wRes.recordset;
        }

        // Se nessun WPS, risponde subito
        if (!wpsRows.length) {
            return res.json({
                project_id:   parseInt(project_id),
                project_code: project.project_code,
                has_wps:      false,
                coverage:     [],
                summary:      { total: 0, covered: 0, partial: 0, uncovered: 0 },
            });
        }

        // Qualifiche saldatori operative (loader unico condiviso con il Riesame) e match sul
        // registry welder_9606 tramite il ponte commessa (COV-4).
        const runQuery = (sql, params) => {
            const r = pool.request();
            Object.entries(params).forEach(([k, v]) => r.input(k, v));
            return r.query(sql);
        };
        const qualRows = await loadWelderQualificationsForProject({
            query: runQuery,
            organizationId: orgId,
            companyId: projectCompanyId,
        });

        // Normalizza WPS: usa base_material_group se presente, altrimenti material_group
        // Usa welding_positions se presente, altrimenti position (campo legacy)
        const normalizeWps = (wps) => ({
            ...wps,
            base_material_group: wps.base_material_group || wps.material_group || null,
            welding_positions:   wps.welding_positions   || wps.position        || null,
        });

        // Costruisce righe di copertura range-aware per ogni WPS
        const rows = wpsRows.map(rawWps => {
            const wps = normalizeWps(rawWps);
            const { qualifiers: qualifiersWithDetail, esito } = computeWpsWelderCoverage(wps, qualRows);

            return {
                wps_id:               wps.id,
                wps_code:             wps.wps_code,
                welding_process:      wps.welding_process,
                material_group:       wps.base_material_group,
                thickness_range_min:  wps.thickness_range_min,
                thickness_range_max:  wps.thickness_range_max,
                welding_positions:    wps.welding_positions,
                qualified_count:      qualifiersWithDetail.length,
                esito,
                qualifiers: qualifiersWithDetail.map(({ q, detail }) => ({
                    id:              q.id,
                    person_name:     q.person_name,
                    person_code:     q.person_code,
                    company_name:    q.company_name,
                    expiry_date:     q.expiry_date,
                    semaforo:        semaforoForRow(q),
                    coverage_detail: detail,
                })),
            };
        });

        const covered   = rows.filter(r => r.esito === 'verde').length;
        const partial   = rows.filter(r => r.esito === 'giallo').length;
        const uncovered = rows.filter(r => r.esito === 'rosso').length;

        res.json({
            project_id:   parseInt(project_id),
            project_code: project.project_code,
            has_wps:      true,
            coverage:     rows,
            summary:      { total: rows.length, covered, partial, uncovered },
        });
    } catch (err) {
        logger.error('getCoverage:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** GET /qualifications/:id */
async function getOne(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const r = await pool.request()
            .input('id', parseInt(req.params.id))
            .input('orgId', orgId)
            .query(`
                SELECT q.*, c.name AS company_name, u.full_name AS approved_by_name
                FROM qualifications q
                LEFT JOIN companies c ON c.id = q.company_id
                LEFT JOIN users u ON u.user_id = q.approved_by
                WHERE q.id=@id AND q.organization_id=@orgId
            `);
        if (!r.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const row = r.recordset[0];
        if (trashedDetailHidden(req.user, row)) return res.status(404).json({ error: 'Non trovata.' });
        const accessList = await ensureCompanyAccessLoaded(req.user);
        if (hasCompanyAccessRows(accessList)) {
            if (!row.company_id) {
                return res.status(403).json({ error: 'Accesso non consentito', code: 'FORBIDDEN' });
            }
            const denied = await assertCompanyRead(req.user, row.company_id);
            if (denied) return sendAccessDenied(res, denied);
        }

        res.json({ ...row, effective_expiry_date: effectiveExpiryDate(row), semaforo: semaforoForRow(row) });
    } catch (err) {
        logger.error('getOneQualif:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** POST /qualifications */
async function createQualification(req, res) {
    try {
        const { body, designationApplicable } = applyFieldApplicability(req.body);
        const {
            company_id, person_name, person_code, department, personnel_id,
            qualification_type, standard_ref, scope_detail,
            certificate_number, issuing_body,
            issue_date, expiry_date, last_renewal_date,
            near_vision_expiry_date, colour_vision_expiry_date,
            status = 'valida', notes,
            // v1 fields
            welding_process, material_group, position_range, ndt_method, ndt_level,
            // v2 fields
            joint_type, thickness_range, pipe_diameter, filler_material, shielding_gas, equipment_type,
            ndt_sector, certification_scheme,
            coordinator_title, diploma_number, cpd_valid_until,
            patent_type, training_body,
            course_name, training_hours, examiner_body,
            certificate_file_url,
            // saldatore 9606-1 enrichment
            exam_date, last_confirmation_date, next_confirmation_due, revalidation_date,
            product_type, weld_details, transfer_mode,
            thickness_min_mm, thickness_max_mm, thickness_max_unlimited, pipe_diameter_min_mm, pipe_diameter_max_mm,
            welding_process_test, welding_processes_validity, welding_position_test,
            thickness_s_test_mm, thickness_t_test_mm, pipe_diameter_test_mm,
            qualification_designation,
            // operatore 14732 (saldatura automatica/meccanizzata)
            welding_type, single_multi_run, qualification_method,
        } = body;

        if (!person_name?.trim()) return res.status(400).json({ error: 'Il nome della persona \u00e8 obbligatorio.' });
        if (!qualification_type?.trim()) return res.status(400).json({ error: 'Il tipo di qualifica \u00e8 obbligatorio.' });

        // Collegamento anagrafica (company_personnel) — gap analysis 08/08/2026:
        // il form manuale offre il selettore "Da anagrafica azienda" (personnel_id)
        // ma la creazione/modifica non lo salvava mai (solo l'ingest AI e il rinnovo
        // lo persistevano), lasciando il collegamento silenziosamente perso.
        const personnelResult = await resolvePersonnelForQualification({
            organizationId: req.user.organization_id,
            companyId: company_id || null,
            personnelId: personnel_id,
            personName: person_name,
            personCode: person_code,
        });
        if (!personnelResult.ok) {
            return res.status(personnelResult.status || 400).json({ error: personnelResult.error, code: personnelResult.code });
        }

        // Range numerici (fonte primaria) + stringhe legacy derivate.
        const thickMin = toNum(thickness_min_mm);
        const thickMax = toNum(thickness_max_mm);
        const pipeMin  = toNum(pipe_diameter_min_mm);
        const pipeMax  = toNum(pipe_diameter_max_mm);
        const thicknessRangeFinal = thickness_range || deriveRangeString(thickMin, thickMax);
        const pipeDiameterFinal   = pipe_diameter || deriveRangeString(pipeMin, pipeMax);
        // Designazione stampata: non sovrascrivere se l'operatore/AI ha letto la riga.
        const designation = designationApplicable ? resolvePrintedDesignation(qualification_designation, {
            welding_process: welding_process_test || welding_process, product_type, joint_type,
            filler_material_group: filler_material,
            thickness_min_mm: thickMin, thickness_max_mm: thickMax,
            pipe_diameter_min_mm: pipeMin, pipe_diameter_max_mm: pipeMax,
            welding_positions: position_range, weld_details,
        }) : null;

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const userId = req.user.user_id;

        const certUrlCheck = await validateCertificateFileUrl(certificate_file_url, { organizationId: orgId });
        if (!certUrlCheck.ok) return res.status(CERTIFICATE_FILE_URL_ERROR.status).json(CERTIFICATE_FILE_URL_ERROR.body);

        // Anti-duplicato: stesso certificate_number + company_id + qualification_type (non revocate)
        // oppure stessa persona (indice unico): criteri in qualificationDuplicate.service
        if (certificate_number?.trim() && company_id) {
            const isDuplicate = await findQualificationDuplicate(
                poolDb(pool),
                {
                    organizationId: orgId,
                    companyId: parseInt(company_id),
                    certificateNumber: certificate_number,
                    qualificationType: qualification_type.trim(),
                    personName: personnelResult.personName || person_name.trim(),
                },
            );
            if (isDuplicate) {
                return res.status(409).json({
                    error: DUPLICATE_QUALIFICATION_MESSAGE,
                    code: 'DUPLICATE_QUALIFICATION',
                });
            }
        }

        const visionClocks = persistedVisionClocks(
            qualification_type,
            near_vision_expiry_date,
            colour_vision_expiry_date,
        );
        const r = await pool.request()
            .input('orgId',     orgId)
            .input('compId',    company_id   || null)
            .input('personName',personnelResult.personName || person_name.trim())
            .input('personCode',personnelResult.personCode || person_code || null)
            .input('personnelId', personnelResult.personnelId)
            .input('dept',      department   || null)
            .input('qualType',  qualification_type.trim())
            .input('stdRef',    standard_ref || null)
            .input('scope',     scope_detail || null)
            .input('certNum',   certificate_number || null)
            .input('issuer',    issuing_body || null)
            .input('issueDate', issue_date   || null)
            .input('expiryDate',expiry_date  || null)
            .input('nearVision', visionClocks.near)
            .input('colourVision', visionClocks.colour)
            .input('renewalDate',last_renewal_date || null)
            .input('status',    status)
            .input('notes',     notes        || null)
            .input('userId',    userId)
            // v1
            .input('weldProc',  welding_process || null)
            .input('matGroup',  material_group  || null)
            .input('posRange',  position_range  || null)
            .input('ndtMethod', ndt_method      || null)
            .input('ndtLevel',  toIntOrNull(ndt_level))
            // v2 — sempre attiva alla creazione, nessun gate di approvazione interna (v. header file)
            .input('approvalStatus', 'approvata')
            .input('jointType',   joint_type        || null)
            .input('thickRange',  thickness_range   || null)
            .input('pipeDiam',    pipe_diameter     || null)
            .input('filler',      filler_material   || null)
            .input('shieldGas',   shielding_gas     || null)
            .input('equipType',   equipment_type    || null)
            .input('ndtSector',   ndt_sector        || null)
            .input('certScheme',  certification_scheme || null)
            .input('coordTitle',  coordinator_title || null)
            .input('diplomaNum',  diploma_number    || null)
            .input('cpdUntil',    cpd_valid_until   || null)
            .input('patentType',  patent_type       || null)
            .input('trainBody',   training_body     || null)
            .input('courseName',  course_name       || null)
            .input('trainHours',  toIntOrNull(training_hours))
            .input('examBody',    examiner_body     || null)
            .input('certFileUrl', certUrlCheck.value)
            // saldatore 9606-1 enrichment
            .input('examDate',    exam_date         || null)
            .input('lastConfDate',last_confirmation_date || null)
            .input('nextConfDue', next_confirmation_due  || null)
            .input('revalDate',   revalidation_date || null)
            .input('productType', product_type      || null)
            .input('weldDetails', weld_details      || null)
            .input('transferMode', transfer_mode    || null)
            .input('weldProcTest', welding_process_test || null)
            .input('weldProcValidity', welding_processes_validity || null)
            .input('posTest', welding_position_test || null)
            .input('thickSTest', toNum(thickness_s_test_mm))
            .input('thickTTest', toNum(thickness_t_test_mm))
            .input('pipeTest', toNum(pipe_diameter_test_mm))
            .input('designation', designation       || null)
            .input('thickMin',    thickMin)
            .input('thickMax',    thickMax)
            .input('thickMaxUnlimited', !!thickness_max_unlimited)
            .input('pipeMin',     pipeMin)
            .input('pipeMax',     pipeMax)
            .input('thickRangeFinal', thicknessRangeFinal || null)
            .input('pipeDiamFinal',   pipeDiameterFinal   || null)
            .input('weldingType',     welding_type      || null)
            .input('singleMultiRun',  single_multi_run  || null)
            .input('qualMethod',      qualification_method || null)
            .query(`
                INSERT INTO qualifications
                    (organization_id, company_id, person_name, person_code, personnel_id, department,
                     qualification_type, standard_ref, scope_detail, certificate_number, issuing_body,
                     issue_date, exam_date, expiry_date, near_vision_expiry_date, colour_vision_expiry_date, last_renewal_date,
                     last_confirmation_date, next_confirmation_due, revalidation_date,
                     status, notes, created_by,
                     welding_process, material_group, position_range, ndt_method, ndt_level,
                     approval_status, joint_type, product_type, weld_details, transfer_mode, qualification_designation,
                     welding_process_test, welding_processes_validity, welding_position_test,
                     thickness_s_test_mm, thickness_t_test_mm, pipe_diameter_test_mm,
                     thickness_min_mm, thickness_max_mm, thickness_max_unlimited, pipe_diameter_min_mm, pipe_diameter_max_mm,
                     thickness_range, pipe_diameter,
                     filler_material, shielding_gas, equipment_type,
                     welding_type, single_multi_run, qualification_method,
                     ndt_sector, certification_scheme,
                     coordinator_title, diploma_number, cpd_valid_until,
                     patent_type, training_body,
                     course_name, training_hours, examiner_body, certificate_file_url)
                OUTPUT INSERTED.id
                VALUES
                    (@orgId, @compId, @personName, @personCode, @personnelId, @dept,
                     @qualType, @stdRef, @scope, @certNum, @issuer,
                     @issueDate, @examDate, @expiryDate, @nearVision, @colourVision, @renewalDate,
                     @lastConfDate, @nextConfDue, @revalDate,
                     @status, @notes, @userId,
                     @weldProc, @matGroup, @posRange, @ndtMethod, @ndtLevel,
                     @approvalStatus, @jointType, @productType, @weldDetails, @transferMode, @designation,
                     @weldProcTest, @weldProcValidity, @posTest, @thickSTest, @thickTTest, @pipeTest,
                     @thickMin, @thickMax, @thickMaxUnlimited, @pipeMin, @pipeMax,
                     @thickRangeFinal, @pipeDiamFinal,
                     @filler, @shieldGas, @equipType,
                     @weldingType, @singleMultiRun, @qualMethod,
                     @ndtSector, @certScheme,
                     @coordTitle, @diplomaNum, @cpdUntil,
                     @patentType, @trainBody,
                     @courseName, @trainHours, @examBody, @certFileUrl)
            `);

        logger.info(`[Qualif] Creata id=${r.recordset[0].id} per org ${orgId}`);
        await logEntityChange({
            organizationId: orgId,
            entityTable: 'qualifications',
            entityId: r.recordset[0].id,
            actionType: 'created',
            actorUserId: req.user.user_id,
            after: body,
            fields: QUALIFICATION_MANUAL_EDITABLE_FIELDS,
        });
        res.status(201).json({ success: true, id: r.recordset[0].id });
    } catch (err) {
        if (isQualificationDuplicateIndexError(err)) {
            return res.status(409).json({ error: DUPLICATE_QUALIFICATION_MESSAGE, code: 'DUPLICATE_QUALIFICATION' });
        }
        logger.error('createQualif:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** PUT /qualifications/:id */
async function updateQualification(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);
        const { body, designationApplicable } = applyFieldApplicability(req.body);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT * FROM qualifications WHERE id=@id AND organization_id=@orgId AND deleted_at IS NULL');
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const targetCompanyId = body.company_id !== undefined ? body.company_id : check.recordset[0].company_id;
        const writeDenied = await assertMutatingAllowed(req.user, { companyId: targetCompanyId });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const {
            company_id, person_name, person_code, department, personnel_id,
            qualification_type, standard_ref, scope_detail,
            certificate_number, issuing_body,
            issue_date, expiry_date, last_renewal_date,
            near_vision_expiry_date, colour_vision_expiry_date,
            status, notes,
            welding_process, material_group, position_range, ndt_method, ndt_level,
            joint_type, thickness_range, pipe_diameter, filler_material, shielding_gas, equipment_type,
            ndt_sector, certification_scheme,
            coordinator_title, diploma_number, cpd_valid_until,
            patent_type, training_body,
            course_name, training_hours, examiner_body,
            certificate_file_url,
            // saldatore 9606-1 enrichment
            exam_date, last_confirmation_date, next_confirmation_due, revalidation_date,
            product_type, weld_details, transfer_mode,
            thickness_min_mm, thickness_max_mm, thickness_max_unlimited, pipe_diameter_min_mm, pipe_diameter_max_mm,
            welding_process_test, welding_processes_validity, welding_position_test,
            thickness_s_test_mm, thickness_t_test_mm, pipe_diameter_test_mm,
            qualification_designation,
            // operatore 14732 (saldatura automatica/meccanizzata)
            welding_type, single_multi_run, qualification_method,
        } = body;

        // Valore invariato = nessuna rivalidazione (i record storici restano modificabili).
        const currentCertUrl = check.recordset[0].certificate_file_url || null;
        let certUrlToSave = certificate_file_url || null;
        if (certUrlToSave !== currentCertUrl) {
            const certUrlCheck = await validateCertificateFileUrl(certificate_file_url, { organizationId: orgId });
            if (!certUrlCheck.ok) return res.status(CERTIFICATE_FILE_URL_ERROR.status).json(CERTIFICATE_FILE_URL_ERROR.body);
            certUrlToSave = certUrlCheck.value;
        }

        const thickMin = toNum(thickness_min_mm);
        const thickMax = toNum(thickness_max_mm);
        const pipeMin  = toNum(pipe_diameter_min_mm);
        const pipeMax  = toNum(pipe_diameter_max_mm);
        const thicknessRangeFinal = thickness_range || deriveRangeString(thickMin, thickMax);
        const pipeDiameterFinal   = pipe_diameter || deriveRangeString(pipeMin, pipeMax);
        const designation = designationApplicable ? resolvePrintedDesignation(qualification_designation, {
            welding_process: welding_process_test || welding_process, product_type, joint_type,
            filler_material_group: filler_material,
            thickness_min_mm: thickMin, thickness_max_mm: thickMax,
            pipe_diameter_min_mm: pipeMin, pipe_diameter_max_mm: pipeMax,
            welding_positions: position_range, weld_details,
        }) : null;

        // Collegamento anagrafica (company_personnel) — gap analysis 08/08/2026:
        // stessa correzione di createQualification, vedi commento lì.
        const personnelResult = await resolvePersonnelForQualification({
            organizationId: orgId,
            companyId: company_id ?? targetCompanyId,
            personnelId: personnel_id,
            personName: person_name,
            personCode: person_code,
        });
        if (!personnelResult.ok) {
            return res.status(personnelResult.status || 400).json({ error: personnelResult.error, code: personnelResult.code });
        }

        const visionClocks = persistedVisionClocks(
            qualification_type,
            near_vision_expiry_date,
            colour_vision_expiry_date,
        );
        await pool.request()
            .input('id',        id)
            .input('orgId',     orgId)
            .input('compId',    company_id   || null)
            .input('personName',personnelResult.personName || person_name?.trim())
            .input('personCode',personnelResult.personCode || person_code || null)
            .input('personnelId', personnelResult.personnelId)
            .input('dept',      department   || null)
            .input('qualType',  qualification_type?.trim())
            .input('stdRef',    standard_ref || null)
            .input('scope',     scope_detail || null)
            .input('certNum',   certificate_number || null)
            .input('issuer',    issuing_body || null)
            .input('issueDate', issue_date   || null)
            .input('expiryDate',expiry_date  || null)
            .input('nearVision', visionClocks.near)
            .input('colourVision', visionClocks.colour)
            .input('renewalDate',last_renewal_date || null)
            .input('status',    status || 'valida')
            .input('notes',     notes        || null)
            .input('weldProc',  welding_process || null)
            .input('matGroup',  material_group  || null)
            .input('posRange',  position_range  || null)
            .input('ndtMethod', ndt_method      || null)
            .input('ndtLevel',  toIntOrNull(ndt_level))
            .input('jointType',   joint_type        || null)
            .input('thickRange',  thickness_range   || null)
            .input('pipeDiam',    pipe_diameter     || null)
            .input('filler',      filler_material   || null)
            .input('shieldGas',   shielding_gas     || null)
            .input('equipType',   equipment_type    || null)
            .input('ndtSector',   ndt_sector        || null)
            .input('certScheme',  certification_scheme || null)
            .input('coordTitle',  coordinator_title || null)
            .input('diplomaNum',  diploma_number    || null)
            .input('cpdUntil',    cpd_valid_until   || null)
            .input('patentType',  patent_type       || null)
            .input('trainBody',   training_body     || null)
            .input('courseName',  course_name       || null)
            .input('trainHours',  toIntOrNull(training_hours))
            .input('examBody',    examiner_body     || null)
            .input('certFileUrl', certUrlToSave)
            // saldatore 9606-1 enrichment
            .input('examDate',    exam_date         || null)
            .input('lastConfDate',last_confirmation_date || null)
            .input('nextConfDue', next_confirmation_due  || null)
            .input('revalDate',   revalidation_date || null)
            .input('productType', product_type      || null)
            .input('weldDetails', weld_details      || null)
            .input('transferMode', transfer_mode    || null)
            .input('weldProcTest', welding_process_test || null)
            .input('weldProcValidity', welding_processes_validity || null)
            .input('posTest', welding_position_test || null)
            .input('thickSTest', toNum(thickness_s_test_mm))
            .input('thickTTest', toNum(thickness_t_test_mm))
            .input('pipeTest', toNum(pipe_diameter_test_mm))
            .input('designation', designation       || null)
            .input('thickMin',    thickMin)
            .input('thickMax',    thickMax)
            .input('thickMaxUnlimited', !!thickness_max_unlimited)
            .input('pipeMin',     pipeMin)
            .input('pipeMax',     pipeMax)
            .input('thickRangeFinal', thicknessRangeFinal || null)
            .input('pipeDiamFinal',   pipeDiameterFinal   || null)
            .input('weldingType',     welding_type      || null)
            .input('singleMultiRun',  single_multi_run  || null)
            .input('qualMethod',      qualification_method || null)
            .query(`
                UPDATE qualifications SET
                    company_id=@compId, person_name=@personName, person_code=@personCode,
                    personnel_id=@personnelId,
                    department=@dept, qualification_type=@qualType, standard_ref=@stdRef,
                    scope_detail=@scope, certificate_number=@certNum, issuing_body=@issuer,
                    issue_date=@issueDate, exam_date=@examDate, expiry_date=@expiryDate,
                    near_vision_expiry_date=@nearVision, colour_vision_expiry_date=@colourVision,
                    last_renewal_date=@renewalDate,
                    last_confirmation_date=@lastConfDate, next_confirmation_due=@nextConfDue, revalidation_date=@revalDate,
                    status=@status, notes=@notes, updated_at=GETDATE(),
                    welding_process=@weldProc, material_group=@matGroup, position_range=@posRange,
                    ndt_method=@ndtMethod, ndt_level=@ndtLevel,
                    joint_type=@jointType, product_type=@productType, weld_details=@weldDetails,
                    transfer_mode=@transferMode,
                    qualification_designation=@designation,
                    welding_process_test=@weldProcTest, welding_processes_validity=@weldProcValidity,
                    welding_position_test=@posTest,
                    thickness_s_test_mm=@thickSTest, thickness_t_test_mm=@thickTTest,
                    pipe_diameter_test_mm=@pipeTest,
                    thickness_min_mm=@thickMin, thickness_max_mm=@thickMax, thickness_max_unlimited=@thickMaxUnlimited,
                    pipe_diameter_min_mm=@pipeMin, pipe_diameter_max_mm=@pipeMax,
                    thickness_range=@thickRangeFinal, pipe_diameter=@pipeDiamFinal,
                    filler_material=@filler, shielding_gas=@shieldGas, equipment_type=@equipType,
                    welding_type=@weldingType, single_multi_run=@singleMultiRun, qualification_method=@qualMethod,
                    ndt_sector=@ndtSector, certification_scheme=@certScheme,
                    coordinator_title=@coordTitle, diploma_number=@diplomaNum, cpd_valid_until=@cpdUntil,
                    patent_type=@patentType, training_body=@trainBody,
                    course_name=@courseName, training_hours=@trainHours, examiner_body=@examBody,
                    certificate_file_url=@certFileUrl
                WHERE id=@id AND organization_id=@orgId
            `);

        await logEntityChange({
            organizationId: orgId,
            entityTable: 'qualifications',
            entityId: id,
            actionType: 'updated',
            actorUserId: req.user.user_id,
            before: check.recordset[0],
            after: body,
            fields: QUALIFICATION_MANUAL_EDITABLE_FIELDS,
        });
        res.json({ success: true });
    } catch (err) {
        if (isQualificationDuplicateIndexError(err)) {
            return res.status(409).json({ error: DUPLICATE_QUALIFICATION_MESSAGE, code: 'DUPLICATE_QUALIFICATION' });
        }
        logger.error('updateQualif:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** DELETE /qualifications/:id — stato di business revocata, distinto dal cestino. */
async function deleteQualification(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT id, company_id, status FROM qualifications WHERE id=@id AND organization_id=@orgId AND deleted_at IS NULL');
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        await pool.request().input('id', id).input('orgId', orgId)
            .query("UPDATE qualifications SET status='revocata', updated_at=GETDATE() WHERE id=@id AND organization_id=@orgId AND deleted_at IS NULL");
        await logEntityChange({
            organizationId: orgId,
            entityTable: 'qualifications',
            entityId: id,
            actionType: 'updated',
            actorUserId: req.user.user_id,
            before: { status: check.recordset[0].status },
            after: { status: 'revocata' },
            fields: ['status'],
        });

        res.json({ success: true });
    } catch (err) {
        logger.error('deleteQualif:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * DELETE /qualifications/:id/permanent — cestino.
 * Il nome della route resta per i client già in uso. Non cancella il file né
 * le conferme: imposta deleted_at e deleted_by. revocata resta un altro stato.
 */
async function hardDeleteQualification(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'Identificativo non valido.', code: 'INVALID_ID' });
        }

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query(`
                SELECT id, company_id, status, certificate_number, person_name
                FROM qualifications
                WHERE id=@id AND organization_id=@orgId AND deleted_at IS NULL
            `);
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const row = check.recordset[0];
        const writeDenied = await assertMutatingAllowed(req.user, { companyId: row.company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        await pool.request().input('id', id).input('orgId', orgId).input('actor', req.user.user_id)
            .query(`UPDATE qualifications
                    SET deleted_at = SYSUTCDATETIME(), deleted_by = @actor
                    WHERE id=@id AND organization_id=@orgId AND deleted_at IS NULL`);

        await logEntityChange({
            organizationId: orgId,
            entityTable: 'qualifications',
            entityId: id,
            actionType: 'soft_deleted',
            actorUserId: req.user.user_id,
            before: { status: row.status, certificate_number: row.certificate_number, person_name: row.person_name, deleted_at: null },
            after: { deleted_at: 'cestino' },
        });

        logger.info(`[Qualif] Nel cestino id=${id} da user ${req.user.user_id} org ${orgId}`);
        res.json({ success: true });
    } catch (err) {
        logger.error('hardDeleteQualification:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** POST /qualifications/:id/renew
 *  Crea un nuovo record con previous_qualification_id puntato al record corrente.
 *  Copia tutti i campi; il nuovo record è immediatamente attivo (nessun gate di
 *  approvazione interna, v. header file).
 */
async function renewQualification(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);
        const userId = req.user.user_id;

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT * FROM qualifications WHERE id=@id AND organization_id=@orgId AND deleted_at IS NULL');
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const q = check.recordset[0];
        const writeDenied = await assertMutatingAllowed(req.user, { companyId: q.company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        // Sovrascritture dal body (es. nuove date, nuovo certificato)
        const {
            issue_date, expiry_date, last_renewal_date,
            near_vision_expiry_date, colour_vision_expiry_date,
            certificate_number, certificate_file_url,
            notes,
        } = req.body || {};

        const certUrlCheck = await validateCertificateFileUrl(certificate_file_url, { organizationId: orgId });
        if (!certUrlCheck.ok) return res.status(CERTIFICATE_FILE_URL_ERROR.status).json(CERTIFICATE_FILE_URL_ERROR.body);

        const visionClocks = persistedVisionClocks(
            q.qualification_type,
            near_vision_expiry_date != null && near_vision_expiry_date !== ''
                ? near_vision_expiry_date
                : q.near_vision_expiry_date,
            colour_vision_expiry_date != null && colour_vision_expiry_date !== ''
                ? colour_vision_expiry_date
                : q.colour_vision_expiry_date,
        );
        const r = await pool.request()
            .input('orgId',       orgId)
            .input('prevId',      id)
            .input('compId',      q.company_id)
            .input('personName',  q.person_name)
            .input('personCode',  q.person_code)
            .input('dept',        q.department)
            .input('qualType',    q.qualification_type)
            .input('stdRef',      q.standard_ref)
            .input('scope',       q.scope_detail)
            .input('certNum',     certificate_number || q.certificate_number)
            .input('issuer',      q.issuing_body)
            .input('issueDate',   issue_date || null)
            .input('expiryDate',  expiry_date || null)
            .input('nearVision',  visionClocks.near)
            .input('colourVision', visionClocks.colour)
            .input('renewalDate', last_renewal_date || null)
            .input('notes',       notes || q.notes)
            .input('userId',      userId)
            .input('personnelId', q.personnel_id || null)
            .input('weldProc',    q.welding_process)
            .input('matGroup',    q.material_group)
            .input('posRange',    q.position_range)
            .input('ndtMethod',   q.ndt_method)
            .input('ndtLevel',    q.ndt_level)
            .input('jointType',   q.joint_type)
            .input('thickRange',  q.thickness_range)
            .input('pipeDiam',    q.pipe_diameter)
            .input('filler',      q.filler_material)
            .input('shieldGas',   q.shielding_gas)
            .input('equipType',   q.equipment_type)
            .input('ndtSector',   q.ndt_sector)
            .input('certScheme',  q.certification_scheme)
            .input('coordTitle',  q.coordinator_title)
            .input('diplomaNum',  q.diploma_number)
            .input('patentType',  q.patent_type)
            .input('trainBody',   q.training_body)
            .input('courseName',  q.course_name)
            .input('trainHours',  q.training_hours)
            .input('examBody',    q.examiner_body)
            .input('certFileUrl', certUrlCheck.value)
            .query(`
                INSERT INTO qualifications
                    (organization_id, company_id, person_name, person_code, department,
                     qualification_type, standard_ref, scope_detail, certificate_number, issuing_body,
                     issue_date, expiry_date, near_vision_expiry_date, colour_vision_expiry_date,
                     last_renewal_date, status, notes, created_by,
                     previous_qualification_id, approval_status, personnel_id,
                     welding_process, material_group, position_range, ndt_method, ndt_level,
                     joint_type, thickness_range, pipe_diameter, filler_material, shielding_gas, equipment_type,
                     ndt_sector, certification_scheme, coordinator_title, diploma_number,
                     patent_type, training_body, course_name, training_hours, examiner_body,
                     certificate_file_url)
                OUTPUT INSERTED.id
                VALUES
                    (@orgId, @compId, @personName, @personCode, @dept,
                     @qualType, @stdRef, @scope, @certNum, @issuer,
                     @issueDate, @expiryDate, @nearVision, @colourVision, @renewalDate, 'valida', @notes, @userId,
                     @prevId, 'approvata', @personnelId,
                     @weldProc, @matGroup, @posRange, @ndtMethod, @ndtLevel,
                     @jointType, @thickRange, @pipeDiam, @filler, @shieldGas, @equipType,
                     @ndtSector, @certScheme, @coordTitle, @diplomaNum,
                     @patentType, @trainBody, @courseName, @trainHours, @examBody,
                     @certFileUrl)
            `);

        const newId = r.recordset[0].id;
        logger.info(`[Qualif] Rinnovo: nuovo id=${newId} da id=${id} per org ${orgId}`);
        res.status(201).json({ success: true, id: newId, previous_qualification_id: id });
    } catch (err) {
        if (isQualificationDuplicateIndexError(err)) {
            return res.status(409).json({ error: DUPLICATE_QUALIFICATION_MESSAGE, code: 'DUPLICATE_QUALIFICATION' });
        }
        logger.error('renewQualif:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// Tipi documento ammessi per il batch upload qualifiche (IG-3 staging).
const UPLOAD_BATCH_DOC_TYPES = new Set(['patentino_saldatore', 'qualifica_14732', 'cert_ndt']);

/** Campi additivi di classificazione per file (`confidence` storico = ai|rule_based resta invariato). */
function classificationResponseFields(classification) {
    if (!classification) return {};
    return {
        detected_doc_type: classification.detected_doc_type,
        classification_confidence: classification.confidence,
        classification_source: classification.classification_source,
        classification: {
            detected_doc_type: classification.detected_doc_type,
            confidence: classification.confidence,
            classification_source: classification.classification_source,
            reasons: classification.reasons || [],
            needs_choice: Boolean(classification.needs_choice),
        },
    };
}

/** POST /qualifications/upload-batch — estrazione + staging IG-3 (revisione pre-commit) */
async function uploadBatch(req, res) {
    try {
        const orgId    = req.user.organization_id;
        const userId   = req.user.user_id;
        const company_id = req.body?.company_id ? parseInt(req.body.company_id) : null;
        // `doc_type` è un override opzionale (client vecchi/in cache lo inviano sempre): se assente
        // o non valido il tipo viene riconosciuto per file (null = auto-detect).
        const requestedDocType = req.body?.doc_type ?? req.query?.doc_type;
        const docType = UPLOAD_BATCH_DOC_TYPES.has(requestedDocType) ? requestedDocType : null;

        if (!company_id || isNaN(company_id)) {
            return res.status(400).json({ error: 'company_id obbligatorio: seleziona un\'azienda specifica prima di caricare i patentini.' });
        }
        if (await denyOutsideCompany(res, req.user, company_id, 'write')) return;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nessun file caricato.' });
        }

        const { extractQualificationFromPdf } = require('../services/qualificationIngest.service');
        const { createStagingRecord } = require('../services/ingestStaging.service');

        const results = [];
        for (const file of req.files) {
            let entry = { fileName: file.originalname, status: 'error', warnings: [] };
            try {
                const buffer = fs.readFileSync(file.path);
                const extracted = await extractQualificationFromPdf(buffer, file.originalname, orgId, company_id, docType);

                const { classification: extractedClassification, ...extractedRest } = extracted;
                const classFields = classificationResponseFields(extractedClassification);

                if (extracted.status === 'wrong_module') {
                    try { fs.unlinkSync(file.path); } catch (_) {}
                    results.push({
                        fileName: file.originalname,
                        status: 'wrong_module',
                        ...extractedRest,
                        ...classFields,
                    });
                    continue;
                }

                if (extracted.status === 'type_unresolved') {
                    try { fs.unlinkSync(file.path); } catch (_) {}
                    results.push({
                        fileName: file.originalname,
                        status: 'type_unresolved',
                        warnings: extracted.warnings || [],
                        ...classFields,
                    });
                    continue;
                }

                if (extracted.status === 'duplicate') {
                    try { fs.unlinkSync(file.path); } catch (_) {}
                    results.push({
                        fileName: file.originalname,
                        status: 'duplicate',
                        person_name: extracted.person_name,
                        qualification_type: extracted.qualification_type,
                        warnings: extracted.warnings || [],
                        verification: extracted.verification,
                        ...classFields,
                    });
                    continue;
                }

                const stagingId = await createStagingRecord({
                    organizationId: orgId,
                    companyId: company_id,
                    docType: extracted.doc_type || docType,
                    originalName: file.originalname,
                    storagePath: file.path,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                    fields: extracted.fields,
                    fieldConfidence: extracted.field_confidence,
                    fieldSources: extracted.field_sources,
                    warnings: extracted.warnings,
                    qualificationType: extracted.qualification_type,
                    userId,
                    aiModel: extracted.ai_model || null,
                });

                entry = {
                    fileName: file.originalname,
                    status: 'pending_review',
                    staging_id: stagingId,
                    fields: extracted.fields,
                    field_confidence: extracted.field_confidence,
                    qualification_type: extracted.qualification_type,
                    confidence: extracted.confidence,
                    warnings: extracted.warnings || [],
                    verification: extracted.verification,
                    doc_type: extracted.doc_type || docType,
                    ...classFields,
                };
            } catch (fileErr) {
                const errMsg = describeIngestFileError(fileErr);
                logger.error('[Qualif/batch] Estrazione fallita', {
                    file: redactFileNameForLog(file.originalname),
                    error: errMsg,
                    stack: fileErr?.stack || null,
                });
                entry = {
                    fileName: file.originalname,
                    status: 'error',
                    error: errMsg,
                    warnings: [errMsg],
                };
                try { fs.unlinkSync(file.path); } catch (_) {}
            }
            results.push(entry);
        }

        const pending = results.filter(r => r.status === 'pending_review').length;
        logger.info(`[Qualif/batch] ${pending}/${req.files.length} file in staging per org ${orgId}`);
        res.json({ results, uploaded: pending, total: req.files.length });
    } catch (err) {
        const errMsg = describeIngestFileError(err, "Errore imprevisto durante l'upload batch patentini.");
        logger.error('uploadBatch qualifiche:', { error: errMsg, stack: err?.stack || null });
        res.status(500).json({ error: errMsg });
    }
}

/** POST /qualifications/:id/certificate — Upload certificato PDF/immagine */
async function uploadCertificate(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);

        if (!req.file) return res.status(400).json({ error: 'Nessun file caricato.' });

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT * FROM qualifications WHERE id=@id AND organization_id=@orgId AND deleted_at IS NULL');
        if (!check.recordset.length) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Qualifica non trovata.' });
        }

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) {
            fs.unlinkSync(req.file.path);
            return sendAccessDenied(res, writeDenied);
        }

        const uploadBase = process.env.UPLOAD_DIR
            ? path.resolve(process.env.UPLOAD_DIR)
            : path.resolve(__dirname, '../../uploads');
        const relUrl = expectedQualificationUrl(
            '/uploads/' + path.relative(uploadBase, req.file.path).replace(/\\/g, '/'),
            orgId,
        );
        if (!relUrl) {
            fs.unlinkSync(req.file.path);
            return res.status(CERTIFICATE_FILE_URL_ERROR.status).json(CERTIFICATE_FILE_URL_ERROR.body);
        }

        await pool.request()
            .input('id', id).input('orgId', orgId).input('url', relUrl)
            .query(`UPDATE qualifications SET certificate_file_url=@url, updated_at=GETDATE() WHERE id=@id AND organization_id=@orgId`);

        logger.info(`[Qualif] Certificato caricato id=${id}: ${relUrl}`);
        res.json({ success: true, certificate_file_url: relUrl });
    } catch (err) {
        logger.error('uploadCertificate:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** GET /qualifications/:id/history — Catena rinnovi via previous_qualification_id */
async function getHistory(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT id, company_id FROM qualifications WHERE id=@id AND organization_id=@orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });
        if (await denyOutsideCompany(res, req.user, check.recordset[0].company_id, 'read')) return;

        // Risali la catena (max 20 rinnovi)
        const chain = [];
        let currentId = id;
        for (let i = 0; i < 20; i++) {
            const r = await pool.request()
                .input('id', currentId).input('orgId', orgId)
                .query(`
                    SELECT q.id, q.company_id, q.issue_date, q.expiry_date, q.certificate_number,
                           q.qualification_type, q.next_confirmation_due, q.cpd_valid_until,
                           q.approval_status, q.status, q.previous_qualification_id,
                           c.name AS company_name
                    FROM qualifications q
                    LEFT JOIN companies c ON c.id = q.company_id
                    WHERE q.id=@id AND q.organization_id=@orgId
                `);
            if (!r.recordset.length) break;
            const row = r.recordset[0];
            if (await isOutsideCompany(req.user, row.company_id, 'read')) {
                if (chain.length === 0 && await denyOutsideCompany(res, req.user, row.company_id, 'read')) return;
                break;
            }
            chain.push({ ...row, semaforo: semaforoForRow(row) });
            if (!row.previous_qualification_id) break;
            currentId = row.previous_qualification_id;
        }

        res.json({ history: chain, current_id: id });
    } catch (err) {
        logger.error('getQualifHistory:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** GET /qualifications/:id/confirmations — storico conferme semestrali */
async function getConfirmations(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id, 10);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query(`
                SELECT id, company_id, qualification_type, approval_status, status,
                       last_confirmation_date, next_confirmation_due
                FROM qualifications
                WHERE id=@id AND organization_id=@orgId
            `);
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const qual = check.recordset[0];
        const readDenied = await assertCompanyRead(req.user, qual.company_id);
        if (readDenied) return sendAccessDenied(res, readDenied);

        const auth = await canUserConfirmSemiannual(req.user, qual.company_id);

        const rows = await pool.request()
            .input('qualId', id)
            .input('orgId', orgId)
            .query(`
                SELECT id, qualification_id, confirmed_at, confirmed_by,
                       confirmer_name, confirmer_title, notes, created_at
                FROM qualification_confirmations
                WHERE qualification_id = @qualId AND organization_id = @orgId
                ORDER BY confirmed_at DESC, id DESC
            `);

        res.json({
            confirmations: rows.recordset || [],
            // Nessun gate su approval_status (rimosso — v. header file): la conferma è
            // consentita su qualsiasi qualifica attiva (status non revocata/sospesa).
            can_confirm: auth.allowed
                && !['revocata', 'sospesa'].includes(qual.status)
                && requiresSemiannualConfirmation(qual.qualification_type),
            last_confirmation_date: qual.last_confirmation_date,
            next_confirmation_due: qual.next_confirmation_due,
            is_welder_9606: isWelder9606Type(qual.qualification_type),
            requires_confirmation: requiresSemiannualConfirmation(qual.qualification_type),
            approval_status: qual.approval_status,
        });
    } catch (err) {
        logger.error('getConfirmations:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** POST /qualifications/:id/confirm-semiannual — registra conferma semestrale */
async function confirmSemiannual(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id, 10);
        const userId = req.user.user_id;
        const { confirmed_at, notes } = req.body || {};

        const check = await pool.request()
            .input('id', id)
            .input('orgId', orgId)
            .input('userId', userId)
            .query(`
                SELECT q.id, q.company_id, q.qualification_type, q.approval_status, q.status,
                       q.expiry_date, q.last_confirmation_date, q.next_confirmation_due,
                       u.full_name AS user_name
                FROM qualifications q
                LEFT JOIN users u ON u.user_id = @userId
                WHERE q.id=@id AND q.organization_id=@orgId
            `);
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const qual = check.recordset[0];
        if (await denyOutsideCompany(res, req.user, qual.company_id, 'write')) return;

        // Nessun gate su approval_status (rimosso — v. header file): la conferma è
        // consentita su qualsiasi qualifica attiva (status non revocata/sospesa).
        if (['revocata', 'sospesa'].includes(qual.status)) {
            return res.status(400).json({
                error: 'Conferma semestrale non consentita: qualifica non attiva (revocata/sospesa).',
                code: 'NOT_ACTIVE',
            });
        }
        if (!requiresSemiannualConfirmation(qual.qualification_type)) {
            return res.status(400).json({
                error: 'Tipo qualifica non ammesso per conferma semestrale (solo ISO 9606-1 / ISO 14732).',
                code: 'NOT_WELDER_9606',
            });
        }

        const auth = await canUserConfirmSemiannual(req.user, qual.company_id);
        if (!auth.allowed) {
            return res.status(403).json({
                error: 'Solo il coordinatore responsabile primario o admin/superadmin possono registrare la conferma.',
                code: 'FORBIDDEN_NOT_PRIMARY',
                reason: auth.reason,
            });
        }

        const confirmedDate = confirmed_at
            ? String(confirmed_at).slice(0, 10)
            : new Date().toISOString().slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(confirmedDate)) {
            return res.status(400).json({ error: 'Data conferma non valida.', code: 'INVALID_DATE' });
        }

        const nextDue = addMonthsIso(confirmedDate, 6);
        // Una conferma che riporta la scadenza effettiva nel futuro rimette "valida" una riga
        // marcata "scaduta" in ingest (stato salvato obsoleto); altri stati restano invariati.
        const effectiveAfter = effectiveExpiryDate({ ...qual, next_confirmation_due: nextDue });
        const todayIso = new Date().toISOString().slice(0, 10);
        // mssql restituisce le colonne DATE come oggetti Date: confronto sempre su YYYY-MM-DD
        const effectiveAfterIso = effectiveAfter instanceof Date
            ? effectiveAfter.toISOString().slice(0, 10)
            : (effectiveAfter ? String(effectiveAfter).slice(0, 10) : null);
        const reviveStatus = qual.status === 'scaduta'
            && (!effectiveAfterIso || effectiveAfterIso >= todayIso);
        const notesTrim = notes?.trim() ? notes.trim().substring(0, 500) : null;

        let confirmerName = qual.user_name || req.user.name || req.user.full_name || 'Coordinatore';
        let confirmerTitle = null;

        if (auth.primary) {
            confirmerName = auth.primary.name || confirmerName;
            confirmerTitle = auth.primary.job_title || null;
        } else {
            const titleRow = await pool.request()
                .input('userId', userId)
                .query(`
                    SELECT TOP 1 coordinator_title
                    FROM qualifications
                    WHERE created_by = @userId
                      AND coordinator_title IS NOT NULL
                      AND status NOT IN ('revocata','sospesa')
                    ORDER BY updated_at DESC
                `);
            confirmerTitle = titleRow.recordset[0]?.coordinator_title || null;
        }

        const tx = pool.transaction();
        await tx.begin();
        try {
            // Ogni query nella transazione richiede un request separato (mssql:
            // i nomi parametro non possono essere ridichiarati sullo stesso request).
            await tx.request()
                .input('qualId', id)
                .input('orgId', orgId)
                .input('compId', qual.company_id)
                .input('confirmedAt', confirmedDate)
                .input('userId', userId)
                .input('confName', confirmerName)
                .input('confTitle', confirmerTitle)
                .input('notes', notesTrim)
                .query(`
                    INSERT INTO qualification_confirmations (
                        qualification_id, organization_id, company_id,
                        confirmed_at, confirmed_by, confirmer_name, confirmer_title, notes
                    )
                    VALUES (
                        @qualId, @orgId, @compId,
                        @confirmedAt, @userId, @confName, @confTitle, @notes
                    )
                `);

            await tx.request()
                .input('qualId', id)
                .input('orgId', orgId)
                .input('lastConf', confirmedDate)
                .input('nextDue', nextDue)
                .input('reviveStatus', reviveStatus ? 1 : 0)
                .query(`
                    UPDATE qualifications
                    SET last_confirmation_date = @lastConf,
                        next_confirmation_due = @nextDue,
                        status = CASE WHEN @reviveStatus = 1 AND status = 'scaduta' THEN 'valida' ELSE status END,
                        updated_at = GETDATE()
                    WHERE id = @qualId AND organization_id = @orgId
                `);

            await tx.commit();
        } catch (txErr) {
            await tx.rollback();
            throw txErr;
        }

        logger.info(`[Qualif] Conferma semestrale id=${id} da user ${userId} data=${confirmedDate}`);
        res.status(201).json({
            success: true,
            last_confirmation_date: confirmedDate,
            next_confirmation_due: nextDue,
        });
    } catch (err) {
        logger.error('confirmSemiannual:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * Ricalcola last_confirmation_date / next_confirmation_due dalla conferma più recente.
 * Usato dopo PUT/DELETE su una riga dello storico.
 */
async function recomputeConfirmationAggregates(txOrPool, { qualId, orgId }) {
    const latest = await txOrPool.request()
        .input('qualId', qualId)
        .input('orgId', orgId)
        .query(`
            SELECT TOP 1 confirmed_at
            FROM qualification_confirmations
            WHERE qualification_id = @qualId AND organization_id = @orgId
            ORDER BY confirmed_at DESC, id DESC
        `);
    const lastConf = latest.recordset[0]?.confirmed_at
        ? String(latest.recordset[0].confirmed_at).slice(0, 10)
        : null;
    const nextDue = lastConf ? addMonthsIso(lastConf, 6) : null;
    await txOrPool.request()
        .input('qualId', qualId)
        .input('orgId', orgId)
        .input('lastConf', lastConf)
        .input('nextDue', nextDue)
        .query(`
            UPDATE qualifications
            SET last_confirmation_date = @lastConf,
                next_confirmation_due = @nextDue,
                updated_at = GETDATE()
            WHERE id = @qualId AND organization_id = @orgId
        `);
    return { last_confirmation_date: lastConf, next_confirmation_due: nextDue };
}

/**
 * PUT /qualifications/:id/confirmations/:confirmationId — corregge data/note di una
 * conferma già registrata (rilievo Mason 24/08/2026: date non editabili dopo insert).
 * Stessi privilegi di POST confirm-semiannual. Dopo l'update ricalcola gli aggregati
 * sulla qualifica dalla conferma più recente.
 */
async function updateConfirmation(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const qualId = parseInt(req.params.id, 10);
        const confirmationId = parseInt(req.params.confirmationId, 10);
        const { confirmed_at, notes } = req.body || {};

        if (!Number.isFinite(qualId) || !Number.isFinite(confirmationId)) {
            return res.status(400).json({ error: 'Identificativi non validi.', code: 'INVALID_ID' });
        }

        const check = await pool.request()
            .input('id', qualId)
            .input('orgId', orgId)
            .query(`
                SELECT id, company_id, qualification_type, status
                FROM qualifications
                WHERE id=@id AND organization_id=@orgId
            `);
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const qual = check.recordset[0];
        if (await denyOutsideCompany(res, req.user, qual.company_id, 'write')) return;
        if (!requiresSemiannualConfirmation(qual.qualification_type)) {
            return res.status(400).json({
                error: 'Tipo qualifica non ammesso per conferma semestrale (solo ISO 9606-1 / ISO 14732).',
                code: 'NOT_WELDER_9606',
            });
        }

        const auth = await canUserConfirmSemiannual(req.user, qual.company_id);
        if (!auth.allowed) {
            return res.status(403).json({
                error: 'Solo il coordinatore responsabile primario o admin/superadmin possono modificare la conferma.',
                code: 'FORBIDDEN_NOT_PRIMARY',
                reason: auth.reason,
            });
        }

        const existing = await pool.request()
            .input('cid', confirmationId)
            .input('qualId', qualId)
            .input('orgId', orgId)
            .query(`
                SELECT id, confirmed_at, notes
                FROM qualification_confirmations
                WHERE id = @cid AND qualification_id = @qualId AND organization_id = @orgId
            `);
        if (!existing.recordset.length) {
            return res.status(404).json({ error: 'Conferma non trovata.', code: 'CONFIRMATION_NOT_FOUND' });
        }

        const current = existing.recordset[0];
        const confirmedDate = confirmed_at != null
            ? String(confirmed_at).slice(0, 10)
            : String(current.confirmed_at).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(confirmedDate)) {
            return res.status(400).json({ error: 'Data conferma non valida.', code: 'INVALID_DATE' });
        }

        const notesTrim = notes === undefined
            ? current.notes
            : (notes?.trim() ? notes.trim().substring(0, 500) : null);

        const tx = pool.transaction();
        await tx.begin();
        try {
            await tx.request()
                .input('cid', confirmationId)
                .input('qualId', qualId)
                .input('orgId', orgId)
                .input('confirmedAt', confirmedDate)
                .input('notes', notesTrim)
                .query(`
                    UPDATE qualification_confirmations
                    SET confirmed_at = @confirmedAt,
                        notes = @notes
                    WHERE id = @cid AND qualification_id = @qualId AND organization_id = @orgId
                `);

            const aggregates = await recomputeConfirmationAggregates(tx, { qualId, orgId });
            await tx.commit();

            logger.info(`[Qualif] Conferma ${confirmationId} aggiornata su qual=${qualId} data=${confirmedDate}`);
            res.json({
                success: true,
                confirmation: {
                    id: confirmationId,
                    confirmed_at: confirmedDate,
                    notes: notesTrim,
                },
                ...aggregates,
            });
        } catch (txErr) {
            await tx.rollback();
            throw txErr;
        }
    } catch (err) {
        logger.error('updateConfirmation:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** GET /qualifications/confirmations/export — export Excel registro conferme */
async function exportConfirmations(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const companyId = req.query.company_id ? parseInt(req.query.company_id, 10) : null;
        const qualId = req.query.qualification_id ? parseInt(req.query.qualification_id, 10) : null;
        const dateFrom = req.query.date_from ? String(req.query.date_from).slice(0, 10) : null;
        const dateTo = req.query.date_to ? String(req.query.date_to).slice(0, 10) : null;

        const accessList = await ensureCompanyAccessLoaded(req.user);
        if (companyId != null && Number.isFinite(companyId)) {
            if (await denyOutsideCompany(res, req.user, companyId, 'read')) return;
        }
        if (qualId != null && Number.isFinite(qualId)) {
            const qualRow = await pool.request().input('id', qualId).input('orgId', orgId)
                .query('SELECT id, company_id FROM qualifications WHERE id=@id AND organization_id=@orgId');
            if (!qualRow.recordset.length) return res.status(404).json({ error: 'Non trovata.' });
            if (await denyOutsideCompany(res, req.user, qualRow.recordset[0].company_id, 'read')) return;
        }

        const conditions = ['qc.organization_id = @orgId', 'q.deleted_at IS NULL'];
        const params = { orgId };
        const companyFilter = companyAccessSqlFilter(accessList, 'qc');
        if (companyFilter.clause) {
            conditions.push(companyFilter.clause);
            Object.assign(params, companyFilter.params);
        }

        if (companyId != null && Number.isFinite(companyId)) {
            conditions.push('qc.company_id = @compId');
            params.compId = companyId;
        }
        if (qualId != null && Number.isFinite(qualId)) {
            conditions.push('qc.qualification_id = @qualId');
            params.qualId = qualId;
        }
        if (dateFrom) {
            conditions.push('qc.confirmed_at >= @dateFrom');
            params.dateFrom = dateFrom;
        }
        if (dateTo) {
            conditions.push('qc.confirmed_at <= @dateTo');
            params.dateTo = dateTo;
        }

        const reqDb = pool.request().input('orgId', orgId);
        Object.entries(params).forEach(([k, v]) => {
            if (k !== 'orgId') reqDb.input(k, v);
        });

        const result = await reqDb.query(`
            SELECT
                qc.confirmed_at,
                q.person_name,
                q.qualification_type,
                q.certificate_number,
                c.name AS company_name,
                qc.confirmer_name,
                qc.confirmer_title,
                qc.notes,
                q.last_confirmation_date,
                q.next_confirmation_due
            FROM qualification_confirmations qc
            INNER JOIN qualifications q ON q.id = qc.qualification_id
            LEFT JOIN companies c ON c.id = qc.company_id
            WHERE ${conditions.join(' AND ')}
            ORDER BY qc.confirmed_at DESC, qc.id DESC
        `);

        const rows = (result.recordset || []).map((r) => ({
            'Data conferma': r.confirmed_at ? String(r.confirmed_at).slice(0, 10) : '',
            'Persona': r.person_name || '',
            'Tipo qualifica': r.qualification_type || '',
            'N. certificato': r.certificate_number || '',
            'Azienda': r.company_name || '',
            'Confermato da': r.confirmer_name || '',
            'Titolo': r.confirmer_title || '',
            'Note': r.notes || '',
            'Ultima conferma (qualifica)': r.last_confirmation_date ? String(r.last_confirmation_date).slice(0, 10) : '',
            'Prossima conferma': r.next_confirmation_due ? String(r.next_confirmation_due).slice(0, 10) : '',
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{
            'Data conferma': '', 'Persona': '', 'Tipo qualifica': '', 'N. certificato': '',
            'Azienda': '', 'Confermato da': '', 'Titolo': '', 'Note': '',
            'Ultima conferma (qualifica)': '', 'Prossima conferma': '',
        }]);
        XLSX.utils.book_append_sheet(wb, ws, 'Conferme semestrali');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const suffix = qualId ? `_qual${qualId}` : (companyId ? `_az${companyId}` : '');
        const filename = `conferme_semestrali${suffix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (err) {
        logger.error('exportConfirmations:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** GET /qualifications/coverage/domains — registry plug-in (COV-1). */
async function listCoverageDomains(req, res) {
    try {
        const { listCoverageDomains: listDomains } = require('../services/capabilityCoverage');
        res.json({ domains: listDomains() });
    } catch (err) {
        logger.error('listCoverageDomains:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * POST /qualifications/coverage/verify
 * Body: { domain, company_id?, criteria: { … } }
 */
async function verifyCoverageRequirement(req, res) {
    try {
        const { verifyCoverage } = require('../services/capabilityCoverage');
        const pool = await getPool();
        const orgId = req.user.organization_id;
        const rawCompany = req.body?.company_id;
        const companyId = rawCompany != null && rawCompany !== '' ? Number(rawCompany) : null;
        if (await denyOutsideCompany(res, req.user, companyId, 'read')) return;
        const result = await verifyCoverage(req.body || {}, {
            organizationId: orgId,
            companyId,
            pool,
        });
        res.json(result);
    } catch (err) {
        const status = err.httpStatus || 500;
        if (status >= 500) logger.error('verifyCoverageRequirement:', err.message);
        res.status(status).json({ error: err.message, code: err.code || undefined });
    }
}

module.exports = {
    listQualifications,
    getStats,
    getCoverage,
    listCoverageDomains,
    verifyCoverageRequirement,
    getVisionFitnessGaps,
    getOne,
    createQualification,
    updateQualification,
    deleteQualification,
    hardDeleteQualification,
    QUALIFICATION_MANUAL_EDITABLE_FIELDS,
    renewQualification,
    uploadBatch,
    uploadCertificate,
    getHistory,
    getConfirmations,
    confirmSemiannual,
    updateConfirmation,
    exportConfirmations,
    // Esportate per test unitari (calcolo semaforo/scadenza effettiva)
    effectiveExpiryDate,
    semaforoForRow,
    SITUAZIONE_BUCKET_SQL,
    QUALIFICATION_TAB_FAMILY_SQL,
    buildQualificationTypeScope,
    parseCompanyIdParam,
};
