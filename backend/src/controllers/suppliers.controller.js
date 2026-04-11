/**
 * Suppliers Controller
 * Gestisce anagrafica fornitori e le loro valutazioni
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// --- FORNITORI ---

async function listSuppliers(req, res) {
    try {
        const { organization_id } = req.user;
        const result = await query(`
            SELECT s.*, cp.name AS company_name,
                (SELECT TOP 1 score FROM supplier_evaluations se WHERE se.supplier_id = s.id ORDER BY evaluation_date DESC) as last_score
            FROM suppliers s
            LEFT JOIN companies cp ON s.company_id = cp.id
            WHERE s.organization_id = @organization_id
            ORDER BY s.name ASC
        `, { organization_id });

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('Error listing suppliers', { error: error.message });
        res.status(500).json({ error: 'Errore recupero fornitori' });
    }
}

async function getSupplierById(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        const result = await query(`
            SELECT s.*, cp.name AS company_name
            FROM suppliers s
            LEFT JOIN companies cp ON s.company_id = cp.id
            WHERE s.id = @id AND s.organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) return res.status(404).json({ error: 'Fornitore non trovato' });
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error getting supplier', { error: error.message });
        res.status(500).json({ error: 'Errore recupero fornitore' });
    }
}

async function createSupplier(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const { name, vat_number, category, is_qualified, notes, company_id } = req.body;

        if (!name) return res.status(400).json({ error: 'Nome fornitore obbligatorio' });

        const result = await query(`
            INSERT INTO suppliers (organization_id, company_id, name, vat_number, category, is_qualified, notes, created_by)
            OUTPUT INSERTED.*
            VALUES (@organization_id, @company_id, @name, @vat_number, @category, @is_qualified, @notes, @created_by)
        `, {
            organization_id,
            company_id: company_id || null,
            name,
            vat_number: vat_number || null,
            category: category || null,
            is_qualified: is_qualified ? 1 : 0,
            notes: notes || null,
            created_by: user_id
        });

        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error creating supplier', { error: error.message });
        res.status(500).json({ error: 'Errore creazione fornitore' });
    }
}

async function updateSupplier(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        const { name, vat_number, category, is_qualified, notes, company_id } = req.body;

        const check = await query(`SELECT id FROM suppliers WHERE id = @id AND organization_id = @organization_id`, { id: parseInt(id), organization_id });
        if (check.recordset.length === 0) return res.status(404).json({ error: 'Fornitore non trovato' });

        const updates = [];
        const params = { id: parseInt(id) };

        if (name !== undefined) { updates.push('name = @name'); params.name = name; }
        if (vat_number !== undefined) { updates.push('vat_number = @vat_number'); params.vat_number = vat_number; }
        if (category !== undefined) { updates.push('category = @category'); params.category = category; }
        if (is_qualified !== undefined) { updates.push('is_qualified = @is_qualified'); params.is_qualified = is_qualified ? 1 : 0; }
        if (notes !== undefined) { updates.push('notes = @notes'); params.notes = notes; }
        if (company_id !== undefined) { updates.push('company_id = @company_id'); params.company_id = company_id; }

        if (updates.length === 0) return res.status(400).json({ error: 'Nessun campo da aggiornare' });
        updates.push('updated_at = GETDATE()');

        await query(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = @id`, params);
        res.json({ success: true, message: 'Fornitore aggiornato' });
    } catch (error) {
        logger.error('Error updating supplier', { error: error.message });
        res.status(500).json({ error: 'Errore aggiornamento fornitore' });
    }
}

async function deleteSupplier(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        
        const check = await query(`SELECT id FROM suppliers WHERE id = @id AND organization_id = @organization_id`, { id: parseInt(id), organization_id });
        if (check.recordset.length === 0) return res.status(404).json({ error: 'Fornitore non trovato' });

        await query(`DELETE FROM supplier_evaluations WHERE supplier_id = @id`, { id: parseInt(id) });
        await query(`DELETE FROM suppliers WHERE id = @id`, { id: parseInt(id) });
        res.json({ success: true, message: 'Fornitore eliminato' });
    } catch (error) {
        logger.error('Error deleting supplier', { error: error.message });
        res.status(500).json({ error: 'Errore eliminazione fornitore' });
    }
}

// --- VALUTAZIONI ---

async function listEvaluations(req, res) {
    try {
        const { id } = req.params; // supplier_id
        const { organization_id } = req.user;

        const check = await query(`SELECT id FROM suppliers WHERE id = @id AND organization_id = @organization_id`, { id: parseInt(id), organization_id });
        if (check.recordset.length === 0) return res.status(404).json({ error: 'Fornitore non trovato' });

        const result = await query(`
            SELECT * FROM supplier_evaluations 
            WHERE supplier_id = @id 
            ORDER BY evaluation_date DESC
        `, { id: parseInt(id) });

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('Error listing evaluations', { error: error.message });
        res.status(500).json({ error: 'Errore recupero valutazioni' });
    }
}

async function createEvaluation(req, res) {
    try {
        const { id } = req.params;
        const { user_id, organization_id } = req.user;
        const { evaluation_date, score, notes, next_evaluation_date } = req.body;

        if (!evaluation_date || score === undefined) return res.status(400).json({ error: 'Data e score obbligatori' });
        if (score < 1 || score > 5) return res.status(400).json({ error: 'Score deve essere tra 1 e 5' });

        const check = await query(`SELECT id FROM suppliers WHERE id = @id AND organization_id = @organization_id`, { id: parseInt(id), organization_id });
        if (check.recordset.length === 0) return res.status(404).json({ error: 'Fornitore non trovato' });

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
        res.status(500).json({ error: 'Errore creazione valutazione' });
    }
}

async function deleteEvaluation(req, res) {
    try {
        const { id, evalId } = req.params;
        const { organization_id } = req.user;

        const check = await query(`
            SELECT e.id FROM supplier_evaluations e
            INNER JOIN suppliers s ON e.supplier_id = s.id
            WHERE e.id = @evalId AND s.id = @id AND s.organization_id = @organization_id
        `, { evalId: parseInt(evalId), id: parseInt(id), organization_id });

        if (check.recordset.length === 0) return res.status(404).json({ error: 'Valutazione non trovata' });

        await query(`DELETE FROM supplier_evaluations WHERE id = @evalId`, { evalId: parseInt(evalId) });
        res.json({ success: true, message: 'Valutazione eliminata' });
    } catch (error) {
        logger.error('Error deleting evaluation', { error: error.message });
        res.status(500).json({ error: 'Errore eliminazione valutazione' });
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
