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
    assertCompanyRead,
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

        const { status, year, company_id, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const companyIdFilter = company_id ? parseInt(company_id, 10) : null;

        let where = ['mr.organization_id = @orgId', 'mr.is_deleted = 0'];
        if (companyFilter.clause) where.push(companyFilter.clause);

        const req2 = pool.request()
            .input('orgId', orgId)
            .input('limit', parseInt(limit))
            .input('offset', offset);
        Object.entries(companyFilter.params).forEach(([k, v]) => req2.input(k, v));

        if (status)     { where.push('mr.status = @status');                 req2.input('status', status); }
        if (year)       { where.push('YEAR(mr.review_date) = @year');        req2.input('year', parseInt(year, 10)); }
        if (company_id) { where.push('mr.company_id = @company_id');         req2.input('company_id', parseInt(company_id, 10)); }

        const whereClause = where.join(' AND ');

        const [dataRes, countRes] = await Promise.all([
            req2.query(`
                SELECT mr.id, mr.uuid, mr.review_number, mr.review_date, mr.status,
                       mr.chairperson, mr.company_id, mr.created_at, mr.updated_at,
                       u.full_name AS created_by_name,
                       c.name AS company_name
                FROM management_reviews mr
                LEFT JOIN users u    ON u.user_id     = mr.created_by
                LEFT JOIN companies c ON c.id = mr.company_id
                WHERE ${whereClause}
                ORDER BY mr.review_date DESC, mr.created_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `),
            (() => {
                const cntReq = pool.request().input('orgId2', orgId);
                Object.entries(companyFilter.params).forEach(([k, v]) => cntReq.input(k, v));
                const cntWhere = ['mr.organization_id = @orgId2', 'mr.is_deleted = 0'];
                if (companyFilter.clause) cntWhere.push(companyFilter.clause);
                if (status)     { cntWhere.push('mr.status = @cntStatus');    cntReq.input('cntStatus', status); }
                if (year)       { cntWhere.push('YEAR(mr.review_date) = @cntYear'); cntReq.input('cntYear', parseInt(year, 10)); }
                if (company_id) { cntWhere.push('mr.company_id = @cntCompanyId');   cntReq.input('cntCompanyId', parseInt(company_id, 10)); }
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
                LEFT JOIN companies c ON c.id = mr.company_id
                LEFT JOIN users u     ON u.user_id    = mr.created_by
                WHERE mr.id = @id AND mr.organization_id = @orgId AND mr.is_deleted = 0
            `);
        if (!r.recordset.length) return res.status(404).json({ error: 'Riesame non trovato' });
        const review = r.recordset[0];
        if (review.company_id) {
            const readDenied = await assertCompanyRead(req.user, review.company_id);
            if (readDenied) return sendAccessDenied(res, readDenied);
        }
        res.json({ success: true, data: review });
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
            input_context_changes, input_customer_satisfaction,
            input_process_performance, input_risk_effectiveness,
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
            .input('input_previous_actions',      input_previous_actions      || null)
            .input('input_audits',                input_audits                || null)
            .input('input_nc_corrective',         input_nc_corrective         || null)
            .input('input_objectives',            input_objectives            || null)
            .input('input_complaints',            input_complaints            || null)
            .input('input_suppliers',             input_suppliers             || null)
            .input('input_resources',             input_resources             || null)
            .input('input_improvements',          input_improvements          || null)
            .input('input_context_changes',       input_context_changes       || null)
            .input('input_customer_satisfaction', input_customer_satisfaction || null)
            .input('input_process_performance',   input_process_performance   || null)
            .input('input_risk_effectiveness',    input_risk_effectiveness    || null)
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
                    input_context_changes, input_customer_satisfaction,
                    input_process_performance, input_risk_effectiveness,
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
                    @input_context_changes, @input_customer_satisfaction,
                    @input_process_performance, @input_risk_effectiveness,
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
            'company_id',
            'review_date', 'status', 'chairperson', 'participants',
            'input_previous_actions', 'input_audits', 'input_nc_corrective',
            'input_objectives', 'input_complaints', 'input_suppliers',
            'input_resources', 'input_improvements',
            'input_context_changes', 'input_customer_satisfaction',
            'input_process_performance', 'input_risk_effectiveness',
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

// ─── INPUT SUMMARY §9.3 ───────────────────────────────────────────────────────

/**
 * GET /management-reviews/input-summary
 * Aggrega dati dai moduli collegati (NC, obiettivi, audit, fornitori, reclami)
 * per pre-compilare gli input §9.3.2 del riesame di direzione.
 *
 * Query params:
 *   company_id  (opzionale) — filtra per azienda
 *   date_from   (opzionale) — default: 1° gennaio anno corrente
 *   date_to     (opzionale) — default: oggi
 */
async function getInputSummary(req, res) {
    const pool  = await getPool();
    const orgId = req.user.organization_id;

    const today = new Date();
    const defaultFrom = `${today.getFullYear()}-01-01`;
    const defaultTo   = today.toISOString().slice(0, 10);

    const dateFrom   = req.query.date_from || defaultFrom;
    const dateTo     = req.query.date_to   || defaultTo;
    const companyId  = req.query.company_id ? parseInt(req.query.company_id, 10) : null;

    // Guard accesso azienda (P5 — RBAC)
    if (companyId) {
        const readDenied = await assertCompanyRead(req.user, companyId);
        if (readDenied) return sendAccessDenied(res, readDenied);
    }

    const result = {
        period: { from: dateFrom, to: dateTo },
        nc:         { open: 0, overdue: 0, total_closed_period: 0, details: [] },
        objectives: { total: 0, achieved: 0, percentage: 0 },
        audits:     { conducted: 0, planned: 0 },
        suppliers:  { evaluated: 0, avg_score: null },
        complaints: { total: 0 },
        risks:      { open: 0, mitigated_closed_period: 0, high_priority: 0 },
        previous_review: null,
        norm_coverage: [],
    };

    // ── NC ──────────────────────────────────────────────────────────────────────
    try {
        const ncReq = pool.request()
            .input('orgId', orgId)
            .input('dateFrom', dateFrom)
            .input('dateTo',   dateTo);

        let companyCond = '';
        if (companyId) {
            ncReq.input('companyId', companyId);
            companyCond = 'AND a.company_id = @companyId';
        }

        const ncRes = await ncReq.query(`
            SELECT
                SUM(CASE WHEN nc.status NOT IN ('closed','verified') THEN 1 ELSE 0 END)
                    AS open_count,
                SUM(CASE WHEN nc.status NOT IN ('closed','verified')
                             AND nc.due_date < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END)
                    AS overdue_count,
                SUM(CASE WHEN nc.status IN ('closed','verified')
                             AND nc.updated_at >= @dateFrom
                             AND nc.updated_at <= DATEADD(day,1,CAST(@dateTo AS DATE)) THEN 1 ELSE 0 END)
                    AS closed_period
            FROM non_conformities nc
            LEFT JOIN audits a ON nc.audit_id = a.audit_id
            WHERE COALESCE(a.organization_id, nc.organization_id) = @orgId
              ${companyCond}
        `);
        const nc = ncRes.recordset[0];
        result.nc.open               = nc.open_count    || 0;
        result.nc.overdue            = nc.overdue_count || 0;
        result.nc.total_closed_period = nc.closed_period || 0;
    } catch (err) {
        logger.error('getInputSummary NC:', err.message);
        result.nc.note = 'Dato non disponibile';
    }

    // ── DETTAGLIO NC (§9.3.2-c.4) — top NC aperte per gravità ─────────────────────
    try {
        const ncDetReq = pool.request().input('orgId', orgId);
        let ncDetCompanyCond = '';
        if (companyId) {
            ncDetReq.input('companyId', companyId);
            ncDetCompanyCond = 'AND a.company_id = @companyId';
        }
        const ncDetRes = await ncDetReq.query(`
            SELECT TOP (10)
                nc.nc_id, nc.nc_number, nc.description, nc.severity, nc.status, nc.due_date
            FROM non_conformities nc
            LEFT JOIN audits a ON nc.audit_id = a.audit_id
            WHERE COALESCE(a.organization_id, nc.organization_id) = @orgId
              AND nc.status NOT IN ('closed','verified')
              ${ncDetCompanyCond}
            ORDER BY
                CASE nc.severity WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END,
                nc.due_date ASC,
                nc.created_at DESC
        `);
        result.nc.details = ncDetRes.recordset.map((row) => ({
            id:       row.nc_id,
            number:   row.nc_number,
            title:    row.description
                ? String(row.description).slice(0, 140)
                : (row.nc_number || `NC ${row.nc_id}`),
            severity: row.severity || null,
            status:   row.status   || null,
            due_date: row.due_date ? new Date(row.due_date).toISOString().slice(0, 10) : null,
        }));
    } catch (err) {
        logger.error('getInputSummary NC dettaglio:', err.message);
        result.nc.details = [];
        result.nc.details_note = 'Dato non disponibile';
    }

    // ── OBIETTIVI ───────────────────────────────────────────────────────────────
    try {
        const objReq = pool.request()
            .input('orgId', orgId);

        let objCompanyCond = '';
        if (companyId) {
            objReq.input('companyId', companyId);
            objCompanyCond = 'AND company_id = @companyId';
        }

        const objRes = await objReq.query(`
                SELECT
                    COUNT(*)                                              AS total,
                    SUM(CASE WHEN status = 'achieved' THEN 1 ELSE 0 END) AS achieved
                FROM objectives
                WHERE organization_id = @orgId AND is_deleted = 0
                  ${objCompanyCond}
            `);
        const obj = objRes.recordset[0];
        const total    = obj.total    || 0;
        const achieved = obj.achieved || 0;
        result.objectives.total      = total;
        result.objectives.achieved   = achieved;
        result.objectives.percentage = total > 0 ? Math.round((achieved / total) * 100) : 0;
    } catch (err) {
        logger.error('getInputSummary Obiettivi:', err.message);
        result.objectives.note = 'Dato non disponibile';
    }

    // ── AUDIT ───────────────────────────────────────────────────────────────────
    try {
        const audReq = pool.request()
            .input('orgId',    orgId)
            .input('dateFrom', dateFrom)
            .input('dateTo',   dateTo);

        let audCompanyCond = '';
        if (companyId) {
            audReq.input('companyId', companyId);
            audCompanyCond = 'AND a.company_id = @companyId';
        }

        const audRes = await audReq.query(`
            SELECT
                SUM(CASE WHEN a.status IN ('completed','approved') THEN 1 ELSE 0 END) AS conducted,
                SUM(CASE WHEN a.status IN ('draft','in_progress')  THEN 1 ELSE 0 END) AS planned
            FROM audits a
            WHERE a.organization_id = @orgId
              AND a.is_deleted = 0
              AND a.audit_date >= @dateFrom
              AND a.audit_date <= @dateTo
              ${audCompanyCond}
        `);
        const aud = audRes.recordset[0];
        result.audits.conducted = aud.conducted || 0;
        result.audits.planned   = aud.planned   || 0;
    } catch (err) {
        logger.error('getInputSummary Audit:', err.message);
        result.audits.note = 'Dato non disponibile';
    }

    // ── FORNITORI ───────────────────────────────────────────────────────────────
    try {
        const supReq = pool.request()
            .input('orgId',    orgId)
            .input('dateFrom', dateFrom)
            .input('dateTo',   dateTo);

        let supCompanyCond = '';
        if (companyId) {
            supReq.input('companyId', companyId);
            supCompanyCond = 'AND s.company_id = @companyId';
        }

        const supRes = await supReq.query(`
            SELECT
                COUNT(DISTINCT se.supplier_id) AS evaluated,
                AVG(CAST(se.score AS FLOAT))   AS avg_score
            FROM supplier_evaluations se
            INNER JOIN suppliers s ON s.id = se.supplier_id
            WHERE s.organization_id = @orgId
              AND se.evaluation_date >= @dateFrom
              AND se.evaluation_date <= @dateTo
              ${supCompanyCond}
        `);
        const sup = supRes.recordset[0];
        result.suppliers.evaluated = sup.evaluated || 0;
        result.suppliers.avg_score = sup.avg_score != null
            ? Math.round(sup.avg_score * 10) / 10
            : null;
    } catch (err) {
        logger.error('getInputSummary Fornitori:', err.message);
        result.suppliers.note = 'Dato non disponibile';
    }

    // ── RECLAMI ─────────────────────────────────────────────────────────────────
    try {
        const cmpReq = pool.request()
            .input('orgId',    orgId)
            .input('dateFrom', dateFrom)
            .input('dateTo',   dateTo);

        let cmpCompanyCond = '';
        if (companyId) {
            cmpReq.input('companyId', companyId);
            cmpCompanyCond = 'AND company_id = @companyId';
        }

        const cmpRes = await cmpReq.query(`
                SELECT COUNT(*) AS total
                FROM complaints
                WHERE organization_id = @orgId
                  AND created_at >= @dateFrom
                  AND created_at <= DATEADD(day,1,CAST(@dateTo AS DATE))
                  ${cmpCompanyCond}
            `);
        result.complaints.total = cmpRes.recordset[0].total || 0;
    } catch (err) {
        logger.error('getInputSummary Reclami:', err.message);
        result.complaints.total = 0;
        result.complaints.note  = 'Dato non disponibile';
    }

    // ── RISCHI E OPPORTUNITÀ (§9.3.2-e) ───────────────────────────────────────────
    // status risks: 'open','in_treatment','mitigated','closed'; priorità = probability*impact (1-9)
    try {
        const riskReq = pool.request()
            .input('orgId', orgId)
            .input('dateFrom', dateFrom)
            .input('dateTo',   dateTo);

        let riskCompanyCond = '';
        if (companyId) {
            riskReq.input('companyId', companyId);
            riskCompanyCond = 'AND company_id = @companyId';
        }

        const riskRes = await riskReq.query(`
            SELECT
                SUM(CASE WHEN status IN ('open','in_treatment') THEN 1 ELSE 0 END)
                    AS open_count,
                SUM(CASE WHEN status IN ('mitigated','closed')
                             AND updated_at >= @dateFrom
                             AND updated_at <= DATEADD(day,1,CAST(@dateTo AS DATE)) THEN 1 ELSE 0 END)
                    AS mitigated_closed_period,
                SUM(CASE WHEN status IN ('open','in_treatment')
                             AND (probability * impact) >= 6 THEN 1 ELSE 0 END)
                    AS high_priority
            FROM risks
            WHERE organization_id = @orgId AND is_deleted = 0
              ${riskCompanyCond}
        `);
        const rk = riskRes.recordset[0];
        result.risks.open                    = rk.open_count              || 0;
        result.risks.mitigated_closed_period = rk.mitigated_closed_period || 0;
        result.risks.high_priority           = rk.high_priority           || 0;
    } catch (err) {
        logger.error('getInputSummary Rischi:', err.message);
        result.risks.note = 'Dato non disponibile';
    }

    // ── RIESAME PRECEDENTE (§9.3.2-a) — output del riesame più recente prima del periodo ─
    try {
        const prevReq = pool.request()
            .input('orgId', orgId)
            .input('dateFrom', dateFrom);

        let prevCompanyCond = '';
        if (companyId) {
            prevReq.input('companyId', companyId);
            prevCompanyCond = 'AND company_id = @companyId';
        }

        const prevRes = await prevReq.query(`
            SELECT TOP (1)
                review_number, review_date,
                output_improvements, output_sgq_changes, output_resources
            FROM management_reviews
            WHERE organization_id = @orgId AND is_deleted = 0
              AND review_date < @dateFrom
              ${prevCompanyCond}
            ORDER BY review_date DESC, created_at DESC
        `);
        if (prevRes.recordset.length) {
            const pr = prevRes.recordset[0];
            result.previous_review = {
                review_number:       pr.review_number || null,
                review_date:         pr.review_date ? new Date(pr.review_date).toISOString().slice(0, 10) : null,
                output_improvements: pr.output_improvements || null,
                output_sgq_changes:  pr.output_sgq_changes  || null,
                output_resources:    pr.output_resources    || null,
            };
        }
    } catch (err) {
        logger.error('getInputSummary RiesamePrecedente:', err.message);
        result.previous_review_note = 'Dato non disponibile';
    }

    // ── COPERTURA NORMATIVA ──────────────────────────────────────────────────────
    try {
        const normReq = pool.request()
            .input('orgId', orgId)
            .input('cutoff', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));

        if (companyId) {
            normReq.input('companyId', companyId);
        }

        const normRes = await normReq.query(`
            SELECT
                nr.clause_ref,
                nr.clause_title,
                MAX(a.audit_date) AS last_verified
            FROM norm_requirements nr
            LEFT JOIN audits a ON (
                a.organization_id = @orgId
                AND a.is_deleted = 0
                AND a.status IN ('completed', 'approved')
                AND CAST(a.audit_date AS DATE) >= CAST(@cutoff AS DATE)
                ${companyId ? 'AND a.company_id = @companyId' : ''}
            )
            WHERE nr.is_current = 1
              AND nr.standard_code = 'ISO_9001_2015'
              AND LEN(nr.clause_ref) - LEN(REPLACE(nr.clause_ref, '.', '')) = 1
            GROUP BY nr.clause_ref, nr.clause_title
            ORDER BY nr.clause_ref
        `);

        result.norm_coverage = normRes.recordset.map((row) => ({
            clause:        row.clause_ref,
            title:         row.clause_title,
            status:        row.last_verified ? 'ok' : 'gap',
            last_verified: row.last_verified
                ? new Date(row.last_verified).toISOString().slice(0, 10)
                : null,
        }));
    } catch (err) {
        logger.error('getInputSummary NormCoverage:', err.message);
        result.norm_coverage = [];
        result.norm_coverage_note = 'Dato non disponibile';
    }

    // Dati aggregati sempre freschi — disabilita la cache HTTP per evitare 304/ETag stale
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: result });
}

// ─── GENERA BOZZA TESTI §9.3.2 ────────────────────────────────────────────────

/**
 * POST /management-reviews/:id/generate-draft
 * Genera testi pronti per copia-incolla nei campi §9.3.2.
 * Usa AI se configurata (GEMINI_API_KEY / AZURE_OPENAI_* / OPENAI_API_KEY),
 * altrimenti produce testo deterministico dai dati aggregati.
 *
 * Body: { company_id?, period_from?, period_to?, sections? }
 */
async function generateDraft(req, res) {
    const pool  = await getPool();
    const orgId = req.user.organization_id;
    const reviewId = parseInt(req.params.id, 10);

    const today = new Date();
    const periodFrom = req.body.period_from || `${today.getFullYear()}-01-01`;
    const periodTo   = req.body.period_to   || today.toISOString().slice(0, 10);
    const companyId  = req.body.company_id  ? parseInt(req.body.company_id, 10) : null;

    // Verifica che il riesame appartenga all'org
    try {
        const chk = await pool.request()
            .input('id',    reviewId)
            .input('orgId', orgId)
            .query(`SELECT id FROM management_reviews WHERE id=@id AND organization_id=@orgId AND is_deleted=0`);
        if (!chk.recordset.length) {
            return res.status(404).json({ success: false, error: 'Riesame non trovato.' });
        }
    } catch (err) {
        logger.error('generateDraft check review:', err.message);
        return res.status(500).json({ success: false, error: 'Errore interno.' });
    }

    // Raccoglie dati aggregati dal periodo
    let nc         = { open: 0, overdue: 0, total_closed_period: 0 };
    let objectives = { total: 0, achieved: 0, percentage: 0 };
    let audits     = { conducted: 0 };
    let suppliers  = { evaluated: 0, avg_score: null };
    let risks      = { open: 0, mitigated_closed_period: 0, high_priority: 0 };
    let prevReview = null;
    let normGaps   = [];

    try {
        const companyCond = companyId ? 'AND a.company_id = @companyId' : '';
        const ncReq = pool.request().input('orgId', orgId).input('dateFrom', periodFrom).input('dateTo', periodTo);
        if (companyId) ncReq.input('companyId', companyId);
        const ncRes = await ncReq.query(`
            SELECT
                SUM(CASE WHEN nc.status NOT IN ('closed','verified') THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN nc.status NOT IN ('closed','verified') AND nc.due_date < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS overdue_count,
                SUM(CASE WHEN nc.status IN ('closed','verified') AND nc.updated_at >= @dateFrom AND nc.updated_at <= DATEADD(day,1,CAST(@dateTo AS DATE)) THEN 1 ELSE 0 END) AS closed_period
            FROM non_conformities nc
            LEFT JOIN audits a ON nc.audit_id = a.audit_id
            WHERE COALESCE(a.organization_id, nc.organization_id) = @orgId ${companyCond}
        `);
        const r = ncRes.recordset[0];
        nc = { open: r.open_count || 0, overdue: r.overdue_count || 0, total_closed_period: r.closed_period || 0 };
    } catch (_) { /* dati non disponibili — il draft userà 0 */ }

    try {
        const objRes = await pool.request().input('orgId', orgId).query(`
            SELECT COUNT(*) AS total, SUM(CASE WHEN status='achieved' THEN 1 ELSE 0 END) AS achieved
            FROM objectives WHERE organization_id=@orgId AND is_deleted=0
        `);
        const r = objRes.recordset[0];
        const total = r.total || 0; const achieved = r.achieved || 0;
        objectives = { total, achieved, percentage: total > 0 ? Math.round((achieved / total) * 100) : 0 };
    } catch (_) { /* fallback a 0 */ }

    try {
        const audReq = pool.request().input('orgId', orgId).input('dateFrom', periodFrom).input('dateTo', periodTo);
        if (companyId) audReq.input('companyId', companyId);
        const companyCond = companyId ? 'AND a.company_id = @companyId' : '';
        const audRes = await audReq.query(`
            SELECT SUM(CASE WHEN a.status IN ('completed','approved') THEN 1 ELSE 0 END) AS conducted
            FROM audits a
            WHERE a.organization_id=@orgId AND a.is_deleted=0 AND a.audit_date>=@dateFrom AND a.audit_date<=@dateTo ${companyCond}
        `);
        audits = { conducted: audRes.recordset[0].conducted || 0 };
    } catch (_) { /* fallback a 0 */ }

    try {
        const supReq = pool.request().input('orgId', orgId).input('dateFrom', periodFrom).input('dateTo', periodTo);
        if (companyId) supReq.input('companyId', companyId);
        const companyCond = companyId ? 'AND s.company_id = @companyId' : '';
        const supRes = await supReq.query(`
            SELECT COUNT(DISTINCT se.supplier_id) AS evaluated, AVG(CAST(se.score AS FLOAT)) AS avg_score
            FROM supplier_evaluations se
            INNER JOIN suppliers s ON s.id=se.supplier_id
            WHERE s.organization_id=@orgId AND se.evaluation_date>=@dateFrom AND se.evaluation_date<=@dateTo ${companyCond}
        `);
        const r = supRes.recordset[0];
        suppliers = { evaluated: r.evaluated || 0, avg_score: r.avg_score != null ? Math.round(r.avg_score * 10) / 10 : null };
    } catch (_) { /* fallback */ }

    try {
        const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const normReq = pool.request().input('orgId', orgId).input('cutoff', cutoff);
        if (companyId) normReq.input('companyId', companyId);
        const companyCond = companyId ? 'AND a.company_id = @companyId' : '';
        const normRes = await normReq.query(`
            SELECT nr.clause_ref, MAX(a.audit_date) AS last_verified
            FROM norm_requirements nr
            LEFT JOIN audits a ON (a.organization_id=@orgId AND a.is_deleted=0 AND a.status IN ('completed','approved') AND CAST(a.audit_date AS DATE)>=CAST(@cutoff AS DATE) ${companyCond})
            WHERE nr.is_current=1 AND nr.standard_code='ISO_9001_2015'
              AND LEN(nr.clause_ref) - LEN(REPLACE(nr.clause_ref, '.', '')) = 1
            GROUP BY nr.clause_ref
            ORDER BY nr.clause_ref
        `);
        normGaps = normRes.recordset.filter((r) => !r.last_verified).map((r) => r.clause_ref);
    } catch (_) { /* fallback */ }

    try {
        const riskReq = pool.request().input('orgId', orgId).input('dateFrom', periodFrom).input('dateTo', periodTo);
        if (companyId) riskReq.input('companyId', companyId);
        const companyCond = companyId ? 'AND company_id = @companyId' : '';
        const riskRes = await riskReq.query(`
            SELECT
                SUM(CASE WHEN status IN ('open','in_treatment') THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN status IN ('mitigated','closed') AND updated_at >= @dateFrom AND updated_at <= DATEADD(day,1,CAST(@dateTo AS DATE)) THEN 1 ELSE 0 END) AS mitigated_closed_period,
                SUM(CASE WHEN status IN ('open','in_treatment') AND (probability * impact) >= 6 THEN 1 ELSE 0 END) AS high_priority
            FROM risks
            WHERE organization_id = @orgId AND is_deleted = 0 ${companyCond}
        `);
        const r = riskRes.recordset[0];
        risks = {
            open: r.open_count || 0,
            mitigated_closed_period: r.mitigated_closed_period || 0,
            high_priority: r.high_priority || 0,
        };
    } catch (_) { /* fallback a 0 */ }

    try {
        const prevReq = pool.request().input('orgId', orgId).input('reviewId', reviewId).input('dateFrom', periodFrom);
        if (companyId) prevReq.input('companyId', companyId);
        const companyCond = companyId ? 'AND company_id = @companyId' : '';
        const prevRes = await prevReq.query(`
            SELECT TOP (1) review_number, review_date, output_improvements, output_sgq_changes, output_resources
            FROM management_reviews
            WHERE organization_id = @orgId AND is_deleted = 0 AND id <> @reviewId
              AND review_date < @dateFrom ${companyCond}
            ORDER BY review_date DESC, created_at DESC
        `);
        if (prevRes.recordset.length) {
            const pr = prevRes.recordset[0];
            prevReview = {
                review_number: pr.review_number || null,
                review_date: pr.review_date ? new Date(pr.review_date).toISOString().slice(0, 10) : null,
                output_improvements: pr.output_improvements || null,
                output_sgq_changes: pr.output_sgq_changes || null,
                output_resources: pr.output_resources || null,
            };
        }
    } catch (_) { /* fallback null */ }

    // Tenta AI se configurata
    let aiText = null;
    try {
        const aiAdapter = require('../services/aiProviderAdapter');
        const prevReviewLine = prevReview
            ? `Riesame precedente (${prevReview.review_number || 's.n.'} del ${prevReview.review_date || 'n.d.'}): ` +
              `miglioramenti="${(prevReview.output_improvements || 'n.d.').slice(0, 300)}"; ` +
              `modifiche SGQ="${(prevReview.output_sgq_changes || 'n.d.').slice(0, 300)}"; ` +
              `risorse="${(prevReview.output_resources || 'n.d.').slice(0, 300)}"`
            : 'Nessun riesame precedente registrato.';
        const prompt = `Sei un consulente ISO 9001. Dati del periodo ${periodFrom} - ${periodTo}:
- NC aperte: ${nc.open}, scadute: ${nc.overdue}, chiuse nel periodo: ${nc.total_closed_period}
- Obiettivi raggiunti: ${objectives.percentage}% (${objectives.achieved}/${objectives.total})
- Audit condotti: ${audits.conducted}
- Fornitori valutati: ${suppliers.evaluated}${suppliers.avg_score != null ? `, score medio: ${suppliers.avg_score}` : ''}
- Rischi aperti: ${risks.open}, di cui ad alta priorità: ${risks.high_priority}; rischi mitigati/chiusi nel periodo: ${risks.mitigated_closed_period}
- Azioni da precedenti riesami: ${prevReviewLine}
- Clausole senza evidenza di verifica nell'ultimo anno: ${normGaps.length > 0 ? normGaps.join(', ') : 'nessuna'}

Genera testi concisi per la sezione §9.3.2 del riesame di direzione ISO 9001, in italiano, stile tecnico-formale, max 120 parole per sezione.
Per "previous_actions_summary" sintetizza lo stato di avanzamento delle azioni definite nel riesame precedente; se non c'è un riesame precedente, indicalo esplicitamente.
Per "risks_summary" valuta l'efficacia delle azioni intraprese per affrontare rischi e opportunità.
Rispondi SOLO con JSON con questa struttura:
{"nc_summary":"...","objectives_summary":"...","audits_summary":"...","suppliers_summary":"...","risks_summary":"...","previous_actions_summary":"...","norm_gaps":"..."}`;

        const result = await aiAdapter.chat(
            [{ role: 'user', content: prompt }],
            { responseFormat: 'json', maxTokens: 800, temperature: 0.3 }
        );
        aiText = typeof result.content === 'string' ? JSON.parse(result.content) : result.content;
    } catch (aiErr) {
        if (aiErr.code !== 'AI_NOT_CONFIGURED') {
            logger.warn('generateDraft AI error (usando fallback deterministico):', aiErr.message);
        }
    }

    // Draft deterministico (usato se AI non disponibile o fallisce)
    const gapsText = normGaps.length > 0
        ? `Le seguenti clausole non presentano evidenze di verifica nell'ultimo anno: ${normGaps.join(', ')}.`
        : 'Tutte le clausole principali risultano coperte da audit nell\'ultimo anno.';

    const risksText = `Nel periodo risultano ${risks.open} rischi aperti` +
        (risks.high_priority > 0 ? `, di cui ${risks.high_priority} ad alta priorità` : '') +
        `. Sono stati mitigati o chiusi ${risks.mitigated_closed_period} rischi. ` +
        (risks.open === 0
            ? 'Non risultano rischi aperti al momento del riesame.'
            : (risks.high_priority > 0
                ? 'Le azioni di trattamento dei rischi ad alta priorità sono monitorate per verificarne l\'efficacia.'
                : 'I rischi aperti sono presidiati secondo le azioni di trattamento definite.'));

    const previousActionsText = prevReview
        ? `Stato delle azioni dal precedente riesame ${prevReview.review_number || ''}`.trim() +
            (prevReview.review_date ? ` (del ${prevReview.review_date})` : '') + ':\n' +
            `- Miglioramenti: ${prevReview.output_improvements || 'da aggiornare'}\n` +
            `- Modifiche al SGQ: ${prevReview.output_sgq_changes || 'da aggiornare'}\n` +
            `- Risorse: ${prevReview.output_resources || 'da aggiornare'}`
        : 'Non risulta un riesame di direzione precedente nel periodo considerato: non vi sono azioni pregresse da verificare.';

    const drafts = aiText || {
        nc_summary: `Nel periodo ${periodFrom} – ${periodTo} sono state rilevate ${nc.open} non conformità ancora aperte` +
            (nc.overdue > 0 ? `, di cui ${nc.overdue} scadute` : '') +
            `. Nel periodo sono state chiuse ${nc.total_closed_period} NC. ` +
            (nc.open === 0 ? 'Non risultano NC aperte al momento del riesame.' : 'Le NC aperte sono in fase di gestione secondo le procedure vigenti.'),

        objectives_summary: `Degli ${objectives.total} obiettivi per la qualità monitorati, ${objectives.achieved} risultano raggiunti (${objectives.percentage}%). ` +
            (objectives.percentage >= 80
                ? 'Il livello di raggiungimento degli obiettivi è soddisfacente.'
                : 'Sono previste azioni di miglioramento per gli obiettivi non ancora raggiunti.'),

        audits_summary: `Nel periodo sono stati condotti ${audits.conducted} audit intern${audits.conducted === 1 ? 'o' : 'i'}. ` +
            'I risultati degli audit sono stati analizzati e le eventuali NC rilevate sono state gestite attraverso le procedure di azione correttiva.',

        suppliers_summary: suppliers.evaluated > 0
            ? `Sono stati valutati ${suppliers.evaluated} fornitori nel periodo` +
              (suppliers.avg_score != null ? ` con uno score medio di ${suppliers.avg_score}/100` : '') +
              '. Le valutazioni confermano il livello di qualificazione dei fornitori critici.'
            : 'Non sono state effettuate valutazioni formali di fornitori nel periodo in esame.',

        risks_summary: risksText,

        previous_actions_summary: previousActionsText,

        norm_gaps: gapsText,
    };

    res.json({ success: true, drafts, meta: { period_from: periodFrom, period_to: periodTo, ai_used: !!aiText } });
}

// ─── GENERA OUTPUT §9.3.3 ─────────────────────────────────────────────────────

/**
 * POST /management-reviews/:id/generate-outputs
 * Genera una proposta di OUTPUT del riesame (§9.3.3): decisioni e azioni su
 *   a) opportunità di miglioramento     → output_improvements
 *   b) modifiche al sistema di gestione  → output_sgq_changes
 *   c) fabbisogno di risorse             → output_resources
 *
 * A differenza di generate-draft (che sintetizza i dati aggregati per gli INPUT
 * §9.3.2), questo endpoint parte dagli INPUT compilati del riesame: usa i valori
 * correnti del form passati in `body.inputs` (così include anche modifiche non
 * ancora salvate) e, in mancanza, i campi salvati nel record. Usa AI se
 * configurata, altrimenti un fallback deterministico sempre presente.
 *
 * Body: { company_id?, period_from?, period_to?, inputs?: { input_*: string } }
 */
async function generateOutputs(req, res) {
    const pool  = await getPool();
    const orgId = req.user.organization_id;
    const reviewId = parseInt(req.params.id, 10);

    const today = new Date();
    const periodFrom = req.body.period_from || `${today.getFullYear()}-01-01`;
    const periodTo   = req.body.period_to   || today.toISOString().slice(0, 10);
    const companyId  = req.body.company_id  ? parseInt(req.body.company_id, 10) : null;

    // Verifica appartenenza all'org e carica gli input §9.3.2 salvati
    let saved = null;
    try {
        const chk = await pool.request()
            .input('id',    reviewId)
            .input('orgId', orgId)
            .query(`
                SELECT input_previous_actions, input_context_changes, input_audits,
                       input_nc_corrective, input_objectives, input_complaints,
                       input_customer_satisfaction, input_suppliers, input_resources,
                       input_improvements, input_process_performance, input_risk_effectiveness
                FROM management_reviews
                WHERE id=@id AND organization_id=@orgId AND is_deleted=0
            `);
        if (!chk.recordset.length) {
            return res.status(404).json({ success: false, error: 'Riesame non trovato.' });
        }
        saved = chk.recordset[0];
    } catch (err) {
        logger.error('generateOutputs check review:', err.message);
        return res.status(500).json({ success: false, error: 'Errore interno.' });
    }

    // Merge: i valori correnti del form (body.inputs) prevalgono sui salvati
    const bodyInputs = (req.body.inputs && typeof req.body.inputs === 'object') ? req.body.inputs : {};
    const inputFields = [
        'input_previous_actions', 'input_context_changes', 'input_audits', 'input_nc_corrective',
        'input_objectives', 'input_complaints', 'input_customer_satisfaction', 'input_suppliers',
        'input_resources', 'input_improvements', 'input_process_performance', 'input_risk_effectiveness',
    ];
    const inputs = {};
    inputFields.forEach((f) => {
        const fromBody = bodyInputs[f];
        inputs[f] = (typeof fromBody === 'string' && fromBody.trim())
            ? fromBody.trim()
            : (saved[f] || '');
    });

    // Metriche aggregate leggere per arricchire il fallback deterministico
    let nc         = { open: 0, overdue: 0 };
    let objectives = { total: 0, achieved: 0, percentage: 0 };
    let risks      = { open: 0, high_priority: 0 };

    try {
        const companyCond = companyId ? 'AND a.company_id = @companyId' : '';
        const ncReq = pool.request().input('orgId', orgId);
        if (companyId) ncReq.input('companyId', companyId);
        const ncRes = await ncReq.query(`
            SELECT
                SUM(CASE WHEN nc.status NOT IN ('closed','verified') THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN nc.status NOT IN ('closed','verified') AND nc.due_date < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END) AS overdue_count
            FROM non_conformities nc
            LEFT JOIN audits a ON nc.audit_id = a.audit_id
            WHERE COALESCE(a.organization_id, nc.organization_id) = @orgId ${companyCond}
        `);
        const r = ncRes.recordset[0];
        nc = { open: r.open_count || 0, overdue: r.overdue_count || 0 };
    } catch (_) { /* fallback a 0 */ }

    try {
        const objRes = await pool.request().input('orgId', orgId).query(`
            SELECT COUNT(*) AS total, SUM(CASE WHEN status='achieved' THEN 1 ELSE 0 END) AS achieved
            FROM objectives WHERE organization_id=@orgId AND is_deleted=0
        `);
        const r = objRes.recordset[0];
        const total = r.total || 0; const achieved = r.achieved || 0;
        objectives = { total, achieved, percentage: total > 0 ? Math.round((achieved / total) * 100) : 0 };
    } catch (_) { /* fallback a 0 */ }

    try {
        const riskReq = pool.request().input('orgId', orgId);
        if (companyId) riskReq.input('companyId', companyId);
        const companyCond = companyId ? 'AND company_id = @companyId' : '';
        const riskRes = await riskReq.query(`
            SELECT
                SUM(CASE WHEN status IN ('open','in_treatment') THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN status IN ('open','in_treatment') AND (probability * impact) >= 6 THEN 1 ELSE 0 END) AS high_priority
            FROM risks
            WHERE organization_id = @orgId AND is_deleted = 0 ${companyCond}
        `);
        const r = riskRes.recordset[0];
        risks = { open: r.open_count || 0, high_priority: r.high_priority || 0 };
    } catch (_) { /* fallback a 0 */ }

    // Tenta AI se configurata
    let aiOutputs = null;
    try {
        const aiAdapter = require('../services/aiProviderAdapter');
        const digest = [
            `a) Azioni da precedenti riesami: ${(inputs.input_previous_actions || 'n.d.').slice(0, 400)}`,
            `b) Cambiamenti del contesto: ${(inputs.input_context_changes || 'n.d.').slice(0, 400)}`,
            `Risultati audit interni: ${(inputs.input_audits || 'n.d.').slice(0, 300)}`,
            `Non conformità e azioni correttive: ${(inputs.input_nc_corrective || 'n.d.').slice(0, 300)}`,
            `Stato obiettivi qualità: ${(inputs.input_objectives || 'n.d.').slice(0, 300)}`,
            `Prestazioni dei processi: ${(inputs.input_process_performance || 'n.d.').slice(0, 300)}`,
            `Soddisfazione cliente/feedback: ${(inputs.input_customer_satisfaction || 'n.d.').slice(0, 300)}`,
            `Prestazioni fornitori esterni: ${(inputs.input_suppliers || 'n.d.').slice(0, 300)}`,
            `Adeguatezza delle risorse: ${(inputs.input_resources || 'n.d.').slice(0, 300)}`,
            `Efficacia azioni su rischi e opportunità: ${(inputs.input_risk_effectiveness || 'n.d.').slice(0, 300)}`,
            `Opportunità di miglioramento: ${(inputs.input_improvements || 'n.d.').slice(0, 300)}`,
        ].join('\n');
        const prompt = `Sei un consulente ISO 9001. Sulla base degli INPUT del riesame di direzione (§9.3.2) riportati sotto, redigi gli OUTPUT del riesame (§9.3.3): decisioni e azioni concrete e azionabili.
Dati sintetici del periodo ${periodFrom} - ${periodTo}: NC aperte ${nc.open} (di cui scadute ${nc.overdue}); obiettivi raggiunti ${objectives.percentage}% (${objectives.achieved}/${objectives.total}); rischi aperti ${risks.open}, di cui ad alta priorità ${risks.high_priority}.

INPUT §9.3.2:
${digest}

Genera, in italiano, stile tecnico-formale, max 120 parole per voce:
- output_improvements: decisioni e azioni relative alle opportunità di miglioramento (§9.3.3-a)
- output_sgq_changes: ogni esigenza di modifica al sistema di gestione per la qualità (§9.3.3-b)
- output_resources: il fabbisogno di risorse deliberato (§9.3.3-c)
Rispondi SOLO con JSON con questa struttura:
{"output_improvements":"...","output_sgq_changes":"...","output_resources":"..."}`;

        const result = await aiAdapter.chat(
            [{ role: 'user', content: prompt }],
            { responseFormat: 'json', maxTokens: 700, temperature: 0.3 }
        );
        aiOutputs = typeof result.content === 'string' ? JSON.parse(result.content) : result.content;
    } catch (aiErr) {
        if (aiErr.code !== 'AI_NOT_CONFIGURED') {
            logger.warn('generateOutputs AI error (usando fallback deterministico):', aiErr.message);
        }
    }

    // Output deterministici (usati se AI non disponibile o fallisce)
    const objShortfall = objectives.total > 0 && objectives.percentage < 100;

    const improvementsText =
        `Sulla base di ${nc.open} non conformità aperte` +
        (nc.overdue > 0 ? ` (di cui ${nc.overdue} scadute)` : '') +
        ` e di un grado di raggiungimento degli obiettivi pari al ${objectives.percentage}%, ` +
        'si decide di dare seguito alle opportunità di miglioramento individuate' +
        (inputs.input_improvements ? `: ${inputs.input_improvements.slice(0, 300)}.` : ' nel corso del riesame.') +
        ' Le relative azioni saranno pianificate con responsabilità e tempistiche definite e verificate al prossimo riesame.';

    const sgqChangesText =
        (inputs.input_context_changes
            ? `In relazione ai cambiamenti del contesto rilevati (${inputs.input_context_changes.slice(0, 200)}), `
            : 'Non emergono cambiamenti del contesto tali da imporre modifiche sostanziali al SGQ; ') +
        (risks.open > 0
            ? `si valuta l'aggiornamento di procedure e documenti coerente con i ${risks.open} rischi aperti` +
              (risks.high_priority > 0 ? ` (di cui ${risks.high_priority} ad alta priorità).` : '.')
            : 'si conferma l\'adeguatezza dell\'attuale assetto documentale del SGQ.') +
        ' Le modifiche approvate saranno recepite nella documentazione di sistema.';

    const resourcesText =
        (inputs.input_resources
            ? `Dall'analisi dell'adeguatezza delle risorse (${inputs.input_resources.slice(0, 200)}), `
            : 'Dall\'analisi delle risorse disponibili, ') +
        (objShortfall || nc.open > 0
            ? 'si delibera di destinare risorse aggiuntive (umane, formative e/o infrastrutturali) a supporto degli obiettivi non ancora raggiunti e della gestione delle non conformità aperte.'
            : 'le risorse attuali risultano adeguate al mantenimento del SGQ; si conferma il piano di formazione e manutenzione in essere.');

    const outputs = aiOutputs || {
        output_improvements: improvementsText,
        output_sgq_changes:  sgqChangesText,
        output_resources:    resourcesText,
    };

    res.json({ success: true, outputs, meta: { period_from: periodFrom, period_to: periodTo, ai_used: !!aiOutputs } });
}

module.exports = { listReviews, getOneReview, createReview, updateReview, deleteReview, getInputSummary, generateDraft, generateOutputs };
