const {
    RELEASED_DOC_STATUSES,
    isReleasedDocStatus,
    normalizeRegistryDocStatus,
    parseRegistryDocStatus,
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

    it('normalizeRegistryDocStatus mappa vigente → rilasciato', () => {
        expect(normalizeRegistryDocStatus('vigente')).toBe('rilasciato');
        expect(normalizeRegistryDocStatus('Vigente')).toBe('rilasciato');
    });

    it('parseRegistryDocStatus accetta vigente legacy', () => {
        expect(parseRegistryDocStatus('vigente')).toEqual({ ok: true, status: 'rilasciato' });
    });

    it('parseRegistryDocStatus rifiuta valori fuori registro', () => {
        const r = parseRegistryDocStatus('superata');
        expect(r.ok).toBe(false);
        expect(r.allowed).toContain('rilasciato');
    });
});
