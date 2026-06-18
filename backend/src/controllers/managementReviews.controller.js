/**
 * managementReviews.controller.js — Riesame di Direzione ISO 9001 §9.3
 * CRUD completo con isolamento multi-tenant su organization_id.
 * Numerazione automatica: RD-YYYY-NNN (progressiva per organizzazione).
 */

const { getPool } = require('../config/database');
const logger = require('../utils/logger');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
    assertMutatingAllowed,
    sendAccessDenied,
} = require('../services/companyAccess.service');

// ─── Numerazione automatica RD-YYYY-NNN ──────────────────────────────────────

async function generateReviewNumber(pool, orgId, year) {
    const res = await pool.request()
        .input('orgId', orgId)
        .input('year', String(year))
        .query(`
            SELECT COUNT(*) AS cnt
            FROM management_reviews
            WHERE organization_id = @orgId
              AND LEFT(review_number, 7) = CONCAT('RD-', @year, '-')
              AND is_deleted = 0
        `);
    const seq = (res.recordset[0].cnt || 0) + 1;
    return `RD-${year}-${String(seq).padStart(3, '0')}`;
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

async function listReviews(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'mr');

        const { status, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = ['mr.organization_id = @orgId', 'mr.is_deleted = 0'];
        if (companyFilter.clause) where.push(companyFilter.clause);

        const req2 = pool.request()
            .input('orgId', orgId)
            .input('limit', parseInt(limit))
            .input('offset', offset);
        Object.entries(companyFilter.params).forEach(([k, v]) => req2.input(k, v));

        if (status) { where.push('mr.status = @status'); req2.input('status', status); }

        const whereClause = where.join(' AND ');

        const [dataRes, countRes] = await Promise.all([
            req2.query(`
                SELECT mr.id, mr.uuid, mr.review_number, mr.review_date, mr.status,
                       mr.chairperson, mr.company_id, mr.created_at, mr.updated_at,
                       u.full_name AS created_by_name,
                       c.name AS company_name
                FROM management_reviews mr
                LEFT JOIN users u    ON u.user_id     = mr.created_by
                LEFT JOIN companies c ON c.company_id = mr.company_id
                WHERE ${whereClause}
                ORDER BY mr.review_date DESC, mr.created_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `),
            (() => {
                const cntReq = pool.request().input('orgId2', orgId);
                Object.entries(companyFilter.params).forEach(([k, v]) => cntReq.input(k, v));
                const cntWhere = ['mr.organization_id = @orgId2', 'mr.is_deleted = 0'];
                if (companyFilter.clause) cntWhere.push(companyFilter.clause);
                if (status) { cntWhere.push('mr.status = @cntStatus'); cntReq.input('cntStatus', status); }
                return cntReq.query(`SELECT COUNT(*) AS total FROM management_reviews mr WHERE ${cntWhere.join(' AND ')}`);
            })(),
        ]);

        res.json({
            success: true,
            data: dataRes.recordset,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: countRes.recordset[0].total },
        });
    } catch (err) {
        logger.error('listReviews:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ─── GET ONE ──────────────────────────────────────────────────────────────────

async function getOneReview(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const r = await pool.request()
            .input('id', parseInt(req.params.id))
            .input('orgId', orgId)
            .query(`
                SELECT mr.*, c.name AS company_name, u.full_name AS created_by_name
                FROM management_reviews mr
                LEFT JOIN companies c ON c.company_id = mr.company_id
                LEFT JOIN users u     ON u.user_id    = mr.created_by
                WHERE mr.id = @id AND mr.organization_id = @orgId AND mr.is_deleted = 0
            `);
        if (!r.recordset.length) return res.status(404).json({ error: 'Riesame non trovato' });
        res.json({ success: true, data: r.recordset[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ─── CREATE ───────────────────────────────────────────────────────────────────

async function createReview(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const userId = req.user.user_id;

        const {
            review_date, chairperson, participants,
            input_previous_actions, input_audits, input_nc_corrective,
            input_objectives, input_complaints, input_suppliers,
            input_resources, input_improvements,
            output_improvements, output_sgq_changes, output_resources,
            notes, company_id, status = 'draft',
        } = req.body;

        if (!review_date) return res.status(400).json({ error: 'Data riesame obbligatoria' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const year = new Date(review_date).getFullYear();
        const reviewNumber = await generateReviewNumber(pool, orgId, year);

        const r = await pool.request()
            .input('orgId',   orgId)
            .input('userId',  userId)
            .input('review_number', reviewNumber)
            .input('review_date', review_date)
            .input('status',  status)
            .input('chairperson', chairperson || null)
            .input('participants', participants || null)
            .input('input_previous_actions', input_previous_actions || null)
            .input('input_audits',           input_audits           || null)
            .input('input_nc_corrective',    input_nc_corrective    || null)
            .input('input_objectives',       input_objectives       || null)
            .input('input_complaints',       input_complaints       || null)
            .input('input_suppliers',        input_suppliers        || null)
            .input('input_resources',        input_resources        || null)
            .input('input_improvements',     input_improvements     || null)
            .input('output_improvements',    output_improvements    || null)
            .input('output_sgq_changes',     output_sgq_changes     || null)
            .input('output_resources',       output_resources       || null)
            .input('notes',      notes       || null)
            .input('company_id', company_id  || null)
            .query(`
                INSERT INTO management_reviews (
                    organization_id, company_id, review_number, review_date, status,
                    chairperson, participants,
                    input_previous_actions, input_audits, input_nc_corrective,
                    input_objectives, input_complaints, input_suppliers,
                    input_resources, input_improvements,
                    output_improvements, output_sgq_changes, output_resources,
                    notes, created_by
                )
                OUTPUT INSERTED.id, INSERTED.review_number, INSERTED.uuid
                VALUES (
                    @orgId, @company_id, @review_number, @review_date, @status,
                    @chairperson, @participants,
                    @input_previous_actions, @input_audits, @input_nc_corrective,
                    @input_objectives, @input_complaints, @input_suppliers,
                    @input_resources, @input_improvements,
                    @output_improvements, @output_sgq_changes, @output_resources,
                    @notes, @userId
                )
            `);

        const created = r.recordset[0];
        logger.info('ManagementReview created', { id: created.id, orgId, reviewNumber });
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        logger.error('createReview:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

async function updateReview(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT company_id FROM management_reviews WHERE id = @id AND organization_id = @orgId AND is_deleted = 0');
        if (!check.recordset.length) return res.status(404).json({ error: 'Riesame non trovato' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const fields = [
            'review_date', 'status', 'chairperson', 'participants',
            'input_previous_actions', 'input_audits', 'input_nc_corrective',
            'input_objectives', 'input_complaints', 'input_suppliers',
            'input_resources', 'input_improvements',
            'output_improvements', 'output_sgq_changes', 'output_resources',
            'notes',
        ];

        const sets = ['updated_at = SYSDATETIME()'];
        const req2 = pool.request().input('id', id).input('orgId', orgId);

        fields.forEach((f) => {
            if (req.body[f] !== undefined) {
                sets.push(`${f} = @${f}`);
                req2.input(f, req.body[f] ?? null);
            }
        });

        await req2.query(`
            UPDATE management_reviews SET ${sets.join(', ')}
            WHERE id = @id AND organization_id = @orgId
        `);
        res.json({ success: true });
    } catch (err) {
        logger.error('updateReview:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ─── DELETE (soft) ────────────────────────────────────────────────────────────

async function deleteReview(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT company_id FROM management_reviews WHERE id = @id AND organization_id = @orgId AND is_deleted = 0');
        if (!check.recordset.length) return res.status(404).json({ error: 'Riesame non trovato' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        await pool.request().input('id', id).input('orgId', orgId)
            .query('UPDATE management_reviews SET is_deleted = 1, updated_at = SYSDATETIME() WHERE id = @id AND organization_id = @orgId');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = { listReviews, getOneReview, createReview, updateReview, deleteReview };
