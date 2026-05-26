const {
    RELEASED_DOC_STATUSES,
    isReleasedDocStatus,
} = require('./documentStatus');

describe('documentStatus constants', () => {
    it('RELEASED_DOC_STATUSES include rilasciato e vigente', () => {
        expect(RELEASED_DOC_STATUSES).toContain('rilasciato');
        expect(RELEASED_DOC_STATUSES).toContain('vigente');
    });

    it('isReleasedDocStatus riconosce stati vigenti', () => {
        expect(isReleasedDocStatus('rilasciato')).toBe(true);
        expect(isReleasedDocStatus('vigente')).toBe(true);
    });

    it('isReleasedDocStatus esclude bozza e obsoleto', () => {
        expect(isReleasedDocStatus('bozza')).toBe(false);
        expect(isReleasedDocStatus('obsoleto')).toBe(false);
        expect(isReleasedDocStatus('in_revisione')).toBe(false);
    });
});
