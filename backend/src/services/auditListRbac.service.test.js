/**
 * @jest-environment node
 */

const {
    studioScopeClause,
    isOrgWideAdmin,
    normalizeRole,
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
