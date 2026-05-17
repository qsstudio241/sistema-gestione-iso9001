/**
 * Projects Controller — CRUD Commesse/Progetti ISO 3834
 * Modulo Saldatura
 *
 * Tenant-isolated: ogni query filtra per organization_id dal JWT.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// GET /projects
async function listProjects(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            search,
            status,
            company_id,
            page = 1,
            limit = 50,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const conditions = ['p.organization_id = @organization_id'];
        const params = { organization_id, limit: parseInt(limit), offset };

        if (search) {
            conditions.push('(p.project_code LIKE @search OR p.client_name LIKE @search OR p.description LIKE @search)');
            params.search = `%${search}%`;
        }
        if (status) {
            conditions.push('p.status = @status');
            params.status = status;
        }
        if (company_id) {
            conditions.push('p.company_id = @company_id');
            params.company_id = parseInt(company_id);
        }

        const where = conditions.join(' AND ');

        const result = await query(`
            SELECT
                p.*,
                c.name AS company_name,
                (SELECT COUNT(*) FROM project_welders pw
                 WHERE pw.project_id = p.id AND pw.organization_id = @organization_id
                ) AS welders_count
            FROM projects p
            LEFT JOIN companies c ON p.company_id = c.id
            WHERE ${where}
            ORDER BY p.updated_at DESC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `, params);

        const countResult = await query(`
            SELECT COUNT(*) AS total
            FROM projects p
            WHERE ${where}
        `, params);

        const total = countResult.recordset[0].total;

        const data = result.recordset.map(row => {
            let wpsCount = 0;
            if (row.applicable_wps_ids) {
                try {
                    const parsed = JSON.parse(row.applicable_wps_ids);
                    wpsCount = Array.isArray(parsed) ? parsed.length : 0;
                } catch (_) { /* JSON non valido */ }
            }
            return { ...row, wps_count: wpsCount };
        });

        res.json({
            success: true,
            data,
            pagination: {
                page:       parseInt(page),
                limit:      parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        logger.error('Error listing projects', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero dei progetti', code: 'PROJECT_LIST_ERROR' });
    }
}

// GET /projects/stats
async function getProjectStats(req, res) {
    try {
        const { organization_id } = req.user;

        const result = await query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'offerta' THEN 1 ELSE 0 END) AS offerta,
                SUM(CASE WHEN status = 'attiva' THEN 1 ELSE 0 END) AS attiva,
                SUM(CASE WHEN status = 'completata' THEN 1 ELSE 0 END) AS completata,
                SUM(CASE WHEN status = 'chiusa' THEN 1 ELSE 0 END) AS chiusa
            FROM projects
            WHERE organization_id = @organization_id
        `, { organization_id });

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error getting project stats', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero delle statistiche', code: 'PROJECT_STATS_ERROR' });
    }
}

// GET /projects/:id
async function getProject(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
            SELECT p.*, c.name AS company_name
            FROM projects p
            LEFT JOIN companies c ON p.company_id = c.id
            WHERE p.id = @id AND p.organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Progetto non trovato', code: 'PROJECT_NOT_FOUND' });
        }

        const project = result.recordset[0];

        // Parse WPS ids e recupera dettagli
        let wpsDetails = [];
        if (project.applicable_wps_ids) {
            try {
                const wpsIds = JSON.parse(project.applicable_wps_ids);
                if (Array.isArray(wpsIds) && wpsIds.length > 0) {
                    const placeholders = wpsIds.map((_, i) => `@wpsId${i}`).join(',');
                    const wpsParams = { organization_id };
                    wpsIds.forEach((wid, i) => { wpsParams[`wpsId${i}`] = parseInt(wid); });
                    const wpsResult = await query(`
                        SELECT id, wps_code, welding_process, status
                        FROM welding_procedures
                        WHERE id IN (${placeholders}) AND organization_id = @organization_id
                    `, wpsParams);
                    wpsDetails = wpsResult.recordset;
                }
            } catch (_) { /* JSON non valido */ }
        }

        // Saldatori assegnati
        const weldersResult = await query(`
            SELECT pw.*, q.person_name, q.qualification_type, q.certificate_number, q.expiry_date
            FROM project_welders pw
            JOIN qualifications q ON pw.qualification_id = q.id
            WHERE pw.project_id = @id AND pw.organization_id = @organization_id
            ORDER BY q.person_name
        `, { id: parseInt(id), organization_id });

        res.json({
            success: true,
            data: {
                ...project,
                wps_details: wpsDetails,
                welders: weldersResult.recordset,
            },
        });
    } catch (error) {
        logger.error('Error getting project', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero del progetto', code: 'PROJECT_GET_ERROR' });
    }
}

// POST /projects
async function createProject(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const {
            company_id, project_code, client_name, client_company_id,
            description, start_date, end_date, applicable_wps_ids,
            status = 'offerta', requirements_review_date,
            technical_review_date, notes,
        } = req.body;

        if (!project_code) {
            return res.status(400).json({ error: 'Codice progetto obbligatorio', code: 'VALIDATION_ERROR' });
        }

        const wpsIdsJson = applicable_wps_ids
            ? JSON.stringify(Array.isArray(applicable_wps_ids) ? applicable_wps_ids : [applicable_wps_ids])
            : null;

        const result = await query(`
            INSERT INTO projects (
                organization_id, company_id, project_code, client_name,
                client_company_id, description, start_date, end_date,
                applicable_wps_ids, status, requirements_review_date,
                technical_review_date, notes, created_by, created_at, updated_at
            )
            OUTPUT INSERTED.id
            VALUES (
                @organization_id, @company_id, @project_code, @client_name,
                @client_company_id, @description, @start_date, @end_date,
                @applicable_wps_ids, @status, @requirements_review_date,
                @technical_review_date, @notes, @created_by, GETDATE(), GETDATE()
            )
        `, {
            organization_id,
            company_id:              company_id ? parseInt(company_id) : null,
            project_code,
            client_name:             client_name || null,
            client_company_id:       client_company_id ? parseInt(client_company_id) : null,
            description:             description || null,
            start_date:              start_date || null,
            end_date:                end_date || null,
            applicable_wps_ids:      wpsIdsJson,
            status,
            requirements_review_date: requirements_review_date || null,
            technical_review_date:   technical_review_date || null,
            notes:                   notes || null,
            created_by:              user_id,
        });

        const newId = result.recordset[0].id;
        logger.info('Project created', { id: newId, organization_id, project_code });

        res.status(201).json({ success: true, data: { id: newId, project_code, status } });
    } catch (error) {
        logger.error('Error creating project', { error: error.message });
        res.status(500).json({ error: 'Errore durante la creazione del progetto', code: 'PROJECT_CREATE_ERROR' });
    }
}

// PUT /projects/:id
async function updateProject(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const existing = await query(`
            SELECT id FROM projects
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Progetto non trovato', code: 'PROJECT_NOT_FOUND' });
        }

        const allowed = [
            'company_id', 'project_code', 'client_name', 'client_company_id',
            'description', 'start_date', 'end_date', 'applicable_wps_ids',
            'status', 'requirements_review_date', 'technical_review_date', 'notes',
        ];

        const updates = [];
        const params = { id: parseInt(id) };

        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = @${field}`);
                if (field === 'applicable_wps_ids') {
                    const val = req.body[field];
                    params[field] = val ? JSON.stringify(Array.isArray(val) ? val : [val]) : null;
                } else if (['company_id', 'client_company_id'].includes(field)) {
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
            UPDATE projects
            SET ${updates.join(', ')}
            WHERE id = @id
        `, params);

        logger.info('Project updated', { id, organization_id });
        res.json({ success: true, message: 'Progetto aggiornato con successo' });
    } catch (error) {
        logger.error('Error updating project', { error: error.message });
        res.status(500).json({ error: 'Errore durante l\'aggiornamento del progetto', code: 'PROJECT_UPDATE_ERROR' });
    }
}

// DELETE /projects/:id
async function deleteProject(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const existing = await query(`
            SELECT id, status FROM projects
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Progetto non trovato', code: 'PROJECT_NOT_FOUND' });
        }

        const project = existing.recordset[0];

        if (project.status === 'offerta') {
            // Hard delete per progetti in stato offerta (+ saldatori collegati)
            await query(`
                DELETE FROM project_welders
                WHERE project_id = @id AND organization_id = @organization_id
            `, { id: parseInt(id), organization_id });
            await query(`
                DELETE FROM projects
                WHERE id = @id AND organization_id = @organization_id
            `, { id: parseInt(id), organization_id });
        } else {
            // Soft delete: status = chiusa
            await query(`
                UPDATE projects SET status = 'chiusa', updated_at = GETDATE()
                WHERE id = @id AND organization_id = @organization_id
            `, { id: parseInt(id), organization_id });
        }

        logger.info('Project deleted', { id, organization_id, hard: project.status === 'offerta' });
        res.json({ success: true, message: 'Progetto eliminato con successo' });
    } catch (error) {
        logger.error('Error deleting project', { error: error.message });
        res.status(500).json({ error: 'Errore durante l\'eliminazione del progetto', code: 'PROJECT_DELETE_ERROR' });
    }
}

module.exports = {
    listProjects,
    getProjectStats,
    getProject,
    createProject,
    updateProject,
    deleteProject,
};
