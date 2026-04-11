/**
 * qualifications.controller.js — CRUD Registro Qualifiche
 * Sprint 4
 *
 * Endpoints:
 *   GET    /qualifications          → lista con semaforo
 *   GET    /qualifications/:id      → dettaglio
 *   POST   /qualifications          → crea
 *   PUT    /qualifications/:id      → aggiorna
 *   DELETE /qualifications/:id      → soft delete (status = 'revocata')
 *   GET    /qualifications/stats    → conteggi per stato (badge)
 */

const { getPool } = require('../config/database');
const logger = require('../utils/logger');

// Soglie semaforo (giorni)
const DAYS_WARNING = 60;   // giallo: scade entro 60 giorni
const DAYS_URGENT  = 30;   // rosso intenso: scade entro 30 giorni

/**
 * Calcola il semaforo in base alla data di scadenza.
 * Restituisce: 'verde' | 'giallo' | 'arancione' | 'rosso' | 'grigio'
 */
function semaforo(expiryDate, status) {
    if (status === 'sospesa' || status === 'revocata') return 'grigio';
    if (!expiryDate) return 'verde'; // nessuna scadenza = valida indefinitamente
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    const diffDays = Math.floor((expiry - today) / 86400000);
    if (diffDays < 0)              return 'rosso';     // scaduta
    if (diffDays <= DAYS_URGENT)   return 'arancione'; // meno di 30 giorni
    if (diffDays <= DAYS_WARNING)  return 'giallo';    // meno di 60 giorni
    return 'verde';
}

/** GET /qualifications */
async function listQualifications(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const {
            search = '', company_id = '', status = '',
            person_name = '', expiring_days = '',
            page = 1, limit = 50,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        let where = ['q.organization_id = @orgId'];
        const r = pool.request().input('orgId', orgId).input('lim', parseInt(limit)).input('off', offset);

        if (search) { r.input('search', `%${search}%`); where.push("(q.person_name LIKE @search OR q.qualification_type LIKE @search OR q.certificate_number LIKE @search)"); }
        if (company_id) { r.input('companyId', parseInt(company_id)); where.push('q.company_id = @companyId'); }
        if (status)  { r.input('status', status); where.push('q.status = @status'); }
        if (expiring_days) {
            r.input('expDays', parseInt(expiring_days));
            where.push("q.expiry_date IS NOT NULL AND q.expiry_date <= DATEADD(day, @expDays, CAST(GETDATE() AS DATE)) AND q.expiry_date >= CAST(GETDATE() AS DATE) AND q.status NOT IN ('revocata','sospesa')");
        }
        const whereClause = where.join(' AND ');

        const countResult = await pool.request().input('orgId', orgId).query(`SELECT COUNT(*) AS total FROM qualifications q WHERE ${whereClause}`);

        const result = await r.query(`
            SELECT q.*,
                   c.name AS company_name
            FROM qualifications q
            LEFT JOIN companies c ON c.id = q.company_id
            WHERE ${whereClause}
            ORDER BY
                CASE WHEN q.expiry_date IS NULL THEN 1 ELSE 0 END,
                q.expiry_date ASC,
                q.person_name ASC
            OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
        `);

        const qualifications = result.recordset.map(q => ({
            ...q,
            semaforo: semaforo(q.expiry_date, q.status),
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
        const pool  = await getPool();
        const orgId = req.user.organization_id;

        const r = await pool.request().input('orgId', orgId).query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'valida' AND (expiry_date IS NULL OR expiry_date > DATEADD(day, 60, CAST(GETDATE() AS DATE))) THEN 1 ELSE 0 END) AS valide,
                SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date BETWEEN DATEADD(day, 31, CAST(GETDATE() AS DATE)) AND DATEADD(day, 60, CAST(GETDATE() AS DATE)) AND status NOT IN ('revocata','sospesa') THEN 1 ELSE 0 END) AS in_scadenza_60,
                SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(day, 30, CAST(GETDATE() AS DATE)) AND status NOT IN ('revocata','sospesa') THEN 1 ELSE 0 END) AS in_scadenza_30,
                SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date < CAST(GETDATE() AS DATE) AND status NOT IN ('revocata','sospesa') THEN 1 ELSE 0 END) AS scadute,
                SUM(CASE WHEN status IN ('sospesa','revocata') THEN 1 ELSE 0 END) AS non_attive
            FROM qualifications
            WHERE organization_id = @orgId
        `);

        const s = r.recordset[0];
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

/** GET /qualifications/:id */
async function getOne(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const r = await pool.request()
            .input('id', parseInt(req.params.id))
            .input('orgId', orgId)
            .query('SELECT * FROM qualifications WHERE id=@id AND organization_id=@orgId');
        if (!r.recordset.length) return res.status(404).json({ error: 'Non trovata.' });
        res.json({ ...r.recordset[0], semaforo: semaforo(r.recordset[0].expiry_date, r.recordset[0].status) });
    } catch (err) {
        logger.error('getOneQualif:', err.message);
        res.status(500).json({ error: err.message });
    }
}

/** POST /qualifications */
async function createQualification(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const userId = req.user.id;
        const {
            company_id, person_name, person_code, department,
            qualification_type, standard_ref, scope_detail,
            certificate_number, issuing_body,
            issue_date, expiry_date, last_renewal_date,
            status = 'valida', notes,
        } = req.body;

        if (!person_name?.trim()) return res.status(400).json({ error: 'Il nome della persona è obbligatorio.' });
        if (!qualification_type?.trim()) return res.status(400).json({ error: 'Il tipo di qualifica è obbligatorio.' });

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
            .query(`
                INSERT INTO qualifications
                    (organization_id, company_id, person_name, person_code, department,
                     qualification_type, standard_ref, scope_detail, certificate_number, issuing_body,
                     issue_date, expiry_date, last_renewal_date, status, notes, created_by)
                OUTPUT INSERTED.id
                VALUES
                    (@orgId, @compId, @personName, @personCode, @dept,
                     @qualType, @stdRef, @scope, @certNum, @issuer,
                     @issueDate, @expiryDate, @renewalDate, @status, @notes, @userId)
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
        const {
            company_id, person_name, person_code, department,
            qualification_type, standard_ref, scope_detail,
            certificate_number, issuing_body,
            issue_date, expiry_date, last_renewal_date,
            status, notes,
        } = req.body;

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT id FROM qualifications WHERE id=@id AND organization_id=@orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

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
            .query(`
                UPDATE qualifications SET
                    company_id=@compId, person_name=@personName, person_code=@personCode,
                    department=@dept, qualification_type=@qualType, standard_ref=@stdRef,
                    scope_detail=@scope, certificate_number=@certNum, issuing_body=@issuer,
                    issue_date=@issueDate, expiry_date=@expiryDate, last_renewal_date=@renewalDate,
                    status=@status, notes=@notes, updated_at=GETDATE()
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
            .query('SELECT id FROM qualifications WHERE id=@id AND organization_id=@orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Non trovata.' });

        await pool.request().input('id', id).input('orgId', orgId)
            .query("UPDATE qualifications SET status='revocata', updated_at=GETDATE() WHERE id=@id AND organization_id=@orgId");

        res.json({ success: true });
    } catch (err) {
        logger.error('deleteQualif:', err.message);
        res.status(500).json({ error: err.message });
    }
}

module.exports = { listQualifications, getStats, getOne, createQualification, updateQualification, deleteQualification };
