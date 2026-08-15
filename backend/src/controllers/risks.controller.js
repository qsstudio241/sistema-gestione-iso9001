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
const {
    parsePgFactor,
    parseOptionalPgFactor,
    decorateRiskRow,
    normalizePgMax,
    normalizeResidualPair,
    normalizeMethod,
    normalizeSwotQuadrant,
    normalizeImpactSign,
    DEFAULT_PG_MAX,
} = require('../utils/riskScore');
const { detectRisksM03File, buildM03TemplateBuffer } = require('../utils/excelRisksM03Detector');
const {
    isSignificantReviewChange,
    mergeRiskReviewState,
    buildRiskReviewSnapshot,
    insertRiskReview,
} = require('../utils/riskReviews');

async function resolveCompanyPgMax(pool, companyId) {
    if (!companyId) return DEFAULT_PG_MAX;
    const r = await pool.request()
        .input('cid', parseInt(companyId, 10))
        .query('SELECT risk_pg_max FROM companies WHERE id = @cid');
    return normalizePgMax(r.recordset[0]?.risk_pg_max);
}

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
        const { status, context, company_id, include_closed, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const includeClosed = include_closed === '1' || include_closed === 'true';

        let where = ['r.organization_id = @orgId', 'r.is_deleted = 0'];
        if (companyFilter.clause) where.push(companyFilter.clause);
        const req2 = pool.request().input('orgId', orgId).input('limit', parseInt(limit)).input('offset', offset);
        Object.entries(companyFilter.params).forEach(([k, v]) => req2.input(k, v));

        if (status)     { where.push('r.status = @status');       req2.input('status', status); }
        else if (!includeClosed) { where.push("r.status <> 'closed'"); }
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
                       r.residual_probability, r.residual_impact, r.effectiveness_note,
                       r.analysis_method, r.swot_quadrant, r.impact_sign,
                       r.created_by, r.created_at, r.updated_at,
                       u.full_name AS created_by_name,
                       c.name AS company_name,
                       c.risk_pg_max
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
                else if (!includeClosed) cntWhere.push("r.status <> 'closed'");
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
                SUM(CASE WHEN (r.probability * r.impact) >=
                    ((ISNULL(c.risk_pg_max, 3) * ISNULL(c.risk_pg_max, 3)) * 2 / 3)
                    THEN 1 ELSE 0 END) AS high_priority
            FROM risks r
            LEFT JOIN companies c ON c.id = r.company_id
            WHERE r.organization_id = @orgId AND r.is_deleted = 0${whereExtra}
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
            .query(`SELECT r.risk_id, r.organization_id, r.company_id, r.title, r.description, r.context, r.category,
                           r.probability, r.impact, r.treatment, r.treatment_desc, r.responsible, r.review_date,
                           r.status, r.nature, r.evaluated_element, r.context_text, r.interested_parties_text,
                           r.current_actions, r.further_actions,
                           r.residual_probability, r.residual_impact, r.effectiveness_note,
                           r.analysis_method, r.swot_quadrant, r.impact_sign,
                           r.created_by, r.created_at, r.updated_at, c.risk_pg_max
                    FROM risks r
                    LEFT JOIN companies c ON c.id = r.company_id
                    WHERE r.risk_id = @id AND r.organization_id = @orgId AND r.is_deleted = 0`);
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
            residual_probability, residual_impact, effectiveness_note,
            analysis_method, swot_quadrant, impact_sign,
        } = req.body;

        if (!title) return res.status(400).json({ error: 'Titolo obbligatorio' });

        const pgMax = await resolveCompanyPgMax(pool, company_id);
        const pParsed = parsePgFactor(probability, 2, pgMax);
        const gParsed = parsePgFactor(impact, 2, pgMax);
        if (!pParsed.ok) return res.status(400).json({ error: pParsed.error });
        if (!gParsed.ok) return res.status(400).json({ error: gParsed.error });
        const rpParsed = parseOptionalPgFactor(residual_probability, pgMax);
        const rgParsed = parseOptionalPgFactor(residual_impact, pgMax);
        if (!rpParsed.ok) return res.status(400).json({ error: rpParsed.error });
        if (!rgParsed.ok) return res.status(400).json({ error: rgParsed.error });

        const validNature = ['risk', 'opportunity'];
        const safeNature  = validNature.includes(nature) ? nature : 'risk';
        const safeMethod = normalizeMethod(analysis_method);
        const safeQuadrant = safeMethod === 'swot_signed' ? normalizeSwotQuadrant(swot_quadrant) : null;
        const safeSign = safeMethod === 'swot_signed' ? normalizeImpactSign(impact_sign) : 1;

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
            .input('residual_probability', rpParsed.value)
            .input('residual_impact', rgParsed.value)
            .input('effectiveness_note', emptyToNull(effectiveness_note))
            .input('analysis_method', safeMethod)
            .input('swot_quadrant', safeQuadrant)
            .input('impact_sign', safeSign)
            .query(`
                INSERT INTO risks (organization_id, company_id, title, description, context, category,
                    probability, impact, treatment, treatment_desc, responsible, review_date, created_by, nature,
                    evaluated_element, context_text, interested_parties_text, current_actions, further_actions,
                    residual_probability, residual_impact, effectiveness_note,
                    analysis_method, swot_quadrant, impact_sign)
                OUTPUT INSERTED.risk_id, INSERTED.probability, INSERTED.impact,
                       INSERTED.residual_probability, INSERTED.residual_impact,
                       INSERTED.analysis_method, INSERTED.swot_quadrant, INSERTED.impact_sign
                VALUES (@orgId, @company_id, @title, @description, @context, @category,
                    @probability, @impact, @treatment, @treatment_desc, @responsible, @review_date, @userId, @nature,
                    @evaluated_element, @context_text, @interested_parties_text, @current_actions, @further_actions,
                    @residual_probability, @residual_impact, @effectiveness_note,
                    @analysis_method, @swot_quadrant, @impact_sign)
            `);

        const created = decorateRiskRow({ ...r.recordset[0], risk_pg_max: pgMax });
        await insertRiskReview(pool, buildRiskReviewSnapshot({
            ...created,
            title,
            evaluated_element,
            nature: safeNature,
            current_actions,
            further_actions,
            effectiveness_note,
            residual_probability: rpParsed.value,
            residual_impact: rgParsed.value,
            analysis_method: safeMethod,
            swot_quadrant: safeQuadrant,
            impact_sign: safeSign,
        }, { organization_id: orgId, company_id: company_id || null, recorded_by: userId }));
        logger.info('Risk created', { risk_id: created.risk_id, orgId, score: created.score });
        res.status(201).json({ success: true, data: created });
    } catch (err) {
        logger.error('createRisk:', err.message);
        if (err.number === 547) {
            return res.status(400).json({ error: 'Valore non ammesso (vincolo CHECK). P e G devono essere interi nella scala dell\'azienda.' });
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
            residual_probability, residual_impact, effectiveness_note,
            analysis_method, swot_quadrant, impact_sign,
        } = req.body;

        const check = await pool.request().input('id', id).input('orgId', orgId)
            .query(`SELECT risk_id, company_id, organization_id, title, evaluated_element, nature,
                           probability, impact, impact_sign, analysis_method, swot_quadrant,
                           residual_probability, residual_impact, effectiveness_note,
                           current_actions, further_actions
                    FROM risks WHERE risk_id = @id AND organization_id = @orgId AND is_deleted = 0`);
        if (!check.recordset.length) return res.status(404).json({ error: 'Rischio non trovato' });
        const prev = check.recordset[0];

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: prev.company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);
        const hasPgValue = (v) => v !== undefined && v !== null && v !== '';
        const needsPg = hasPgValue(probability) || hasPgValue(impact)
            || hasPgValue(residual_probability) || hasPgValue(residual_impact);
        const pgMax = needsPg
            ? await resolveCompanyPgMax(pool, prev.company_id)
            : DEFAULT_PG_MAX;

        const sets = ['updated_at = GETDATE()'];
        const patch = {};
        // orgId incluso nel request per defense-in-depth: il WHERE finale lo riapplica
        const req2 = pool.request().input('id', id).input('orgId', orgId);
        if (title         !== undefined) { sets.push('title = @title');                 req2.input('title', title); patch.title = title; }
        if (description   !== undefined) { sets.push('description = @description');     req2.input('description', description); }
        if (context       !== undefined) { sets.push('context = @context');             req2.input('context', context); }
        if (category      !== undefined) { sets.push('category = @category');           req2.input('category', category); }
        if (probability !== undefined) {
            const pParsed = parsePgFactor(probability, undefined, pgMax);
            if (!pParsed.ok) return res.status(400).json({ error: pParsed.error });
            sets.push('probability = @probability');
            req2.input('probability', pParsed.value);
            patch.probability = pParsed.value;
        }
        if (impact !== undefined) {
            const gParsed = parsePgFactor(impact, undefined, pgMax);
            if (!gParsed.ok) return res.status(400).json({ error: gParsed.error });
            sets.push('impact = @impact');
            req2.input('impact', gParsed.value);
            patch.impact = gParsed.value;
        }
        if (evaluated_element !== undefined) { sets.push('evaluated_element = @evaluated_element'); req2.input('evaluated_element', emptyToNull(evaluated_element)); patch.evaluated_element = emptyToNull(evaluated_element); }
        if (context_text !== undefined) { sets.push('context_text = @context_text'); req2.input('context_text', emptyToNull(context_text)); }
        if (interested_parties_text !== undefined) { sets.push('interested_parties_text = @interested_parties_text'); req2.input('interested_parties_text', emptyToNull(interested_parties_text)); }
        if (current_actions !== undefined) { sets.push('current_actions = @current_actions'); req2.input('current_actions', emptyToNull(current_actions)); patch.current_actions = emptyToNull(current_actions); }
        if (further_actions !== undefined) { sets.push('further_actions = @further_actions'); req2.input('further_actions', emptyToNull(further_actions)); patch.further_actions = emptyToNull(further_actions); }
        if (residual_probability !== undefined) {
            const rpParsed = parseOptionalPgFactor(residual_probability, pgMax);
            if (!rpParsed.ok) return res.status(400).json({ error: rpParsed.error });
            sets.push('residual_probability = @residual_probability');
            req2.input('residual_probability', rpParsed.value);
            patch.residual_probability = rpParsed.value;
        }
        if (residual_impact !== undefined) {
            const rgParsed = parseOptionalPgFactor(residual_impact, pgMax);
            if (!rgParsed.ok) return res.status(400).json({ error: rgParsed.error });
            sets.push('residual_impact = @residual_impact');
            req2.input('residual_impact', rgParsed.value);
            patch.residual_impact = rgParsed.value;
        }
        if (effectiveness_note !== undefined) { sets.push('effectiveness_note = @effectiveness_note'); req2.input('effectiveness_note', emptyToNull(effectiveness_note)); patch.effectiveness_note = emptyToNull(effectiveness_note); }
        if (treatment     !== undefined) { sets.push('treatment = @treatment');         req2.input('treatment', treatment); }
        if (treatment_desc!== undefined) { sets.push('treatment_desc = @treatment_desc'); req2.input('treatment_desc', treatment_desc); }
        if (responsible   !== undefined) { sets.push('responsible = @responsible');     req2.input('responsible', responsible); }
        if (review_date   !== undefined) { sets.push('review_date = @review_date');     req2.input('review_date', emptyToNull(review_date)); }
        if (status        !== undefined) { sets.push('status = @status');               req2.input('status', status); }
        if (nature        !== undefined) {
            const validNature = ['risk', 'opportunity'];
            const safeNature  = validNature.includes(nature) ? nature : 'risk';
            sets.push('nature = @nature');
            req2.input('nature', safeNature);
            patch.nature = safeNature;
        }
        if (analysis_method !== undefined) {
            const safeMethod = normalizeMethod(analysis_method);
            sets.push('analysis_method = @analysis_method');
            req2.input('analysis_method', safeMethod);
            patch.analysis_method = safeMethod;
            if (safeMethod !== 'swot_signed') {
                sets.push('swot_quadrant = NULL');
                sets.push('impact_sign = 1');
                patch.swot_quadrant = null;
                patch.impact_sign = 1;
            }
        }
        if (swot_quadrant !== undefined) {
            sets.push('swot_quadrant = @swot_quadrant');
            req2.input('swot_quadrant', normalizeSwotQuadrant(swot_quadrant));
            patch.swot_quadrant = normalizeSwotQuadrant(swot_quadrant);
        }
        if (impact_sign !== undefined) {
            sets.push('impact_sign = @impact_sign');
            req2.input('impact_sign', normalizeImpactSign(impact_sign));
            patch.impact_sign = normalizeImpactSign(impact_sign);
        }

        await req2.query(`UPDATE risks SET ${sets.join(', ')} WHERE risk_id = @id AND organization_id = @orgId`);
        const next = mergeRiskReviewState(prev, patch);
        if (isSignificantReviewChange(prev, next)) {
            await insertRiskReview(pool, buildRiskReviewSnapshot(next, {
                organization_id: orgId,
                company_id: prev.company_id,
                recorded_by: req.user.user_id,
            }));
        }
        res.json({ success: true });
    } catch (err) {
        if (err.number === 547) {
            return res.status(400).json({ error: 'Valore non ammesso (vincolo CHECK). P e G devono essere interi nella scala dell\'azienda.' });
        }
        res.status(500).json({ error: err.message });
    }
}

async function listRiskReviews(req, res) {
    try {
        const pool = await getPool();
        const orgId = req.user.organization_id;
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
            return res.status(400).json({ error: 'Id non valido' });
        }
        const head = await pool.request().input('id', id).input('orgId', orgId)
            .query(`SELECT r.risk_id, c.risk_pg_max
                    FROM risks r
                    LEFT JOIN companies c ON c.id = r.company_id
                    WHERE r.risk_id = @id AND r.organization_id = @orgId AND r.is_deleted = 0`);
        if (!head.recordset.length) return res.status(404).json({ error: 'Rischio non trovato' });
        const pgMax = normalizePgMax(head.recordset[0].risk_pg_max);
        const hist = await pool.request().input('id', id).input('orgId', orgId)
            .query(`
                SELECT rv.id, rv.risk_id, rv.organization_id, rv.company_id, rv.title, rv.evaluated_element,
                       rv.nature, rv.probability, rv.impact, rv.impact_sign, rv.analysis_method, rv.swot_quadrant,
                       rv.residual_probability, rv.residual_impact, rv.effectiveness_note,
                       rv.current_actions, rv.further_actions, rv.recorded_at, rv.recorded_by,
                       u.full_name AS recorded_by_name
                FROM risk_reviews rv
                INNER JOIN risks r ON r.risk_id = rv.risk_id AND r.organization_id = @orgId
                LEFT JOIN users u ON u.user_id = rv.recorded_by
                WHERE rv.risk_id = @id
                ORDER BY rv.recorded_at DESC, rv.id DESC
            `);
        const data = hist.recordset.map((row) => decorateRiskRow({ ...row, risk_pg_max: pgMax }));
        return res.json({ success: true, data });
    } catch (err) {
        logger.error('listRiskReviews:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

async function detectRisksImport(req, res) {
    try {
        const file = req.file;
        if (!file || !file.buffer) {
            return res.status(400).json({ error: 'File Excel mancante', code: 'MISSING_FILE' });
        }
        let mapping = null;
        if (req.body?.mapping) {
            try {
                mapping = typeof req.body.mapping === 'string'
                    ? JSON.parse(req.body.mapping)
                    : req.body.mapping;
            } catch {
                return res.status(400).json({ error: 'Mapping colonne non valido', code: 'INVALID_MAPPING' });
            }
        }
        let pgMax = normalizePgMax(req.body?.pgMax);
        if (req.body?.company_id) {
            const pool = await getPool();
            pgMax = await resolveCompanyPgMax(pool, req.body.company_id);
            if (req.body.pgMax) pgMax = normalizePgMax(req.body.pgMax);
        }
        const detection = detectRisksM03File(file.buffer, {
            sheetName: req.body?.sheetName || null,
            mapping: mapping && typeof mapping === 'object' ? mapping : null,
            pgMax,
        });
        return res.json({
            success: true,
            data: {
                ...detection,
                fileName: file.originalname || 'm03.xlsx',
            },
        });
    } catch (err) {
        logger.error('detectRisksImport:', err.message);
        return res.status(500).json({ error: 'Errore analisi Excel', code: 'RISKS_DETECT_FAILED' });
    }
}

async function importRisks(req, res) {
    try {
        const pool = await getPool();
        const orgId = req.user.organization_id;
        const userId = req.user.user_id;
        const company_id = req.body.company_id || null;
        const rows = Array.isArray(req.body.rows) ? req.body.rows : [];

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);
        const pgMax = await resolveCompanyPgMax(pool, company_id);

        let inserted = 0;
        let skipped = 0;
        const createdIds = [];

        for (const row of rows) {
            if (row?.action === 'skip') {
                skipped += 1;
                continue;
            }
            const pParsed = parsePgFactor(row?.probability, undefined, pgMax);
            const gParsed = parsePgFactor(row?.impact, undefined, pgMax);
            if (!pParsed.ok || !gParsed.ok) {
                skipped += 1;
                continue;
            }
            const rpParsed = parseOptionalPgFactor(row?.residual_probability, pgMax);
            const rgParsed = parseOptionalPgFactor(row?.residual_impact, pgMax);
            if (!rpParsed.ok || !rgParsed.ok) {
                skipped += 1;
                continue;
            }
            const residualPair = normalizeResidualPair(rpParsed.value, rgParsed.value);
            const title = emptyToNull(row?.title) || emptyToNull(row?.evaluated_element) || `Valutazione riga ${row?.excelRow || inserted + 1}`;
            const safeMethod = normalizeMethod(row?.analysis_method);
            const safeQuadrant = safeMethod === 'swot_signed' ? normalizeSwotQuadrant(row?.swot_quadrant) : null;
            const safeSign = safeMethod === 'swot_signed' ? normalizeImpactSign(row?.impact_sign) : 1;
            const r = await pool.request()
                .input('orgId', orgId).input('userId', userId)
                .input('title', String(title).slice(0, 200))
                .input('description', null)
                .input('context', 'internal').input('category', null)
                .input('probability', pParsed.value).input('impact', gParsed.value)
                .input('treatment', 'mitigate').input('treatment_desc', null)
                .input('responsible', emptyToNull(row?.responsible))
                .input('review_date', emptyToNull(row?.review_date))
                .input('company_id', company_id)
                .input('nature', row?.nature === 'opportunity' ? 'opportunity' : 'risk')
                .input('evaluated_element', emptyToNull(row?.evaluated_element))
                .input('context_text', emptyToNull(row?.context_text))
                .input('interested_parties_text', emptyToNull(row?.interested_parties_text))
                .input('current_actions', emptyToNull(row?.current_actions))
                .input('further_actions', emptyToNull(row?.further_actions))
                .input('residual_probability', residualPair.residual_probability)
                .input('residual_impact', residualPair.residual_impact)
                .input('effectiveness_note', emptyToNull(row?.effectiveness_note))
                .input('analysis_method', safeMethod)
                .input('swot_quadrant', safeQuadrant)
                .input('impact_sign', safeSign)
                .query(`
                    INSERT INTO risks (organization_id, company_id, title, description, context, category,
                        probability, impact, treatment, treatment_desc, responsible, review_date, created_by, nature,
                        evaluated_element, context_text, interested_parties_text, current_actions, further_actions,
                        residual_probability, residual_impact, effectiveness_note,
                        analysis_method, swot_quadrant, impact_sign)
                    OUTPUT INSERTED.risk_id
                    VALUES (@orgId, @company_id, @title, @description, @context, @category,
                        @probability, @impact, @treatment, @treatment_desc, @responsible, @review_date, @userId, @nature,
                        @evaluated_element, @context_text, @interested_parties_text, @current_actions, @further_actions,
                        @residual_probability, @residual_impact, @effectiveness_note,
                        @analysis_method, @swot_quadrant, @impact_sign)
                `);
            createdIds.push(r.recordset[0].risk_id);
            await insertRiskReview(pool, buildRiskReviewSnapshot({
                risk_id: r.recordset[0].risk_id,
                title: String(title).slice(0, 200),
                evaluated_element: emptyToNull(row?.evaluated_element),
                nature: ['risk', 'opportunity'].includes(row?.nature) ? row.nature : 'risk',
                probability: pParsed.value,
                impact: gParsed.value,
                impact_sign: safeSign,
                analysis_method: safeMethod,
                swot_quadrant: safeQuadrant,
                residual_probability: residualPair.residual_probability,
                residual_impact: residualPair.residual_impact,
                effectiveness_note: emptyToNull(row?.effectiveness_note),
                current_actions: emptyToNull(row?.current_actions),
                further_actions: emptyToNull(row?.further_actions),
            }, { organization_id: orgId, company_id, recorded_by: userId }));
            inserted += 1;
        }

        logger.info('Risks M03 import', { orgId, inserted, skipped, fileName: req.body.fileName });
        return res.json({ success: true, data: { inserted, skipped, risk_ids: createdIds } });
    } catch (err) {
        logger.error('importRisks:', err.message);
        if (err.number === 547) {
            return res.status(400).json({ error: 'Valore non ammesso (vincolo CHECK). P e G devono essere interi nella scala dell\'azienda.' });
        }
        return res.status(500).json({ error: err.message });
    }
}

async function downloadM03Template(req, res) {
    try {
        const buf = buildM03TemplateBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="M03-analisi-rischi-opportunita.xlsx"');
        return res.send(buf);
    } catch (err) {
        logger.error('downloadM03Template:', err.message);
        return res.status(500).json({ error: 'Errore generazione modello' });
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

async function setCompanyPgScale(req, res) {
    try {
        const pool = await getPool();
        const companyId = parseInt(req.body?.company_id, 10);
        const pgMax = normalizePgMax(req.body?.risk_pg_max);
        if (!companyId) {
            return res.status(400).json({ error: 'Seleziona un\'azienda per impostare la scala P/G.', code: 'COMPANY_REQUIRED' });
        }
        if (![3, 4, 5].includes(Number(req.body?.risk_pg_max))) {
            return res.status(400).json({ error: 'Scala P/G ammessa: 1–3, 1–4 o 1–5.', code: 'INVALID_PG_MAX' });
        }
        const writeDenied = await assertMutatingAllowed(req.user, { companyId });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const used = await pool.request().input('cid', companyId).query(`
            SELECT MAX(v) AS used_max FROM (
                SELECT probability AS v FROM risks WHERE company_id = @cid AND is_deleted = 0
                UNION ALL SELECT impact FROM risks WHERE company_id = @cid AND is_deleted = 0
                UNION ALL SELECT residual_probability FROM risks
                    WHERE company_id = @cid AND is_deleted = 0 AND residual_probability IS NOT NULL
                UNION ALL SELECT residual_impact FROM risks
                    WHERE company_id = @cid AND is_deleted = 0 AND residual_impact IS NOT NULL
            ) x
        `);
        const usedMax = used.recordset[0]?.used_max || 0;
        if (usedMax > pgMax) {
            return res.status(400).json({
                error: `Ci sono valutazioni con P/G = ${usedMax}. Non puoi scendere sotto 1–${usedMax}.`,
                code: 'PG_SCALE_IN_USE',
                used_max: usedMax,
            });
        }

        await pool.request()
            .input('cid', companyId)
            .input('pgMax', pgMax)
            .query('UPDATE companies SET risk_pg_max = @pgMax, updated_at = GETDATE() WHERE id = @cid');

        return res.json({ success: true, data: { company_id: companyId, risk_pg_max: pgMax, used_max: usedMax } });
    } catch (err) {
        logger.error('setCompanyPgScale:', err.message);
        return res.status(500).json({ error: err.message });
    }
}

module.exports = {
    listRisks, getRiskStats, getOneRisk, createRisk, updateRisk, deleteRisk,
    listRiskReviews,
    detectRisksImport, importRisks, downloadM03Template, setCompanyPgScale,
    listObjectives, getObjectiveStats, getOneObjective, createObjective, updateObjective, deleteObjective
};
