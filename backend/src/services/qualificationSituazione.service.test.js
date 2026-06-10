const {
    VALID_SITUAZIONI,
    isValidSituazione,
    situazioneWhereClause,
    applySituazioneFilter,
} = require('../services/qualificationSituazione.service');

describe('qualificationSituazione.service', () => {
    it('accetta solo situazioni note', () => {
        expect(isValidSituazione('valide')).toBe(true);
        expect(isValidSituazione('urgenti_30')).toBe(true);
        expect(isValidSituazione('in_scadenza_90')).toBe(false);
        expect(isValidSituazione('')).toBe(false);
    });

    it('genera clausola SQL per alias q', () => {
        const clause = situazioneWhereClause('scadute');
        expect(clause).toContain('q.expiry_date');
        expect(clause).toContain("q.status NOT IN ('revocata','sospesa')");
    });

    it('applySituazioneFilter ignora valori non validi', () => {
        const where = ['q.organization_id = @orgId'];
        applySituazioneFilter(where, 'foo');
        expect(where).toHaveLength(1);
        applySituazioneFilter(where, 'da_approvare');
        expect(where).toHaveLength(2);
        expect(where[1]).toContain('approval_status');
    });

    it('VALID_SITUAZIONI include valide e da_approvare', () => {
        expect(VALID_SITUAZIONI).toEqual(expect.arrayContaining(['valide', 'da_approvare']));
    });
});
