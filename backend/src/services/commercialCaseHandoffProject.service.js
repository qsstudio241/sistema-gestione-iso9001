/**
 * Ponte Riesame Requisiti → Commesse.
 * All'handoff di un caso APPROVED scrive projects.commercial_case_id
 * (colonna già presente, migrazione 085). Non è una soglia normativa nuova.
 */

const { query, getPool, sql } = require('../config/database');
const logger = require('../utils/logger');
const { assertMutatingAllowed } = require('./companyAccess.service');
const { getLicensedModuleKeysForOrg } = require('./moduleLicense.service');
const { logEntityChange } = require('./entityChangeLog.service');

const PROJECT_CODE_MAX = 100;

function textOrNull(raw, maxLen) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    return maxLen ? s.substring(0, maxLen) : s;
}

function intOrNull(raw) {
    if (raw == null || raw === '') return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
}

/**
 * Crea la commessa o collega quella già esistente con lo stesso codice,
 * nello stesso studio. Non ruba una commessa di un altro caso o di un'altra azienda.
 * @returns {Promise<{ok:true, action:string, project:object}|{ok:false, status:number, error:string, code:string}>}
 */
async function linkApprovedCaseToProject({ organizationId, user, caseRow, handoffRef, notes }) {
    const caseId = intOrNull(caseRow && caseRow.id);
    const projectCode = textOrNull(handoffRef, PROJECT_CODE_MAX);
    if (!caseId || !projectCode) {
        return {
            ok: false,
            status: 400,
            error: 'Riferimento commessa obbligatorio',
            code: 'VALIDATION_ERROR',
        };
    }

    const companyId = intOrNull(caseRow.company_id);
    const denied = await assertMutatingAllowed(user, { companyId });
    if (denied) {
        return {
            ok: false,
            status: denied.status,
            error: denied.body.error,
            code: denied.body.code,
        };
    }

    const licensed = await getLicensedModuleKeysForOrg(organizationId);
    if (!licensed.includes('saldatura')) {
        return {
            ok: false,
            status: 403,
            error: 'Il modulo Commesse non è abilitato per questo studio.',
            code: 'MODULE_NOT_LICENSED',
        };
    }

    const description = textOrNull(caseRow.title, 500);
    const clientName = textOrNull(caseRow.commercial_customer_name, 255);
    const endCustomerId = intOrNull(caseRow.commercial_customer_id);
    const userId = user && user.user_id;
    const notesVal = textOrNull(notes, 500);

    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const outcome = await linkProjectInTransaction(transaction, {
            organizationId,
            caseId,
            projectCode,
            companyId,
            description,
            clientName,
            endCustomerId,
            userId,
            notesVal,
            lockResource: `sgq-handoff-${organizationId}-${caseId}`,
            codeLockResource: `sgq-handoff-code-${organizationId}-${projectCode}`,
        });
        if (!outcome.ok) {
            await transaction.rollback();
            return outcome;
        }
        await transaction.commit();
        if (outcome.action !== 'already_linked') {
            await logEntityChange({
                organizationId,
                entityTable: 'projects',
                entityId: outcome.project.id,
                actionType: outcome.action === 'created' ? 'created' : 'updated',
                actorUserId: userId,
                after: outcome.action === 'created'
                    ? {
                        project_code: outcome.project.project_code,
                        company_id: outcome.project.company_id,
                        commercial_case_id: caseId,
                        status: 'offerta',
                    }
                    : outcome.action === 'code_updated'
                        ? {
                            project_code: outcome.project.project_code,
                            commercial_case_id: caseId,
                            company_id: outcome.project.company_id,
                        }
                        : {
                            commercial_case_id: caseId,
                            company_id: outcome.project.company_id,
                        },
                fields: outcome.action === 'created'
                    ? ['project_code', 'company_id', 'commercial_case_id', 'status']
                    : outcome.action === 'code_updated'
                        ? ['project_code', 'commercial_case_id', 'company_id']
                        : ['commercial_case_id', 'company_id'],
            });
        }
        return outcome;
    } catch (err) {
        try { await transaction.rollback(); } catch (_) { /* già chiusa */ }
        throw err;
    }
}

async function txQuery(transaction, text, params) {
    const req = new sql.Request(transaction);
    Object.entries(params || {}).forEach(([key, value]) => {
        req.input(key, value);
    });
    return req.query(text);
}

function companyBlocksLink(companyId, projectCompany) {
    if (companyId == null && projectCompany != null) {
        return {
            ok: false,
            status: 409,
            error: "Il riesame non ha un'azienda: non si collega una commessa di un'azienda specifica.",
            code: 'PROJECT_COMPANY_REQUIRED',
        };
    }
    if (companyId != null && projectCompany != null && projectCompany !== companyId) {
        return {
            ok: false,
            status: 409,
            error: "La commessa con questo riferimento appartiene a un'altra azienda.",
            code: 'PROJECT_COMPANY_MISMATCH',
        };
    }
    return null;
}

function pickProjectForCode(rows, { caseId, companyId }) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return { match: null };
    const linkable = list.find((row) => {
        const otherCase = row.commercial_case_id != null && Number(row.commercial_case_id) !== caseId;
        if (otherCase) return false;
        return !companyBlocksLink(companyId, intOrNull(row.company_id));
    });
    if (linkable) return { match: linkable };
    const blocked = list
        .map((row) => companyBlocksLink(companyId, intOrNull(row.company_id)))
        .find(Boolean);
    if (blocked) return blocked;
    return {
        ok: false,
        status: 409,
        error: 'Esiste già una commessa con questo riferimento collegata a un altro caso di riesame.',
        code: 'PROJECT_ALREADY_LINKED',
    };
}

async function acquireTxLock(transaction, lockResource) {
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
        { lockResource },
    );
    const lockResult = lock.recordset[0] && Number(lock.recordset[0].lock_result);
    return Number.isFinite(lockResult) && lockResult >= 0;
}

async function saveHandoffOnCase(transaction, ctx) {
    const upd = await txQuery(
        transaction,
        `
        UPDATE commercial_cases
        SET handoff_ref = @handoffRef,
            handoff_at = SYSUTCDATETIME(),
            handoff_by = @userId,
            handoff_notes = @notesVal,
            updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.*
        WHERE id = @caseId AND organization_id = @organizationId
        `,
        {
            handoffRef: ctx.projectCode,
            userId: ctx.userId,
            notesVal: ctx.notesVal,
            caseId: ctx.caseId,
            organizationId: ctx.organizationId,
        },
    );
    const row = upd.recordset[0];
    if (!row) {
        return {
            ok: false,
            status: 404,
            error: 'Caso non trovato',
            code: 'NOT_FOUND',
        };
    }
    return { ok: true, case: row };
}

async function projectsByCode(transaction, { organizationId, projectCode, excludeId }) {
    return txQuery(
        transaction,
        `
        SELECT id, project_code, company_id, commercial_case_id
        FROM projects WITH (UPDLOCK, HOLDLOCK)
        WHERE organization_id = @organizationId
          AND project_code = @projectCode
          AND deleted_at IS NULL
          AND (@excludeId IS NULL OR id <> @excludeId)
        ORDER BY id
        `,
        { organizationId, projectCode, excludeId: excludeId == null ? null : excludeId },
    );
}

async function linkProjectInTransaction(transaction, ctx) {
    const caseLocked = await acquireTxLock(transaction, ctx.lockResource);
    if (!caseLocked) {
        return {
            ok: false,
            status: 409,
            error: 'Un altro passaggio per questo caso è ancora in corso. Riprovare.',
            code: 'HANDOFF_BUSY',
        };
    }
    const codeLocked = await acquireTxLock(transaction, ctx.codeLockResource);
    if (!codeLocked) {
        return {
            ok: false,
            status: 409,
            error: 'Un altro passaggio con questo riferimento è ancora in corso. Riprovare.',
            code: 'HANDOFF_BUSY',
        };
    }

    const {
        organizationId, caseId, projectCode, companyId, description, clientName, endCustomerId, userId,
    } = ctx;

    const already = await txQuery(
        transaction,
        `
        SELECT TOP 1 id, project_code, company_id, commercial_case_id
        FROM projects WITH (UPDLOCK, HOLDLOCK)
        WHERE organization_id = @organizationId
          AND commercial_case_id = @caseId
          AND deleted_at IS NULL
        ORDER BY id
        `,
        { organizationId, caseId },
    );
    if (already.recordset[0]) {
        let project = already.recordset[0];
        let action = 'already_linked';
        if (textOrNull(project.project_code, PROJECT_CODE_MAX) !== projectCode) {
            const clash = await projectsByCode(transaction, {
                organizationId,
                projectCode,
                excludeId: project.id,
            });
            if ((clash.recordset || []).length) {
                return {
                    ok: false,
                    status: 409,
                    error: 'Esiste già una commessa con questo riferimento.',
                    code: 'PROJECT_ALREADY_LINKED',
                };
            }
            const renamed = await txQuery(
                transaction,
                `
                UPDATE projects
                SET project_code = @projectCode,
                    updated_at = GETDATE()
                OUTPUT INSERTED.id, INSERTED.project_code, INSERTED.commercial_case_id, INSERTED.company_id
                WHERE id = @projectId
                  AND organization_id = @organizationId
                  AND deleted_at IS NULL
                  AND commercial_case_id = @caseId
                `,
                { projectCode, projectId: project.id, organizationId, caseId },
            );
            project = renamed.recordset[0];
            if (!project) {
                return {
                    ok: false,
                    status: 409,
                    error: 'La commessa non è più aggiornabile.',
                    code: 'PROJECT_ALREADY_LINKED',
                };
            }
            action = 'code_updated';
        }
        const saved = await saveHandoffOnCase(transaction, ctx);
        if (!saved.ok) return saved;
        return { ok: true, action, project, case: saved.case };
    }

    const byCode = await projectsByCode(transaction, {
        organizationId,
        projectCode,
        excludeId: null,
    });
    const picked = pickProjectForCode(byCode.recordset, { caseId, companyId });
    if (picked.ok === false) return picked;
    const match = picked.match;
    if (match) {
        const linked = await txQuery(
            transaction,
            `
            UPDATE projects
            SET commercial_case_id = @caseId,
                company_id = COALESCE(company_id, @companyId),
                description = CASE
                    WHEN description IS NULL OR LTRIM(RTRIM(description)) = '' THEN @description
                    ELSE description
                END,
                client_name = CASE
                    WHEN client_name IS NULL OR LTRIM(RTRIM(client_name)) = '' THEN @clientName
                    ELSE client_name
                END,
                end_customer_id = COALESCE(end_customer_id, @endCustomerId),
                requirements_review_date = COALESCE(requirements_review_date, CAST(SYSUTCDATETIME() AS DATE)),
                updated_at = GETDATE()
            OUTPUT INSERTED.id, INSERTED.project_code, INSERTED.commercial_case_id, INSERTED.company_id
            WHERE id = @projectId
              AND organization_id = @organizationId
              AND deleted_at IS NULL
              AND commercial_case_id IS NULL
            `,
            {
                caseId,
                companyId,
                description,
                clientName,
                endCustomerId,
                projectId: match.id,
                organizationId,
            },
        );
        const project = linked.recordset[0];
        if (!project) {
            return {
                ok: false,
                status: 409,
                error: 'La commessa non è più collegabile.',
                code: 'PROJECT_ALREADY_LINKED',
            };
        }
        const saved = await saveHandoffOnCase(transaction, ctx);
        if (!saved.ok) return saved;
        return { ok: true, action: 'linked', project, case: saved.case };
    }

    const inserted = await txQuery(
        transaction,
        `
        INSERT INTO projects (
            organization_id, company_id, project_code, client_name,
            end_customer_id, description, status, requirements_review_date,
            commercial_case_id, created_by, created_at, updated_at
        )
        OUTPUT INSERTED.id, INSERTED.project_code, INSERTED.commercial_case_id, INSERTED.company_id
        VALUES (
            @organizationId, @companyId, @projectCode, @clientName,
            @endCustomerId, @description, 'offerta', CAST(SYSUTCDATETIME() AS DATE),
            @caseId, @userId, GETDATE(), GETDATE()
        )
        `,
        {
            organizationId,
            companyId,
            projectCode,
            clientName,
            endCustomerId,
            description,
            caseId,
            userId,
        },
    );
    const project = inserted.recordset[0];
    if (!project) {
        logger.error('linkApprovedCaseToProject insert vuoto', { organizationId, caseId });
        return {
            ok: false,
            status: 500,
            error: 'Commessa non creata',
            code: 'PROJECT_CREATE_ERROR',
        };
    }
    const saved = await saveHandoffOnCase(transaction, ctx);
    if (!saved.ok) return saved;
    return { ok: true, action: 'created', project, case: saved.case };
}

module.exports = {
    linkApprovedCaseToProject,
};
