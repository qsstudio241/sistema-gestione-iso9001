/**
 * risks.controller.js — Registro Rischi & Obiettivi ISO 9001 §6.1 + §6.2
 * Sprint 6
 */

const { getPool } = require('../config/database');
const logger      = require('../utils/logger');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
    assertMutatingAllowed,
    sendAccessDenied,
} = require('../services/companyAccess.service');
const { parsePgFactor, decorateRiskRow } = require('../utils/riskScore');

function emptyToNull(v) {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
}

// ─── RISKS ──────────────────────────────────────────────────────────────────

async function listRisks(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'r');
        const { status, context, company_id, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = ['r.organization_id = @orgId', 'r.is_deleted = 0'];
        if (companyFilter.clause) where.push(companyFilter.clause);
        const req2 = pool.request().input('orgId', orgId).input('limit', parseInt(limit)).input('offset', offset);
        Object.entries(companyFilter.params).forEach(([k, v]) => req2.input(k, v));

        if (status)     { where.push('r.status = @status');       req2.input('status', status); }
        if (context)    { where.push('r.context = @context');     req2.input('context', context); }
        if (company_id) { where.push('r.company_id = @companyId'); req2.input('companyId', parseInt(company_id)); }

        const whereClause = where.join(' AND ');

        const [dataRes, countRes] = await Promise.all([
            req2.query(`
                SELECT r.risk_id, r.organization_id, r.company_id, r.title, r.description,
                       r.context, r.category, r.probability, r.impact, r.treatment,
                       r.treatment_desc, r.responsible, r.review_date, r.status,
                       r.nature, r.evaluated_element, r.context_text, r.interested_parties_text,
                       r.current_actions, r.further_actions,
                       r.created_by, r.created_at, r.updated_at,
                       u.full_name AS created_by_name,
                       c.name AS company_name
                FROM risks r
                LEFT JOIN users u ON u.user_id = r.created_by
                LEFT JOIN companies c ON c.id = r.company_id
                WHERE ${whereClause}
                ORDER BY (r.probability * r.impact) DESC, r.created_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `),
            (() => {
                const cntReq = pool.request().input('orgId2', orgId);
                Object.entries(companyFilter.params).forEach(([k, v]) => cntReq.input(k, v));
                if (status)     cntReq.input('cntStatus', status);
                if (context)    cntReq.input('cntContext', context);
                if (company_id) cntReq.input('cntCompanyId', parseInt(company_id));
                const cntWhere = ['r.organization_id = @orgId2', 'r.is_deleted = 0'];
                if (companyFilter.clause) cntWhere.push(companyFilter.clause);
                if (status)     cntWhere.push('r.status = @cntStatus');
                if (context)    cntWhere.push('r.context = @cntContext');
                if (company_id) cntWhere.push('r.company_id = @cntCompanyId');
                return cntReq.query(`SELECT COUNT(*) AS total FROM risks r WHERE ${cntWhere.join(' AND ')}`);
            })(),
        ]);

        const data = dataRes.recordset.map(decorateRiskRow);
        res.json({ success: true, data, pagination: { page: parseInt(page), limit: parseInt(limit), total: countRes.recordset[0].total } });
    } catch (err) {
        logger.error('listRisks:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getRiskStats(req, res) {
    try {
        const pool       = await getPool();
        const orgId      = req.user.organization_id;
        const { company_id } = req.query;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'r');
        let whereExtra = companyFilter.clause ? ` AND ${companyFilter.clause}` : '';
        const req2 = pool.request().input('orgId', orgId);
        Object.entries(companyFilter.params).forEach(([k, v]) => req2.input(k, v));
        if (company_id) {
            whereExtra += ' AND r.company_id = @scopeCompanyId';
            req2.input('scopeCompanyId', parseInt(company_id, 10));
        }
        const r = await req2.query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS [open],
                SUM(CASE WHEN status = 'in_treatment' THEN 1 ELSE 0 END) AS in_treatment,
                SUM(CASE WHEN status = 'mitigated' THEN 1 ELSE 0 END) AS mitigated,
                SUM(CASE WHEN (probability * impact) >= 6 THEN 1 ELSE 0 END) AS high_priority
            FROM risks r WHERE r.organization_id = @orgId AND r.is_deleted = 0${whereExtra}
        `);
        res.json({ success: true, data: r.recordset[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getOneRisk(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const r = await pool.request()
            .input('id', parseInt(req.params.id))
            .input('orgId', orgId)
            .query(`SELECT risk_id, organization_id, company_id, title, description, context, category,
                           probability, impact, treatment, treatment_desc, responsible, review_date,
                           status, nature, evaluated_element, context_text, interested_parties_text,
                           current_actions, further_actions, created_by, created_at, updated_at
                    FROM risks WHERE risk_id = @id AND organization_id = @orgId AND is_deleted = 0`);
        if (!r.recordset.length) return res.status(404).json({ error: 'Rischio non trovato' });
        res.json({ success: true, data: decorateRiskRow(r.recordset[0]) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function createRisk(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const userId = req.user.user_id;
        const {
            title, description, context = 'internal', category,
            probability = 2, impact = 2, treatment = 'mitigate', treatment_desc,
            responsible, review_date, company_id, nature,
            evaluated_element, context_text, interested_parties_text,
            current_actions, further_actions,
        } = req.body;

        if (!title) return res.status(400).json({ error: 'Titolo obbligatorio' });

        const pParsed = parsePgFactor(probability, 2);
        const gParsed = parsePgFactor(impact, 2);
        if (!pParsed.ok) return res.status(400).json({ error: pParsed.error });
        if (!gParsed.ok) return res.status(400).json({ error: gParsed.error });

        const validNature = ['risk', 'opportunity'];
        const safeNature  = validNature.includes(nature) ? nature : 'risk';

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const r = await pool.request()
            .input('orgId', orgId).input('userId', userId)
            .input('title', title).input('description', description || null)
            .input('context', context).input('category', category || null)
            .input('probability', pParsed.value).input('impact', gParsed.value)
            .input('treatment', treatment).input('treatment_desc', treatment_desc || null)
            .input('responsible', responsible || null).input('review_date', review_date || null)
            .input('company_id', company_id || null).input('nature', safeNature)
            .input('evaluated_element', emptyToNull(evaluated_element))
            .input('context_text', emptyToNull(context_text))
            .input('interested_parties_text', emptyToNull(interested_parties_text))
            .input('current_actions', emptyToNull(current_actions))
            .input('further_actions', emptyToNull(further_actions))
            .query(`
                INSERT INTO risks (organization_id, company_id, title, description, context, category,
                    probability, impact, treatment, treatment_desc, responsible, review_date, created_by, nature,
                    evaluated_element, context_text, interested_parties_text, current_actions, further_actions)
                OUTPUT INSERTED.risk_id, INSERTED.probability, INSERTED.impact
                VALUES (@orgId, @company_id, @title, @description, @context, @category,
                    @probability, @impact, @treatment, @treatment_desc, @responsible, @review_date, @userId, @nature,
                    @evaluated_element, @context_text, @interested_parties_text, @current_actions, @further_actions)
            `);

        const created = decorateRiskRow(r.recordset[0]);
        logger.info('Risk created', { risk_id: created.risk_id, orgId, score: created.score });
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        logger.error('createRisk:', err.message);
        if (err.number === 547) {
            return res.status(400).json({ error: 'Valore non ammesso (vincolo CHECK). P e G devono essere interi 1–3.' });
        }
        res.status(500).json({ error: err.message });
    }
}

async function updateRisk(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);
        const {
            title, description, context, category, probability, impact, treatment, treatment_desc,
            responsible, review_date, status, nature,
            evaluated_element, context_text, interested_parties_text, current_actions, further_actions,
        } = req.body;

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT risk_id, company_id FROM risks WHERE risk_id = @id AND organization_id = @orgId AND is_deleted = 0');
        if (!check.recordset.length) return res.status(404).json({ error: 'Rischio non trovato' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const sets = ['updated_at = GETDATE()'];
        // orgId incluso nel request per defense-in-depth: il WHERE finale lo riapplica
        const req2 = pool.request().input('id', id).input('orgId', orgId);
        if (title         !== undefined) { sets.push('title = @title');                 req2.input('title', title); }
        if (description   !== undefined) { sets.push('description = @description');     req2.input('description', description); }
        if (context       !== undefined) { sets.push('context = @context');             req2.input('context', context); }
        if (category      !== undefined) { sets.push('category = @category');           req2.input('category', category); }
        if (probability !== undefined) {
            const pParsed = parsePgFactor(probability);
            if (!pParsed.ok) return res.status(400).json({ error: pParsed.error });
            sets.push('probability = @probability');
            req2.input('probability', pParsed.value);
        }
        if (impact !== undefined) {
            const gParsed = parsePgFactor(impact);
            if (!gParsed.ok) return res.status(400).json({ error: gParsed.error });
            sets.push('impact = @impact');
            req2.input('impact', gParsed.value);
        }
        if (evaluated_element !== undefined) { sets.push('evaluated_element = @evaluated_element'); req2.input('evaluated_element', emptyToNull(evaluated_element)); }
        if (context_text !== undefined) { sets.push('context_text = @context_text'); req2.input('context_text', emptyToNull(context_text)); }
        if (interested_parties_text !== undefined) { sets.push('interested_parties_text = @interested_parties_text'); req2.input('interested_parties_text', emptyToNull(interested_parties_text)); }
        if (current_actions !== undefined) { sets.push('current_actions = @current_actions'); req2.input('current_actions', emptyToNull(current_actions)); }
        if (further_actions !== undefined) { sets.push('further_actions = @further_actions'); req2.input('further_actions', emptyToNull(further_actions)); }
        if (treatment     !== undefined) { sets.push('treatment = @treatment');         req2.input('treatment', treatment); }
        if (treatment_desc!== undefined) { sets.push('treatment_desc = @treatment_desc'); req2.input('treatment_desc', treatment_desc); }
        if (responsible   !== undefined) { sets.push('responsible = @responsible');     req2.input('responsible', responsible); }
        if (review_date   !== undefined) { sets.push('review_date = @review_date');     req2.input('review_date', review_date); }
        if (status        !== undefined) { sets.push('status = @status');               req2.input('status', status); }
        if (nature        !== undefined) {
            const validNature = ['risk', 'opportunity'];
            const safeNature  = validNature.includes(nature) ? nature : 'risk';
            sets.push('nature = @nature');
            req2.input('nature', safeNature);
        }

        await req2.query(`UPDATE risks SET ${sets.join(', ')} WHERE risk_id = @id AND organization_id = @orgId`);
        res.json({ success: true });
    } catch (err) {
        if (err.number === 547) {
            return res.status(400).json({ error: 'Valore non ammesso (vincolo CHECK). P e G devono essere interi 1–3.' });
        }
        res.status(500).json({ error: err.message });
    }
}

async function deleteRisk(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT company_id FROM risks WHERE risk_id = @id AND organization_id = @orgId AND is_deleted = 0');
        if (!check.recordset.length) return res.status(404).json({ error: 'Rischio non trovato' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        await pool.request().input('id', id).input('orgId', orgId)
            .query('UPDATE risks SET is_deleted = 1, updated_at = GETDATE() WHERE risk_id = @id AND organization_id = @orgId');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ─── OBJECTIVES ─────────────────────────────────────────────────────────────

async function listObjectives(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'o');
        const { status, company_id, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = ['o.organization_id = @orgId', 'o.is_deleted = 0'];
        if (companyFilter.clause) where.push(companyFilter.clause);
        const req2 = pool.request().input('orgId', orgId).input('limit', parseInt(limit)).input('offset', offset);
        Object.entries(companyFilter.params).forEach(([k, v]) => req2.input(k, v));
        if (status)     { where.push('o.status = @status');       req2.input('status', status); }
        if (company_id) { where.push('o.company_id = @companyId'); req2.input('companyId', parseInt(company_id)); }

        const [dataRes, countRes] = await Promise.all([
            req2.query(`
                SELECT o.*, u.full_name AS created_by_name, c.name AS company_name
                FROM objectives o
                LEFT JOIN users u ON u.user_id = o.created_by
                LEFT JOIN companies c ON c.id = o.company_id
                WHERE ${where.join(' AND ')}
                ORDER BY o.due_date ASC, o.created_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `),
            (() => {
                const cntReq = pool.request().input('orgId2', orgId);
                Object.entries(companyFilter.params).forEach(([k, v]) => cntReq.input(k, v));
                if (status)     cntReq.input('cntStatus', status);
                if (company_id) cntReq.input('cntCompanyId', parseInt(company_id));
                const cntWhere = ['o.organization_id = @orgId2', 'o.is_deleted = 0'];
                if (companyFilter.clause) cntWhere.push(companyFilter.clause);
                if (status)     cntWhere.push('o.status = @cntStatus');
                if (company_id) cntWhere.push('o.company_id = @cntCompanyId');
                return cntReq.query(`SELECT COUNT(*) AS total FROM objectives o WHERE ${cntWhere.join(' AND ')}`);
            })(),
        ]);

        res.json({ success: true, data: dataRes.recordset, pagination: { page: parseInt(page), limit: parseInt(limit), total: countRes.recordset[0].total } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getObjectiveStats(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const r = await pool.request().input('orgId', orgId).query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'active'    THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN status = 'achieved'  THEN 1 ELSE 0 END) AS achieved,
                SUM(CASE WHEN due_date < CAST(GETDATE() AS DATE) AND status = 'active' THEN 1 ELSE 0 END) AS overdue,
                AVG(CAST(progress_pct AS FLOAT)) AS avg_progress
            FROM objectives WHERE organization_id = @orgId AND is_deleted = 0
        `);
        res.json({ success: true, data: r.recordset[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getOneObjective(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const r = await pool.request().input('id', parseInt(req.params.id)).input('orgId', orgId)
            .query('SELECT * FROM objectives WHERE objective_id = @id AND organization_id = @orgId AND is_deleted = 0');
        if (!r.recordset.length) return res.status(404).json({ error: 'Obiettivo non trovato' });
        res.json({ success: true, data: r.recordset[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function createObjective(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const userId = req.user.user_id;
        const { title, description, iso_clause, kpi_description, target_value, current_value, progress_pct = 0, responsible, due_date, company_id } = req.body;

        if (!title) return res.status(400).json({ error: 'Titolo obbligatorio' });

        const r = await pool.request()
            .input('orgId', orgId).input('userId', userId)
            .input('title', title).input('description', description || null)
            .input('iso_clause', iso_clause || null).input('kpi_description', kpi_description || null)
            .input('target_value', target_value || null).input('current_value', current_value || null)
            .input('progress_pct', parseInt(progress_pct)).input('responsible', responsible || null)
            .input('due_date', due_date || null).input('company_id', company_id || null)
            .query(`
                INSERT INTO objectives (organization_id, company_id, title, description, iso_clause,
                    kpi_description, target_value, current_value, progress_pct, responsible, due_date, created_by)
                OUTPUT INSERTED.objective_id
                VALUES (@orgId, @company_id, @title, @description, @iso_clause,
                    @kpi_description, @target_value, @current_value, @progress_pct, @responsible, @due_date, @userId)
            `);

        res.status(201).json({ success: true, data: { objective_id: r.recordset[0].objective_id } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function updateObjective(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);
        const { title, description, iso_clause, kpi_description, target_value, current_value, progress_pct, responsible, due_date, status } = req.body;

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT objective_id FROM objectives WHERE objective_id = @id AND organization_id = @orgId AND is_deleted = 0');
        if (!check.recordset.length) return res.status(404).json({ error: 'Obiettivo non trovato' });

        const sets = ['updated_at = GETDATE()'];
        // orgId incluso nel request per defense-in-depth: il WHERE finale lo riapplica
        const req2 = pool.request().input('id', id).input('orgId', orgId);
        if (title           !== undefined) { sets.push('title = @title');                       req2.input('title', title); }
        if (description     !== undefined) { sets.push('description = @description');           req2.input('description', description); }
        if (iso_clause      !== undefined) { sets.push('iso_clause = @iso_clause');             req2.input('iso_clause', iso_clause); }
        if (kpi_description !== undefined) { sets.push('kpi_description = @kpi_description');   req2.input('kpi_description', kpi_description); }
        if (target_value    !== undefined) { sets.push('target_value = @target_value');         req2.input('target_value', target_value); }
        if (current_value   !== undefined) { sets.push('current_value = @current_value');       req2.input('current_value', current_value); }
        if (progress_pct    !== undefined) { sets.push('progress_pct = @progress_pct');         req2.input('progress_pct', parseInt(progress_pct)); }
        if (responsible     !== undefined) { sets.push('responsible = @responsible');           req2.input('responsible', responsible); }
        if (due_date        !== undefined) { sets.push('due_date = @due_date');                 req2.input('due_date', due_date); }
        if (status          !== undefined) { sets.push('status = @status');                     req2.input('status', status); }

        await req2.query(`UPDATE objectives SET ${sets.join(', ')} WHERE objective_id = @id AND organization_id = @orgId`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function deleteObjective(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);
        await pool.request().input('id', id).input('orgId', orgId)
            .query('UPDATE objectives SET is_deleted = 1, updated_at = GETDATE() WHERE objective_id = @id AND organization_id = @orgId');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    listRisks, getRiskStats, getOneRisk, createRisk, updateRisk, deleteRisk,
    listObjectives, getObjectiveStats, getOneObjective, createObjective, updateObjective, deleteObjective
};
