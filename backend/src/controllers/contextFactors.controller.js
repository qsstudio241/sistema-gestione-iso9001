/**
 * contextFactors.controller.js — Fattori di contesto §4.1 ISO 9001
 */

const { getPool } = require('../config/database');
const logger      = require('../utils/logger');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
    assertMutatingAllowed,
    sendAccessDenied,
} = require('../services/companyAccess.service');

const VALID_TYPES   = ['internal', 'external'];
const VALID_IMPACTS = ['positive', 'negative', 'neutral'];

async function listContextFactors(req, res) {
    try {
        const pool       = await getPool();
        const orgId      = req.user.organization_id;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const cf         = companyAccessSqlFilter(accessList, 'f');
        const { type, is_active, company_id, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = ['f.organization_id = @orgId'];
        if (cf.clause) where.push(cf.clause);
        if (type)      { where.push('f.type = @type'); }
        if (is_active !== undefined) { where.push('f.is_active = @is_active'); }
        if (company_id) { where.push('f.company_id = @companyId'); }

        const req2 = pool.request()
            .input('orgId', orgId)
            .input('limit', parseInt(limit))
            .input('offset', offset);
        Object.entries(cf.params).forEach(([k, v]) => req2.input(k, v));
        if (type)       req2.input('type', type);
        if (is_active !== undefined) req2.input('is_active', is_active === 'false' ? 0 : 1);
        if (company_id) req2.input('companyId', parseInt(company_id));

        const [dataRes, countRes] = await Promise.all([
            req2.query(`
                SELECT f.*, c.name AS company_name
                FROM context_factors f
                LEFT JOIN companies c ON c.id = f.company_id
                WHERE ${where.join(' AND ')}
                ORDER BY f.type, f.created_at DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `),
            (() => {
                const cr = pool.request().input('orgId2', orgId);
                Object.entries(cf.params).forEach(([k, v]) => cr.input(k, v));
                const cw = ['f.organization_id = @orgId2'];
                if (cf.clause) cw.push(cf.clause);
                if (type)       { cr.input('cntType', type); cw.push('f.type = @cntType'); }
                if (company_id) { cr.input('cntCompanyId', parseInt(company_id)); cw.push('f.company_id = @cntCompanyId'); }
                return cr.query(`SELECT COUNT(*) AS total FROM context_factors f WHERE ${cw.join(' AND ')}`);
            })(),
        ]);

        res.json({ success: true, data: dataRes.recordset, pagination: { page: parseInt(page), limit: parseInt(limit), total: countRes.recordset[0].total } });
    } catch (err) {
        logger.error('listContextFactors:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getOneContextFactor(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const r = await pool.request()
            .input('id', parseInt(req.params.id))
            .input('orgId', orgId)
            .query('SELECT * FROM context_factors WHERE id = @id AND organization_id = @orgId');
        if (!r.recordset.length) return res.status(404).json({ error: 'Fattore non trovato' });
        res.json({ success: true, data: r.recordset[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function createContextFactor(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const { description, type = 'external', category, impact = 'neutral', company_id } = req.body;

        if (!description) return res.status(400).json({ error: 'Descrizione obbligatoria' });
        if (!VALID_TYPES.includes(type))   return res.status(400).json({ error: 'type non valido' });
        if (!VALID_IMPACTS.includes(impact)) return res.status(400).json({ error: 'impact non valido' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const r = await pool.request()
            .input('orgId', orgId)
            .input('company_id', company_id || null)
            .input('type', type)
            .input('category', category || null)
            .input('description', description)
            .input('impact', impact)
            .query(`
                INSERT INTO context_factors (organization_id, company_id, type, category, description, impact)
                OUTPUT INSERTED.id
                VALUES (@orgId, @company_id, @type, @category, @description, @impact)
            `);

        logger.info('ContextFactor created', { id: r.recordset[0].id, orgId });
        res.status(201).json({ success: true, data: { id: r.recordset[0].id } });
    } catch (err) {
        logger.error('createContextFactor:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function updateContextFactor(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);
        const { description, type, category, impact, is_active } = req.body;

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT company_id FROM context_factors WHERE id = @id AND organization_id = @orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Fattore non trovato' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const sets = ['updated_at = GETDATE()'];
        const req2 = pool.request().input('id', id).input('orgId', orgId);
        if (description !== undefined) { sets.push('description = @description'); req2.input('description', description); }
        if (type        !== undefined && VALID_TYPES.includes(type))   { sets.push('type = @type');   req2.input('type', type); }
        if (category    !== undefined) { sets.push('category = @category');       req2.input('category', category); }
        if (impact      !== undefined && VALID_IMPACTS.includes(impact)) { sets.push('impact = @impact'); req2.input('impact', impact); }
        if (is_active   !== undefined) { sets.push('is_active = @is_active');     req2.input('is_active', is_active ? 1 : 0); }

        await req2.query(`UPDATE context_factors SET ${sets.join(', ')} WHERE id = @id AND organization_id = @orgId`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function deleteContextFactor(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT company_id FROM context_factors WHERE id = @id AND organization_id = @orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Fattore non trovato' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        await pool.request().input('id', id).input('orgId', orgId)
            .query('DELETE FROM context_factors WHERE id = @id AND organization_id = @orgId');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = { listContextFactors, getOneContextFactor, createContextFactor, updateContextFactor, deleteContextFactor };
