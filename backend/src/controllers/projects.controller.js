/**
 * Projects Controller  -  CRUD Commesse/Progetti ISO 3834
 * Modulo Saldatura
 *
 * Tenant-isolated: ogni query filtra per organization_id dal JWT.
 */

const { query, getPool, sql } = require('../config/database');
const { logEntityChange, trashedDetailHidden, softDeleteSql } = require('../services/entityChangeLog.service');
const logger = require('../utils/logger');
const {
    ensureCompanyAccessLoaded,
    companyAccessSqlFilter,
    assertMutatingAllowed,
    assertCompanyRead,
    hasCompanyAccessRows,
    sendAccessDenied,
} = require('../services/companyAccess.service');

/** Utente con user_company_access: 403 fuori dalle aziende consentite.
 *  Studio senza aziende assegnate: lettura libera; scrittura no per il viewer. */
async function denyOutsideCompany(res, user, companyId, level = 'read') {
    const accessList = await ensureCompanyAccessLoaded(user);
    if (!hasCompanyAccessRows(accessList)) {
        if (level !== 'write') return false;
        const studioDenied = await assertMutatingAllowed(user, {});
        if (studioDenied) {
            sendAccessDenied(res, studioDenied);
            return true;
        }
        return false;
    }
    let denied;
    if (companyId == null || companyId === '') {
        denied = { status: 403, body: { error: 'Accesso non consentito', code: 'FORBIDDEN' } };
    } else if (level === 'write') {
        denied = await assertMutatingAllowed(user, { companyId });
    } else {
        denied = await assertCompanyRead(user, companyId);
    }
    if (denied) {
        sendAccessDenied(res, denied);
        return true;
    }
    return false;
}

/**
 * Id intero positivo. parseInt("1e2") è 1 e parseFloat("1e2") è 100:
 * lo stesso campo non può essere letto con due parser diversi.
 */
function strictPositiveInt(raw) {
    if (typeof raw === 'number') {
        if (!Number.isInteger(raw) || raw <= 0) return null;
        return raw;
    }
    const text = String(raw).trim();
    if (!/^[1-9]\d{0,8}$/.test(text)) return null;
    return parseInt(text, 10);
}

/**
 * Una stringa JSON (client in cache, o valore già annidato) è una lista di id,
 * non un id singolo. Gli elementi non numerici restano nella lista: li rifiuta
 * strictPositiveInt, come per un array inviato dal form.
 */
function unwrapWpsIdList(raw, depth = 0) {
    if (depth > 32) return { ok: false };
    if (Array.isArray(raw)) {
        const list = [];
        for (const item of raw) {
            if (typeof item === 'string' && /^\s*(\[|")/.test(item)) {
                const inner = unwrapWpsIdList(item, depth + 1);
                if (!inner.ok) return inner;
                list.push(...inner.list);
            } else {
                list.push(item);
            }
        }
        return { ok: true, list };
    }
    if (typeof raw === 'string') {
        const text = raw.trim();
        if (!text) return { ok: true, list: [] };
        if (text.startsWith('[') || (text.startsWith('"') && text.endsWith('"'))) {
            try {
                return unwrapWpsIdList(JSON.parse(text), depth + 1);
            } catch {
                return { ok: false };
            }
        }
        return { ok: true, list: [raw] };
    }
    return { ok: true, list: [raw] };
}

/**
 * WPS da collegare a una commessa. Assente nell'org → 404, azienda non
 * consentita → 403, e il chiamante non deve arrivare all'INSERT/UPDATE.
 * @returns {Promise<{ ok: boolean, json?: string|null }>}
 */
async function writableWpsIdsJson(res, user, organizationId, raw) {
    if (raw == null || raw === '') return { ok: true, json: null };
    const unwrapped = unwrapWpsIdList(raw);
    if (!unwrapped.ok) {
        res.status(400).json({ error: 'WPS di riferimento non valida', code: 'VALIDATION_ERROR' });
        return { ok: false };
    }
    const list = unwrapped.list;
    if (list.length === 0) return { ok: true, json: '[]' };
    const ids = [];
    for (const item of list) {
        const id = strictPositiveInt(item);
        if (id == null) {
            res.status(400).json({ error: 'WPS di riferimento non valida', code: 'VALIDATION_ERROR' });
            return { ok: false };
        }
        if (!ids.includes(id)) ids.push(id);
    }
    const params = { organization_id: organizationId };
    const placeholders = ids.map((id, i) => {
        params[`wps${i}`] = id;
        return `@wps${i}`;
    }).join(', ');
    const found = await query(`
        SELECT id, company_id FROM welding_procedures
        WHERE organization_id = @organization_id AND id IN (${placeholders})
    `, params);
    if (found.recordset.length !== ids.length) {
        res.status(404).json({ error: 'WPS di riferimento non trovata', code: 'WPS_NOT_FOUND' });
        return { ok: false };
    }
    for (const row of found.recordset) {
        if (await denyOutsideCompany(res, user, row.company_id, 'write')) return { ok: false };
    }
    return { ok: true, json: JSON.stringify(ids) };
}

/**
 * Selettore «Caso Riesame Requisiti» sulla commessa.
 * La colonna c'è già: niente migrazione. Il caso deve essere della stessa
 * azienda e non già collegato a un'altra commessa viva.
 * Campo assente nel body: non si tocca (il passaggio all'approvazione resta).
 * @returns {Promise<{ ok: boolean, skip?: boolean, id?: number|null }>}
 */
async function resolveCommercialCaseId(res, user, organizationId, raw, projectCompanyId, projectId) {
    if (raw === undefined) return { ok: true, skip: true };
    if (raw === null || raw === '') return { ok: true, id: null };

    const caseId = strictPositiveInt(raw);
    if (caseId == null) {
        res.status(400).json({ error: 'Caso di riesame non valido', code: 'VALIDATION_ERROR' });
        return { ok: false };
    }

    const found = await query(`
        SELECT id, company_id
        FROM commercial_cases
        WHERE id = @caseId AND organization_id = @organization_id
    `, { caseId, organization_id: organizationId });
    if (found.recordset.length === 0) {
        res.status(404).json({ error: 'Caso di riesame non trovato', code: 'CASE_NOT_FOUND' });
        return { ok: false };
    }

    const caseCompany = found.recordset[0].company_id != null
        ? Number(found.recordset[0].company_id)
        : null;
    const projectCompany = projectCompanyId != null && projectCompanyId !== ''
        ? Number(projectCompanyId)
        : null;
    if (!Number.isInteger(caseCompany) || !Number.isInteger(projectCompany) || caseCompany !== projectCompany) {
        res.status(409).json({
            error: 'Il caso di riesame deve essere della stessa azienda della commessa.',
            code: 'CASE_COMPANY_MISMATCH',
        });
        return { ok: false };
    }
    if (await denyOutsideCompany(res, user, caseCompany, 'write')) return { ok: false };

    const other = await query(`
        SELECT id
        FROM projects
        WHERE organization_id = @organization_id
          AND commercial_case_id = @caseId
          AND deleted_at IS NULL
          AND id <> ISNULL(@projectId, 0)
    `, {
        organization_id: organizationId,
        caseId,
        projectId: projectId || null,
    });
    if (other.recordset.length > 0) {
        res.status(409).json({
            error: 'Questo caso di riesame è già collegato a un\'altra commessa.',
            code: 'CASE_ALREADY_LINKED',
        });
        return { ok: false };
    }

    return { ok: true, id: caseId };
}

async function txQuery(transaction, text, params) {
    const req = new sql.Request(transaction);
    Object.entries(params || {}).forEach(([key, value]) => {
        req.input(key, value === undefined ? null : value);
    });
    return req.query(text);
}

/**
 * Stesso lucchetto del passaggio all'approvazione (sgq-handoff-studio-caso):
 * due salvataggi dello stesso caso non collegano due commesse vive.
 */
async function beginCaseLink(organizationId, caseId, projectId) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const lock = await txQuery(
            transaction,
            `
            DECLARE @lockResult INT;
            EXEC @lockResult = sp_getapplock
                @Resource = @lockResource,
                @LockMode = 'Exclusive',
                @LockOwner = 'Transaction',
                @LockTimeout = 10000;
            SELECT @lockResult AS lock_result;
            `,
            { lockResource: `sgq-handoff-${organizationId}-${caseId}` },
        );
        const lockResult = Number(lock.recordset[0] && lock.recordset[0].lock_result);
        if (!Number.isFinite(lockResult) || lockResult < 0) {
            await transaction.rollback();
            return {
                ok: false,
                status: 409,
                error: 'Il caso di riesame è in uso. Riprovare.',
                code: 'CASE_LINK_BUSY',
            };
        }
        const other = await txQuery(
            transaction,
            `
            SELECT id
            FROM projects
            WHERE organization_id = @organization_id
              AND commercial_case_id = @caseId
              AND deleted_at IS NULL
              AND id <> ISNULL(@projectId, 0)
            `,
            { organization_id: organizationId, caseId, projectId: projectId || null },
        );
        if (other.recordset.length > 0) {
            await transaction.rollback();
            return {
                ok: false,
                status: 409,
                error: 'Questo caso di riesame è già collegato a un\'altra commessa.',
                code: 'CASE_ALREADY_LINKED',
            };
        }
        return {
            ok: true,
            run: (text, params) => txQuery(transaction, text, params),
            commit: () => transaction.commit(),
            rollback: () => transaction.rollback(),
        };
    } catch (err) {
        try { await transaction.rollback(); } catch (_) { /* già chiusa */ }
        throw err;
    }
}

const {
    resolveCommercialCustomerFields,
} = require('../services/commercialCustomerCounterparty.service');
const { stampTechnicalReviewChecklistJson } = require('../utils/technicalReviewChecklist');
const { normalizeApplicableWpsIds } = require('../utils/applicableWpsIds');

/** JWT non include full_name: se manca, lo legge da users. */
async function userForReviewStamp(user) {
    if (!user) return { full_name: 'Utente' };
    if (user.full_name) return user;
    try {
        const r = await query(
            'SELECT full_name FROM users WHERE user_id = @user_id AND organization_id = @organization_id',
            { user_id: user.user_id, organization_id: user.organization_id }
        );
        return { ...user, full_name: r.recordset[0]?.full_name || user.email || 'Utente' };
    } catch {
        return { ...user, full_name: user.email || 'Utente' };
    }
}

// GET /projects
async function listProjects(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            search,
            status,
            company_id,
            page = 1,
            limit = 50,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'p');

        const conditions = ['p.organization_id = @organization_id', 'p.deleted_at IS NULL'];
        const params = { organization_id, limit: parseInt(limit), offset };
        Object.assign(params, companyFilter.params);

        if (companyFilter.clause) conditions.push(companyFilter.clause);
        if (search) {
            conditions.push(`(
                p.project_code LIKE @search OR p.client_name LIKE @search
                OR p.description LIKE @search
                OR EXISTS (
                    SELECT 1 FROM company_counterparties cps
                    WHERE cps.id = p.end_customer_id AND cps.name LIKE @search
                )
            )`);
            params.search = `%${search}%`;
        }
        if (status) {
            conditions.push('p.status = @status');
            params.status = status;
        }
        if (company_id) {
            conditions.push('p.company_id = @company_id');
            params.company_id = parseInt(company_id);
        }

        const where = conditions.join(' AND ');

        const result = await query(`
            SELECT
                p.*,
                c.name AS company_name,
                cp.name AS end_customer_name,
                cp.external_ref AS end_customer_ref,
                (SELECT COUNT(*) FROM project_welders pw
                 WHERE pw.project_id = p.id AND pw.organization_id = @organization_id
                   AND pw.deleted_at IS NULL
                ) AS welders_count
            FROM projects p
            LEFT JOIN companies c ON p.company_id = c.id
            LEFT JOIN company_counterparties cp ON cp.id = p.end_customer_id
            WHERE ${where}
            ORDER BY p.updated_at DESC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `, params);

        const countResult = await query(`
            SELECT COUNT(*) AS total
            FROM projects p
            WHERE ${where}
        `, params);

        const total = countResult.recordset[0].total;

        const data = result.recordset.map(row => {
            const wpsCount = normalizeApplicableWpsIds(row.applicable_wps_ids).length;
            return { ...row, wps_count: wpsCount };
        });

        res.json({
            success: true,
            data,
            pagination: {
                page:       parseInt(page),
                limit:      parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        logger.error('Error listing projects', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero dei progetti', code: 'PROJECT_LIST_ERROR' });
    }
}

// GET /projects/stats
async function getProjectStats(req, res) {
    try {
        const { organization_id } = req.user;
        const accessList = await ensureCompanyAccessLoaded(req.user);
        const companyFilter = companyAccessSqlFilter(accessList, 'p');
        const whereExtra = companyFilter.clause ? ` AND ${companyFilter.clause}` : '';
        const params = { organization_id, ...companyFilter.params };

        const result = await query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN p.status = 'offerta' THEN 1 ELSE 0 END) AS offerta,
                SUM(CASE WHEN p.status = 'attiva' THEN 1 ELSE 0 END) AS attiva,
                SUM(CASE WHEN p.status = 'completata' THEN 1 ELSE 0 END) AS completata,
                SUM(CASE WHEN p.status = 'chiusa' THEN 1 ELSE 0 END) AS chiusa
            FROM projects p
            WHERE p.organization_id = @organization_id AND p.deleted_at IS NULL${whereExtra}
        `, params);

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('Error getting project stats', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero delle statistiche', code: 'PROJECT_STATS_ERROR' });
    }
}

// GET /projects/:id
async function getProject(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
            SELECT p.*, c.name AS company_name, cp.name AS end_customer_name, cp.external_ref AS end_customer_ref
            FROM projects p
            LEFT JOIN companies c ON p.company_id = c.id
            LEFT JOIN company_counterparties cp ON cp.id = p.end_customer_id
            WHERE p.id = @id AND p.organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Progetto non trovato', code: 'PROJECT_NOT_FOUND' });
        }

        const project = result.recordset[0];
        if (trashedDetailHidden(req.user, project)) {
            return res.status(404).json({ error: 'Progetto non trovato', code: 'PROJECT_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, project.company_id, 'read')) return;

        // Parse WPS ids e recupera dettagli (anche JSON annidato; le WPS nel cestino no)
        let wpsDetails = [];
        const wpsIds = normalizeApplicableWpsIds(project.applicable_wps_ids);
        if (wpsIds.length > 0) {
            const placeholders = wpsIds.map((_, i) => `@wpsId${i}`).join(',');
            const wpsParams = { organization_id };
            wpsIds.forEach((wid, i) => { wpsParams[`wpsId${i}`] = wid; });
            const wpsResult = await query(`
                SELECT id, wps_code, welding_process, status
                FROM welding_procedures
                WHERE id IN (${placeholders}) AND organization_id = @organization_id AND deleted_at IS NULL
            `, wpsParams);
            wpsDetails = wpsResult.recordset;
        }

        // Saldatori assegnati
        const weldersResult = await query(`
            SELECT pw.*, q.person_name, q.qualification_type, q.certificate_number, q.expiry_date
            FROM project_welders pw
            JOIN qualifications q ON pw.qualification_id = q.id
            WHERE pw.project_id = @id AND pw.organization_id = @organization_id
              AND pw.deleted_at IS NULL AND q.deleted_at IS NULL
            ORDER BY q.person_name
        `, { id: parseInt(id), organization_id });

        res.json({
            success: true,
            data: {
                ...project,
                wps_details: wpsDetails,
                welders: weldersResult.recordset,
            },
        });
    } catch (error) {
        logger.error('Error getting project', { error: error.message });
        res.status(500).json({ error: 'Errore durante il recupero del progetto', code: 'PROJECT_GET_ERROR' });
    }
}

// POST /projects
async function createProject(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const {
            company_id, project_code, client_name, end_customer_id,
            description, start_date, end_date, applicable_wps_ids,
            status = 'offerta', requirements_review_date,
            technical_review_date, technical_review_checklist, notes,
        } = req.body;

        if (!project_code) {
            return res.status(400).json({ error: 'Codice progetto obbligatorio', code: 'VALIDATION_ERROR' });
        }

        const companyIdVal = company_id ? parseInt(company_id) : null;
        if (await denyOutsideCompany(res, req.user, companyIdVal, 'write')) return;

        const wpsIds = await writableWpsIdsJson(res, req.user, organization_id, applicable_wps_ids);
        if (!wpsIds.ok) return;

        // Cliente: se end_customer_id è impostato, sincronizza il nome dall'anagrafica
        // aziende (company_counterparties); altrimenti resta testo libero (client_name).
        const customerFields = await resolveCommercialCustomerFields({
            organizationId: organization_id,
            companyId: companyIdVal,
            commercialCustomerIdRaw: end_customer_id,
            commercialCustomerNameRaw: client_name,
        });
        if (!customerFields.ok) {
            return res.status(customerFields.status).json({ error: customerFields.error, code: customerFields.code });
        }

        const technicalReviewChecklistJson = technical_review_checklist
            ? stampTechnicalReviewChecklistJson(
                technical_review_checklist,
                await userForReviewStamp(req.user)
            )
            : null;

        const caseLink = await resolveCommercialCaseId(
            res, req.user, organization_id, req.body.commercial_case_id, companyIdVal, null,
        );
        if (!caseLink.ok) return;
        const commercialCaseId = caseLink.skip ? null : caseLink.id;

        let run = query;
        let commitLink = async () => {};
        let rollbackLink = async () => {};
        if (commercialCaseId) {
            const locked = await beginCaseLink(organization_id, commercialCaseId, null);
            if (!locked.ok) {
                return res.status(locked.status).json({ error: locked.error, code: locked.code });
            }
            run = locked.run;
            commitLink = locked.commit;
            rollbackLink = locked.rollback;
        }

        let result;
        try {
            result = await run(`
            INSERT INTO projects (
                organization_id, company_id, project_code, client_name,
                end_customer_id, description, start_date, end_date,
                applicable_wps_ids, status, requirements_review_date,
                technical_review_date, technical_review_checklist, notes,
                commercial_case_id, created_by, created_at, updated_at
            )
            OUTPUT INSERTED.id
            VALUES (
                @organization_id, @company_id, @project_code, @client_name,
                @end_customer_id, @description, @start_date, @end_date,
                @applicable_wps_ids, @status, @requirements_review_date,
                @technical_review_date, @technical_review_checklist, @notes,
                @commercial_case_id, @created_by, GETDATE(), GETDATE()
            )
        `, {
            organization_id,
            company_id:              companyIdVal,
            project_code,
            client_name:             customerFields.commercialCustomerName,
            end_customer_id:         customerFields.commercialCustomerId,
            description:             description || null,
            start_date:              start_date || null,
            end_date:                end_date || null,
            applicable_wps_ids:      wpsIds.json,
            status,
            requirements_review_date: requirements_review_date || null,
            technical_review_date:   technical_review_date || null,
            technical_review_checklist: technicalReviewChecklistJson,
            notes:                   notes || null,
            commercial_case_id:      commercialCaseId,
            created_by:              user_id,
        });
            await commitLink();
        } catch (err) {
            try { await rollbackLink(); } catch (_) { /* già chiusa */ }
            throw err;
        }

        const newId = result.recordset[0].id;
        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'projects',
            entityId: newId,
            actionType: 'created',
            actorUserId: user_id,
            after: {
                project_code,
                status,
                company_id: companyIdVal,
                description: description || null,
                notes: notes || null,
                commercial_case_id: commercialCaseId,
            },
            fields: ['project_code', 'status', 'company_id', 'description', 'notes', 'commercial_case_id'],
        });
        logger.info('Project created', { id: newId, organization_id, project_code });

        res.status(201).json({ success: true, data: { id: newId, project_code, status } });
    } catch (error) {
        logger.error('Error creating project', { error: error.message });
        res.status(500).json({ error: 'Errore durante la creazione del progetto', code: 'PROJECT_CREATE_ERROR' });
    }
}

// PUT /projects/:id
async function updateProject(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const existing = await query(`
            SELECT id, company_id, end_customer_id, client_name, technical_review_checklist,
                   project_code, description, status, notes, commercial_case_id, deleted_at
            FROM projects
            WHERE id = @id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Progetto non trovato', code: 'PROJECT_NOT_FOUND' });
        }
        const existingProject = existing.recordset[0];
        if (await denyOutsideCompany(res, req.user, existingProject.company_id, 'write')) return;

        // company_id va risolto prima del cliente: se cambia l'azienda (ambito),
        // il collegamento end_customer_id precedente potrebbe non appartenerle più.
        const companyIdNext = req.body.company_id !== undefined
            ? (req.body.company_id !== null ? parseInt(req.body.company_id) : null)
            : existingProject.company_id;
        if (companyIdNext !== existingProject.company_id
            && await denyOutsideCompany(res, req.user, companyIdNext, 'write')) return;

        let applicableWpsJson;
        if (req.body.applicable_wps_ids !== undefined) {
            const loaded = await writableWpsIdsJson(res, req.user, organization_id, req.body.applicable_wps_ids);
            if (!loaded.ok) return;
            applicableWpsJson = loaded.json;
        }

        const allowed = [
            'company_id', 'project_code',
            'description', 'start_date', 'end_date', 'applicable_wps_ids',
            'status', 'requirements_review_date', 'technical_review_date',
            'technical_review_checklist', 'notes',
        ];

        const updates = [];
        const params = { id: parseInt(id) };

        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = @${field}`);
                if (field === 'applicable_wps_ids') {
                    params[field] = applicableWpsJson;
                } else if (field === 'technical_review_checklist') {
                    params[field] = stampTechnicalReviewChecklistJson(
                        req.body[field],
                        await userForReviewStamp(req.user),
                        { previous: existingProject.technical_review_checklist },
                    );
                } else if (field === 'company_id') {
                    params[field] = companyIdNext;
                } else {
                    params[field] = req.body[field] || null;
                }
            }
        }

        // Cliente: se end_customer_id o client_name sono presenti nel body, risincronizza
        // il nome dall'anagrafica aziende (company_counterparties) quando è impostata la FK.
        const caseLink = await resolveCommercialCaseId(
            res,
            req.user,
            organization_id,
            req.body.commercial_case_id,
            companyIdNext,
            parseInt(id),
        );
        if (!caseLink.ok) return;
        if (!caseLink.skip) {
            updates.push('commercial_case_id = @commercial_case_id');
            params.commercial_case_id = caseLink.id;
        }

        if (req.body.end_customer_id !== undefined || req.body.client_name !== undefined) {
            const customerFields = await resolveCommercialCustomerFields({
                organizationId: organization_id,
                companyId: companyIdNext,
                commercialCustomerIdRaw: req.body.end_customer_id,
                commercialCustomerNameRaw: req.body.client_name,
                existing: {
                    commercial_customer_id: existingProject.end_customer_id,
                    commercial_customer_name: existingProject.client_name,
                },
            });
            if (!customerFields.ok) {
                return res.status(customerFields.status).json({ error: customerFields.error, code: customerFields.code });
            }
            updates.push('end_customer_id = @end_customer_id', 'client_name = @client_name');
            params.end_customer_id = customerFields.commercialCustomerId;
            params.client_name = customerFields.commercialCustomerName;
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'VALIDATION_ERROR' });
        }

        updates.push('updated_at = GETDATE()');

        let run = query;
        let commitLink = async () => {};
        let rollbackLink = async () => {};
        if (caseLink.id) {
            const locked = await beginCaseLink(organization_id, caseLink.id, parseInt(id));
            if (!locked.ok) {
                return res.status(locked.status).json({ error: locked.error, code: locked.code });
            }
            run = locked.run;
            commitLink = locked.commit;
            rollbackLink = locked.rollback;
        }

        try {
            await run(`
                UPDATE projects
                SET ${updates.join(', ')}
                WHERE id = @id
            `, params);
            await commitLink();
        } catch (err) {
            try { await rollbackLink(); } catch (_) { /* già chiusa */ }
            throw err;
        }

        const after = { ...req.body };
        const logFields = [...allowed];
        if (!caseLink.skip) {
            after.commercial_case_id = caseLink.id;
            logFields.push('commercial_case_id');
        }
        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'projects',
            entityId: parseInt(id),
            actionType: 'updated',
            actorUserId: req.user.user_id,
            before: existingProject,
            after,
            fields: logFields,
        });
        logger.info('Project updated', { id, organization_id });
        res.json({ success: true, message: 'Progetto aggiornato con successo' });
    } catch (error) {
        logger.error('Error updating project', { error: error.message });
        res.status(500).json({ error: 'Errore durante l\'aggiornamento del progetto', code: 'PROJECT_UPDATE_ERROR' });
    }
}

// DELETE /projects/:id
async function deleteProject(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const projectId = parseInt(id);
        if (!Number.isInteger(projectId) || projectId <= 0) {
            return res.status(400).json({ error: 'Identificativo non valido.', code: 'INVALID_ID' });
        }
        const existing = await query(`
            SELECT id, status, company_id, project_code FROM projects
            WHERE id = @id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { id: projectId, organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({ error: 'Progetto non trovato', code: 'PROJECT_NOT_FOUND' });
        }

        const project = existing.recordset[0];
        if (await denyOutsideCompany(res, req.user, project.company_id, 'write')) return;

        await query(`
            UPDATE project_welders
            SET deleted_at = SYSUTCDATETIME(), deleted_by = @actor_user_id
            WHERE project_id = @id AND organization_id = @organization_id AND deleted_at IS NULL
        `, { id: projectId, organization_id, actor_user_id: req.user.user_id });
        await query(softDeleteSql('projects', 'id'), {
            id: projectId,
            organization_id,
            actor_user_id: req.user.user_id,
        });
        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'projects',
            entityId: projectId,
            actionType: 'soft_deleted',
            actorUserId: req.user.user_id,
            before: { status: project.status, project_code: project.project_code, deleted_at: null },
            after: { deleted_at: 'cestino' },
        });

        logger.info('Project moved to trash', { id, organization_id, status: project.status });
        res.json({ success: true, message: 'Commessa spostata nel cestino' });
    } catch (error) {
        logger.error('Error deleting project', { error: error.message });
        res.status(500).json({ error: 'Errore durante l\'eliminazione del progetto', code: 'PROJECT_DELETE_ERROR' });
    }
}

// POST /projects/:id/welders
async function addProjectWelder(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        const { qualification_id, wps_id, notes } = req.body || {};

        if (!qualification_id) {
            return res.status(400).json({ error: 'qualification_id obbligatorio', code: 'VALIDATION_ERROR' });
        }

        // Verifica progetto
        const proj = await query(
            `SELECT id, company_id FROM projects WHERE id=@id AND organization_id=@organization_id AND deleted_at IS NULL`,
            { id: parseInt(id), organization_id }
        );
        if (!proj.recordset.length) {
            return res.status(404).json({ error: 'Progetto non trovato', code: 'PROJECT_NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, proj.recordset[0].company_id, 'write')) return;

        // Verifica qualifica: stessa org, approvata, non scaduta (warning se in_scadenza)
        const qualCheck = await query(
            `SELECT id, company_id, approval_status, status, expiry_date, person_name
             FROM qualifications
             WHERE id=@qid AND organization_id=@organization_id AND deleted_at IS NULL`,
            { qid: parseInt(qualification_id), organization_id }
        );
        if (!qualCheck.recordset.length) {
            return res.status(404).json({ error: 'Qualifica non trovata', code: 'QUAL_NOT_FOUND' });
        }
        const q = qualCheck.recordset[0];
        if (await denyOutsideCompany(res, req.user, q.company_id, 'write')) return;

        let welderWpsId = null;
        if (wps_id !== undefined && wps_id !== null && wps_id !== '') {
            welderWpsId = strictPositiveInt(wps_id);
            if (welderWpsId == null) {
                return res.status(400).json({ error: 'wps_id non valido', code: 'VALIDATION_ERROR' });
            }
            const nextWps = await query(`
                SELECT id, company_id FROM welding_procedures
                WHERE id = @wps_id AND organization_id = @organization_id AND deleted_at IS NULL
            `, { wps_id: welderWpsId, organization_id });
            if (nextWps.recordset.length === 0) {
                return res.status(404).json({ error: 'WPS di riferimento non trovata', code: 'WPS_NOT_FOUND' });
            }
            if (await denyOutsideCompany(res, req.user, nextWps.recordset[0].company_id, 'write')) return;
        }

        if (q.approval_status !== 'approvata') {
            return res.status(422).json({ error: `Qualifica non approvata (stato: ${q.approval_status})`, code: 'QUAL_NOT_APPROVED' });
        }
        if (q.status === 'revocata' || q.status === 'sospesa') {
            return res.status(422).json({ error: `Qualifica non attiva (stato: ${q.status})`, code: 'QUAL_INACTIVE' });
        }

        let warning = null;
        if (q.expiry_date) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const exp = new Date(q.expiry_date);
            const days = Math.floor((exp - today) / 86400000);
            if (days < 0) {
                return res.status(422).json({ error: 'Qualifica scaduta', code: 'QUAL_EXPIRED' });
            }
            if (days <= 60) {
                warning = `Qualifica di ${q.person_name} in scadenza tra ${days} giorni`;
            }
        }

        // Evita duplicati
        const dup = await query(
            `SELECT id FROM project_welders WHERE project_id=@pid AND qualification_id=@qid AND organization_id=@organization_id AND deleted_at IS NULL`,
            { pid: parseInt(id), qid: parseInt(qualification_id), organization_id }
        );
        if (dup.recordset.length) {
            return res.status(409).json({ error: 'Saldatore gi\u00e0 assegnato a questa commessa', code: 'DUPLICATE' });
        }

        const result = await query(
            `INSERT INTO project_welders (project_id, qualification_id, wps_id, notes, organization_id, created_at)
             OUTPUT INSERTED.id
             VALUES (@pid, @qid, @wid, @notes, @organization_id, GETDATE())`,
            {
                pid: parseInt(id),
                qid: parseInt(qualification_id),
                wid: welderWpsId,
                notes: notes || null,
                organization_id,
            }
        );

        logger.info('ProjectWelder added', { project_id: id, qualification_id, organization_id });
        res.status(201).json({ success: true, data: { id: result.recordset[0].id, warning } });
    } catch (error) {
        logger.error('Error adding project welder', { error: error.message });
        res.status(500).json({ error: 'Errore assegnazione saldatore', code: 'WELDER_ADD_ERROR' });
    }
}

// DELETE /projects/:id/welders/:qualificationId
async function removeProjectWelder(req, res) {
    try {
        const { id, qualificationId } = req.params;
        const { organization_id } = req.user;

        const check = await query(
            `SELECT pw.id, p.company_id
             FROM project_welders pw
             JOIN projects p ON p.id = pw.project_id AND p.organization_id = pw.organization_id
             WHERE pw.project_id=@pid AND pw.qualification_id=@qid AND pw.organization_id=@organization_id`,
            { pid: parseInt(id), qid: parseInt(qualificationId), organization_id }
        );
        if (!check.recordset.length) {
            return res.status(404).json({ error: 'Assegnazione non trovata', code: 'NOT_FOUND' });
        }
        if (await denyOutsideCompany(res, req.user, check.recordset[0].company_id, 'write')) return;

        await query(
            `UPDATE project_welders
             SET deleted_at = SYSUTCDATETIME(), deleted_by = @actor_user_id
             WHERE project_id=@pid AND qualification_id=@qid AND organization_id=@organization_id AND deleted_at IS NULL`,
            { pid: parseInt(id), qid: parseInt(qualificationId), organization_id, actor_user_id: req.user.user_id }
        );
        await logEntityChange({
            organizationId: organization_id,
            entityTable: 'project_welders',
            entityId: check.recordset[0].id,
            actionType: 'soft_deleted',
            actorUserId: req.user.user_id,
            before: { deleted_at: null },
            after: { deleted_at: 'cestino' },
        });

        logger.info('ProjectWelder removed', { project_id: id, qualification_id: qualificationId, organization_id });
        res.json({ success: true });
    } catch (error) {
        logger.error('Error removing project welder', { error: error.message });
        res.status(500).json({ error: 'Errore rimozione saldatore', code: 'WELDER_REMOVE_ERROR' });
    }
}

module.exports = {
    listProjects,
    getProjectStats,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    addProjectWelder,
    removeProjectWelder,
};
