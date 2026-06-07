/**
 * @jest-environment node
 */

const {
    studioScopeClause,
    isOrgWideAdmin,
    normalizeRole,
    documentRegistryScopeClause,
    appendScopeSql,
} = require('./auditListRbac.service');

describe('normalizeRole', () => {
    it('lowercases and trims', () => {
        expect(normalizeRole('  Auditor  ')).toBe('auditor');
        expect(normalizeRole(undefined)).toBe('auditor');
    });
});

describe('isOrgWideAdmin', () => {
    it('true solo per admin/superadmin senza studio', () => {
        expect(isOrgWideAdmin({ role: 'admin', auditor_org_id: null, user_id: 1 })).toBe(true);
        expect(isOrgWideAdmin({ role: 'Admin', auditor_org_id: null, user_id: 1 })).toBe(true);
        expect(isOrgWideAdmin({ role: 'auditor', auditor_org_id: null, user_id: 1 })).toBe(false);
        expect(isOrgWideAdmin({ role: 'admin', auditor_org_id: 5, user_id: 1 })).toBe(false);
    });
});

describe('studioScopeClause', () => {
    it('auditor con ruolo misto maiuscole senza studio → solo created_by', () => {
        const s = studioScopeClause(
            { user_id: 42, role: 'Auditor', auditor_org_id: null },
            'a',
        );
        expect(s.clause).toContain('created_by = @user_id');
        expect(s.params).toEqual({ user_id: 42 });
    });

    it('ruolo sconosciuto non espande a org-wide', () => {
        const s = studioScopeClause(
            { user_id: 99, role: 'legacy_role', auditor_org_id: null },
            'x',
        );
        expect(s.clause).toContain('created_by = @user_id');
        expect(s.params).toEqual({ user_id: 99 });
    });

    it('auditor con studio → predicato company + bozze proprie', () => {
        const s = studioScopeClause(
            { user_id: 3, role: 'auditor', auditor_org_id: 10 },
            'a',
        );
        expect(s.clause).toContain('auditor_org_id = @auditor_org_id');
        expect(s.clause).toContain('company_id IS NULL');
        expect(s.params).toMatchObject({ auditor_org_id: 10, user_id: 3 });
    });

    it('admin senza studio → nessun predicato extra', () => {
        const s = studioScopeClause(
            { user_id: 1, role: 'admin', auditor_org_id: null },
            'a',
        );
        expect(s.clause).toBe('');
        expect(s.params).toEqual({});
    });
});

describe('appendScopeSql', () => {
    it('restituisce suffisso AND o stringa vuota', () => {
        expect(appendScopeSql({ clause: '', params: {} })).toBe('');
        expect(appendScopeSql({ clause: 'a.x = 1', params: {} })).toBe(' AND a.x = 1');
    });
});

describe('documentRegistryScopeClause', () => {
    it('auditor con studio → auditor_org_id e company collegate', () => {
        const s = documentRegistryScopeClause(
            { user_id: 3, role: 'auditor', auditor_org_id: 10 },
            'dr',
        );
        expect(s.clause).toContain('dr.auditor_org_id = @auditor_org_id');
        expect(s.clause).toContain('companies WHERE auditor_org_id');
        expect(s.params).toMatchObject({ auditor_org_id: 10, user_id: 3 });
    });

    it('cliente azienda → filtro company_id assegnate', () => {
        const s = documentRegistryScopeClause(
            {
                user_id: 8,
                role: 'viewer',
                auditor_org_id: 10,
                company_access: [{ company_id: 11, permission: 'read' }],
            },
            'dr',
        );
        expect(s.clause).toContain('dr.company_id IN');
        expect(s.params.ca_scope_0).toBe(11);
    });

    it('admin senza studio → org-wide', () => {
        const s = documentRegistryScopeClause(
            { user_id: 1, role: 'admin', auditor_org_id: null },
            'dr',
        );
        expect(s.clause).toBe('');
    });
});
