/**
 * @jest-environment node
 */

const {
    isSignificantReviewChange,
    mergeRiskReviewState,
    buildRiskReviewSnapshot,
} = require('./riskReviews');

describe('isSignificantReviewChange', () => {
    const base = {
        probability: 2, impact: 3, impact_sign: 1, analysis_method: 'pxg',
        swot_quadrant: null, residual_probability: null, residual_impact: null,
        effectiveness_note: null, current_actions: 'A', further_actions: 'B', nature: 'risk',
    };

    it('titolo da solo non è significativo', () => {
        expect(isSignificantReviewChange(
            { ...base, title: 'Uno' },
            { ...base, title: 'Due' },
        )).toBe(false);
    });

    it('cambio G è significativo', () => {
        expect(isSignificantReviewChange(base, { ...base, impact: 2 })).toBe(true);
    });

    it('testo 4.1/4.2 non è nel confronto', () => {
        expect(isSignificantReviewChange(
            { ...base, context_text: 'x', interested_parties_text: 'y' },
            { ...base, context_text: 'z', interested_parties_text: 'w' },
        )).toBe(false);
    });

    it('nota efficacia vuota vs testo è significativo', () => {
        expect(isSignificantReviewChange(base, { ...base, effectiveness_note: 'ok' })).toBe(true);
    });
});

describe('merge + snapshot', () => {
    it('merge tiene i campi non inviati', () => {
        const next = mergeRiskReviewState(
            { probability: 2, impact: 3, further_actions: 'piano' },
            { title: 'Nuovo', further_actions: undefined },
        );
        expect(next.probability).toBe(2);
        expect(next.title).toBe('Nuovo');
        expect(next.further_actions).toBe('piano');
    });

    it('snapshot normalizza metodo e segno', () => {
        const snap = buildRiskReviewSnapshot({
            risk_id: 1, title: 'T', probability: 2, impact: 3,
            analysis_method: 'swot_signed', swot_quadrant: 't', impact_sign: -1,
        }, { organization_id: 9, recorded_by: 4 });
        expect(snap.swot_quadrant).toBe('T');
        expect(snap.impact_sign).toBe(-1);
        expect(snap.organization_id).toBe(9);
        expect(snap.recorded_by).toBe(4);
    });
});
