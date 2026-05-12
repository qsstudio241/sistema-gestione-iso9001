/**
 * Departments Controller — ISO 9001:2015 §8.5
 * Gestisce l'anagrafica reparti produttivi (fornitori interni).
 * Usati come "soggetto" nelle NC interne e nei reclami di tipo 'internal'.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

async function listDepartments(req, res) {
    try {
        const { organization_id } = req.user;
        const { is_active } = req.query;

        let where = ['d.organization_id = @org'];
        const params = { org: organization_id };
        if (is_active !== undefined) { where.push('d.is_active = @ia'); params.ia = is_active === 'false' ? 0 : 1; }

        const result = await query(`
            SELECT
                d.*,
                p.name AS parent_name,
                (SELECT COUNT(*) FROM complaints c WHERE c.department_id = d.id) AS complaints_count
            FROM departments d
            LEFT JOIN departments p ON d.parent_id = p.id
            WHERE ${where.join(' AND ')}
            ORDER BY p.name ASC, d.name ASC
        `, params);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('Error listing departments', { error: error.message });
        res.status(500).json({ error: 'Errore recupero reparti', code: 'DEPTS_LIST_ERROR' });
    }
}

async function getDepartmentById(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
            SELECT d.*, p.name AS parent_name
            FROM departments d
            LEFT JOIN departments p ON d.parent_id = p.id
            WHERE d.id = @id AND d.organization_id = @org
        `, { id: parseInt(id), org: organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Reparto non trovato', code: 'DEPT_NOT_FOUND' });
        }
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error getting department', { error: error.message });
        res.status(500).json({ error: 'Errore recupero reparto', code: 'DEPT_GET_ERROR' });
    }
}

async function createDepartment(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const { name, code, description, manager_name, manager_user_id, parent_id, notes } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Nome reparto obbligatorio', code: 'VALIDATION_ERROR' });
        }

        const result = await query(`
            INSERT INTO departments (
                organization_id, name, code, description, manager_name, manager_user_id, parent_id, notes, created_by
            )
            OUTPUT INSERTED.*
            VALUES (@org, @name, @code, @description, @manager_name, @manager_user_id, @parent_id, @notes, @created_by)
        `, {
            org: organization_id,
            name,
            code: code || null,
            description: description || null,
            manager_name: manager_name || null,
            manager_user_id: manager_user_id || null,
            parent_id: parent_id || null,
            notes: notes || null,
            created_by: user_id
        });

        logger.info('Department created', { id: result.recordset[0].id, organization_id });
        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error creating department', { error: error.message });
        res.status(500).json({ error: 'Errore creazione reparto', code: 'DEPT_CREATE_ERROR' });
    }
}

async function updateDepartment(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const check = await query(
            `SELECT id FROM departments WHERE id = @id AND organization_id = @org`,
            { id: parseInt(id), org: organization_id }
        );
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Reparto non trovato', code: 'DEPT_NOT_FOUND' });
        }

        const fields = ['name', 'code', 'description', 'manager_name', 'manager_user_id', 'parent_id', 'notes', 'is_active'];
        const updates = [];
        const params = { id: parseInt(id) };

        for (const f of fields) {
            if (req.body[f] !== undefined) {
                updates.push(`${f} = @${f}`);
                params[f] = f === 'is_active' ? (req.body[f] ? 1 : 0) : req.body[f];
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'VALIDATION_ERROR' });
        }
        updates.push('updated_at = GETDATE()');

        await query(`UPDATE departments SET ${updates.join(', ')} WHERE id = @id`, params);
        logger.info('Department updated', { id, organization_id });
        res.json({ success: true, message: 'Reparto aggiornato' });
    } catch (error) {
        logger.error('Error updating department', { error: error.message });
        res.status(500).json({ error: 'Errore aggiornamento reparto', code: 'DEPT_UPDATE_ERROR' });
    }
}

async function deleteDepartment(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const check = await query(
            `SELECT id FROM departments WHERE id = @id AND organization_id = @org`,
            { id: parseInt(id), org: organization_id }
        );
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Reparto non trovato', code: 'DEPT_NOT_FOUND' });
        }

        // Check se ci sono reclami o NC collegati
        const usedBy = await query(`
            SELECT 
                (SELECT COUNT(*) FROM complaints WHERE department_id = @id) AS complaints_count,
                (SELECT COUNT(*) FROM non_conformities WHERE source_type = 'manual' AND nc_id IN (
                    SELECT nc_id FROM non_conformities WHERE source_complaint_id IN (
                        SELECT id FROM complaints WHERE department_id = @id))) AS nc_count
        `, { id: parseInt(id) });

        const { complaints_count } = usedBy.recordset[0];
        if (complaints_count > 0) {
            return res.status(409).json({
                error: `Impossibile eliminare: ${complaints_count} reclamo/i collegato/i`,
                code: 'DEPT_HAS_COMPLAINTS'
            });
        }

        await query(`DELETE FROM departments WHERE id = @id`, { id: parseInt(id) });
        logger.info('Department deleted', { id, organization_id });
        res.json({ success: true, message: 'Reparto eliminato' });
    } catch (error) {
        logger.error('Error deleting department', { error: error.message });
        res.status(500).json({ error: 'Errore eliminazione reparto', code: 'DEPT_DELETE_ERROR' });
    }
}

module.exports = {
    listDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment
};
