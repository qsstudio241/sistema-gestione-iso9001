/**
 * Welding Controller ? CRUD per WPS e WPQR
 * Modulo Saldatura ISO 3834
 *
 * Tenant-isolated: ogni query filtra per organization_id dal JWT.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { normalizeApplicableWpsIds } = require('../utils/applicableWpsIds');
const { logEntityChange, trashedDetailHidden, softDeleteSql } = require('../services/entityChangeLog.service');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
    assertMutatingAllowed,
    assertCompanyRead,
    hasCompanyAccessRows,
    getAllowedCompanyIds,
    sendAccessDenied,
} = require('../services/companyAccess.service');
const {
    insertLink,
    listWpqrRecordsForWps,
    wpqrLinkedToWpsCountSql,
    linksAvailable,
    ROLES: WPS_WPQR_ROLES,
} = require('../services/wpsWpqrLinks.service');

/** Colonne 181+182 su welding_procedures. INSERT/UPDATE le omettono se la migrazione non è ancora applicata. */
const ISO15609_WPS_FIELDS_181 = Object.freeze([
    'wpqr_ref', 'parent_material_a', 'parent_material_b',
    'heat_input', 'current_range', 'voltage_range', 'metal_transfer',
]);
const ISO15609_WPS_FIELDS_182 = Object.freeze([
    'joint_preparation', 'cleaning_method', 'mechanization',
    'shielding_gas_flow_l_min_min', 'shielding_gas_flow_l_min_max',
    'post_heating', 'pwht_details', 'bead_technique',
    'contact_tube_distance_mm_min', 'contact_tube_distance_mm_max',
    'torch_angle_deg', 'throat_mm', 'pipe_diameter_max',
]);
const ISO15609_WPS_FIELDS = Object.freeze([
    ...ISO15609_WPS_FIELDS_181,
    ...ISO15609_WPS_FIELDS_182,
]);
const ISO15609_WPS_NUMERIC = Object.freeze([
    'shielding_gas_flow_l_min_min', 'shielding_gas_flow_l_min_max',
    'contact_tube_distance_mm_min', 'contact_tube_distance_mm_max',
    'torch_angle_deg', 'throat_mm', 'pipe_diameter_max',
]);

async function presentIso15609WpsColumns() {
    try {
        const namesSql = ISO15609_WPS_FIELDS.map((n) => `N'${n}'`).join(', ');
        const r = await query(`
            SELECT c.name AS name
            FROM sys.columns c
            WHERE c.object_id = OBJECT_ID(N'dbo.welding_procedures')
              AND c.name IN (${namesSql})
        `);
        return new Set((r.recordset || []).map((row) => row.name));
    } catch (err) {
        logger.warn('ISO 15609 WPS columns probe failed; omit new fields', { error: err.message });
        return new Set();
    }
}

function iso15609Scalar(body, field) {
    const raw = body[field];
    if (ISO15609_WPS_NUMERIC.includes(field)) {
        if (raw == null || raw === '') return null;
        const n = parseFloat(raw);
        return Number.isFinite(n) ? n : null;
    }
    return raw || null;
}

function iso15609WpsValues(body) {
    const out = {};
    for (const field of ISO15609_WPS_FIELDS) {
        out[field] = iso15609Scalar(body, field);
    }
    if (out.pipe_diameter_max == null && body.pipe_diameter_mm != null && body.pipe_diameter_mm !== '') {
        const n = parseFloat(body.pipe_diameter_mm);
        if (Number.isFinite(n)) out.pipe_diameter_max = n;
    }
    if (out.throat_mm == null && body.throat_mm != null && body.throat_mm !== '') {
        const n = parseFloat(body.throat_mm);
        if (Number.isFinite(n)) out.throat_mm = n;
    }
    return out;
}

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

/**
 * Libreria studio (`company_id` NULL): lettura nel tenant;
 * scrittura solo se il ruolo/permesso lo consente (viewer e sola lettura esclusi).
 */
async function denySketchCompany(res, user, companyId, level = 'read') {
    if (companyId == null || companyId === '') {
        if (level !== 'write') return false;
        const accessList = await ensureCompanyAccessLoaded(user);
        if (!hasCompanyAccessRows(accessList)) {
            const studioDenied = await assertMutatingAllowed(user, {});
            if (studioDenied) {
                sendAccessDenied(res, studioDenied);
                return true;
            }
            return false;
        }
        const hasWrite = accessList.some((row) => row.permission === 'write');
        if (!hasWrite) {
            sendAccessDenied(res, {
                status: 403,
                body: { error: 'Permesso negato: sola lettura', code: 'AUTH_FORBIDDEN' },
            });
            return true;
        }
        return false;
    }
    return denyOutsideCompany(res, user, companyId, level);
}

async function pushCompanyScope(user, alias, conditions, params, prefix) {
    const accessList = await ensureCompanyAccessLoaded(user);
    const filter = companyAccessSqlFilter(accessList, alias, 'company_id', prefix);
    if (filter.clause) {
        conditions.push(filter.clause);
        Object.assign(params, filter.params);
    }
}

/**
 * Id intero positivo. parseInt("1e2") è 1 e parseFloat("1e2") è 100:
 * lo stesso campo non può essere letto con due parser diversi.
 */
function strictPositiveInt(raw) {
    if (typeof raw === 'number') {
        if (!Number.isInteger(raw) || raw <= 0) return null;
        return raw;
    }
    const text = String(raw).trim();
    if (!/^[1-9]\d{0,8}$/.test(text)) return null;
    return parseInt(text, 10);
}

/** WPQR senza company_id proprio appartiene all'azienda della WPS (COALESCE già usato in lista). */
function wpqrScopeCompany(row) {
    if (!row) return null;
    if (row.company_id != null && row.company_id !== '') return row.company_id;
    return row.wps_company_id ?? null;
}

const WPQR_SCOPE_SQL = `
    SELECT wq.id, wq.company_id, w.company_id AS wps_company_id
    FROM wpqr_records wq
    LEFT JOIN welding_procedures w
      ON w.id = wq.wps_id AND w.organization_id = wq.organization_id
    WHERE wq.id = @id AND wq.organization_id = @organization_id
      AND wq.deleted_at IS NULL
`;

async function pushWpqrCompanyScope(user, conditions, params, prefix) {
    const accessList = await ensureCompanyAccessLoaded(user);
    const onWpqr = companyAccessSqlFilter(accessList, 'wq', 'company_id', prefix);
    const onWps = companyAccessSqlFilter(accessList, 'w', 'company_id', `${prefix}w`);
    if (!onWpqr.clause) return;
    conditions.push(`(${onWpqr.clause} OR (wq.company_id IS NULL AND ${onWps.clause}))`);
    Object.assign(params, onWpqr.params, onWps.params);
}

const { describeIngestFileError, redactFileNameForLog } = require('../utils/ingestErrorMessage');
const wpqrTestRuns = require('../services/wpqrTestRuns.service');

/**
 * Campi WPQR modificabili da form/API manuale (updateWPQR) — fonte unica,
 * riusata anche dal test strutturale `welding.controller.manualFieldsCompleteness.test.js`
 * (verifica che ogni campo dello schema ingest WPQR sia qui, gap analysis 08/08/2026).
 * Esclusi di proposito: colonne di sistema (id, created_*), workflow di approvazione
 * (approval_status, rejection_reason, status — gestiti da endpoint dedicati),
 * link a file caricati (certificate_file_url, certificate_original_url),
 * reference_number (duplicato tecnico di wpqr_code, solo per controllo duplicati ingest).
 */
const WPQR_MANUAL_EDITABLE_FIELDS = [
    'wps_id', 'wpqr_code', 'test_date', 'testing_body', 'examiner_body', 'welder_name',
    'welding_process', 'base_material_group', 'welding_positions', 'filler_material',
    'thickness_tested', 'thickness_min', 'thickness_max', 'diameter_min', 'diameter_max',
    'vt_result', 'rt_result', 'ut_result', 'mt_result', 'pt_result',
    'tensile_result', 'bend_result', 'impact_result', 'hardness_result',
    'macro_result', 'issue_date', 'certificate_number', 'notes',
    'qualification_level', 'joint_type', 'standard_reference', 'wps_ref',
    'base_material_spec', 'shielding_gas', 'current_type', 'metal_transfer',
    'mechanization', 'single_multi_run', 'heat_input_note', 'pwht',
    'thickness_max_unlimited', 'preheat_temp', 'interpass_temp', 'throat_test_mm',
    'product_type', 'rotated_position',
    'thickness_t1_min', 'thickness_t1_max', 'thickness_t1_max_unlimited',
    'thickness_t2_min', 'thickness_t2_max', 'thickness_t2_max_unlimited',
    // STUD-1: stud/prigioniero + Parent Metal 2 (mig. 159)
    'qualifying_element', 'base_material_group_2', 'base_material_spec_2',
    ...wpqrTestRuns.WPQR_TEST_HEADER_FIELDS,
];

// ?
// WPS ? Welding Procedure Specifications
// ?

//  GET /api/v1/welding/wps ??
async function listWPS(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id,
            welding_process,
            status,
            search,
            page  = 1,
            limit = 50,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const conditions = ['w.organization_id = @organization_id', 'w.deleted_at IS NULL'];
        const params = { organization_id, limit: parseInt(limit), offset };

        if (company_id != null && company_id !== '') {
            if (await denyOutsideCompany(res, req.user, company_id, 'read')) return;
        }
        await pushCompanyScope(req.user, 'w', conditions, params, 'wpsco');

        if (company_id) {
            conditions.push('w.company_id = @company_id');
            params.company_id = parseInt(company_id);
        }
        if (welding_process) {
            conditions.push('w.welding_process = @welding_process');
            params.welding_process = welding_process;
        }
        if (status) {
            conditions.push('w.status = @status');
            params.status = status;
        }
        if (search) {
            conditions.push('(w.wps_code LIKE @search OR w.material_group LIKE @search OR w.filler_material LIKE @search)');
            params.search = `%${search}%`;
        }

        const where = conditions.join(' AND ');
        const linksOn = await linksAvailable();
        const wpqrCountSql = linksOn
            ? wpqrLinkedToWpsCountSql('w.id')
            : `(SELECT COUNT(*) FROM wpqr_records wq
                 WHERE wq.wps_id = w.id AND wq.organization_id = @organization_id
                   AND wq.deleted_at IS NULL)`;

        const result = await query(`
            SELECT
                w.*,
                c.name AS company_name,
                ${wpqrCountSql} AS wpqr_count
            FROM welding_procedures w
            LEFT JOIN companies c ON w.company_id = c.id
            WHERE ${where}
            ORDER BY w.updated_at DESC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `, params);

        const countResult = await query(`
            SELECT COUNT(*) AS total
            FROM welding_procedures w
            WHERE ${where}
        `, params);

        const total = countResult.recordset[0].total;

        res.json({
            success: true,
            data: result.recordset,
            pagination: {
                page:       parseInt(page),
                limit:      parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        logger.error('Error listing WPS', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero delle WPS', code: 'WPS_LIST_ERROR' });
    }
}

//  GET /api/v1/welding/wps/:id 
async function getWPS(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
            SELECT w.*, c.name AS company_name
            FROM welding_procedures w
            LEFT JOIN companies c ON w.company_id = c.id
            WHERE w.id = @id AND w.organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS non trovata', code: 'WPS_NOT_FOUND' });
        }
        if (trashedDetailHidden(req.user, result.recordset[0])) {
            return res.status(404).json({ error: 'WPS non trovata', code: 'WPS_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, result.recordset[0].company_id, 'read')) return;

        const linkedWpqr = await listWpqrRecordsForWps({
            organizationId: organization_id,
            wpsId: parseInt(id, 10),
        });

        res.json({
            success: true,
            data: {
                ...result.recordset[0],
                wpqr_records: linkedWpqr,
            },
        });
    } catch (error) {
        logger.error('Error getting WPS', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero della WPS', code: 'WPS_GET_ERROR' });
    }
}

//  POST /api/v1/welding/wps/generate — bozza da WPQR (nessuna scrittura DB)
async function generateWPS(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id,
            joint_type,
            welding_process,
            parent_material_a,
            parent_material_b,
            thickness_a_mm,
            thickness_b_mm,
            pipe_diameter_mm,
            throat_mm,
        } = req.body || {};

        // Validazione soft: campi incompleti → status need_input (domande), non 400.
        // Così l'assistente può chiedere i dati mancanti invece di ricevere errore HTTP.
        const tA = thickness_a_mm === '' || thickness_a_mm == null
            ? null
            : Number(thickness_a_mm);
        const tB = thickness_b_mm === '' || thickness_b_mm == null
            ? null
            : Number(thickness_b_mm);
        // Diametro tubo (mm) — opzionale, SOLO per giunti su tubo (gap analysis
        // 07/08/2026: prima non era nemmeno un parametro della richiesta, quindi
        // il diametro dichiarato sul WPQR non veniva mai verificato).
        const pipeDiameterMm = pipe_diameter_mm === '' || pipe_diameter_mm == null
            ? null
            : Number(pipe_diameter_mm);
        // Gola richiesta (mm) — opzionale, SOLO per giunti FW (gap analysis
        // 07/08/2026, GAP_WPQR_ESTENSIONI_ANNEX_B item 1: la gola dichiarata sulla
        // WPQR ora viene estratta, ma senza questo parametro non veniva mai
        // verificata quando si genera una WPS per un giunto d'angolo).
        const throatMm = throat_mm === '' || throat_mm == null
            ? null
            : Number(throat_mm);

        const requestedCompany = company_id != null && company_id !== '' ? parseInt(company_id, 10) : null;
        if (await denyOutsideCompany(res, req.user, requestedCompany, 'write')) return;

        const { generateWpsFromWpqr } = require('../services/wpsGenerator.service');
        const result = await generateWpsFromWpqr({
            organizationId: organization_id,
            companyId: company_id != null && company_id !== ''
                ? parseInt(company_id, 10)
                : null,
            request: {
                joint_type: joint_type != null ? String(joint_type).trim() : '',
                welding_process: welding_process ? String(welding_process).trim() : undefined,
                parent_material_a: parent_material_a != null ? String(parent_material_a).trim() : '',
                parent_material_b: parent_material_b != null ? String(parent_material_b).trim() : '',
                thickness_a_mm: tA,
                thickness_b_mm: tB,
                pipe_diameter_mm: pipeDiameterMm,
                throat_mm: throatMm,
            },
        });

        let sketch_suggestions = { joint_design: [], welding_sequence: [], combined: [] };
        if (result.wpqr_used && result.wpqr_used.id) {
            try {
                const { suggestForWps } = require('../services/weldSketches.service');
                sketch_suggestions = await suggestForWps({
                    organizationId: organization_id,
                    companyId: requestedCompany,
                    wpqr: result.wpqr_used,
                    request: {
                        joint_type: joint_type != null ? String(joint_type).trim() : '',
                        welding_process: welding_process ? String(welding_process).trim() : undefined,
                        thickness_a_mm: tA,
                        thickness_b_mm: tB,
                    },
                });
            } catch (sketchErr) {
                logger.warn('WPS generate: sketch suggestions skipped', { error: sketchErr.message });
            }
        }

        res.json({
            success: true,
            status: result.status,
            wpqr_used: result.wpqr_used,
            candidates: result.candidates,
            wps_draft: result.wps_draft,
            sketch_suggestions,
            extensions_needed: result.extensions_needed,
            questions: result.questions || [],
            warnings: result.warnings,
        });
    } catch (error) {
        logger.error('Error generating WPS from WPQR', { error: error.message });
        res.status(500).json({
            error: 'Errore durante la generazione WPS',
            code: 'WPS_GENERATE_ERROR',
        });
    }
}

//  POST /api/v1/welding/wps ?
async function createWPS(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const {
            company_id, wps_code, revision, welding_process, material_group,
            filler_material, shielding_gas, joint_type, position, welding_positions,
            thickness_range_min, thickness_range_max, pipe_diameter_min,
            preheat_temp, interpass_temp, pwht, qualification_standard,
            status = 'bozza', notes, wpqr_id,
        } = req.body;

        if (!wps_code) {
            return res.status(400).json({ error: 'Codice WPS obbligatorio', code: 'VALIDATION_ERROR' });
        }
        if (await denyOutsideCompany(res, req.user, company_id, 'write')) return;

        const isoPresent = await presentIso15609WpsColumns();
        const isoCols = ISO15609_WPS_FIELDS.filter((f) => isoPresent.has(f));
        const isoValues = iso15609WpsValues(req.body);
        let sketchCols = [];
        try {
            const { presentWpsSketchColumns } = require('../services/weldSketches.service');
            const sketchPresent = await presentWpsSketchColumns();
            sketchCols = ['joint_sketch_id', 'sequence_sketch_id'].filter((f) => sketchPresent.has(f));
        } catch (_) { sketchCols = []; }
        const extraColsList = [...isoCols, ...sketchCols];
        const extraCols = extraColsList.length ? `,\n                ${extraColsList.join(', ')}` : '';
        const extraVals = extraColsList.length ? `,\n                ${extraColsList.map((f) => `@${f}`).join(', ')}` : '';
        const extraParams = {};
        for (const f of isoCols) extraParams[f] = isoValues[f];
        for (const f of sketchCols) {
            const raw = req.body[f];
            extraParams[f] = raw != null && raw !== '' ? parseInt(raw, 10) : null;
            if (!Number.isSafeInteger(extraParams[f]) || extraParams[f] <= 0) extraParams[f] = null;
        }

        const result = await query(`
            INSERT INTO welding_procedures (
                organization_id, company_id, wps_code, revision,
                welding_process, material_group, filler_material, shielding_gas,
                joint_type, position, thickness_range_min, thickness_range_max,
                pipe_diameter_min, preheat_temp, interpass_temp, pwht,
                qualification_standard, status, notes${extraCols},
                created_by, created_at, updated_at
            )
            OUTPUT INSERTED.id
            VALUES (
                @organization_id, @company_id, @wps_code, @revision,
                @welding_process, @material_group, @filler_material, @shielding_gas,
                @joint_type, @position, @thickness_range_min, @thickness_range_max,
                @pipe_diameter_min, @preheat_temp, @interpass_temp, @pwht,
                @qualification_standard, @status, @notes${extraVals},
                @created_by, GETDATE(), GETDATE()
            )
        `, {
            organization_id,
            company_id:         company_id ? parseInt(company_id) : null,
            wps_code,
            revision:           revision || null,
            welding_process:    welding_process || null,
            material_group:     material_group || null,
            filler_material:    filler_material || null,
            shielding_gas:      shielding_gas || null,
            joint_type:         joint_type || null,
            position:           position || welding_positions || null,
            thickness_range_min: thickness_range_min != null ? parseFloat(thickness_range_min) : null,
            thickness_range_max: thickness_range_max != null ? parseFloat(thickness_range_max) : null,
            pipe_diameter_min:  pipe_diameter_min != null
                ? parseFloat(pipe_diameter_min)
                : (req.body.pipe_diameter_mm != null && req.body.pipe_diameter_mm !== ''
                    ? parseFloat(req.body.pipe_diameter_mm)
                    : null),
            preheat_temp:       preheat_temp || null,
            interpass_temp:     interpass_temp || null,
            pwht:               pwht || null,
            qualification_standard: qualification_standard || null,
            status,
            notes:              notes || null,
            created_by:         user_id,
            ...extraParams,
        });

        const newId = result.recordset[0].id;
        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'welding_procedures',
            entityId: newId,
            actionType: 'created',
            actorUserId: user_id,
            after: { wps_code, status, company_id, welding_process, notes: notes || null },
            fields: ['wps_code', 'status', 'company_id', 'welding_process', 'notes'],
        });

        let wpqr_link = null;
        const parsedWpqrId = wpqr_id != null && wpqr_id !== '' ? parseInt(wpqr_id, 10) : null;
        if (Number.isSafeInteger(parsedWpqrId) && parsedWpqrId > 0) {
            try {
                wpqr_link = await insertLink({
                    organizationId: organization_id,
                    companyId: company_id ? parseInt(company_id, 10) : null,
                    wpsId: newId,
                    wpqrId: parsedWpqrId,
                    role: WPS_WPQR_ROLES.PRIMARY,
                    userId: user_id,
                });
            } catch (linkErr) {
                logger.error('WPS created but WPQR link failed', {
                    id: newId, wpqr_id: parsedWpqrId, error: linkErr.message,
                });
                wpqr_link = { created: false, available: false, error: linkErr.message };
            }
        }

        logger.info('WPS created', { id: newId, organization_id, wps_code, wpqr_id: parsedWpqrId || null });

        res.status(201).json({
            success: true,
            data: { id: newId, wps_code, status, wpqr_id: parsedWpqrId || null, wpqr_link },
        });
    } catch (error) {
        logger.error('Error creating WPS', { error: error.message });
        res.status(500).json({ error: 'Errore durante la creazione della WPS', code: 'WPS_CREATE_ERROR' });
    }
}

//  PUT /api/v1/welding/wps/:id ?
async function updateWPS(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const existing = await query(`
            SELECT id, company_id, wps_code, status, notes, deleted_at FROM welding_procedures
            WHERE id = @id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS non trovata', code: 'WPS_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, existing.recordset[0].company_id, 'write')) return;
        if (req.body.company_id !== undefined
            && await denyOutsideCompany(res, req.user, req.body.company_id, 'write')) return;

        const isoPresent = await presentIso15609WpsColumns();
        let sketchCols = [];
        try {
            const { presentWpsSketchColumns } = require('../services/weldSketches.service');
            const sketchPresent = await presentWpsSketchColumns();
            sketchCols = ['joint_sketch_id', 'sequence_sketch_id'].filter((f) => sketchPresent.has(f));
        } catch (_) { sketchCols = []; }
        const allowed = [
            'company_id', 'wps_code', 'revision', 'welding_process',
            'material_group', 'filler_material', 'shielding_gas', 'joint_type',
            'position', 'welding_positions', 'thickness_range_min', 'thickness_range_max',
            'pipe_diameter_min', 'preheat_temp', 'interpass_temp', 'pwht',
            'qualification_standard', 'status', 'notes',
            ...ISO15609_WPS_FIELDS.filter((f) => isoPresent.has(f)),
            ...sketchCols,
        ];

        const updates = [];
        const params  = { id: parseInt(id) };

        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = @${field}`);
                if (field === 'company_id') {
                    params[field] = req.body[field] !== null ? parseInt(req.body[field]) : null;
                } else if ([
                    'thickness_range_min', 'thickness_range_max', 'pipe_diameter_min',
                    ...ISO15609_WPS_NUMERIC,
                ].includes(field)) {
                    params[field] = req.body[field] != null && req.body[field] !== ''
                        ? parseFloat(req.body[field])
                        : null;
                } else {
                    params[field] = req.body[field] || null;
                }
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'VALIDATION_ERROR' });
        }

        updates.push('updated_at = GETDATE()');

        await query(`
            UPDATE welding_procedures
            SET ${updates.join(', ')}
            WHERE id = @id
        `, params);

        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'welding_procedures',
            entityId: parseInt(id),
            actionType: 'updated',
            actorUserId: req.user.user_id,
            before: existing.recordset[0],
            after: req.body,
            fields: allowed,
        });
        logger.info('WPS updated', { id, organization_id });
        res.json({ success: true, message: 'WPS aggiornata con successo' });
    } catch (error) {
        logger.error('Error updating WPS', { error: error.message });
        res.status(500).json({ error: 'Errore durante l\'aggiornamento della WPS', code: 'WPS_UPDATE_ERROR' });
    }
}

//  DELETE /api/v1/welding/wps/:id ?
async function deleteWPS(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const existing = await query(`
            SELECT id, company_id FROM welding_procedures
            WHERE id = @id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS non trovata', code: 'WPS_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, existing.recordset[0].company_id, 'write')) return;

        // FK 173/174 senza ON DELETE: passate e link prima delle WPQR e della WPS (tabelle assenti = saltate).
        const wpsId = parseInt(id);
        const childWpqr = await query(`
            SELECT id FROM wpqr_records
            WHERE wps_id = @id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { id: wpsId, organization_id });
        await wpqrTestRuns.deleteWpqrDependents({
            organizationId: organization_id,
            wpqrIds: childWpqr.recordset.map((r) => r.id),
            actorUserId: req.user.user_id,
        });
        await wpqrTestRuns.deleteWpsLinks({
            organizationId: organization_id,
            wpsId,
            actorUserId: req.user.user_id,
        });

        await query(softDeleteSql('wpqr_records', 'id').replace('id = @id', 'wps_id = @id'), {
            id: wpsId,
            organization_id,
            actor_user_id: req.user.user_id,
        });
        await query(`
            UPDATE wps_welders
            SET deleted_at = SYSUTCDATETIME(), deleted_by = @actor_user_id
            WHERE wps_id = @id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { id: wpsId, organization_id, actor_user_id: req.user.user_id });
        await query(softDeleteSql('welding_procedures', 'id'), {
            id: wpsId,
            organization_id,
            actor_user_id: req.user.user_id,
        });
        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'welding_procedures',
            entityId: wpsId,
            actionType: 'soft_deleted',
            actorUserId: req.user.user_id,
            before: { company_id: existing.recordset[0].company_id, deleted_at: null },
            after: { deleted_at: 'cestino' },
        });

        logger.info('WPS deleted', { id, organization_id });
        res.json({ success: true, message: 'WPS eliminata con successo' });
    } catch (error) {
        logger.error('Error deleting WPS', { error: error.message });
        res.status(500).json({ error: 'Errore durante l\'eliminazione della WPS', code: 'WPS_DELETE_ERROR' });
    }
}

// ?
// WPQR ? Welding Procedure Qualification Records
// ?

//  GET /api/v1/welding/wpqr ?
async function listWPQR(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            wps_id, company_id, approval_status, search,
            page = 1, limit = 50,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const conditions = [
            'wq.organization_id = @organization_id',
            'wq.deleted_at IS NULL',
            '(wq.wps_id IS NULL OR w.deleted_at IS NULL)',
        ];
        const params = { organization_id, limit: parseInt(limit), offset };

        if (company_id != null && company_id !== '') {
            if (await denyOutsideCompany(res, req.user, company_id, 'read')) return;
        }
        await pushWpqrCompanyScope(req.user, conditions, params, 'wpqrco');

        if (wps_id) {
            conditions.push('wq.wps_id = @wps_id');
            params.wps_id = parseInt(wps_id);
        }
        if (company_id) {
            conditions.push('(wq.company_id = @company_id OR (wq.company_id IS NULL AND w.company_id = @company_id))');
            params.company_id = parseInt(company_id);
        }
        if (approval_status) {
            conditions.push('wq.approval_status = @approval_status');
            params.approval_status = approval_status;
        }
        if (search) {
            conditions.push('(wq.wpqr_code LIKE @search OR wq.reference_number LIKE @search OR wq.testing_body LIKE @search OR wq.examiner_body LIKE @search OR wq.welder_name LIKE @search)');
            params.search = `%${search}%`;
        }

        const where = conditions.join(' AND ');

        const result = await query(`
            SELECT
                wq.*,
                w.wps_code AS wps_code,
                w.welding_process AS wps_welding_process,
                c.name AS company_name
            FROM wpqr_records wq
            LEFT JOIN welding_procedures w ON wq.wps_id = w.id
            LEFT JOIN companies c ON c.id = COALESCE(wq.company_id, w.company_id)
            WHERE ${where}
            ORDER BY wq.updated_at DESC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `, params);

        const countResult = await query(`
            SELECT COUNT(*) AS total
            FROM wpqr_records wq
            LEFT JOIN welding_procedures w ON wq.wps_id = w.id
            WHERE ${where}
        `, params);

        const total = countResult.recordset[0].total;

        res.json({
            success: true,
            data: result.recordset,
            pagination: {
                page:       parseInt(page),
                limit:      parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        logger.error('Error listing WPQR', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero dei WPQR', code: 'WPQR_LIST_ERROR' });
    }
}

//  GET /api/v1/welding/wpqr/:id ??
async function getWPQR(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
            SELECT wq.*, w.wps_code, w.welding_process AS wps_welding_process,
                   w.company_id AS wps_company_id
            FROM wpqr_records wq
            LEFT JOIN welding_procedures w ON wq.wps_id = w.id
            WHERE wq.id = @id AND wq.organization_id = @organization_id
              AND (wq.wps_id IS NULL OR w.deleted_at IS NULL)
        `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }
        if (trashedDetailHidden(req.user, result.recordset[0])) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, wpqrScopeCompany(result.recordset[0]), 'read')) return;

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error getting WPQR', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero del WPQR', code: 'WPQR_GET_ERROR' });
    }
}

//  POST /api/v1/welding/wpqr 
async function createWPQR(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const {
            wps_id, wpqr_code, test_date, testing_body, examiner_body, welder_name,
            welding_process, base_material_group, welding_positions, filler_material,
            thickness_tested, thickness_min, thickness_max, diameter_min, diameter_max,
            vt_result, rt_result, ut_result, mt_result, pt_result,
            tensile_result, bend_result, impact_result, hardness_result,
            macro_result, issue_date, certificate_number, notes,
            // Copertura pag.1 + parametri prova pag.2 (DEPUTYTASK1 25/07/2026)
            qualification_level, joint_type, standard_reference, wps_ref,
            base_material_spec, shielding_gas, current_type, metal_transfer,
            mechanization, single_multi_run, heat_input_note, pwht,
            // Estensioni ISO 15614-1 aggiunte via ingest (08/08/2026) — prima
            // creabili SOLO dall'AI, mai da form manuale (gap segnalato dal
            // committente, GAP_WPQR_ESTENSIONI_ANNEX_B).
            thickness_max_unlimited, preheat_temp, interpass_temp, throat_test_mm,
            product_type, rotated_position,
            thickness_t1_min, thickness_t1_max, thickness_t1_max_unlimited,
            thickness_t2_min, thickness_t2_max, thickness_t2_max_unlimited,
            qualifying_element, base_material_group_2, base_material_spec_2,
        } = req.body;

        if (!wps_id) {
            return res.status(400).json({ error: 'wps_id obbligatorio', code: 'VALIDATION_ERROR' });
        }

        const wpsExists = await query(`
            SELECT id, company_id FROM welding_procedures
            WHERE id = @wps_id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { wps_id: parseInt(wps_id), organization_id });

        if (wpsExists.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS di riferimento non trovata', code: 'WPS_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, wpsExists.recordset[0].company_id, 'write')) return;

        const toNum = (v) => (v !== undefined && v !== null && v !== '') ? parseFloat(v) : null;
        const toBit = (v) => (v === true || v === 1 || v === '1') ? 1 : 0;

        const result = await query(`
            INSERT INTO wpqr_records (
                organization_id, wps_id, wpqr_code, test_date, testing_body, examiner_body,
                welder_name, welding_process, base_material_group, welding_positions, filler_material,
                thickness_tested, thickness_min, thickness_max, diameter_min, diameter_max,
                vt_result, rt_result, ut_result, mt_result, pt_result,
                tensile_result, bend_result, impact_result, hardness_result,
                macro_result, issue_date, certificate_number, notes,
                qualification_level, joint_type, standard_reference, wps_ref,
                base_material_spec, shielding_gas, current_type, metal_transfer,
                mechanization, single_multi_run, heat_input_note, pwht,
                thickness_max_unlimited, preheat_temp, interpass_temp, throat_test_mm,
                product_type, rotated_position,
                thickness_t1_min, thickness_t1_max, thickness_t1_max_unlimited,
                thickness_t2_min, thickness_t2_max, thickness_t2_max_unlimited,
                qualifying_element, base_material_group_2, base_material_spec_2,
                approval_status, status,
                created_by, created_at, updated_at
            )
            OUTPUT INSERTED.id
            VALUES (
                @organization_id, @wps_id, @wpqr_code, @test_date, @testing_body, @examiner_body,
                @welder_name, @welding_process, @base_material_group, @welding_positions, @filler_material,
                @thickness_tested, @thickness_min, @thickness_max, @diameter_min, @diameter_max,
                @vt_result, @rt_result, @ut_result, @mt_result, @pt_result,
                @tensile_result, @bend_result, @impact_result, @hardness_result,
                @macro_result, @issue_date, @certificate_number, @notes,
                @qualification_level, @joint_type, @standard_reference, @wps_ref,
                @base_material_spec, @shielding_gas, @current_type, @metal_transfer,
                @mechanization, @single_multi_run, @heat_input_note, @pwht,
                @thickness_max_unlimited, @preheat_temp, @interpass_temp, @throat_test_mm,
                @product_type, @rotated_position,
                @thickness_t1_min, @thickness_t1_max, @thickness_t1_max_unlimited,
                @thickness_t2_min, @thickness_t2_max, @thickness_t2_max_unlimited,
                @qualifying_element, @base_material_group_2, @base_material_spec_2,
                'bozza', 'attiva',
                @created_by, GETDATE(), GETDATE()
            )
        `, {
            organization_id,
            wps_id:             parseInt(wps_id),
            wpqr_code:          wpqr_code || null,
            test_date:          test_date || null,
            testing_body:       testing_body || null,
            examiner_body:      examiner_body || testing_body || null,
            welder_name:        welder_name || null,
            welding_process:    welding_process || null,
            base_material_group: base_material_group || null,
            welding_positions:  welding_positions || null,
            filler_material:    filler_material || null,
            thickness_tested:   toNum(thickness_tested),
            thickness_min:      toNum(thickness_min),
            thickness_max:      toNum(thickness_max),
            diameter_min:       toNum(diameter_min),
            diameter_max:       toNum(diameter_max),
            vt_result:          vt_result || null,
            rt_result:          rt_result || null,
            ut_result:          ut_result || null,
            mt_result:          mt_result || null,
            pt_result:          pt_result || null,
            tensile_result:     tensile_result || null,
            bend_result:        bend_result || null,
            impact_result:      impact_result || null,
            hardness_result:    hardness_result || null,
            macro_result:       macro_result || null,
            issue_date:         issue_date || null,
            certificate_number: certificate_number || null,
            notes:              notes || null,
            qualification_level: qualification_level || null,
            joint_type:          joint_type || null,
            standard_reference:  standard_reference || null,
            wps_ref:             wps_ref || null,
            base_material_spec:  base_material_spec || null,
            shielding_gas:       shielding_gas || null,
            current_type:        current_type || null,
            metal_transfer:      metal_transfer || null,
            mechanization:       mechanization || null,
            single_multi_run:    single_multi_run || null,
            heat_input_note:     heat_input_note || null,
            pwht:                toBit(pwht),
            thickness_max_unlimited: toBit(thickness_max_unlimited),
            preheat_temp:        preheat_temp || null,
            interpass_temp:      interpass_temp || null,
            throat_test_mm:      toNum(throat_test_mm),
            product_type:        product_type || null,
            rotated_position:    toBit(rotated_position),
            thickness_t1_min:    toNum(thickness_t1_min),
            thickness_t1_max:    toNum(thickness_t1_max),
            thickness_t1_max_unlimited: toBit(thickness_t1_max_unlimited),
            thickness_t2_min:    toNum(thickness_t2_min),
            thickness_t2_max:    toNum(thickness_t2_max),
            thickness_t2_max_unlimited: toBit(thickness_t2_max_unlimited),
            qualifying_element:  qualifying_element || null,
            base_material_group_2: base_material_group_2 || null,
            base_material_spec_2:  base_material_spec_2 || null,
            created_by:         user_id,
        });

        const newId = result.recordset[0].id;
        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'wpqr_records',
            entityId: newId,
            actionType: 'created',
            actorUserId: user_id,
            after: { wpqr_code, wps_id: parseInt(wps_id), certificate_number, welder_name },
            fields: ['wpqr_code', 'wps_id', 'certificate_number', 'welder_name'],
        });
        logger.info('WPQR created', { id: newId, organization_id, wps_id });

        res.status(201).json({ success: true, data: { id: newId, wpqr_code, wps_id: parseInt(wps_id) } });
    } catch (error) {
        logger.error('Error creating WPQR', { error: error.message });
        res.status(500).json({ error: 'Errore durante la creazione del WPQR', code: 'WPQR_CREATE_ERROR' });
    }
}

//  PUT /api/v1/welding/wpqr/:id ??
async function updateWPQR(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const existing = await query(WPQR_SCOPE_SQL, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, wpqrScopeCompany(existing.recordset[0]), 'write')) return;

        let nextWpsId = null;
        if (req.body.wps_id !== undefined && req.body.wps_id !== null && req.body.wps_id !== '') {
            nextWpsId = strictPositiveInt(req.body.wps_id);
            if (nextWpsId == null) {
                return res.status(400).json({ error: 'wps_id non valido', code: 'VALIDATION_ERROR' });
            }
            const nextWps = await query(`
                SELECT id, company_id FROM welding_procedures
                WHERE id = @wps_id AND organization_id = @organization_id AND deleted_at IS NULL
            `, { wps_id: nextWpsId, organization_id });
            if (nextWps.recordset.length === 0) {
                return res.status(404).json({ error: 'WPS di riferimento non trovata', code: 'WPS_NOT_FOUND' });
            }
            if (await denyOutsideCompany(res, req.user, nextWps.recordset[0].company_id, 'write')) return;
        }

        const allowed = WPQR_MANUAL_EDITABLE_FIELDS;

        const updates = [];
        const params  = { id: parseInt(id) };

        const numericFields = new Set([
            'thickness_tested', 'thickness_min', 'thickness_max', 'diameter_min', 'diameter_max',
            'throat_test_mm',
            'thickness_t1_min', 'thickness_t1_max', 'thickness_t2_min', 'thickness_t2_max',
        ]);
        const booleanFields = new Set([
            'pwht', 'thickness_max_unlimited', 'rotated_position',
            'thickness_t1_max_unlimited', 'thickness_t2_max_unlimited',
        ]);
        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = @${field}`);
                const v = req.body[field];
                if (field === 'wps_id') {
                    params[field] = (v !== null && v !== '') ? nextWpsId : null;
                } else if (numericFields.has(field)) {
                    params[field] = (v !== null && v !== '') ? parseFloat(v) : null;
                } else if (booleanFields.has(field)) {
                    params[field] = (v === true || v === 1 || v === '1') ? 1 : 0;
                } else {
                    params[field] = v || null;
                }
            }
        }

        // Mirroring testing_body -> examiner_body (stesso concetto — "Examiner or
        // examining body" nel modulo WPQR ufficiale — gap segnalato dal committente
        // 08/08/2026: la UI espone solo "Ente certificatore" (testing_body), senza
        // questo passaggio examiner_body resterebbe congelato al valore impostato
        // dall'ingest AI anche dopo una correzione manuale del solo testing_body).
        if (req.body.testing_body !== undefined && req.body.examiner_body === undefined) {
            updates.push('examiner_body = @examiner_body');
            params.examiner_body = req.body.testing_body || null;
        }

        // Condizioni di prova di testata (migrazione 173): validate prima di qualunque scrittura.
        const header = wpqrTestRuns.normalizeTestHeader(req.body);
        if (header.errors.length > 0) {
            return res.status(400).json({ error: 'Condizioni di prova non valide', code: 'VALIDATION_ERROR', details: header.errors });
        }
        const headerFields = Object.keys(header.fields);
        if (headerFields.length > 0) {
            if (!(await wpqrTestRuns.testHeaderColumnsAvailable())) {
                return res.status(503).json({
                    error: 'Condizioni di prova non ancora disponibili: migrazione database non applicata.',
                    code: 'WPQR_TEST_DATA_UNAVAILABLE',
                });
            }
            for (const field of headerFields) {
                updates.push(`${field} = @${field}`);
                params[field] = header.fields[field];
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'VALIDATION_ERROR' });
        }

        updates.push('updated_at = GETDATE()');
        params.organization_id = organization_id;

        await query(`
            UPDATE wpqr_records
            SET ${updates.join(', ')}
            WHERE id = @id AND organization_id = @organization_id
        `, params);

        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'wpqr_records',
            entityId: parseInt(id),
            actionType: 'updated',
            actorUserId: req.user.user_id,
            before: existing.recordset[0],
            after: req.body,
            fields: allowed,
        });
        logger.info('WPQR updated', { id, organization_id });
        res.json({ success: true, message: 'WPQR aggiornato con successo' });
    } catch (error) {
        logger.error('Error updating WPQR', { error: error.message });
        res.status(500).json({ error: 'Errore durante l\'aggiornamento del WPQR', code: 'WPQR_UPDATE_ERROR' });
    }
}

//  DELETE /api/v1/welding/wpqr/:id 
async function deleteWPQR(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const existing = await query(WPQR_SCOPE_SQL, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, wpqrScopeCompany(existing.recordset[0]), 'write')) return;

        await wpqrTestRuns.deleteWpqrDependents({
            organizationId: organization_id,
            wpqrIds: [parseInt(id)],
            actorUserId: req.user.user_id,
        });

        await query(softDeleteSql('wpqr_records', 'id'), {
            id: parseInt(id),
            organization_id,
            actor_user_id: req.user.user_id,
        });
        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'wpqr_records',
            entityId: parseInt(id),
            actionType: 'soft_deleted',
            actorUserId: req.user.user_id,
            before: { deleted_at: null },
            after: { deleted_at: 'cestino' },
        });

        logger.info('WPQR deleted', { id, organization_id });
        res.json({ success: true, message: 'WPQR eliminato con successo' });
    } catch (error) {
        logger.error('Error deleting WPQR', { error: error.message });
        res.status(500).json({ error: 'Errore durante l\'eliminazione del WPQR', code: 'WPQR_DELETE_ERROR' });
    }
}

function sendTestRunsError(res, error, logMessage, fallbackCode, fallbackText) {
    if (error instanceof wpqrTestRuns.TestRunsError) {
        const body = { error: error.message, code: error.code };
        if (error.details) body.details = error.details;
        return res.status(error.status).json(body);
    }
    logger.error(logMessage, { error: error.message });
    return res.status(500).json({ error: fallbackText, code: fallbackCode });
}

async function listWpqrTestRuns(req, res) {
    try {
        const wpqrId = wpqrTestRuns.parseId(req.params.id);
        if (!wpqrId) return res.status(400).json({ error: 'ID WPQR non valido', code: 'VALIDATION_ERROR' });
        const { runs, available } = await wpqrTestRuns.listTestRuns({
            wpqrId,
            organizationId: req.user.organization_id,
            user: req.user,
        });
        res.json({ success: true, runs, available });
    } catch (error) {
        sendTestRunsError(res, error, 'Error listing WPQR test runs', 'WPQR_TEST_RUNS_LIST_ERROR',
            'Errore durante il recupero delle passate');
    }
}

// PUT /api/v1/welding/wpqr/:id/test-runs  (replace-set)
async function saveWpqrTestRuns(req, res) {
    try {
        const wpqrId = wpqrTestRuns.parseId(req.params.id);
        if (!wpqrId) return res.status(400).json({ error: 'ID WPQR non valido', code: 'VALIDATION_ERROR' });
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const { runs, available } = await wpqrTestRuns.replaceTestRuns({
            wpqrId,
            organizationId: req.user.organization_id,
            user: req.user,
            runs: body.runs,
        });
        res.json({ success: true, runs, available });
    } catch (error) {
        sendTestRunsError(res, error, 'Error saving WPQR test runs', 'WPQR_TEST_RUNS_SAVE_ERROR',
            'Errore durante il salvataggio delle passate');
    }
}

// ===============================================================================
// WPS Welders ? Assegnazione saldatori a WPS
// ===============================================================================

// GET /api/v1/welding/wps/:id/welders
async function listWpsWelders(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const wpsCheck = await query(`
            SELECT id, company_id FROM welding_procedures
            WHERE id = @id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { id: parseInt(id), organization_id });

        if (wpsCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS non trovata', code: 'WPS_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, wpsCheck.recordset[0].company_id, 'read')) return;

        const result = await query(`
            SELECT
                ww.id, ww.wps_id, ww.qualification_id, ww.assigned_date, ww.notes, ww.created_at,
                q.person_name, q.qualification_type, q.certificate_number,
                q.expiry_date, q.status AS qualification_status,
                q.welding_process, q.position_range
            FROM wps_welders ww
            JOIN qualifications q ON ww.qualification_id = q.id
            WHERE ww.wps_id = @id AND ww.organization_id = @organization_id
              AND ww.deleted_at IS NULL AND q.deleted_at IS NULL
            ORDER BY q.person_name
        `, { id: parseInt(id), organization_id });

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('Error listing WPS welders', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero dei saldatori WPS', code: 'WPS_WELDERS_LIST_ERROR' });
    }
}

// POST /api/v1/welding/wps/:id/welders
async function assignWpsWelder(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        const { qualification_id, assigned_date, notes } = req.body;

        if (!qualification_id) {
            return res.status(400).json({ error: 'qualification_id obbligatorio', code: 'VALIDATION_ERROR' });
        }

        // Verifica WPS appartenga alla stessa org
        const wpsCheck = await query(`
            SELECT id, company_id FROM welding_procedures
            WHERE id = @id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { id: parseInt(id), organization_id });

        if (wpsCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS non trovata', code: 'WPS_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, wpsCheck.recordset[0].company_id, 'write')) return;

        // Verifica qualifica appartenga alla stessa org
        const qualCheck = await query(`
            SELECT id, company_id FROM qualifications
            WHERE id = @qualification_id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { qualification_id: parseInt(qualification_id), organization_id });

        if (qualCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Qualifica non trovata', code: 'QUALIFICATION_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, qualCheck.recordset[0].company_id, 'write')) return;

        // Verifica duplicato
        const dupCheck = await query(`
            SELECT id FROM wps_welders
            WHERE wps_id = @wps_id AND qualification_id = @qualification_id AND organization_id = @organization_id
              AND deleted_at IS NULL
        `, { wps_id: parseInt(id), qualification_id: parseInt(qualification_id), organization_id });

        if (dupCheck.recordset.length > 0) {
            return res.status(409).json({ error: 'Saldatore già assegnato a questa WPS', code: 'DUPLICATE_ASSIGNMENT' });
        }

        const result = await query(`
            INSERT INTO wps_welders (wps_id, qualification_id, assigned_date, notes, organization_id, created_at)
            OUTPUT INSERTED.id
            VALUES (@wps_id, @qualification_id, @assigned_date, @notes, @organization_id, GETDATE())
        `, {
            wps_id:           parseInt(id),
            qualification_id: parseInt(qualification_id),
            assigned_date:    assigned_date || null,
            notes:            notes || null,
            organization_id,
        });

        const newId = result.recordset[0].id;
        logger.info('WPS welder assigned', { id: newId, wps_id: id, qualification_id, organization_id });

        res.status(201).json({ success: true, data: { id: newId } });
    } catch (error) {
        logger.error('Error assigning WPS welder', { error: error.message });
        res.status(500).json({ error: 'Errore durante l\'assegnazione del saldatore', code: 'WPS_WELDER_ASSIGN_ERROR' });
    }
}

// DELETE /api/v1/welding/wps/:id/welders/:welderId
async function removeWpsWelder(req, res) {
    try {
        const { id, welderId } = req.params;
        const { organization_id } = req.user;

        const existing = await query(`
            SELECT ww.id, w.company_id
            FROM wps_welders ww
            JOIN welding_procedures w ON w.id = ww.wps_id AND w.organization_id = ww.organization_id
            WHERE ww.id = @welderId AND ww.wps_id = @wps_id AND ww.organization_id = @organization_id
              AND ww.deleted_at IS NULL
        `, { welderId: parseInt(welderId), wps_id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Assegnazione non trovata', code: 'ASSIGNMENT_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, existing.recordset[0].company_id, 'write')) return;

        await query(`
            UPDATE wps_welders
            SET deleted_at = SYSUTCDATETIME(), deleted_by = @actor_user_id
            WHERE id = @welderId AND organization_id = @organization_id AND deleted_at IS NULL
        `, { welderId: parseInt(welderId), organization_id, actor_user_id: req.user.user_id });
        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'wps_welders',
            entityId: parseInt(welderId),
            actionType: 'soft_deleted',
            actorUserId: req.user.user_id,
            before: { deleted_at: null },
            after: { deleted_at: 'cestino' },
        });

        logger.info('WPS welder removed', { welderId, wps_id: id, organization_id });
        res.json({ success: true, message: 'Assegnazione rimossa con successo' });
    } catch (error) {
        logger.error('Error removing WPS welder', { error: error.message });
        res.status(500).json({ error: 'Errore durante la rimozione del saldatore', code: 'WPS_WELDER_REMOVE_ERROR' });
    }
}

// ===============================================================================
// WPQR — Stats per approval_status (nessuna scadenza calendario: ISO 15614/15613/14555)
// ===============================================================================

// GET /api/v1/welding/wpqr/stats
async function getWPQRStats(req, res) {
    try {
        const { organization_id } = req.user;
        const { company_id } = req.query;

        const params = { organization_id };
        const conditions = [
            'wq.organization_id = @organization_id',
            'wq.deleted_at IS NULL',
            '(wq.wps_id IS NULL OR w.deleted_at IS NULL)',
        ];
        if (company_id != null && company_id !== '') {
            if (await denyOutsideCompany(res, req.user, company_id, 'read')) return;
        }
        await pushWpqrCompanyScope(req.user, conditions, params, 'wpqrstat');
        let companyClause = conditions.length > 1
            ? ` AND ${conditions.slice(1).join(' AND ')}`
            : '';
        if (company_id) {
            companyClause += ' AND (wq.company_id = @company_id OR (wq.company_id IS NULL AND w.company_id = @company_id))';
            params.company_id = parseInt(company_id);
        }

        const result = await query(`
            SELECT
                COUNT(*) AS totale,
                SUM(CASE WHEN wq.approval_status = 'bozza'      THEN 1 ELSE 0 END) AS da_approvare,
                SUM(CASE WHEN wq.approval_status = 'rifiutata'  THEN 1 ELSE 0 END) AS rifiutate,
                SUM(CASE WHEN wq.approval_status = 'approvata'  THEN 1 ELSE 0 END) AS approvate
            FROM wpqr_records wq
            LEFT JOIN welding_procedures w ON wq.wps_id = w.id
            WHERE wq.organization_id = @organization_id
              AND wq.deleted_at IS NULL
              AND (wq.wps_id IS NULL OR w.deleted_at IS NULL)
              AND (wq.status IS NULL OR wq.status != 'revocata')
              ${companyClause}
        `, params);

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error getting WPQR stats', { error: error.message });
        res.status(500).json({ error: 'Errore stats WPQR', code: 'WPQR_STATS_ERROR' });
    }
}

// ===============================================================================
// WPQR ? Approval workflow
// ===============================================================================

// POST /api/v1/welding/wpqr/:id/approve
async function approveWPQR(req, res) {
    try {
        const { id } = req.params;
        const { organization_id, role } = req.user;

        const allowed = ['admin', 'superadmin', 'coordinatore'];
        if (!allowed.includes(role)) {
            return res.status(403).json({ error: 'Permesso insufficiente', code: 'FORBIDDEN' });
        }

        const existing = await query(WPQR_SCOPE_SQL, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, wpqrScopeCompany(existing.recordset[0]), 'write')) return;

        await query(`
            UPDATE wpqr_records
            SET approval_status = 'approvata', rejection_reason = NULL, updated_at = GETDATE()
            WHERE id = @id
        `, { id: parseInt(id) });

        logger.info('WPQR approved', { id, organization_id });
        res.json({ success: true, message: 'WPQR approvato' });
    } catch (error) {
        logger.error('Error approving WPQR', { error: error.message });
        res.status(500).json({ error: 'Errore approvazione WPQR', code: 'WPQR_APPROVE_ERROR' });
    }
}

// POST /api/v1/welding/wpqr/:id/reject
async function rejectWPQR(req, res) {
    try {
        const { id } = req.params;
        const { organization_id, role } = req.user;

        const allowed = ['admin', 'superadmin', 'coordinatore'];
        if (!allowed.includes(role)) {
            return res.status(403).json({ error: 'Permesso insufficiente', code: 'FORBIDDEN' });
        }

        const { reason } = req.body;

        const existing = await query(WPQR_SCOPE_SQL, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, wpqrScopeCompany(existing.recordset[0]), 'write')) return;

        await query(`
            UPDATE wpqr_records
            SET approval_status = 'rifiutata', rejection_reason = @reason, updated_at = GETDATE()
            WHERE id = @id
        `, { id: parseInt(id), reason: reason || null });

        logger.info('WPQR rejected', { id, organization_id });
        res.json({ success: true, message: 'WPQR rifiutato' });
    } catch (error) {
        logger.error('Error rejecting WPQR', { error: error.message });
        res.status(500).json({ error: 'Errore rifiuto WPQR', code: 'WPQR_REJECT_ERROR' });
    }
}

// ===============================================================================
// WPQR ? Batch PDF upload con AI extraction
// ===============================================================================

// POST /api/v1/welding/wpqr/upload-batch — estrazione + staging IG-3 (revisione pre-commit)
async function uploadWPQRBatch(req, res) {
    const fs = require('fs');
    try {
        const { organization_id, user_id } = req.user;
        const companyId = parseInt(req.body.company_id, 10);

        if (!companyId || Number.isNaN(companyId)) {
            return res.status(400).json({ error: 'company_id obbligatorio', code: 'VALIDATION_ERROR' });
        }
        if (await denyOutsideCompany(res, req.user, companyId, 'write')) return;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nessun file caricato', code: 'NO_FILES' });
        }

        const { extractWPQRFromPdf } = require('../services/wpqrIngest.service');
        const { createStagingRecord } = require('../services/ingestStaging.service');

        const results = [];
        for (const file of req.files) {
            let entry = { fileName: file.originalname, status: 'error', warnings: [] };
            try {
                const buffer = file.buffer || fs.readFileSync(file.path);
                const extracted = await extractWPQRFromPdf(
                    buffer,
                    file.originalname,
                    organization_id,
                    companyId,
                );

                if (extracted.status === 'wrong_module') {
                    try { if (file.path) fs.unlinkSync(file.path); } catch (_) {}
                    results.push({
                        fileName: file.originalname,
                        status: 'wrong_module',
                        ...extracted,
                    });
                    continue;
                }

                if (extracted.status === 'duplicate') {
                    try { if (file.path) fs.unlinkSync(file.path); } catch (_) {}
                    results.push({
                        fileName: file.originalname,
                        status: 'duplicate',
                        reference_number: extracted.reference_number,
                        warnings: extracted.warnings || [],
                    });
                    continue;
                }

                const stagingId = await createStagingRecord({
                    organizationId: organization_id,
                    companyId,
                    docType: 'wpqr',
                    originalName: file.originalname,
                    storagePath: file.path,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                    fields: extracted.fields,
                    fieldConfidence: extracted.field_confidence,
                    warnings: extracted.warnings,
                    userId: user_id,
                    aiModel: extracted.ai_model || null,
                });

                entry = {
                    fileName: file.originalname,
                    status: 'pending_review',
                    staging_id: stagingId,
                    fields: extracted.fields,
                    field_confidence: extracted.field_confidence,
                    confidence: extracted.confidence,
                    warnings: extracted.warnings || [],
                };
            } catch (err) {
                const errMsg = describeIngestFileError(err);
                logger.error('[WPQR/batch] Estrazione fallita', {
                    file: redactFileNameForLog(file.originalname),
                    error: errMsg,
                    stack: err?.stack || null,
                });
                entry = {
                    fileName: file.originalname,
                    status: 'error',
                    error: errMsg,
                    warnings: [errMsg],
                };
                try { if (file.path) fs.unlinkSync(file.path); } catch (_) {}
            }
            results.push(entry);
        }

        res.json({ success: true, results });
    } catch (error) {
        logger.error('Error uploading WPQR batch', { error: error.message });
        res.status(500).json({ error: 'Errore upload batch WPQR', code: 'WPQR_UPLOAD_ERROR' });
    }
}

// POST /api/v1/welding/wps/upload-batch — estrazione + staging IG-6
async function uploadWPSBatch(req, res) {
    const fs = require('fs');
    try {
        const { organization_id, user_id } = req.user;
        const companyId = parseInt(req.body.company_id, 10);

        if (!companyId || Number.isNaN(companyId)) {
            return res.status(400).json({ error: 'company_id obbligatorio', code: 'VALIDATION_ERROR' });
        }
        if (await denyOutsideCompany(res, req.user, companyId, 'write')) return;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nessun file caricato', code: 'NO_FILES' });
        }

        const { extractWPSFromPdf } = require('../services/wpsIngest.service');
        const { createStagingRecord } = require('../services/ingestStaging.service');

        const results = [];
        for (const file of req.files) {
            let entry = { fileName: file.originalname, status: 'error', warnings: [] };
            try {
                const buffer = file.buffer || fs.readFileSync(file.path);
                const extracted = await extractWPSFromPdf(
                    buffer,
                    file.originalname,
                    organization_id,
                    companyId,
                );

                if (extracted.status === 'wrong_module') {
                    try { if (file.path) fs.unlinkSync(file.path); } catch (_) {}
                    results.push({ fileName: file.originalname, status: 'wrong_module', ...extracted });
                    continue;
                }

                if (extracted.status === 'duplicate') {
                    try { if (file.path) fs.unlinkSync(file.path); } catch (_) {}
                    results.push({
                        fileName: file.originalname,
                        status: 'duplicate',
                        wps_code: extracted.wps_code,
                        warnings: extracted.warnings || [],
                    });
                    continue;
                }

                const stagingId = await createStagingRecord({
                    organizationId: organization_id,
                    companyId,
                    docType: 'wps',
                    originalName: file.originalname,
                    storagePath: file.path,
                    mimeType: file.mimetype,
                    fileSize: file.size,
                    fields: extracted.fields,
                    fieldConfidence: extracted.field_confidence,
                    warnings: extracted.warnings,
                    userId: user_id,
                    aiModel: extracted.ai_model || null,
                });

                entry = {
                    fileName: file.originalname,
                    status: 'pending_review',
                    staging_id: stagingId,
                    fields: extracted.fields,
                    field_confidence: extracted.field_confidence,
                    confidence: extracted.confidence,
                    warnings: extracted.warnings || [],
                };
            } catch (err) {
                const errMsg = describeIngestFileError(err);
                logger.error('[WPS/batch] Estrazione fallita', {
                    file: redactFileNameForLog(file.originalname),
                    error: errMsg,
                    stack: err?.stack || null,
                });
                entry = { fileName: file.originalname, status: 'error', error: errMsg, warnings: [errMsg] };
                try { if (file.path) fs.unlinkSync(file.path); } catch (_) {}
            }
            results.push(entry);
        }

        res.json({ success: true, results });
    } catch (error) {
        logger.error('Error uploading WPS batch', { error: error.message });
        res.status(500).json({ error: 'Errore upload batch WPS', code: 'WPS_UPLOAD_ERROR' });
    }
}

// ===============================================================================
// WPS ? Coverage check range-aware
// ===============================================================================

// GET /api/v1/welding/wps/coverage?project_id=X
async function getWpsCoverage(req, res) {
    try {
        const { organization_id } = req.user;
        const { project_id } = req.query;

        if (!project_id) {
            return res.status(400).json({ error: 'project_id richiesto', code: 'VALIDATION_ERROR' });
        }

        // Carica il progetto per ricavare company_id e WPS assegnate
        const projResult = await query(`
            SELECT id, project_code, company_id, applicable_wps_ids
            FROM projects
            WHERE id = @project_id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { project_id: parseInt(project_id), organization_id });

        if (projResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Commessa non trovata', code: 'PROJECT_NOT_FOUND' });
        }

        const project = projResult.recordset[0];
        if (await denyOutsideCompany(res, req.user, project.company_id, 'read')) return;
        const companyId = project.company_id;

        const wpsIds = normalizeApplicableWpsIds(project.applicable_wps_ids);

        // WPS attive+approvate per l'azienda della commessa
        const baseConditions = [
            'w.organization_id = @organization_id',
            'w.deleted_at IS NULL',
            "(w.approval_status = 'approvata' OR w.approval_status IS NULL)",
            "(w.status = 'attiva' OR w.status = 'bozza')",
        ];
        const params = { organization_id };

        if (companyId) {
            baseConditions.push('w.company_id = @company_id');
            params.company_id = parseInt(companyId);
        }

        // Se ci sono WPS specifiche assegnate, usa quelle; altrimenti tutte dell'azienda
        let wpsWhere = baseConditions.join(' AND ');
        if (wpsIds.length > 0) {
            wpsWhere += ` AND w.id IN (${wpsIds.join(',')})`;
        }

        const wpsResult = await query(`
            SELECT
                w.id, w.wps_code, w.revision, w.welding_process,
                w.material_group, w.base_material_group,
                w.thickness_range_min, w.thickness_range_max,
                w.pipe_diameter_min,
                w.position, w.welding_positions,
                w.approval_status, w.status,
                w.expiry_date, w.issue_date,
                c.name AS company_name,
                ${(await linksAvailable())
                    ? wpqrLinkedToWpsCountSql('w.id')
                    : `(SELECT COUNT(*) FROM wpqr_records wq
                 WHERE wq.wps_id = w.id AND wq.organization_id = @organization_id
                   AND wq.deleted_at IS NULL)`} AS wpqr_count
            FROM welding_procedures w
            LEFT JOIN companies c ON c.id = w.company_id
            WHERE ${wpsWhere}
            ORDER BY w.wps_code
        `, params);

        const wpsRows = wpsResult.recordset;

        // Calcola semaforo per ogni WPS
        const now = new Date();
        const days30 = 30 * 24 * 60 * 60 * 1000;
        const days60 = 60 * 24 * 60 * 60 * 1000;

        const coverage = wpsRows.map(w => {
            let semaforo = 'verde';
            if (w.expiry_date) {
                const exp = new Date(w.expiry_date).getTime();
                const diff = exp - now.getTime();
                if (diff < 0) semaforo = 'rosso';
                else if (diff < days30) semaforo = 'rosso';
                else if (diff < days60) semaforo = 'arancione';
                else semaforo = 'verde';
            }
            const isApproved = !w.approval_status || w.approval_status === 'approvata';
            if (!isApproved) semaforo = 'grigio';

            return {
                wps_id:             w.id,
                wps_code:           w.wps_code,
                revision:           w.revision,
                welding_process:    w.welding_process,
                material_group:     w.base_material_group || w.material_group,
                thickness_min:      w.thickness_range_min,
                thickness_max:      w.thickness_range_max,
                pipe_diameter_min:  w.pipe_diameter_min,
                positions:          w.welding_positions || w.position,
                approval_status:    w.approval_status || 'attiva',
                status:             w.status,
                expiry_date:        w.expiry_date,
                company_name:       w.company_name,
                wpqr_count:         w.wpqr_count,
                semaforo,
            };
        });

        const covered   = coverage.filter(c => c.semaforo === 'verde' || c.semaforo === 'arancione').length;
        const uncovered = coverage.filter(c => c.semaforo === 'rosso').length;

        res.json({
            success:      true,
            project_id:   parseInt(project_id),
            project_code: project.project_code,
            company_id:   companyId,
            has_wps:      coverage.length > 0,
            coverage,
            summary: {
                total:     coverage.length,
                covered,
                uncovered,
                expiring:  coverage.filter(c => c.semaforo === 'arancione').length,
                expired:   coverage.filter(c => c.semaforo === 'rosso').length,
            },
        });
    } catch (error) {
        logger.error('Error getting WPS coverage', { error: error.message });
        res.status(500).json({ error: 'Errore coverage WPS', code: 'WPS_COVERAGE_ERROR' });
    }
}

function sendSketchError(res, error, fallbackCode, fallbackText) {
    if (error && error.status) {
        return res.status(error.status).json({ error: error.message, code: error.code || fallbackCode });
    }
    logger.error(fallbackText, { error: error && error.message });
    return res.status(500).json({ error: fallbackText, code: fallbackCode });
}

async function listWpqrSketches(req, res) {
    try {
        const wpqrId = parseInt(req.params.id, 10);
        if (!Number.isSafeInteger(wpqrId) || wpqrId <= 0) {
            return res.status(400).json({ error: 'ID WPQR non valido', code: 'VALIDATION_ERROR' });
        }
        const existing = await query(WPQR_SCOPE_SQL, { id: wpqrId, organization_id: req.user.organization_id });
        if (!existing.recordset.length) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, wpqrScopeCompany(existing.recordset[0]), 'read')) return;
        const { listSketches } = require('../services/weldSketches.service');
        const sketches = await listSketches({
            organizationId: req.user.organization_id,
            wpqrId,
        });
        res.json({ success: true, sketches });
    } catch (error) {
        sendSketchError(res, error, 'WPQR_SKETCHES_LIST_ERROR', 'Errore durante il recupero degli schizzi');
    }
}

async function listWeldSketches(req, res) {
    try {
        const companyId = req.query.company_id != null && req.query.company_id !== ''
            ? parseInt(req.query.company_id, 10)
            : null;
        if (companyId != null && await denyOutsideCompany(res, req.user, companyId, 'read')) return;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const allowedCompanyIds = hasCompanyAccessRows(accessList)
            ? getAllowedCompanyIds(accessList)
            : null;
        const { listSketches } = require('../services/weldSketches.service');
        const sketches = await listSketches({
            organizationId: req.user.organization_id,
            companyId,
            allowedCompanyIds,
            status: req.query.status || null,
            slot: req.query.slot || null,
        });
        res.json({ success: true, sketches });
    } catch (error) {
        sendSketchError(res, error, 'SKETCHES_LIST_ERROR', 'Errore durante il recupero della libreria schizzi');
    }
}

async function confirmWeldSketch(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID schizzo non valido', code: 'VALIDATION_ERROR' });
        }
        const { confirmSketch, getSketchById } = require('../services/weldSketches.service');
        const existing = await getSketchById({ id, organizationId: req.user.organization_id });
        if (!existing) {
            return res.status(404).json({ error: 'Schizzo non trovato', code: 'SKETCH_NOT_FOUND' });
        }
        if (await denySketchCompany(res, req.user, existing.company_id, 'write')) return;
        const sketch = await confirmSketch({
            id,
            organizationId: req.user.organization_id,
            user: req.user,
        });
        res.json({ success: true, sketch });
    } catch (error) {
        sendSketchError(res, error, 'SKETCH_CONFIRM_ERROR', 'Errore durante la conferma dello schizzo');
    }
}

async function getWeldSketchContent(req, res) {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID schizzo non valido', code: 'VALIDATION_ERROR' });
        }
        const { getSketchById, resolveSketchFile } = require('../services/weldSketches.service');
        const row = await getSketchById({ id, organizationId: req.user.organization_id });
        if (!row) return res.status(404).json({ error: 'Schizzo non trovato', code: 'SKETCH_NOT_FOUND' });
        if (await denySketchCompany(res, req.user, row.company_id, 'read')) return;
        const file = await resolveSketchFile(row);
        if (!file) return res.status(404).json({ error: 'File schizzo non trovato', code: 'SKETCH_FILE_NOT_FOUND' });
        const { contentTypeFor } = require('../utils/uploadsPath');
        const ct = contentTypeFor(file.relReal);
        const ext = ct.ext || '.png';
        res.setHeader('Content-Type', ct.type || 'image/png');
        res.setHeader('Content-Disposition', `inline; filename="sketch-${id}${ext}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        return res.sendFile(file.relReal, {
            root: file.realRoot,
            dotfiles: 'allow',
            etag: false,
            lastModified: false,
            cacheControl: false,
        }, (err) => {
            if (!err || res.headersSent) return;
            if (err.code === 'ENOENT' || err.status === 404) {
                return res.status(404).json({ error: 'File schizzo non trovato', code: 'SKETCH_FILE_NOT_FOUND' });
            }
            logger.error('[welding] lettura schizzo', { code: err.code });
            return res.status(500).json({ error: 'Errore lettura schizzo', code: 'SKETCH_READ_ERROR' });
        });
    } catch (error) {
        sendSketchError(res, error, 'SKETCH_CONTENT_ERROR', 'Errore durante la lettura dello schizzo');
    }
}

async function uploadWeldSketch(req, res) {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: 'File PNG o JPEG obbligatorio', code: 'VALIDATION_ERROR' });
        }
        const companyId = req.body.company_id != null && req.body.company_id !== ''
            ? parseInt(req.body.company_id, 10)
            : null;
        if (await denyOutsideCompany(res, req.user, companyId, 'write')) return;
        const { storeUploadedPng } = require('../services/weldSketches.service');
        const sketch = await storeUploadedPng({
            pngBuffer: req.file.buffer,
            organizationId: req.user.organization_id,
            companyId,
            userId: req.user.user_id,
            slot: req.body.slot || 'combined',
            wpqrId: req.body.wpqr_id ? parseInt(req.body.wpqr_id, 10) : null,
            meta: {
                joint_type: req.body.joint_type || null,
                preparation: req.body.preparation || null,
                product_form: req.body.product_form || null,
                dimension_text: req.body.dimension_text || null,
            },
        });
        res.status(201).json({ success: true, sketch });
    } catch (error) {
        sendSketchError(res, error, 'SKETCH_UPLOAD_ERROR', 'Errore durante il caricamento dello schizzo');
    }
}

module.exports = {
    listWPS,
    getWPS,
    generateWPS,
    createWPS,
    updateWPS,
    deleteWPS,
    listWPQR,
    getWPQR,
    createWPQR,
    updateWPQR,
    deleteWPQR,
    listWpqrTestRuns,
    saveWpqrTestRuns,
    listWpsWelders,
    assignWpsWelder,
    removeWpsWelder,
    // New
    getWPQRStats,
    approveWPQR,
    rejectWPQR,
    uploadWPQRBatch,
    uploadWPSBatch,
    getWpsCoverage,
    WPQR_MANUAL_EDITABLE_FIELDS,
    ISO15609_WPS_FIELDS,
    ISO15609_WPS_FIELDS_181,
    ISO15609_WPS_FIELDS_182,
    listWpqrSketches,
    listWeldSketches,
    confirmWeldSketch,
    getWeldSketchContent,
    uploadWeldSketch,
};
