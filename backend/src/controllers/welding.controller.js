/**
 * Welding Controller ? CRUD per WPS e WPQR
 * Modulo Saldatura ISO 3834
 *
 * Tenant-isolated: ogni query filtra per organization_id dal JWT.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { describeIngestFileError } = require('../utils/ingestErrorMessage');

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
        const conditions = ['w.organization_id = @organization_id'];
        const params = { organization_id, limit: parseInt(limit), offset };

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

        const result = await query(`
            SELECT
                w.*,
                c.name AS company_name,
                (SELECT COUNT(*) FROM wpqr_records wq
                 WHERE wq.wps_id = w.id AND wq.organization_id = @organization_id
                ) AS wpqr_count
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

        const wpqrResult = await query(`
            SELECT * FROM wpqr_records
            WHERE wps_id = @wps_id AND organization_id = @organization_id
            ORDER BY test_date DESC
        `, { wps_id: parseInt(id), organization_id });

        res.json({
            success: true,
            data: {
                ...result.recordset[0],
                wpqr_records: wpqrResult.recordset,
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
        } = req.body || {};

        // Validazione soft: campi incompleti → status need_input (domande), non 400.
        // Così l'assistente può chiedere i dati mancanti invece di ricevere errore HTTP.
        const tA = thickness_a_mm === '' || thickness_a_mm == null
            ? null
            : Number(thickness_a_mm);
        const tB = thickness_b_mm === '' || thickness_b_mm == null
            ? null
            : Number(thickness_b_mm);

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
            },
        });

        res.json({
            success: true,
            status: result.status,
            wpqr_used: result.wpqr_used,
            candidates: result.candidates,
            wps_draft: result.wps_draft,
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
            filler_material, shielding_gas, joint_type, position,
            thickness_range_min, thickness_range_max, pipe_diameter_min,
            preheat_temp, interpass_temp, pwht, qualification_standard,
            status = 'bozza', notes,
        } = req.body;

        if (!wps_code) {
            return res.status(400).json({ error: 'Codice WPS obbligatorio', code: 'VALIDATION_ERROR' });
        }

        const result = await query(`
            INSERT INTO welding_procedures (
                organization_id, company_id, wps_code, revision,
                welding_process, material_group, filler_material, shielding_gas,
                joint_type, position, thickness_range_min, thickness_range_max,
                pipe_diameter_min, preheat_temp, interpass_temp, pwht,
                qualification_standard, status, notes,
                created_by, created_at, updated_at
            )
            OUTPUT INSERTED.id
            VALUES (
                @organization_id, @company_id, @wps_code, @revision,
                @welding_process, @material_group, @filler_material, @shielding_gas,
                @joint_type, @position, @thickness_range_min, @thickness_range_max,
                @pipe_diameter_min, @preheat_temp, @interpass_temp, @pwht,
                @qualification_standard, @status, @notes,
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
            position:           position || null,
            thickness_range_min: thickness_range_min != null ? parseFloat(thickness_range_min) : null,
            thickness_range_max: thickness_range_max != null ? parseFloat(thickness_range_max) : null,
            pipe_diameter_min:  pipe_diameter_min != null ? parseFloat(pipe_diameter_min) : null,
            preheat_temp:       preheat_temp || null,
            interpass_temp:     interpass_temp || null,
            pwht:               pwht || null,
            qualification_standard: qualification_standard || null,
            status,
            notes:              notes || null,
            created_by:         user_id,
        });

        const newId = result.recordset[0].id;
        logger.info('WPS created', { id: newId, organization_id, wps_code });

        res.status(201).json({ success: true, data: { id: newId, wps_code, status } });
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
            SELECT id FROM welding_procedures
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS non trovata', code: 'WPS_NOT_FOUND' });
        }

        const allowed = [
            'company_id', 'wps_code', 'revision', 'welding_process',
            'material_group', 'filler_material', 'shielding_gas', 'joint_type',
            'position', 'thickness_range_min', 'thickness_range_max',
            'pipe_diameter_min', 'preheat_temp', 'interpass_temp', 'pwht',
            'qualification_standard', 'status', 'notes',
        ];

        const updates = [];
        const params  = { id: parseInt(id) };

        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = @${field}`);
                if (field === 'company_id') {
                    params[field] = req.body[field] !== null ? parseInt(req.body[field]) : null;
                } else if (['thickness_range_min', 'thickness_range_max', 'pipe_diameter_min'].includes(field)) {
                    params[field] = req.body[field] != null ? parseFloat(req.body[field]) : null;
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
            SELECT id FROM welding_procedures
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS non trovata', code: 'WPS_NOT_FOUND' });
        }

        await query(`
            DELETE FROM wpqr_records
            WHERE wps_id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        await query(`
            DELETE FROM welding_procedures
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

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
            wps_id, company_id, approval_status, expiring_days, search,
            page = 1, limit = 50,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const conditions = ['wq.organization_id = @organization_id'];
        const params = { organization_id, limit: parseInt(limit), offset };

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
        if (expiring_days) {
            conditions.push(`wq.expiry_date IS NOT NULL AND wq.expiry_date >= CAST(GETDATE() AS DATE) AND wq.expiry_date < DATEADD(day, @expiring_days, CAST(GETDATE() AS DATE))`);
            params.expiring_days = parseInt(expiring_days);
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
            SELECT wq.*, w.wps_code, w.welding_process AS wps_welding_process
            FROM wpqr_records wq
            LEFT JOIN welding_procedures w ON wq.wps_id = w.id
            WHERE wq.id = @id AND wq.organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }

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
            macro_result, issue_date, expiry_date, certificate_number, notes,
            // Copertura pag.1 + parametri prova pag.2 (DEPUTYTASK1 25/07/2026)
            qualification_level, joint_type, standard_reference, wps_ref,
            base_material_spec, shielding_gas, current_type, metal_transfer,
            mechanization, single_multi_run, heat_input_note, pwht,
        } = req.body;

        if (!wps_id) {
            return res.status(400).json({ error: 'wps_id obbligatorio', code: 'VALIDATION_ERROR' });
        }

        const wpsExists = await query(`
            SELECT id FROM welding_procedures
            WHERE id = @wps_id AND organization_id = @organization_id
        `, { wps_id: parseInt(wps_id), organization_id });

        if (wpsExists.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS di riferimento non trovata', code: 'WPS_NOT_FOUND' });
        }

        const toNum = (v) => (v !== undefined && v !== null && v !== '') ? parseFloat(v) : null;
        const toBit = (v) => (v === true || v === 1 || v === '1') ? 1 : 0;

        const result = await query(`
            INSERT INTO wpqr_records (
                organization_id, wps_id, wpqr_code, test_date, testing_body, examiner_body,
                welder_name, welding_process, base_material_group, welding_positions, filler_material,
                thickness_tested, thickness_min, thickness_max, diameter_min, diameter_max,
                vt_result, rt_result, ut_result, mt_result, pt_result,
                tensile_result, bend_result, impact_result, hardness_result,
                macro_result, issue_date, expiry_date, certificate_number, notes,
                qualification_level, joint_type, standard_reference, wps_ref,
                base_material_spec, shielding_gas, current_type, metal_transfer,
                mechanization, single_multi_run, heat_input_note, pwht,
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
                @macro_result, @issue_date, @expiry_date, @certificate_number, @notes,
                @qualification_level, @joint_type, @standard_reference, @wps_ref,
                @base_material_spec, @shielding_gas, @current_type, @metal_transfer,
                @mechanization, @single_multi_run, @heat_input_note, @pwht,
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
            expiry_date:        expiry_date || null,
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
            created_by:         user_id,
        });

        const newId = result.recordset[0].id;
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

        const existing = await query(`
            SELECT id FROM wpqr_records
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }

        const allowed = [
            'wps_id', 'wpqr_code', 'test_date', 'testing_body', 'examiner_body', 'welder_name',
            'welding_process', 'base_material_group', 'welding_positions', 'filler_material',
            'thickness_tested', 'thickness_min', 'thickness_max', 'diameter_min', 'diameter_max',
            'vt_result', 'rt_result', 'ut_result', 'mt_result', 'pt_result',
            'tensile_result', 'bend_result', 'impact_result', 'hardness_result',
            'macro_result', 'issue_date', 'expiry_date', 'certificate_number', 'notes',
            // Copertura pag.1 + parametri prova pag.2 (DEPUTYTASK1 25/07/2026)
            'qualification_level', 'joint_type', 'standard_reference', 'wps_ref',
            'base_material_spec', 'shielding_gas', 'current_type', 'metal_transfer',
            'mechanization', 'single_multi_run', 'heat_input_note', 'pwht',
        ];

        const updates = [];
        const params  = { id: parseInt(id) };

        const numericFields = new Set([
            'wps_id', 'thickness_tested', 'thickness_min', 'thickness_max', 'diameter_min', 'diameter_max',
        ]);
        const booleanFields = new Set(['pwht']);
        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = @${field}`);
                const v = req.body[field];
                if (numericFields.has(field)) {
                    params[field] = (v !== null && v !== '') ? parseFloat(v) : null;
                } else if (booleanFields.has(field)) {
                    params[field] = (v === true || v === 1 || v === '1') ? 1 : 0;
                } else {
                    params[field] = v || null;
                }
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'VALIDATION_ERROR' });
        }

        updates.push('updated_at = GETDATE()');

        await query(`
            UPDATE wpqr_records
            SET ${updates.join(', ')}
            WHERE id = @id
        `, params);

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

        const existing = await query(`
            SELECT id FROM wpqr_records
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }

        await query(`
            DELETE FROM wpqr_records
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        logger.info('WPQR deleted', { id, organization_id });
        res.json({ success: true, message: 'WPQR eliminato con successo' });
    } catch (error) {
        logger.error('Error deleting WPQR', { error: error.message });
        res.status(500).json({ error: 'Errore durante l\'eliminazione del WPQR', code: 'WPQR_DELETE_ERROR' });
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
            SELECT id FROM welding_procedures
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (wpsCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS non trovata', code: 'WPS_NOT_FOUND' });
        }

        const result = await query(`
            SELECT
                ww.id, ww.wps_id, ww.qualification_id, ww.assigned_date, ww.notes, ww.created_at,
                q.person_name, q.qualification_type, q.certificate_number,
                q.expiry_date, q.status AS qualification_status,
                q.welding_process, q.position_range
            FROM wps_welders ww
            JOIN qualifications q ON ww.qualification_id = q.id
            WHERE ww.wps_id = @id AND ww.organization_id = @organization_id
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
            SELECT id FROM welding_procedures
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (wpsCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'WPS non trovata', code: 'WPS_NOT_FOUND' });
        }

        // Verifica qualifica appartenga alla stessa org
        const qualCheck = await query(`
            SELECT id FROM qualifications
            WHERE id = @qualification_id AND organization_id = @organization_id
        `, { qualification_id: parseInt(qualification_id), organization_id });

        if (qualCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Qualifica non trovata', code: 'QUALIFICATION_NOT_FOUND' });
        }

        // Verifica duplicato
        const dupCheck = await query(`
            SELECT id FROM wps_welders
            WHERE wps_id = @wps_id AND qualification_id = @qualification_id AND organization_id = @organization_id
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
            SELECT id FROM wps_welders
            WHERE id = @welderId AND wps_id = @wps_id AND organization_id = @organization_id
        `, { welderId: parseInt(welderId), wps_id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Assegnazione non trovata', code: 'ASSIGNMENT_NOT_FOUND' });
        }

        await query(`
            DELETE FROM wps_welders
            WHERE id = @welderId AND organization_id = @organization_id
        `, { welderId: parseInt(welderId), organization_id });

        logger.info('WPS welder removed', { welderId, wps_id: id, organization_id });
        res.json({ success: true, message: 'Assegnazione rimossa con successo' });
    } catch (error) {
        logger.error('Error removing WPS welder', { error: error.message });
        res.status(500).json({ error: 'Errore durante la rimozione del saldatore', code: 'WPS_WELDER_REMOVE_ERROR' });
    }
}

// ===============================================================================
// WPQR ? Stats semaforo scadenze
// ===============================================================================

// GET /api/v1/welding/wpqr/stats
async function getWPQRStats(req, res) {
    try {
        const { organization_id } = req.user;
        const { company_id } = req.query;

        const params = { organization_id };
        let companyClause = '';
        if (company_id) {
            companyClause = ' AND (wq.company_id = @company_id OR (wq.company_id IS NULL AND w.company_id = @company_id))';
            params.company_id = parseInt(company_id);
        }

        const result = await query(`
            SELECT
                COUNT(*) AS totale,
                SUM(CASE WHEN wq.approval_status = 'bozza'      THEN 1 ELSE 0 END) AS da_approvare,
                SUM(CASE WHEN wq.approval_status = 'approvata'
                         AND (wq.expiry_date IS NULL OR wq.expiry_date >= DATEADD(day, 60, CAST(GETDATE() AS DATE)))
                         THEN 1 ELSE 0 END) AS valide,
                SUM(CASE WHEN wq.approval_status = 'approvata'
                         AND wq.expiry_date IS NOT NULL
                         AND wq.expiry_date >= CAST(GETDATE() AS DATE)
                         AND wq.expiry_date < DATEADD(day, 30, CAST(GETDATE() AS DATE))
                         THEN 1 ELSE 0 END) AS in_scadenza_30,
                SUM(CASE WHEN wq.approval_status = 'approvata'
                         AND wq.expiry_date IS NOT NULL
                         AND wq.expiry_date >= CAST(GETDATE() AS DATE)
                         AND wq.expiry_date >= DATEADD(day, 30, CAST(GETDATE() AS DATE))
                         AND wq.expiry_date < DATEADD(day, 60, CAST(GETDATE() AS DATE))
                         THEN 1 ELSE 0 END) AS in_scadenza_60,
                SUM(CASE WHEN wq.expiry_date IS NOT NULL
                         AND wq.expiry_date < CAST(GETDATE() AS DATE)
                         THEN 1 ELSE 0 END) AS scadute
            FROM wpqr_records wq
            LEFT JOIN welding_procedures w ON wq.wps_id = w.id
            WHERE wq.organization_id = @organization_id
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

        const existing = await query(`
            SELECT id FROM wpqr_records
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }

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

        const existing = await query(`
            SELECT id FROM wpqr_records
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'WPQR non trovato', code: 'WPQR_NOT_FOUND' });
        }

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
                    fileName: file.originalname,
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
                    fileName: file.originalname,
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
            WHERE id = @project_id AND organization_id = @organization_id
        `, { project_id: parseInt(project_id), organization_id });

        if (projResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Commessa non trovata', code: 'PROJECT_NOT_FOUND' });
        }

        const project = projResult.recordset[0];
        const companyId = project.company_id;

        let wpsIds = [];
        try { wpsIds = JSON.parse(project.applicable_wps_ids || '[]'); } catch (_) {}

        // WPS attive+approvate per l'azienda della commessa
        const baseConditions = [
            'w.organization_id = @organization_id',
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
            const ids = wpsIds.map(Number).filter(Boolean).join(',');
            wpsWhere += ` AND w.id IN (${ids})`;
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
                (SELECT COUNT(*) FROM wpqr_records wq
                 WHERE wq.wps_id = w.id AND wq.organization_id = @organization_id
                ) AS wpqr_count
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
};
