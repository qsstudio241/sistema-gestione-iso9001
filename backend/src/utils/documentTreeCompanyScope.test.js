const {
    appendCompanyScopeCondition,
    childrenCountSubquery,
} = require('./documentTreeCompanyScope');

describe('documentTreeCompanyScope', () => {
    describe('appendCompanyScopeCondition', () => {
        it('aggiunge filtro stretto quando company_id è valorizzato', () => {
            const conditions = ['dr.organization_id = @organization_id'];
            const params = { organization_id: 1002 };

            appendCompanyScopeCondition(conditions, params, 'dr', 45);

            expect(conditions).toContain('dr.company_id = @company_id');
            expect(conditions.some(c => c.includes('IS NULL'))).toBe(false);
            expect(params.company_id).toBe(45);
        });

        it('non aggiunge filtro se company_id assente', () => {
            const conditions = ['dr.organization_id = @organization_id'];
            const params = { organization_id: 1002 };

            appendCompanyScopeCondition(conditions, params, 'dr', null);

            expect(conditions).toHaveLength(1);
            expect(params.company_id).toBeUndefined();
        });
    });

    describe('childrenCountSubquery', () => {
        it('include filtro company_id sui figli quando ambito azienda', () => {
            const sql = childrenCountSubquery('dr', 45);
            expect(sql).toMatch(/sub\.company_id = @company_id/);
        });

        it('non filtra per company_id senza ambito', () => {
            const sql = childrenCountSubquery('dr', null);
            expect(sql).not.toMatch(/company_id/);
        });
    });
});
