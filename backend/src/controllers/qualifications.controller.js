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
 *   GET    /qualifications/:id          → dettaglio
 *   POST   /qualifications              → crea (sempre attiva, approval_status=approvata)
 *   PUT    /qualifications/:id          → aggiorna
 *   DELETE /qualifications/:id          → soft delete (status=revocata) — non più esposto in UI
 *   DELETE /qualifications/:id/permanent → cancellazione fisica (nessun legame residuo)
 *   POST   /qualifications/:id/renew    → rinnovo → nuovo record con previous_qualification_id
 */

const path = require('path');
const fs   = require('fs');
const { getPool } = require('../config/database');
const logger = require('../utils/logger');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
    assertMutatingAllowed,
    assertCompanyRead,
    hasCompanyAccessRows,
    sendAccessDenied,
} = require('../services/companyAccess.service');
const { resolvePersonnelForQualification } = require('../services/personnelQualificationLink.service');
const { buildWelderQualificationDesignation } = require('../utils/weldingDesignation');
const { describeIngestFileError } = require('../utils/ingestErrorMessage');
const {
    isWelder9606Type,
    requiresSemiannualConfirmation,
    addMonthsIso,
    canUserConfirmSemiannual,
    isQualificationOperationallyActive,
} = require('../services/weldingCoordinatorAuth.service');
const { toNumericOrNull } = require('../utils/numericSanitizer');
const XLSX = require('xlsx');

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

// Soglie semaforo (giorni)
const DAYS_WARNING = 60;
const DAYS_URGENT  = 30;

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

/**
 * Data di scadenza "effettiva" per il semaforo.
 * Per le qualifiche saldatore ISO 9606 e operatore ISO 14732 la conferma periodica
 * (next_confirmation_due) puo' scadere prima del certificato: si usa la data PIU' IMMINENTE
 * tra le due. Difensivo: se una manca usa l'altra; per gli altri tipi resta solo expiry_date.
 */
function effectiveExpiryDate(q) {
    const expiry = q.expiry_date || null;
    if (!requiresSemiannualConfirmation(q.qualification_type)) return expiry;
    const nextConf = q.next_confirmation_due || null;
    if (!expiry) return nextConf;
    if (!nextConf) return expiry;
    return new Date(nextConf) < new Date(expiry) ? nextConf : expiry;
}

/** Calcola il semaforo usando la data effettiva (conferma periodica per i 9606). */
function semaforoForRow(q) {
    return semaforo(effectiveExpiryDate(q), q.status);
}

// Mappa tipo tab → LIKE su qualification_type
const QUAL_TYPE_MAP = {
    iso9606_1:      '%9606-1%',
    iso9606_2:      '%9606-2%',
    iso14732:       '%14732%',
    iso14731:       '%14731%',
    // NDT per metodo specifico
    iso9712_vt:     '%VT%',
    iso9712_pt:     '%PT%',
    iso9712_mt:     '%MT%',
    iso9712_ut:     '%UT%',
    iso9712_rt:     '%RT%',
    iso9712_et:     '%ET%',
    // raggruppamento NDT generico
    ndt:            '%NDT%',
    // abilitazioni
    pes_pav:        '%PES%',
    pes:            '%PES%',
    pav:            '%PAV%',
    generico:       '%',        // intercettato dopo
};

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
            qualification_type = '',
            page = 1, limit = 50,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        let where = ['q.organization_id = @orgId'];
        if (companyFilter.clause) where.push(companyFilter.clause);
        if (search) where.push("(q.person_name LIKE @search OR q.qualification_type LIKE @search OR q.certificate_number LIKE @search)");
        if (company_id) where.push('q.company_id = @companyId');
        if (status) where.push('q.status = @status');
        if (approval_status) where.push('q.approval_status = @approvalStatus');

        let qualTypeLike = null;
        if (qualification_type && qualification_type !== 'generico') {
            qualTypeLike = QUAL_TYPE_MAP[qualification_type] || `%${qualification_type}%`;
            where.push('q.qualification_type LIKE @qualType');
        } else if (qualification_type === 'generico') {
            // generico = non rientra negli altri tipi noti
            where.push("q.qualification_type NOT LIKE '%9606%' AND q.qualification_type NOT LIKE '%14732%' AND q.qualification_type NOT LIKE '%14731%' AND q.qualification_type NOT LIKE '%NDT%' AND q.qualification_type NOT LIKE '%VT%' AND q.qualification_type NOT LIKE '%PT%' AND q.qualification_type NOT LIKE '%MT%' AND q.qualification_type NOT LIKE '%UT%' AND q.qualification_type NOT LIKE '%RT%' AND q.qualification_type NOT LIKE '%ET%' AND q.qualification_type NOT LIKE '%PES%' AND q.qualification_type NOT LIKE '%PAV%'");
        }

        if (expiring_days) {
            const expDaysInt = parseInt(expiring_days);
            if (expDaysInt < 0) {
                // Già scadute: expiry_date nel passato
                where.push("q.expiry_date IS NOT NULL AND q.expiry_date < CAST(GETDATE() AS DATE) AND q.status NOT IN ('revocata','sospesa')");
            } else {
                where.push("q.expiry_date IS NOT NULL AND q.expiry_date <= DATEADD(day, @expDays, CAST(GETDATE() AS DATE)) AND q.expiry_date >= CAST(GETDATE() AS DATE) AND q.status NOT IN ('revocata','sospesa')");
            }
        }
        const whereClause = where.join(' AND ');

        const bindListFilters = (request) => {
            Object.entries(companyFilter.params).forEach(([k, v]) => request.input(k, v));
            if (search) request.input('search', `%${search}%`);
            if (company_id) request.input('companyId', parseInt(company_id));
            if (status) request.input('status', status);
            if (approval_status) request.input('approvalStatus', approval_status);
            if (qualTypeLike) request.input('qualType', qualTypeLike);
            if (expiring_days) request.input('expDays', parseInt(expiring_days));
        };

        const r = pool.request().input('orgId', orgId).input('lim', parseInt(limit)).input('off', offset);
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
                CASE WHEN q.expiry_date IS NULL THEN 1 ELSE 0 END,
                q.expiry_date ASC,
                q.person_name ASC
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
            page: parseInt(page),
            limit: parseInt(limit),
        });
    } catch (err) {
        logger.error('listQualifications:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** GET /qualifications/stats */
async function getStats(req, res) {
    try {
        const pool       = await getPool();
        const orgId      = req.user.organization_id;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'q');

        const whereExtra = companyFilter.clause ? ` AND ${companyFilter.clause}` : '';
        const r = pool.request().input('orgId', orgId);
        Object.entries(companyFilter.params).forEach(([k, v]) => r.input(k, v));

        const statsResult = await r.query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN q.status = 'valida' AND (q.expiry_date IS NULL OR q.expiry_date > DATEADD(day, 60, CAST(GETDATE() AS DATE))) THEN 1 ELSE 0 END) AS valide,
                SUM(CASE WHEN q.expiry_date IS NOT NULL AND q.expiry_date BETWEEN DATEADD(day, 31, CAST(GETDATE() AS DATE)) AND DATEADD(day, 60, CAST(GETDATE() AS DATE)) AND q.status NOT IN ('revocata','sospesa') THEN 1 ELSE 0 END) AS in_scadenza_60,
                SUM(CASE WHEN q.expiry_date IS NOT NULL AND q.expiry_date BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(day, 30, CAST(GETDATE() AS DATE)) AND q.status NOT IN ('revocata','sospesa') THEN 1 ELSE 0 END) AS in_scadenza_30,
                SUM(CASE WHEN q.expiry_date IS NOT NULL AND q.expiry_date < CAST(GETDATE() AS DATE) AND q.status NOT IN ('revocata','sospesa') THEN 1 ELSE 0 END) AS scadute,
                SUM(CASE WHEN q.status IN ('sospesa','revocata') THEN 1 ELSE 0 END) AS non_attive
            FROM qualifications q
            WHERE q.organization_id = @orgId${whereExtra}
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
            .query(`SELECT id, project_code, applicable_wps_ids, company_id FROM projects WHERE id=@projId AND organization_id=@orgId`);
        if (!projResult.recordset.length) return res.status(404).json({ error: 'Commessa non trovata.' });

        const project = projResult.recordset[0];
        const projectCompanyId = project.company_id || null;
        let wpsIds = [];
        try { wpsIds = JSON.parse(project.applicable_wps_ids || '[]'); } catch (_) {}

        // Carica WPS della commessa — include campi numerici per il match range-aware
        let wpsRows = [];
        if (wpsIds.length) {
            const ph = wpsIds.map((_, i) => `@wid${i}`).join(',');
            const wReq = pool.request().input('orgId', orgId);
            wpsIds.forEach((id, i) => wReq.input(`wid${i}`, parseInt(id)));
            const wRes = await wReq.query(`
                SELECT id, wps_code, welding_process,
                       base_material_group, material_group,
                       thickness_range_min, thickness_range_max, thickness_range,
                       welding_positions, position
                FROM welding_procedures
                WHERE id IN (${ph}) AND organization_id = @orgId AND status != 'annullata'
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

        // Carica qualifiche del tipo pertinente — filtrate per company_id commessa se disponibile.
        // Nessun filtro su approval_status (rimosso il gate manuale, v. header file): l'esclusione
        // di qualifiche non più operativamente valide (certificato scaduto o conferma semestrale
        // scaduta) è automatica, via isQualificationOperationallyActive, subito sotto.
        const qReq = pool.request().input('orgId', orgId);
        let qWhere = `
            q.organization_id = @orgId
            AND q.status NOT IN ('revocata','sospesa')
            AND (q.qualification_type LIKE '%9606%' OR q.qualification_type LIKE '%14732%')
        `;
        if (projectCompanyId) {
            qReq.input('projCompId', parseInt(projectCompanyId));
            qWhere += ' AND q.company_id = @projCompId';
        }
        const qRes = await qReq.query(`
            SELECT q.id, q.person_name, q.person_code, q.qualification_type,
                   q.welding_process, q.material_group, q.position_range,
                   q.thickness_min_mm, q.thickness_max_mm, q.thickness_range, q.joint_type,
                   q.expiry_date, q.status, q.approval_status, q.next_confirmation_due,
                   c.name AS company_name
            FROM qualifications q
            LEFT JOIN companies c ON c.id = q.company_id
            WHERE ${qWhere}
            ORDER BY q.person_name
        `);
        const qualRows = qRes.recordset.filter((q) => isQualificationOperationallyActive(q));

        const {
            computeQualificationCoverage,
            computeWpsCoverageEsito,
        } = require('../utils/qualificationCoverage');

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

            const qualifiersWithDetail = qualRows.map(q => {
                const detail = computeQualificationCoverage(q, wps);
                return { q, detail };
            }).filter(({ detail }) => detail.overall !== 'excluded');

            const coverageDetails = qualifiersWithDetail.map(({ detail }) => detail);
            const esito = computeWpsCoverageEsito(coverageDetails);

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
                    semaforo:        semaforo(q.expiry_date, q.status),
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
        const body = req.body;
        const {
            company_id, person_name, person_code, department,
            qualification_type, standard_ref, scope_detail,
            certificate_number, issuing_body,
            issue_date, expiry_date, last_renewal_date,
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
            product_type, weld_details,
            thickness_min_mm, thickness_max_mm, pipe_diameter_min_mm, pipe_diameter_max_mm,
            // operatore 14732 (saldatura automatica/meccanizzata)
            welding_type, single_multi_run, qualification_method,
        } = body;

        if (!person_name?.trim()) return res.status(400).json({ error: 'Il nome della persona \u00e8 obbligatorio.' });
        if (!qualification_type?.trim()) return res.status(400).json({ error: 'Il tipo di qualifica \u00e8 obbligatorio.' });

        // Range numerici (fonte primaria) + stringhe legacy derivate.
        const thickMin = toNum(thickness_min_mm);
        const thickMax = toNum(thickness_max_mm);
        const pipeMin  = toNum(pipe_diameter_min_mm);
        const pipeMax  = toNum(pipe_diameter_max_mm);
        const thicknessRangeFinal = thickness_range || deriveRangeString(thickMin, thickMax);
        const pipeDiameterFinal   = pipe_diameter || deriveRangeString(pipeMin, pipeMax);
        // Designazione ricalcolata server-side dai campi correnti.
        const designation = buildWelderQualificationDesignation({
            welding_process, product_type, joint_type,
            filler_material_group: filler_material,
            thickness_min_mm: thickMin, thickness_max_mm: thickMax,
            pipe_diameter_min_mm: pipeMin, pipe_diameter_max_mm: pipeMax,
            welding_positions: position_range, weld_details,
        });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const userId = req.user.user_id;

        // Anti-duplicato: stesso certificate_number + company_id + qualification_type (non revocate)
        if (certificate_number?.trim() && company_id) {
            const dupCheck = await pool.request()
                .input('orgId',    orgId)
                .input('certNum',  certificate_number.trim())
                .input('compId',   parseInt(company_id))
                .input('qualType', qualification_type.trim())
                .query(`
                    SELECT COUNT(*) AS cnt FROM qualifications
                    WHERE organization_id=@orgId
                      AND certificate_number=@certNum
                      AND company_id=@compId
                      AND qualification_type=@qualType
                      AND status != 'revocata'
                `);
            if (dupCheck.recordset[0].cnt > 0) {
                return res.status(400).json({
                    error: 'Qualifica duplicata: esiste gi\u00e0 una qualifica attiva con lo stesso numero certificato, azienda e tipo.',
                    code: 'DUPLICATE_QUALIFICATION',
                });
            }
        }

        const r = await pool.request()
            .input('orgId',     orgId)
            .input('compId',    company_id   || null)
            .input('personName',person_name.trim())
            .input('personCode',person_code  || null)
            .input('dept',      department   || null)
            .input('qualType',  qualification_type.trim())
            .input('stdRef',    standard_ref || null)
            .input('scope',     scope_detail || null)
            .input('certNum',   certificate_number || null)
            .input('issuer',    issuing_body || null)
            .input('issueDate', issue_date   || null)
            .input('expiryDate',expiry_date  || null)
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
            .input('certFileUrl', certificate_file_url || null)
            // saldatore 9606-1 enrichment
            .input('examDate',    exam_date         || null)
            .input('lastConfDate',last_confirmation_date || null)
            .input('nextConfDue', next_confirmation_due  || null)
            .input('revalDate',   revalidation_date || null)
            .input('productType', product_type      || null)
            .input('weldDetails', weld_details      || null)
            .input('designation', designation       || null)
            .input('thickMin',    thickMin)
            .input('thickMax',    thickMax)
            .input('pipeMin',     pipeMin)
            .input('pipeMax',     pipeMax)
            .input('thickRangeFinal', thicknessRangeFinal || null)
            .input('pipeDiamFinal',   pipeDiameterFinal   || null)
            .input('weldingType',     welding_type      || null)
            .input('singleMultiRun',  single_multi_run  || null)
            .input('qualMethod',      qualification_method || null)
            .query(`
                INSERT INTO qualifications
                    (organization_id, company_id, person_name, person_code, department,
                     qualification_type, standard_ref, scope_detail, certificate_number, issuing_body,
                     issue_date, exam_date, expiry_date, last_renewal_date,
                     last_confirmation_date, next_confirmation_due, revalidation_date,
                     status, notes, created_by,
                     welding_process, material_group, position_range, ndt_method, ndt_level,
                     approval_status, joint_type, product_type, weld_details, qualification_designation,
                     thickness_min_mm, thickness_max_mm, pipe_diameter_min_mm, pipe_diameter_max_mm,
                     thickness_range, pipe_diameter,
                     filler_material, shielding_gas, equipment_type,
                     welding_type, single_multi_run, qualification_method,
                     ndt_sector, certification_scheme,
                     coordinator_title, diploma_number, cpd_valid_until,
                     patent_type, training_body,
                     course_name, training_hours, examiner_body, certificate_file_url)
                OUTPUT INSERTED.id
                VALUES
                    (@orgId, @compId, @personName, @personCode, @dept,
                     @qualType, @stdRef, @scope, @certNum, @issuer,
                     @issueDate, @examDate, @expiryDate, @renewalDate,
                     @lastConfDate, @nextConfDue, @revalDate,
                     @status, @notes, @userId,
                     @weldProc, @matGroup, @posRange, @ndtMethod, @ndtLevel,
                     @approvalStatus, @jointType, @productType, @weldDetails, @designation,
                     @thickMin, @thickMax, @pipeMin, @pipeMax,
                     @thickRangeFinal, @pipeDiamFinal,
                     @filler, @shieldGas, @equipType,
                     @weldingType, @singleMultiRun, @qualMethod,
                     @ndtSector, @certScheme,
                     @coordTitle, @diplomaNum, @cpdUntil,
                     @patentType, @trainBody,
                     @courseName, @trainHours, @examBody, @certFileUrl)
            `);

        logger.info(`[Qualif] Creata id=${r.recordset[0].id} per org ${orgId}`);
        res.status(201).json({ success: true, id: r.recordset[0].id });
    } catch (err) {
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
        const body  = req.body;

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT id, company_id FROM qualifications WHERE id=@id AND organization_id=@orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const targetCompanyId = body.company_id !== undefined ? body.company_id : check.recordset[0].company_id;
        const writeDenied = await assertMutatingAllowed(req.user, { companyId: targetCompanyId });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const {
            company_id, person_name, person_code, department,
            qualification_type, standard_ref, scope_detail,
            certificate_number, issuing_body,
            issue_date, expiry_date, last_renewal_date,
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
            product_type, weld_details,
            thickness_min_mm, thickness_max_mm, pipe_diameter_min_mm, pipe_diameter_max_mm,
            // operatore 14732 (saldatura automatica/meccanizzata)
            welding_type, single_multi_run, qualification_method,
        } = body;

        const thickMin = toNum(thickness_min_mm);
        const thickMax = toNum(thickness_max_mm);
        const pipeMin  = toNum(pipe_diameter_min_mm);
        const pipeMax  = toNum(pipe_diameter_max_mm);
        const thicknessRangeFinal = thickness_range || deriveRangeString(thickMin, thickMax);
        const pipeDiameterFinal   = pipe_diameter || deriveRangeString(pipeMin, pipeMax);
        const designation = buildWelderQualificationDesignation({
            welding_process, product_type, joint_type,
            filler_material_group: filler_material,
            thickness_min_mm: thickMin, thickness_max_mm: thickMax,
            pipe_diameter_min_mm: pipeMin, pipe_diameter_max_mm: pipeMax,
            welding_positions: position_range, weld_details,
        });

        await pool.request()
            .input('id',        id)
            .input('orgId',     orgId)
            .input('compId',    company_id   || null)
            .input('personName',person_name?.trim())
            .input('personCode',person_code  || null)
            .input('dept',      department   || null)
            .input('qualType',  qualification_type?.trim())
            .input('stdRef',    standard_ref || null)
            .input('scope',     scope_detail || null)
            .input('certNum',   certificate_number || null)
            .input('issuer',    issuing_body || null)
            .input('issueDate', issue_date   || null)
            .input('expiryDate',expiry_date  || null)
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
            .input('certFileUrl', certificate_file_url || null)
            // saldatore 9606-1 enrichment
            .input('examDate',    exam_date         || null)
            .input('lastConfDate',last_confirmation_date || null)
            .input('nextConfDue', next_confirmation_due  || null)
            .input('revalDate',   revalidation_date || null)
            .input('productType', product_type      || null)
            .input('weldDetails', weld_details      || null)
            .input('designation', designation       || null)
            .input('thickMin',    thickMin)
            .input('thickMax',    thickMax)
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
                    department=@dept, qualification_type=@qualType, standard_ref=@stdRef,
                    scope_detail=@scope, certificate_number=@certNum, issuing_body=@issuer,
                    issue_date=@issueDate, exam_date=@examDate, expiry_date=@expiryDate, last_renewal_date=@renewalDate,
                    last_confirmation_date=@lastConfDate, next_confirmation_due=@nextConfDue, revalidation_date=@revalDate,
                    status=@status, notes=@notes, updated_at=GETDATE(),
                    welding_process=@weldProc, material_group=@matGroup, position_range=@posRange,
                    ndt_method=@ndtMethod, ndt_level=@ndtLevel,
                    joint_type=@jointType, product_type=@productType, weld_details=@weldDetails,
                    qualification_designation=@designation,
                    thickness_min_mm=@thickMin, thickness_max_mm=@thickMax,
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

        res.json({ success: true });
    } catch (err) {
        logger.error('updateQualif:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** DELETE /qualifications/:id — soft delete */
async function deleteQualification(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT id, company_id FROM qualifications WHERE id=@id AND organization_id=@orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        await pool.request().input('id', id).input('orgId', orgId)
            .query("UPDATE qualifications SET status='revocata', updated_at=GETDATE() WHERE id=@id AND organization_id=@orgId");

        res.json({ success: true });
    } catch (err) {
        logger.error('deleteQualif:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/**
 * DELETE /qualifications/:id/permanent — cancellazione fisica reale.
 *
 * Decisione di prodotto 28/07/2026: rimosso il concetto di "bozza mai approvata"
 * (non esiste più un gate di approvazione interna — v. header file). L'Elimina
 * definitiva è ora l'unica azione di rimozione esposta in UI (oltre alla modifica
 * diretta dello Stato) ed è consentita per QUALSIASI qualifica, purché non abbia
 * legami reali che ne renderebbero pericolosa la cancellazione:
 *  - non ha conferme semestrali registrate (qualification_confirmations);
 *  - non è collegata a un file di import (import_job_files.qualification_id);
 *  - non è la versione "precedente" di un rinnovo (nessun'altra qualifica la referenzia
 *    tramite previous_qualification_id);
 *  - non è assegnata a un WPS (wps_welders), se la tabella esiste.
 */
async function hardDeleteQualification(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query(`
                SELECT id, company_id, approval_status, approved_at, certificate_file_url
                FROM qualifications WHERE id=@id AND organization_id=@orgId
            `);
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const row = check.recordset[0];
        const writeDenied = await assertMutatingAllowed(req.user, { companyId: row.company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const [confirmations, importLinks, renewalRefs] = await Promise.all([
            pool.request().input('id', id)
                .query('SELECT COUNT(*) AS cnt FROM qualification_confirmations WHERE qualification_id=@id'),
            pool.request().input('id', id)
                .query('SELECT COUNT(*) AS cnt FROM import_job_files WHERE qualification_id=@id'),
            pool.request().input('id', id)
                .query('SELECT COUNT(*) AS cnt FROM qualifications WHERE previous_qualification_id=@id'),
        ]);

        if (confirmations.recordset[0].cnt > 0) {
            return res.status(409).json({
                error: 'Impossibile eliminare: esistono conferme semestrali registrate su questa qualifica.',
                code: 'HAS_CONFIRMATIONS',
            });
        }
        if (importLinks.recordset[0].cnt > 0) {
            return res.status(409).json({
                error: 'Impossibile eliminare: la qualifica \u00e8 collegata a un documento importato.',
                code: 'HAS_IMPORT_LINK',
            });
        }
        if (renewalRefs.recordset[0].cnt > 0) {
            return res.status(409).json({
                error: 'Impossibile eliminare: la qualifica \u00e8 collegata a un rinnovo successivo.',
                code: 'HAS_RENEWAL_LINK',
            });
        }

        try {
            const wpsLink = await pool.request().input('id', id)
                .query('SELECT COUNT(*) AS cnt FROM wps_welders WHERE qualification_id=@id');
            if (wpsLink.recordset[0].cnt > 0) {
                return res.status(409).json({
                    error: 'Impossibile eliminare: la qualifica \u00e8 assegnata a una procedura di saldatura (WPS).',
                    code: 'HAS_WPS_LINK',
                });
            }
        } catch (wpsErr) {
            // Tabella wps_welders assente in alcuni ambienti storici: non blocca l'eliminazione.
            logger.warn('[Qualif] Verifica wps_welders non eseguita:', wpsErr.message);
        }

        await pool.request().input('id', id).input('orgId', orgId)
            .query('DELETE FROM qualifications WHERE id=@id AND organization_id=@orgId');

        if (row.certificate_file_url) {
            try {
                const uploadBase = process.env.UPLOAD_DIR
                    ? path.resolve(process.env.UPLOAD_DIR)
                    : path.resolve(__dirname, '../../uploads');
                const relPart = row.certificate_file_url.replace(/^\//, '').replace(/^uploads\//, '');
                const filePath = path.join(uploadBase, relPart);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (_) {
                /* best-effort: la cancellazione del record non deve fallire per questo */
            }
        }

        logger.info(`[Qualif] Eliminata definitivamente id=${id} da user ${req.user.user_id} org ${orgId}`);
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
            .query('SELECT * FROM qualifications WHERE id=@id AND organization_id=@orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const q = check.recordset[0];
        const writeDenied = await assertMutatingAllowed(req.user, { companyId: q.company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        // Sovrascritture dal body (es. nuove date, nuovo certificato)
        const {
            issue_date, expiry_date, last_renewal_date,
            certificate_number, certificate_file_url,
            notes,
        } = req.body || {};

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
            .input('certFileUrl', certificate_file_url || null)
            .query(`
                INSERT INTO qualifications
                    (organization_id, company_id, person_name, person_code, department,
                     qualification_type, standard_ref, scope_detail, certificate_number, issuing_body,
                     issue_date, expiry_date, last_renewal_date, status, notes, created_by,
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
                     @issueDate, @expiryDate, @renewalDate, 'valida', @notes, @userId,
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
        logger.error('renewQualif:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// Tipi documento ammessi per il batch upload qualifiche (IG-3 staging).
const UPLOAD_BATCH_DOC_TYPES = new Set(['patentino_saldatore', 'qualifica_14732']);

/** POST /qualifications/upload-batch — estrazione + staging IG-3 (revisione pre-commit) */
async function uploadBatch(req, res) {
    try {
        const orgId    = req.user.organization_id;
        const userId   = req.user.user_id;
        const company_id = req.body?.company_id ? parseInt(req.body.company_id) : null;
        const docType = UPLOAD_BATCH_DOC_TYPES.has(req.body?.doc_type) ? req.body.doc_type : 'patentino_saldatore';

        if (!company_id || isNaN(company_id)) {
            return res.status(400).json({ error: 'company_id obbligatorio: seleziona un\'azienda specifica prima di caricare i patentini.' });
        }

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

                if (extracted.status === 'wrong_module') {
                    try { fs.unlinkSync(file.path); } catch (_) {}
                    results.push({
                        fileName: file.originalname,
                        status: 'wrong_module',
                        ...extracted,
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
                    });
                    continue;
                }

                const stagingId = await createStagingRecord({
                    organizationId: orgId,
                    companyId: company_id,
                    docType,
                    originalName: file.originalname,
                    storagePath: file.path,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                    fields: extracted.fields,
                    fieldConfidence: extracted.field_confidence,
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
                };
            } catch (fileErr) {
                const errMsg = describeIngestFileError(fileErr);
                logger.error('[Qualif/batch] Estrazione fallita', {
                    fileName: file.originalname,
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
            .query('SELECT id, company_id, certificate_file_url FROM qualifications WHERE id=@id AND organization_id=@orgId');
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
        const relUrl = '/uploads/' + path.relative(uploadBase, req.file.path).replace(/\\/g, '/');

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
            .query('SELECT id FROM qualifications WHERE id=@id AND organization_id=@orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        // Risali la catena (max 20 rinnovi)
        const chain = [];
        let currentId = id;
        for (let i = 0; i < 20; i++) {
            const r = await pool.request()
                .input('id', currentId).input('orgId', orgId)
                .query(`
                    SELECT q.id, q.issue_date, q.expiry_date, q.certificate_number,
                           q.approval_status, q.status, q.previous_qualification_id,
                           c.name AS company_name
                    FROM qualifications q
                    LEFT JOIN companies c ON c.id = q.company_id
                    WHERE q.id=@id AND q.organization_id=@orgId
                `);
            if (!r.recordset.length) break;
            const row = r.recordset[0];
            chain.push({ ...row, semaforo: semaforo(row.expiry_date, row.status) });
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
                       q.last_confirmation_date, q.next_confirmation_due,
                       u.full_name AS user_name
                FROM qualifications q
                LEFT JOIN users u ON u.user_id = @userId
                WHERE q.id=@id AND q.organization_id=@orgId
            `);
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        const qual = check.recordset[0];

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
                .query(`
                    UPDATE qualifications
                    SET last_confirmation_date = @lastConf,
                        next_confirmation_due = @nextDue,
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

/** GET /qualifications/confirmations/export — export Excel registro conferme */
async function exportConfirmations(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const companyId = req.query.company_id ? parseInt(req.query.company_id, 10) : null;
        const qualId = req.query.qualification_id ? parseInt(req.query.qualification_id, 10) : null;
        const dateFrom = req.query.date_from ? String(req.query.date_from).slice(0, 10) : null;
        const dateTo = req.query.date_to ? String(req.query.date_to).slice(0, 10) : null;

        if (companyId != null && Number.isFinite(companyId)) {
            const readDenied = await assertCompanyRead(req.user, companyId);
            if (readDenied) return sendAccessDenied(res, readDenied);
        }

        const conditions = ['qc.organization_id = @orgId'];
        const params = { orgId };

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

module.exports = {
    listQualifications,
    getStats,
    getCoverage,
    getOne,
    createQualification,
    updateQualification,
    deleteQualification,
    hardDeleteQualification,
    renewQualification,
    uploadBatch,
    uploadCertificate,
    getHistory,
    getConfirmations,
    confirmSemiannual,
    exportConfirmations,
    // Esportate per test unitari (calcolo semaforo/scadenza effettiva)
    effectiveExpiryDate,
    semaforoForRow,
};
