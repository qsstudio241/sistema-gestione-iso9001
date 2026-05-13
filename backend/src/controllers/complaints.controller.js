/**
 * Complaints Controller — ISO 9001:2015 §8.8 + §10.2
 * Gestisce reclami clienti, NC verso fornitori e NC interne (reparti).
 * 
 * Tipi: customer | supplier | internal
 * Workflow: open → in_progress → in_analysis → action_taken → verified → closed | rejected
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ─── Generazione complaint_number progressivo ─────────────────────────────

async function generateComplaintNumber(organization_id) {
    const year = new Date().getFullYear();
    const prefix = `RCL-${year}-`;
    const res = await query(`
        SELECT MAX(CAST(SUBSTRING(complaint_number, LEN(@prefix)+1, 10) AS INT)) AS last_seq
        FROM complaints
        WHERE organization_id = @org AND complaint_number LIKE @pattern
    `, { org: organization_id, prefix, pattern: prefix + '%' });
    const lastSeq = res.recordset[0].last_seq || 0;
    return `${prefix}${String(lastSeq + 1).padStart(3, '0')}`;
}

// ─── LIST ─────────────────────────────────────────────────────────────────

async function listComplaints(req, res) {
    try {
        const { organization_id } = req.user;
        const { complaint_type, status, severity } = req.query;

        let where = ['c.organization_id = @org'];
        const params = { org: organization_id };

        if (complaint_type) { where.push('c.complaint_type = @ct'); params.ct = complaint_type; }
        if (status)         { where.push('c.status = @st');         params.st = status; }
        if (severity)       { where.push('c.severity = @sev');      params.sev = severity; }

        const result = await query(`
            SELECT 
                c.*,
                cp.name AS company_name,
                s.name  AS supplier_name,
                d.name  AS department_name,
                nc.nc_number,
                nc.status AS nc_status,
                CASE
                    WHEN c.status NOT IN ('closed','rejected','verified')
                         AND c.due_date < CAST(GETDATE() AS DATE)
                    THEN 1 ELSE 0
                END AS is_overdue
            FROM complaints c
            LEFT JOIN companies   cp ON c.company_id    = cp.id
            LEFT JOIN suppliers   s  ON c.supplier_id   = s.id
            LEFT JOIN departments d  ON c.department_id = d.id
            LEFT JOIN non_conformities nc ON c.nc_id = nc.nc_id
            WHERE ${where.join(' AND ')}
            ORDER BY c.created_at DESC
        `, params);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('Error listing complaints', { error: error.message });
        res.status(500).json({ error: 'Errore recupero reclami', code: 'COMPLAINTS_LIST_ERROR' });
    }
}

// ─── GET BY ID ────────────────────────────────────────────────────────────

async function getComplaintById(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
            SELECT 
                c.*,
                cp.name AS company_name,
                s.name  AS supplier_name,
                d.name  AS department_name,
                nc.nc_number, nc.status AS nc_status, nc.nc_uuid
            FROM complaints c
            LEFT JOIN companies   cp ON c.company_id    = cp.id
            LEFT JOIN suppliers   s  ON c.supplier_id   = s.id
            LEFT JOIN departments d  ON c.department_id = d.id
            LEFT JOIN non_conformities nc ON c.nc_id = nc.nc_id
            WHERE c.id = @id AND c.organization_id = @org
        `, { id: parseInt(id), org: organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Reclamo non trovato', code: 'COMPLAINT_NOT_FOUND' });
        }
        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error getting complaint', { error: error.message });
        res.status(500).json({ error: 'Errore recupero reclamo', code: 'COMPLAINT_GET_ERROR' });
    }
}

// ─── CREATE ───────────────────────────────────────────────────────────────

async function createComplaint(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const {
            title, description, customer_name, receive_date,
            company_id, notes,
            complaint_type = 'customer',
            severity = 'medium',
            supplier_id, department_id,
            product_service, responsible_person, due_date
        } = req.body;

        if (!title || !description || !customer_name || !receive_date) {
            return res.status(400).json({
                error: 'Campi obbligatori: title, description, customer_name, receive_date',
                code: 'VALIDATION_ERROR'
            });
        }

        const validTypes = ['customer', 'supplier', 'internal'];
        if (!validTypes.includes(complaint_type)) {
            return res.status(400).json({ error: 'complaint_type non valido', code: 'VALIDATION_ERROR' });
        }

        const complaint_number = await generateComplaintNumber(organization_id);

        const result = await query(`
            INSERT INTO complaints (
                organization_id, company_id, title, description, customer_name,
                receive_date, notes, created_by,
                complaint_number, complaint_type, severity,
                supplier_id, department_id, product_service,
                responsible_person, due_date
            )
            OUTPUT INSERTED.*
            VALUES (
                @org, @company_id, @title, @description, @customer_name,
                @receive_date, @notes, @created_by,
                @complaint_number, @complaint_type, @severity,
                @supplier_id, @department_id, @product_service,
                @responsible_person, @due_date
            )
        `, {
            org: organization_id,
            company_id: company_id || null,
            title,
            description,
            customer_name,
            receive_date,
            notes: notes || null,
            created_by: user_id,
            complaint_number,
            complaint_type,
            severity,
            supplier_id: supplier_id || null,
            department_id: department_id || null,
            product_service: product_service || null,
            responsible_person: responsible_person || null,
            due_date: due_date || null,
        });

        logger.info('Complaint created', { id: result.recordset[0].id, complaint_number, organization_id });
        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error creating complaint', { error: error.message });
        res.status(500).json({ error: 'Errore creazione reclamo', code: 'COMPLAINT_CREATE_ERROR' });
    }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────

async function updateComplaint(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const check = await query(
            `SELECT id, status FROM complaints WHERE id = @id AND organization_id = @org`,
            { id: parseInt(id), org: organization_id }
        );
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Reclamo non trovato', code: 'COMPLAINT_NOT_FOUND' });
        }

        const fields = [
            'title', 'description', 'customer_name', 'receive_date', 'close_date',
            'status', 'notes', 'company_id', 'complaint_type', 'severity',
            'supplier_id', 'department_id', 'product_service', 'responsible_person',
            'due_date', 'root_cause', 'resolution_summary', 'nc_id'
        ];

        const updates = [];
        const params = { id: parseInt(id) };

        for (const f of fields) {
            if (req.body[f] !== undefined) {
                updates.push(`${f} = @${f}`);
                params[f] = req.body[f];
            }
        }

        if (req.body.status === 'closed' && req.body.close_date === undefined) {
            updates.push('close_date = CAST(GETDATE() AS DATE)');
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'VALIDATION_ERROR' });
        }
        updates.push('updated_at = GETDATE()');

        await query(`UPDATE complaints SET ${updates.join(', ')} WHERE id = @id`, params);

        logger.info('Complaint updated', { id, organization_id });
        res.json({ success: true, message: 'Reclamo aggiornato' });
    } catch (error) {
        logger.error('Error updating complaint', { error: error.message });
        res.status(500).json({ error: 'Errore aggiornamento reclamo', code: 'COMPLAINT_UPDATE_ERROR' });
    }
}

// ─── DELETE ───────────────────────────────────────────────────────────────

async function deleteComplaint(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const check = await query(
            `SELECT id FROM complaints WHERE id = @id AND organization_id = @org`,
            { id: parseInt(id), org: organization_id }
        );
        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Reclamo non trovato', code: 'COMPLAINT_NOT_FOUND' });
        }

        await query(`DELETE FROM complaints WHERE id = @id`, { id: parseInt(id) });
        logger.info('Complaint deleted', { id, organization_id });
        res.json({ success: true, message: 'Reclamo eliminato' });
    } catch (error) {
        logger.error('Error deleting complaint', { error: error.message });
        res.status(500).json({ error: 'Errore eliminazione reclamo', code: 'COMPLAINT_DELETE_ERROR' });
    }
}

// ─── STATS ────────────────────────────────────────────────────────────────

async function getComplaintsStats(req, res) {
    try {
        const { organization_id } = req.user;

        const result = await query(`
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'open'        THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
                SUM(CASE WHEN status = 'closed'      THEN 1 ELSE 0 END) AS closed_count,
                SUM(CASE WHEN complaint_type = 'customer'  THEN 1 ELSE 0 END) AS customer_count,
                SUM(CASE WHEN complaint_type = 'supplier'  THEN 1 ELSE 0 END) AS supplier_count,
                SUM(CASE WHEN complaint_type = 'internal'  THEN 1 ELSE 0 END) AS internal_count,
                SUM(CASE WHEN severity = 'high' OR severity = 'critical' THEN 1 ELSE 0 END) AS high_severity,
                SUM(CASE
                    WHEN status NOT IN ('closed','rejected','verified')
                         AND due_date < CAST(GETDATE() AS DATE)
                    THEN 1 ELSE 0
                END) AS overdue
            FROM complaints
            WHERE organization_id = @org
        `, { org: organization_id });

        res.json({ success: true, data: result.recordset[0] || {} });
    } catch (error) {
        logger.error('Error getting complaints stats', { error: error.message });
        res.status(500).json({ error: 'Errore statistiche reclami', code: 'COMPLAINTS_STATS_ERROR' });
    }
}

// ─── PROMUOVI RECLAMO A NC ────────────────────────────────────────────────

/**
 * POST /complaints/:id/promote-to-nc
 * Crea una NC nel registro organizzativo a partire da un reclamo.
 * Idempotente: se il reclamo ha già nc_id, restituisce la NC esistente.
 */
async function promoteToNc(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        const { audit_id, section_code = '10.2', severity: ncSeverity } = req.body;

        const complaintRes = await query(
            `SELECT c.*, s.name AS supplier_name FROM complaints c
             LEFT JOIN suppliers s ON c.supplier_id = s.id
             WHERE c.id = @id AND c.organization_id = @org`,
            { id: parseInt(id), org: organization_id }
        );

        if (complaintRes.recordset.length === 0) {
            return res.status(404).json({ error: 'Reclamo non trovato', code: 'COMPLAINT_NOT_FOUND' });
        }

        const complaint = complaintRes.recordset[0];

        // Se già collegato a una NC, restituisci quella
        if (complaint.nc_id) {
            const existingNc = await query(
                `SELECT nc_id, nc_number, status FROM non_conformities WHERE nc_id = @ncId`,
                { ncId: complaint.nc_id }
            );
            return res.json({
                success: true,
                already_exists: true,
                data: existingNc.recordset[0]
            });
        }

        // Serve un audit_id per creare la NC
        if (!audit_id) {
            return res.status(400).json({
                error: 'audit_id obbligatorio per promuovere il reclamo a NC',
                code: 'VALIDATION_ERROR'
            });
        }

        // Verifica audit ownership
        const auditCheck = await query(
            `SELECT audit_id, audit_number FROM audits WHERE audit_id = @aid AND organization_id = @org AND is_deleted = 0`,
            { aid: parseInt(audit_id), org: organization_id }
        );
        if (auditCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
        }
        const audit_number = auditCheck.recordset[0].audit_number;

        // Recupera standard_id dall'audit
        const stdRes = await query(
            `SELECT TOP 1 standard_id FROM audit_standards WHERE audit_id = @aid`,
            { aid: parseInt(audit_id) }
        );
        if (stdRes.recordset.length === 0) {
            return res.status(400).json({ error: 'Audit senza standard associato', code: 'NO_STANDARD' });
        }
        const standard_id = stdRes.recordset[0].standard_id;

        // Genera nc_number
        const countRes = await query(`
            SELECT COUNT(*) AS cnt FROM non_conformities nc
            INNER JOIN audits a ON nc.audit_id = a.audit_id
            WHERE a.organization_id = @org
        `, { org: organization_id });
        const seq = (countRes.recordset[0].cnt || 0) + 1;
        const nc_number = `NC-${audit_number}-${String(seq).padStart(3, '0')}`;

        // Mappa tipo reclamo → severità NC
        const severity = ncSeverity ||
            (complaint.complaint_type === 'supplier' ? 'minor' :
             complaint.complaint_type === 'internal' ? 'minor' : 'observation');

        const description = complaint.complaint_type === 'supplier'
            ? `NC fornitore [${complaint.supplier_name || 'N.D.'}]: ${complaint.title}`
            : complaint.complaint_type === 'internal'
            ? `NC interna: ${complaint.title}`
            : `Reclamo cliente [${complaint.customer_name}]: ${complaint.title}`;

        // Crea NC
        const ncInsert = await query(`
            INSERT INTO non_conformities (
                audit_id, standard_id, nc_number, section_code, description, severity,
                status, source_type, source_complaint_id, created_at, updated_at
            )
            OUTPUT INSERTED.nc_id, INSERTED.nc_uuid, INSERTED.nc_number
            VALUES (
                @audit_id, @standard_id, @nc_number, @section_code, @description, @severity,
                'open', 'complaint', @complaint_id, GETDATE(), GETDATE()
            )
        `, {
            audit_id: parseInt(audit_id),
            standard_id,
            nc_number,
            section_code,
            description,
            severity,
            complaint_id: parseInt(id)
        });

        const newNc = ncInsert.recordset[0];

        // Collega NC al reclamo
        await query(
            `UPDATE complaints SET nc_id = @ncId, updated_at = GETDATE() WHERE id = @id`,
            { ncId: newNc.nc_id, id: parseInt(id) }
        );

        logger.info('Complaint promoted to NC', { complaint_id: id, nc_id: newNc.nc_id, organization_id });

        res.status(201).json({
            success: true,
            data: {
                nc_id: newNc.nc_id,
                nc_uuid: newNc.nc_uuid,
                nc_number: newNc.nc_number,
                complaint_id: parseInt(id)
            }
        });
    } catch (error) {
        logger.error('Error promoting complaint to NC', { error: error.message });
        res.status(500).json({ error: 'Errore promozione a NC', code: 'PROMOTE_TO_NC_ERROR' });
    }
}

module.exports = {
    listComplaints,
    getComplaintById,
    createComplaint,
    updateComplaint,
    deleteComplaint,
    getComplaintsStats,
    promoteToNc
};
