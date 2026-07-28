/**
 * Filtro RBAC lista/dettaglio audit per tenant + studio (auditor org).
 * Fase 4.1: company_access ha precedenza su auditor_org_id (cliente azienda).
 * Allineato a docs/ARCHITETTURA_UTENTI_RBAC: senza studio assegnato, auditor/viewer
 * non devono leggere audit di altri studi (solo i propri finché non viene assegnato uno studio).
 */

function hasCompanyAccessRows(accessList) {
    return Array.isArray(accessList) && accessList.length > 0;
}

/**
 * Scope per utenti con user_company_access: solo company_id assegnate.
 * @param {object} reqUser
 * @param {string} tableAlias
 * @param {string} [companyColumn='company_id']
 */
function companyAccessScopeClause(reqUser, tableAlias = 'a', companyColumn = 'company_id') {
    const access = reqUser?.company_access;
    if (!hasCompanyAccessRows(access)) {
        return null;
    }
    const params = {};
    const inParts = access.map((row, i) => {
        const key = `ca_scope_${i}`;
        params[key] = row.company_id;
        return `@${key}`;
    });
    const t = tableAlias;
    const col = companyColumn;
    return {
        clause: `${t}.${col} IN (${inParts.join(', ')})`,
        params,
    };
}

function hasNoStudio(auditorOrgId) {
    return auditorOrgId == null || auditorOrgId === '';
}

/** Ruolo JWT/DB normalizzato (evita match falliti su 'Auditor' vs 'auditor' → scope vuoto = tutta l'org). */
function normalizeRole(role) {
    return String(role || 'auditor').trim().toLowerCase();
}

/**
 * Admin o superadmin senza studio: visione org-wide (nessun filtro aggiuntivo).
 */
function isOrgWideAdmin(user) {
    if (!user) return false;
    const { role, auditor_org_id } = user;
    if (!hasNoStudio(auditor_org_id)) return false;
    const r = normalizeRole(role);
    return r === 'admin' || r === 'superadmin';
}

/**
 * @param {object} reqUser - req.user (JWT)
 * @param {string} tableAlias - alias tabella audits nella query (es. 'a' o 'audits')
 * @returns {{ clause: string, params: Record<string, unknown> }}
 */
function studioScopeClause(reqUser, tableAlias = 'a') {
    const t = tableAlias;
    const { auditor_org_id, role, user_id } = reqUser;
    const r = normalizeRole(role);

    const companyScope = companyAccessScopeClause(reqUser, t);
    if (companyScope) {
        return companyScope;
    }

    if (isOrgWideAdmin(reqUser)) {
        return { clause: '', params: {} };
    }

    if (auditor_org_id) {
        return {
            clause: `(
                ${t}.company_id IN (SELECT id FROM companies WHERE auditor_org_id = @auditor_org_id)
                OR (${t}.company_id IS NULL AND ${t}.created_by = @user_id)
            )`,
            params: { auditor_org_id, user_id },
        };
    }

    if (r === 'auditor' || r === 'viewer') {
        return {
            clause: `(${t}.created_by = @user_id)`,
            params: { user_id },
        };
    }

    // Ruolo non previsto: mai espandere a org-wide (fallisce chiuso sui propri record).
    return { clause: `(${t}.created_by = @user_id)`, params: { user_id } };
}

/**
 * Suffisso SQL riusabile: ` AND (...)` oppure stringa vuota se org-wide.
 * @param {{ clause: string, params: Record<string, unknown> }} scope
 */
function appendScopeSql(scope) {
    if (!scope?.clause) return '';
    return ` AND ${scope.clause}`;
}

/**
 * Scope ownership NC valido sia per NC da audit sia per NC non-audit
 * (reclamo, rischi, riesame, operativa: `audit_id IS NULL`, tenant su `nc.organization_id`).
 *
 * Un `INNER JOIN audits` scarta le NC senza audit e produce 404 su azioni e allegati:
 * usare sempre questo helper nelle query che verificano la proprietà di una NC.
 *
 * @param {object} reqUser - req.user (JWT)
 * @param {{ ncAlias?: string, auditAlias?: string }} [aliases]
 * @returns {{ joinSql: string, orgSql: string, scopeSql: string, params: Record<string, unknown> }}
 */
function ncOwnershipScope(reqUser, { ncAlias = 'nc', auditAlias = 'a' } = {}) {
    const scope = studioScopeClause(reqUser, auditAlias);
    // Lo scope studio vive sulla tabella audits: applicarlo solo quando l'audit esiste,
    // altrimenti il LEFT JOIN (colonne NULL) escluderebbe ogni NC non-audit.
    const scopeSql = scope.clause
        ? ` AND (${ncAlias}.audit_id IS NULL OR (${scope.clause}))`
        : '';
    return {
        joinSql: `LEFT JOIN audits ${auditAlias} ON ${ncAlias}.audit_id = ${auditAlias}.audit_id`,
        orgSql: `(
              (${ncAlias}.audit_id IS NOT NULL AND ${auditAlias}.organization_id = @organization_id)
              OR (${ncAlias}.audit_id IS NULL AND ${ncAlias}.organization_id = @organization_id)
            )`,
        scopeSql,
        params: scope.params,
    };
}

/**
 * Scope document registry: org-wide per admin/superadmin senza studio;
 * per auditor con studio → auditor_org_id diretto, company dello studio, o bozze proprie.
 * Documenti senza company né auditor_org_id: visibili solo al creatore (auditor) o org-wide (admin).
 *
 * @param {object} reqUser
 * @param {string} tableAlias - alias tabella document_registry (es. 'dr')
 */
function documentRegistryScopeClause(reqUser, tableAlias = 'dr') {
    const t = tableAlias;
    const { auditor_org_id, role, user_id } = reqUser;
    const r = normalizeRole(role);

    const companyScope = companyAccessScopeClause(reqUser, t);
    if (companyScope) {
        return companyScope;
    }

    if (isOrgWideAdmin(reqUser)) {
        return { clause: '', params: {} };
    }

    if (auditor_org_id) {
        return {
            clause: `(
                ${t}.auditor_org_id = @auditor_org_id
                OR (${t}.auditor_org_id IS NULL AND ${t}.company_id IN (
                    SELECT id FROM companies WHERE auditor_org_id = @auditor_org_id
                ))
                OR (${t}.auditor_org_id IS NULL AND ${t}.company_id IS NULL AND ${t}.created_by = @user_id)
            )`,
            params: { auditor_org_id, user_id },
        };
    }

    if (r === 'auditor' || r === 'viewer') {
        return { clause: `(${t}.created_by = @user_id)`, params: { user_id } };
    }

    return { clause: `(${t}.created_by = @user_id)`, params: { user_id } };
}

module.exports = {
    isOrgWideAdmin,
    hasNoStudio,
    hasCompanyAccessRows,
    companyAccessScopeClause,
    normalizeRole,
    studioScopeClause,
    appendScopeSql,
    ncOwnershipScope,
    documentRegistryScopeClause,
};
