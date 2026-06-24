const {
    appendCompanyScopeCondition,
    childrenCountSubquery,
} = require('./documentTreeCompanyScope');

describe('documentTreeCompanyScope', () => {
    describe('appendCompanyScopeCondition', () => {
        it('vista azienda: mostra nodi azienda + condivisi (company_id IS NULL)', () => {
            const conditions = ['dr.organization_id = @organization_id'];
            const params = { organization_id: 1002 };

            appendCompanyScopeCondition(conditions, params, 'dr', 45);

            // I nodi condivisi (norme, cartelle di sistema, company_id NULL) restano visibili.
            expect(conditions).toContain('(dr.company_id = @company_id OR dr.company_id IS NULL)');
            expect(params.company_id).toBe(45);
        });

        it('vista azienda: ESCLUDE il Patrimonio Studio (content_scope=studio)', () => {
            const conditions = ['dr.organization_id = @organization_id'];
            const params = { organization_id: 1002 };

            appendCompanyScopeCondition(conditions, params, 'dr', 45);

            // Zero leak: il know-how dello studio non deve mai comparire nelle viste azienda.
            const studioGuard = conditions.find(c => c.includes('content_scope'));
            expect(studioGuard).toBeDefined();
            expect(studioGuard).toBe("(dr.content_scope IS NULL OR dr.content_scope <> 'studio')");
        });

        it('vista studio (nessuna azienda): nessun filtro azienda ne esclusione studio', () => {
            const conditions = ['dr.organization_id = @organization_id'];
            const params = { organization_id: 1002 };

            appendCompanyScopeCondition(conditions, params, 'dr', null);

            expect(conditions).toHaveLength(1);
            expect(params.company_id).toBeUndefined();
            expect(conditions.some(c => c.includes('content_scope'))).toBe(false);
        });
    });

    describe('childrenCountSubquery', () => {
        it('ambito azienda: filtra per company_id ed esclude il Patrimonio Studio', () => {
            const sql = childrenCountSubquery('dr', 45);
            expect(sql).toMatch(/sub\.company_id = @company_id/);
            expect(sql).toMatch(/sub\.content_scope <> 'studio'/);
        });

        it('senza ambito azienda: nessun filtro company_id ne content_scope', () => {
            const sql = childrenCountSubquery('dr', null);
            expect(sql).not.toMatch(/company_id/);
            expect(sql).not.toMatch(/content_scope/);
        });
    });
});
