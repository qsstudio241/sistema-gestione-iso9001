/**
 * Welding Controller — CRUD per WPS e WPQR
 * Modulo Saldatura ISO 3834
 *
 * Tenant-isolated: ogni query filtra per organization_id dal JWT.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ???????????????????????????????????????????????????????????????????????????????
// WPS — Welding Procedure Specifications
// ???????????????????????????????????????????????????????????????????????????????

// ??? GET /api/v1/welding/wps ??????????????????????????????????????????????????
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

// ??? GET /api/v1/welding/wps/:id ?????????????????????????????????????????????
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

// ??? POST /api/v1/welding/wps ?????????????????????????????????????????????????
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

// ??? PUT /api/v1/welding/wps/:id ??????????????????????????????????????????????
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

// ??? DELETE /api/v1/welding/wps/:id ???????????????????????????????????????????
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

// ???????????????????????????????????????????????????????????????????????????????
// WPQR — Welding Procedure Qualification Records
// ???????????????????????????????????????????????????????????????????????????????

// ??? GET /api/v1/welding/wpqr ?????????????????????????????????????????????????
async function listWPQR(req, res) {
    try {
        const { organization_id } = req.user;
        const { wps_id, page = 1, limit = 50 } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const conditions = ['wq.organization_id = @organization_id'];
        const params = { organization_id, limit: parseInt(limit), offset };

        if (wps_id) {
            conditions.push('wq.wps_id = @wps_id');
            params.wps_id = parseInt(wps_id);
        }

        const where = conditions.join(' AND ');

        const result = await query(`
            SELECT
                wq.*,
                w.wps_code AS wps_code,
                w.welding_process AS wps_welding_process
            FROM wpqr_records wq
            LEFT JOIN welding_procedures w ON wq.wps_id = w.id
            WHERE ${where}
            ORDER BY wq.updated_at DESC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `, params);

        const countResult = await query(`
            SELECT COUNT(*) AS total
            FROM wpqr_records wq
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

// ??? GET /api/v1/welding/wpqr/:id ????????????????????????????????????????????
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

// ??? POST /api/v1/welding/wpqr ????????????????????????????????????????????????
async function createWPQR(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const {
            wps_id, wpqr_code, test_date, testing_body, welder_name,
            vt_result, rt_result, ut_result, mt_result, pt_result,
            tensile_result, bend_result, impact_result, hardness_result,
            macro_result, expiry_date, certificate_number, notes,
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

        const result = await query(`
            INSERT INTO wpqr_records (
                organization_id, wps_id, wpqr_code, test_date, testing_body,
                welder_name, vt_result, rt_result, ut_result, mt_result, pt_result,
                tensile_result, bend_result, impact_result, hardness_result,
                macro_result, expiry_date, certificate_number, notes,
                created_by, created_at, updated_at
            )
            OUTPUT INSERTED.id
            VALUES (
                @organization_id, @wps_id, @wpqr_code, @test_date, @testing_body,
                @welder_name, @vt_result, @rt_result, @ut_result, @mt_result, @pt_result,
                @tensile_result, @bend_result, @impact_result, @hardness_result,
                @macro_result, @expiry_date, @certificate_number, @notes,
                @created_by, GETDATE(), GETDATE()
            )
        `, {
            organization_id,
            wps_id:             parseInt(wps_id),
            wpqr_code:          wpqr_code || null,
            test_date:          test_date || null,
            testing_body:       testing_body || null,
            welder_name:        welder_name || null,
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
            expiry_date:        expiry_date || null,
            certificate_number: certificate_number || null,
            notes:              notes || null,
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

// ??? PUT /api/v1/welding/wpqr/:id ????????????????????????????????????????????
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
            'wps_id', 'wpqr_code', 'test_date', 'testing_body', 'welder_name',
            'vt_result', 'rt_result', 'ut_result', 'mt_result', 'pt_result',
            'tensile_result', 'bend_result', 'impact_result', 'hardness_result',
            'macro_result', 'expiry_date', 'certificate_number', 'notes',
        ];

        const updates = [];
        const params  = { id: parseInt(id) };

        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = @${field}`);
                if (field === 'wps_id') {
                    params[field] = req.body[field] !== null ? parseInt(req.body[field]) : null;
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

// ??? DELETE /api/v1/welding/wpqr/:id ??????????????????????????????????????????
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
// WPS Welders — Assegnazione saldatori a WPS
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

module.exports = {
    listWPS,
    getWPS,
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
};
