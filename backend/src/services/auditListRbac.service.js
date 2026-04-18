/**
 * Filtro RBAC lista/dettaglio audit per tenant + studio (auditor org).
 * Allineato a docs/ARCHITETTURA_UTENTI_RBAC: senza studio assegnato, auditor/viewer
 * non devono leggere audit di altri studi (solo i propri finché non viene assegnato uno studio).
 */

function hasNoStudio(auditorOrgId) {
    return auditorOrgId == null || auditorOrgId === '';
}

/**
 * Admin o superadmin senza studio: visione org-wide (nessun filtro aggiuntivo).
 */
function isOrgWideAdmin(user) {
    if (!user) return false;
    const { role, auditor_org_id } = user;
    if (!hasNoStudio(auditor_org_id)) return false;
    return role === 'admin' || role === 'superadmin';
}

/**
 * @param {object} reqUser - req.user (JWT)
 * @param {string} tableAlias - alias tabella audits nella query (es. 'a' o 'audits')
 * @returns {{ clause: string, params: Record<string, unknown> }}
 */
function studioScopeClause(reqUser, tableAlias = 'a') {
    const t = tableAlias;
    const { auditor_org_id, role, user_id } = reqUser;

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

    if (role === 'auditor' || role === 'viewer') {
        return {
            clause: `(${t}.created_by = @user_id)`,
            params: { user_id },
        };
    }

    return { clause: '', params: {} };
}

module.exports = {
    isOrgWideAdmin,
    hasNoStudio,
    studioScopeClause,
};
