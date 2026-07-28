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
        applySituazioneFilter(where, 'revocata');
        expect(where).toHaveLength(2);
        expect(where[1]).toContain("q.status = 'revocata'");
    });

    // Decisione di prodotto 28/07/2026: rimosso il gate di approvazione interna
    // (Approva/Rifiuta) — "da_approvare" non esiste più come situazione filtrabile,
    // v. header qualifications.controller.js.
    it('VALID_SITUAZIONI non include più da_approvare (nessun gate di approvazione interna)', () => {
        expect(VALID_SITUAZIONI).toEqual(expect.arrayContaining(['valide', 'revocata', 'sospesa']));
        expect(VALID_SITUAZIONI).not.toContain('da_approvare');
    });
});
