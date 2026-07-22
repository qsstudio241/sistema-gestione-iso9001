/**
 * interestedParties.controller.js — Parti interessate §4.2 ISO 9001
 */

const { getPool } = require('../config/database');
const logger      = require('../utils/logger');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
    assertMutatingAllowed,
    sendAccessDenied,
} = require('../services/companyAccess.service');

async function listInterestedParties(req, res) {
    try {
        const pool       = await getPool();
        const orgId      = req.user.organization_id;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const cf         = companyAccessSqlFilter(accessList, 'p');
        const { is_active, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const where = ['p.organization_id = @orgId'];
        if (cf.clause) where.push(cf.clause);
        if (is_active !== undefined) where.push('p.is_active = @is_active');

        const req2 = pool.request()
            .input('orgId', orgId)
            .input('limit', parseInt(limit))
            .input('offset', offset);
        Object.entries(cf.params).forEach(([k, v]) => req2.input(k, v));
        if (is_active !== undefined) req2.input('is_active', is_active === 'false' ? 0 : 1);

        const [dataRes, countRes] = await Promise.all([
            req2.query(`
                SELECT * FROM interested_parties p
                WHERE ${where.join(' AND ')}
                ORDER BY p.name ASC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `),
            (() => {
                const cr = pool.request().input('orgId2', orgId);
                Object.entries(cf.params).forEach(([k, v]) => cr.input(k, v));
                const cw = ['p.organization_id = @orgId2'];
                if (cf.clause) cw.push(cf.clause);
                return cr.query(`SELECT COUNT(*) AS total FROM interested_parties p WHERE ${cw.join(' AND ')}`);
            })(),
        ]);

        res.json({ success: true, data: dataRes.recordset, pagination: { page: parseInt(page), limit: parseInt(limit), total: countRes.recordset[0].total } });
    } catch (err) {
        logger.error('listInterestedParties:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function getOneInterestedParty(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const r = await pool.request()
            .input('id', parseInt(req.params.id))
            .input('orgId', orgId)
            .query('SELECT * FROM interested_parties WHERE id = @id AND organization_id = @orgId');
        if (!r.recordset.length) return res.status(404).json({ error: 'Parte interessata non trovata' });
        res.json({ success: true, data: r.recordset[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function createInterestedParty(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const { name, relationship, requirements, company_id } = req.body;

        if (!name) return res.status(400).json({ error: 'Nome obbligatorio' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const r = await pool.request()
            .input('orgId', orgId)
            .input('company_id', company_id || null)
            .input('name', name)
            .input('relationship', relationship || null)
            .input('requirements', requirements || null)
            .query(`
                INSERT INTO interested_parties (organization_id, company_id, name, relationship, requirements)
                OUTPUT INSERTED.id
                VALUES (@orgId, @company_id, @name, @relationship, @requirements)
            `);

        logger.info('InterestedParty created', { id: r.recordset[0].id, orgId });
        res.status(201).json({ success: true, data: { id: r.recordset[0].id } });
    } catch (err) {
        logger.error('createInterestedParty:', err.message);
        res.status(500).json({ error: err.message });
    }
}

async function updateInterestedParty(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);
        const { name, relationship, requirements, is_active } = req.body;

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT company_id FROM interested_parties WHERE id = @id AND organization_id = @orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Parte interessata non trovata' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const sets = ['updated_at = GETDATE()'];
        const req2 = pool.request().input('id', id).input('orgId', orgId);
        if (name         !== undefined) { sets.push('name = @name');                 req2.input('name', name); }
        if (relationship !== undefined) { sets.push('relationship = @relationship'); req2.input('relationship', relationship); }
        if (requirements !== undefined) { sets.push('requirements = @requirements'); req2.input('requirements', requirements); }
        if (is_active    !== undefined) { sets.push('is_active = @is_active');       req2.input('is_active', is_active ? 1 : 0); }

        await req2.query(`UPDATE interested_parties SET ${sets.join(', ')} WHERE id = @id AND organization_id = @orgId`);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function deleteInterestedParty(req, res) {
    try {
        const pool  = await getPool();
        const orgId = req.user.organization_id;
        const id    = parseInt(req.params.id);

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query('SELECT company_id FROM interested_parties WHERE id = @id AND organization_id = @orgId');
        if (!check.recordset.length) return res.status(404).json({ error: 'Parte interessata non trovata' });

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: check.recordset[0].company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        await pool.request().input('id', id).input('orgId', orgId)
            .query('DELETE FROM interested_parties WHERE id = @id AND organization_id = @orgId');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = { listInterestedParties, getOneInterestedParty, createInterestedParty, updateInterestedParty, deleteInterestedParty };
