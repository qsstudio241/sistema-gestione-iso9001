/**
 * Suppliers Controller — ISO 9001:2015 §8.4
 * Gestisce anagrafica fornitori (esterni e interni) e le loro valutazioni.
 * 
 * supplier_type: 'external' | 'internal'
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ─── LIST ─────────────────────────────────────────────────────────────────

async function listSuppliers(req, res) {
    try {
        const { organization_id } = req.user;
        const { supplier_type, is_active } = req.query;

        let where = ['s.organization_id = @org'];
        const params = { org: organization_id };

        if (supplier_type) { where.push('s.supplier_type = @st'); params.st = supplier_type; }
        if (is_active !== undefined) { where.push('s.is_active = @ia'); params.ia = is_active === 'false' ? 0 : 1; }

        const result = await query(`
            SELECT
                s.*,
                cp.name AS company_name,
                (SELECT TOP 1 score FROM supplier_evaluations se
                 WHERE se.supplier_id = s.id ORDER BY se.evaluation_date DESC) AS last_score,
                (SELECT TOP 1 evaluation_date FROM supplier_evaluations se
                 WHERE se.supplier_id = s.id ORDER BY se.evaluation_date DESC) AS last_eval_date,
                (SELECT COUNT(*) FROM complaints c WHERE c.supplier_id = s.id) AS complaints_count
            FROM suppliers s
            LEFT JOIN companies cp ON s.company_id = cp.id
            WHERE ${where.join(' AND ')}
            ORDER BY s.name ASC
        `, params);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('Error listing suppliers', { error: error.message });
        res.status(500).json({ error: 'Errore recupero fornitori', code: 'SUPPLIERS_LIST_ERROR' });
    }
}

// ─── GET BY ID ────────────────────────────────────────────────────────────

async function getSupplierById(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
            SELECT s.*, cp.name AS company_name
            FROM suppliers s
            LEFT JOIN companies cp ON s.company_id = cp.id
            WHERE s.id = @id AND s.organization_id = @org
        `, { id: parseInt(id), org: organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Fornitore non trovato', code: 'SUPPLIER_NOT_FOUND' });
        }
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error getting supplier', { error: error.message });
        res.status(500).json({ error: 'Errore recupero fornitore', code: 'SUPPLIER_GET_ERROR' });
    }
}

// ─── CREATE ───────────────────────────────────────────────────────────────

async function createSupplier(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const {
            name, vat_number, category, is_qualified = false, notes, company_id,
            supplier_type = 'external', code, email, phone, contact_person, address
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Nome fornitore obbligatorio', code: 'VALIDATION_ERROR' });
        }

        const result = await query(`
            INSERT INTO suppliers (
                organization_id, company_id, name, vat_number, category, is_qualified, notes, created_by,
                supplier_type, code, email, phone, contact_person, address
            )
            OUTPUT INSERTED.*
            VALUES (
                @org, @company_id, @name, @vat_number, @category, @is_qualified, @notes, @created_by,
                @supplier_type, @code, @email, @phone, @contact_person, @address
            )
        `, {
            org: organization_id,
            company_id: company_id || null,
            name,
            vat_number: vat_number || null,
            category: category || null,
            is_qualified: is_qualified ? 1 : 0,
            notes: notes || null,
            created_by: user_id,
            supplier_type,
            code: code || null,
            email: email || null,
            phone: phone || null,
            contact_person: contact_person || null,
            address: address || null
        });

        logger.info('Supplier created', { id: result.recordset[0].id, organization_id });
        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error creating supplier', { error: error.message });
        res.status(500).json({ error: 'Errore creazione fornitore', code: 'SUPPLIER_CREATE_ERROR' });
    }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────

async function updateSupplier(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const check = await query(
            `SELECT id FROM suppliers WHERE id = @id AND organization_id = @org`,
            { id: parseInt(id), org: organization_id }
        );
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Fornitore non trovato', code: 'SUPPLIER_NOT_FOUND' });
        }

        const fields = [
            'name', 'vat_number', 'category', 'is_qualified', 'notes', 'company_id',
            'supplier_type', 'code', 'email', 'phone', 'contact_person', 'address', 'is_active'
        ];
        const updates = [];
        const params = { id: parseInt(id) };

        for (const f of fields) {
            if (req.body[f] !== undefined) {
                updates.push(`${f} = @${f}`);
                params[f] = f === 'is_qualified' || f === 'is_active'
                    ? (req.body[f] ? 1 : 0)
                    : req.body[f];
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'VALIDATION_ERROR' });
        }
        updates.push('updated_at = GETDATE()');

        await query(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = @id`, params);
        logger.info('Supplier updated', { id, organization_id });
        res.json({ success: true, message: 'Fornitore aggiornato' });
    } catch (error) {
        logger.error('Error updating supplier', { error: error.message });
        res.status(500).json({ error: 'Errore aggiornamento fornitore', code: 'SUPPLIER_UPDATE_ERROR' });
    }
}

// ─── DELETE ───────────────────────────────────────────────────────────────

async function deleteSupplier(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const check = await query(
            `SELECT id FROM suppliers WHERE id = @id AND organization_id = @org`,
            { id: parseInt(id), org: organization_id }
        );
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Fornitore non trovato', code: 'SUPPLIER_NOT_FOUND' });
        }

        await query(`DELETE FROM supplier_evaluations WHERE supplier_id = @id`, { id: parseInt(id) });
        await query(`DELETE FROM suppliers WHERE id = @id`, { id: parseInt(id) });
        logger.info('Supplier deleted', { id, organization_id });
        res.json({ success: true, message: 'Fornitore eliminato' });
    } catch (error) {
        logger.error('Error deleting supplier', { error: error.message });
        res.status(500).json({ error: 'Errore eliminazione fornitore', code: 'SUPPLIER_DELETE_ERROR' });
    }
}

// ─── VALUTAZIONI ──────────────────────────────────────────────────────────

async function listEvaluations(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const check = await query(
            `SELECT id FROM suppliers WHERE id = @id AND organization_id = @org`,
            { id: parseInt(id), org: organization_id }
        );
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Fornitore non trovato', code: 'SUPPLIER_NOT_FOUND' });
        }

        const result = await query(
            `SELECT * FROM supplier_evaluations WHERE supplier_id = @id ORDER BY evaluation_date DESC`,
            { id: parseInt(id) }
        );
        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('Error listing evaluations', { error: error.message });
        res.status(500).json({ error: 'Errore recupero valutazioni', code: 'EVALS_LIST_ERROR' });
    }
}

async function createEvaluation(req, res) {
    try {
        const { id } = req.params;
        const { user_id, organization_id } = req.user;
        const { evaluation_date, score, notes, next_evaluation_date } = req.body;

        if (!evaluation_date || score === undefined) {
            return res.status(400).json({ error: 'Data e score obbligatori', code: 'VALIDATION_ERROR' });
        }
        if (score < 1 || score > 5) {
            return res.status(400).json({ error: 'Score deve essere 1-5', code: 'VALIDATION_ERROR' });
        }

        const check = await query(
            `SELECT id FROM suppliers WHERE id = @id AND organization_id = @org`,
            { id: parseInt(id), org: organization_id }
        );
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Fornitore non trovato', code: 'SUPPLIER_NOT_FOUND' });
        }

        const result = await query(`
            INSERT INTO supplier_evaluations (supplier_id, evaluation_date, score, notes, next_evaluation_date, created_by)
            OUTPUT INSERTED.*
            VALUES (@supplier_id, @evaluation_date, @score, @notes, @next_evaluation_date, @created_by)
        `, {
            supplier_id: parseInt(id),
            evaluation_date,
            score,
            notes: notes || null,
            next_evaluation_date: next_evaluation_date || null,
            created_by: user_id
        });

        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error creating evaluation', { error: error.message });
        res.status(500).json({ error: 'Errore creazione valutazione', code: 'EVAL_CREATE_ERROR' });
    }
}

async function deleteEvaluation(req, res) {
    try {
        const { id, evalId } = req.params;
        const { organization_id } = req.user;

        const check = await query(`
            SELECT e.id FROM supplier_evaluations e
            INNER JOIN suppliers s ON e.supplier_id = s.id
            WHERE e.id = @evalId AND s.id = @id AND s.organization_id = @org
        `, { evalId: parseInt(evalId), id: parseInt(id), org: organization_id });

        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Valutazione non trovata', code: 'EVAL_NOT_FOUND' });
        }

        await query(`DELETE FROM supplier_evaluations WHERE id = @evalId`, { evalId: parseInt(evalId) });
        res.json({ success: true, message: 'Valutazione eliminata' });
    } catch (error) {
        logger.error('Error deleting evaluation', { error: error.message });
        res.status(500).json({ error: 'Errore eliminazione valutazione', code: 'EVAL_DELETE_ERROR' });
    }
}

module.exports = {
    listSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    listEvaluations,
    createEvaluation,
    deleteEvaluation
};
