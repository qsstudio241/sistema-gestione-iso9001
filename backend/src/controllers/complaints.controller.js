/**
 * Complaints Controller
 * Gestisce i reclami clienti
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

async function listComplaints(req, res) {
    try {
        const { organization_id } = req.user;
        const result = await query(`
            SELECT c.*, cp.name AS company_name,
              CASE WHEN c.status = 'open' AND DATEDIFF(day, c.receive_date, GETDATE()) > 30 THEN 1 ELSE 0 END AS is_overdue
            FROM complaints c
            LEFT JOIN companies cp ON c.company_id = cp.id
            WHERE c.organization_id = @organization_id
            ORDER BY c.created_at DESC
        `, { organization_id });

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('Error listing complaints', { error: error.message });
        res.status(500).json({ error: 'Errore recupero reclami' });
    }
}

async function getComplaintById(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        const result = await query(`
            SELECT c.*, cp.name AS company_name
            FROM complaints c
            LEFT JOIN companies cp ON c.company_id = cp.id
            WHERE c.id = @id AND c.organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) return res.status(404).json({ error: 'Reclamo non trovato' });
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error getting complaint', { error: error.message });
        res.status(500).json({ error: 'Errore recupero reclamo' });
    }
}

async function createComplaint(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const { title, description, customer_name, receive_date, company_id, notes } = req.body;

        if (!title || !description || !customer_name || !receive_date) {
            return res.status(400).json({ error: 'Campi obbligatori mancanti' });
        }

        const result = await query(`
            INSERT INTO complaints (organization_id, company_id, title, description, customer_name, receive_date, notes, created_by)
            OUTPUT INSERTED.*
            VALUES (@organization_id, @company_id, @title, @description, @customer_name, @receive_date, @notes, @created_by)
        `, {
            organization_id,
            company_id: company_id || null,
            title,
            description,
            customer_name,
            receive_date,
            notes: notes || null,
            created_by: user_id
        });

        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error creating complaint', { error: error.message });
        res.status(500).json({ error: 'Errore creazione reclamo' });
    }
}

async function updateComplaint(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        const { title, description, customer_name, receive_date, close_date, status, notes, company_id } = req.body;

        const check = await query(`SELECT id, status FROM complaints WHERE id = @id AND organization_id = @organization_id`, { id: parseInt(id), organization_id });
        if (check.recordset.length === 0) return res.status(404).json({ error: 'Reclamo non trovato' });

        const updates = [];
        const params = { id: parseInt(id) };

        if (title !== undefined) { updates.push('title = @title'); params.title = title; }
        if (description !== undefined) { updates.push('description = @description'); params.description = description; }
        if (customer_name !== undefined) { updates.push('customer_name = @customer_name'); params.customer_name = customer_name; }
        if (receive_date !== undefined) { updates.push('receive_date = @receive_date'); params.receive_date = receive_date; }
        if (close_date !== undefined) { updates.push('close_date = @close_date'); params.close_date = close_date; }
        if (notes !== undefined) { updates.push('notes = @notes'); params.notes = notes; }
        if (company_id !== undefined) { updates.push('company_id = @company_id'); params.company_id = company_id; }
        
        if (status !== undefined) {
            updates.push('status = @status');
            params.status = status;
            if (status === 'closed' && close_date === undefined) {
                updates.push('close_date = CAST(GETDATE() AS DATE)');
            }
        }

        if (updates.length === 0) return res.status(400).json({ error: 'Nessun campo da aggiornare' });
        updates.push('updated_at = GETDATE()');

        await query(`UPDATE complaints SET ${updates.join(', ')} WHERE id = @id`, params);
        res.json({ success: true, message: 'Reclamo aggiornato' });
    } catch (error) {
        logger.error('Error updating complaint', { error: error.message });
        res.status(500).json({ error: 'Errore aggiornamento reclamo' });
    }
}

async function deleteComplaint(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        
        const check = await query(`SELECT id FROM complaints WHERE id = @id AND organization_id = @organization_id`, { id: parseInt(id), organization_id });
        if (check.recordset.length === 0) return res.status(404).json({ error: 'Reclamo non trovato' });

        await query(`DELETE FROM complaints WHERE id = @id`, { id: parseInt(id) });
        res.json({ success: true, message: 'Reclamo eliminato' });
    } catch (error) {
        logger.error('Error deleting complaint', { error: error.message });
        res.status(500).json({ error: 'Errore eliminazione reclamo' });
    }
}

async function getComplaintsStats(req, res) {
    try {
        const { organization_id } = req.user;
        const result = await query(`
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN status = 'open' AND DATEDIFF(day, receive_date, GETDATE()) > 30 THEN 1 ELSE 0 END) AS overdue_30_days
            FROM complaints
            WHERE organization_id = @organization_id
        `, { organization_id });

        res.json({ success: true, data: result.recordset[0] || { total: 0, open_count: 0, overdue_30_days: 0 } });
    } catch (error) {
        logger.error('Error getting complaints stats', { error: error.message });
        res.status(500).json({ error: 'Errore statistiche reclami' });
    }
}

module.exports = {
    listComplaints,
    getComplaintById,
    createComplaint,
    updateComplaint,
    deleteComplaint,
    getComplaintsStats
};
