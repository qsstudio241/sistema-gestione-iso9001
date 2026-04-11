/**
 * risks.controller.js — Registro Rischi & Obiettivi ISO 9001 §6.1 + §6.2
 * Sprint 6
 */

const { getPool } = require('../config/database');
const logger      = require('../utils/logger');

// score (priorità) = probability × impact  →  1-9
function riskScore(p, i) { return (p || 1) * (i || 1); }

// ─── RISKS ──────────────────────────────────────────────────────────────────

async function listRisks(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const { status, context, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = ['r.organization_id = @orgId', 'r.is_deleted = 0'];
        const req2 = pool.request().input('orgId', orgId).input('limit', parseInt(limit)).input('offset', offset);

        if (status)  { where.push('r.status = @status');   req2.input('status', status); }
        if (context) { where.push('r.context = @context'); req2.input('context', context); }

        const whereClause = where.join(' AND ');

        const [dataRes, countRes] = await Promise.all([
            req2.query(`
                SELECT r.*, u.full_name AS created_by_name
                FROM risks r
                LEFT JOIN users u ON u.user_id = r.created_by
                WHERE ${whereClause}
                ORDER BY (r.probability * r.impact) DESC, r.created_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `),
            pool.request().input('orgId2', orgId)
                .query(`SELECT COUNT(*) AS total FROM risks r WHERE r.organization_id = @orgId2 AND r.is_deleted = 0`)
        ]);

        const data = dataRes.recordset.map(r => ({ ...r, score: riskScore(r.probability, r.impact) }));
        res.json({ success: true, data, pagination: { page: parseInt(page), limit: parseInt(limit), total: countRes.recordset[0].total } });
    } catch (err) {
        logger.error('listRisks:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getRiskStats(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const r = await pool.request().input('orgId', orgId).query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
                SUM(CASE WHEN status = 'in_treatment' THEN 1 ELSE 0 END) AS in_treatment,
                SUM(CASE WHEN status = 'mitigated' THEN 1 ELSE 0 END) AS mitigated,
                SUM(CASE WHEN (probability * impact) >= 6 THEN 1 ELSE 0 END) AS high_priority
            FROM risks WHERE organization_id = @orgId AND is_deleted = 0
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
            .query('SELECT * FROM risks WHERE risk_id = @id AND organization_id = @orgId AND is_deleted = 0');
        if (!r.recordset.length) return res.status(404).json({ error: 'Rischio non trovato' });
        res.json({ success: true, data: { ...r.recordset[0], score: riskScore(r.recordset[0].probability, r.recordset[0].impact) } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function createRisk(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const userId = req.user.user_id;
        const { title, description, context = 'internal', category, probability = 2, impact = 2, treatment = 'mitigate', treatment_desc, responsible, review_date, company_id } = req.body;

        if (!title) return res.status(400).json({ error: 'Titolo obbligatorio' });

        const r = await pool.request()
            .input('orgId', orgId).input('userId', userId)
            .input('title', title).input('description', description || null)
            .input('context', context).input('category', category || null)
            .input('probability', parseInt(probability)).input('impact', parseInt(impact))
            .input('treatment', treatment).input('treatment_desc', treatment_desc || null)
            .input('responsible', responsible || null).input('review_date', review_date || null)
            .input('company_id', company_id || null)
            .query(`
                INSERT INTO risks (organization_id, company_id, title, description, context, category,
                    probability, impact, treatment, treatment_desc, responsible, review_date, created_by)
                OUTPUT INSERTED.risk_id
                VALUES (@orgId, @company_id, @title, @description, @context, @category,
                    @probability, @impact, @treatment, @treatment_desc, @responsible, @review_date, @userId)
            `);

        logger.info('Risk created', { risk_id: r.recordset[0].risk_id, orgId });
        res.status(201).json({ success: true, data: { risk_id: r.recordset[0].risk_id } });
    } catch (err) {
        logger.error('createRisk:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function updateRisk(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);
        const { title, description, context, category, probability, impact, treatment, treatment_desc, responsible, review_date, status } = req.body;

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT risk_id FROM risks WHERE risk_id = @id AND organization_id = @orgId AND is_deleted = 0');
        if (!check.recordset.length) return res.status(404).json({ error: 'Rischio non trovato' });

        const sets = ['updated_at = GETDATE()'];
        const req2 = pool.request().input('id', id);
        if (title         !== undefined) { sets.push('title = @title');                 req2.input('title', title); }
        if (description   !== undefined) { sets.push('description = @description');     req2.input('description', description); }
        if (context       !== undefined) { sets.push('context = @context');             req2.input('context', context); }
        if (category      !== undefined) { sets.push('category = @category');           req2.input('category', category); }
        if (probability   !== undefined) { sets.push('probability = @probability');     req2.input('probability', parseInt(probability)); }
        if (impact        !== undefined) { sets.push('impact = @impact');               req2.input('impact', parseInt(impact)); }
        if (treatment     !== undefined) { sets.push('treatment = @treatment');         req2.input('treatment', treatment); }
        if (treatment_desc!== undefined) { sets.push('treatment_desc = @treatment_desc'); req2.input('treatment_desc', treatment_desc); }
        if (responsible   !== undefined) { sets.push('responsible = @responsible');     req2.input('responsible', responsible); }
        if (review_date   !== undefined) { sets.push('review_date = @review_date');     req2.input('review_date', review_date); }
        if (status        !== undefined) { sets.push('status = @status');               req2.input('status', status); }

        await req2.query(`UPDATE risks SET ${sets.join(', ')} WHERE risk_id = @id`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function deleteRisk(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);
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
        const { status, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = ['o.organization_id = @orgId', 'o.is_deleted = 0'];
        const req2 = pool.request().input('orgId', orgId).input('limit', parseInt(limit)).input('offset', offset);
        if (status) { where.push('o.status = @status'); req2.input('status', status); }

        const [dataRes, countRes] = await Promise.all([
            req2.query(`
                SELECT o.*, u.full_name AS created_by_name
                FROM objectives o
                LEFT JOIN users u ON u.user_id = o.created_by
                WHERE ${where.join(' AND ')}
                ORDER BY o.due_date ASC, o.created_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `),
            pool.request().input('orgId2', orgId)
                .query('SELECT COUNT(*) AS total FROM objectives WHERE organization_id = @orgId2 AND is_deleted = 0')
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
        const req2 = pool.request().input('id', id);
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

        await req2.query(`UPDATE objectives SET ${sets.join(', ')} WHERE objective_id = @id`);
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
