/**
 * @jest-environment node
 */

const {
    parsePgFactor,
    parseOptionalPgFactor,
    riskScore,
    riskScoreLevel,
    decorateRiskRow,
    normalizePgMax,
    highPriorityThreshold,
} = require('./riskScore');

describe('riskScore — R = P × G (scala 1-3)', () => {
    const matrix = [];
    for (let p = 1; p <= 3; p += 1) {
        for (let g = 1; g <= 3; g += 1) {
            matrix.push([p, g, p * g]);
        }
    }

    test.each(matrix)('P=%i × G=%i → R=%i', (p, g, expected) => {
        expect(riskScore(p, g)).toBe(expected);
    });

    it('copre tutta la matrice 3×3 (9 valori, R da 1 a 9)', () => {
        const scores = matrix.map(([, , r]) => r);
        expect(new Set(scores).size).toBe(6);
        expect(Math.min(...scores)).toBe(1);
        expect(Math.max(...scores)).toBe(9);
    });
});

describe('riskScoreLevel — terzi del R massimo', () => {
    it('1-3: 1-3 basso, 4-6 medio, 7-9 alto', () => {
        expect(riskScoreLevel(1)).toBe('basso');
        expect(riskScoreLevel(3)).toBe('basso');
        expect(riskScoreLevel(4)).toBe('medio');
        expect(riskScoreLevel(6)).toBe('medio');
        expect(riskScoreLevel(7)).toBe('alto');
        expect(riskScoreLevel(9)).toBe('alto');
    });

    it('1-5: 1-8 basso, 9-16 medio, 17-25 alto', () => {
        expect(riskScoreLevel(8, 5)).toBe('basso');
        expect(riskScoreLevel(9, 5)).toBe('medio');
        expect(riskScoreLevel(16, 5)).toBe('medio');
        expect(riskScoreLevel(17, 5)).toBe('alto');
        expect(riskScoreLevel(25, 5)).toBe('alto');
    });
});

describe('parsePgFactor — scala azienda', () => {
    it('accetta 1, 2, 3 e default', () => {
        expect(parsePgFactor(1)).toEqual({ ok: true, value: 1 });
        expect(parsePgFactor('3')).toEqual({ ok: true, value: 3 });
        expect(parsePgFactor(undefined, 2)).toEqual({ ok: true, value: 2 });
    });

    it('rifiuta G=4 sulla scala 1-3, accetta sulla 1-5', () => {
        const r = parsePgFactor(4);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/1 e 3/);
        expect(parsePgFactor(4, undefined, 5)).toEqual({ ok: true, value: 4 });
        expect(parsePgFactor(5, undefined, 5)).toEqual({ ok: true, value: 5 });
    });

    it('rifiuta 0 e non interi', () => {
        expect(parsePgFactor(0).ok).toBe(false);
        expect(parsePgFactor(2.5).ok).toBe(false);
    });
});

describe('parseOptionalPgFactor — residuo opzionale', () => {
    it('vuoto / null → null', () => {
        expect(parseOptionalPgFactor('')).toEqual({ ok: true, value: null });
        expect(parseOptionalPgFactor(null)).toEqual({ ok: true, value: null });
        expect(parseOptionalPgFactor(undefined)).toEqual({ ok: true, value: null });
    });

    it('accetta 1-3 e 4 solo se scala 1-5', () => {
        expect(parseOptionalPgFactor(2)).toEqual({ ok: true, value: 2 });
        expect(parseOptionalPgFactor(4).ok).toBe(false);
        expect(parseOptionalPgFactor(4, 5)).toEqual({ ok: true, value: 4 });
    });
});

describe('decorateRiskRow', () => {
    it('aggiunge score e score_level senza mutare P/G', () => {
        const row = decorateRiskRow({ probability: 3, impact: 3, title: 'x' });
        expect(row.score).toBe(9);
        expect(row.score_level).toBe('alto');
        expect(row.probability).toBe(3);
        expect(row.impact).toBe(3);
        expect(row.residual_score).toBeNull();
        expect(row.residual_score_level).toBeNull();
        expect(row.risk_pg_max).toBe(3);
    });

    it('usa risk_pg_max della riga per i livelli', () => {
        const row = decorateRiskRow({ probability: 5, impact: 5, risk_pg_max: 5 });
        expect(row.score).toBe(25);
        expect(row.score_level).toBe('alto');
    });

    it('calcola residuo solo se entrambi P e G residui sono presenti', () => {
        const full = decorateRiskRow({
            probability: 3, impact: 3,
            residual_probability: 1, residual_impact: 2,
        });
        expect(full.residual_score).toBe(2);
        expect(full.residual_score_level).toBe('basso');

        const partial = decorateRiskRow({
            probability: 2, impact: 2,
            residual_probability: 2, residual_impact: null,
        });
        expect(partial.residual_score).toBeNull();
    });
});

describe('normalizePgMax / highPriorityThreshold', () => {
    it('accetta solo 3, 4, 5', () => {
        expect(normalizePgMax(5)).toBe(5);
        expect(normalizePgMax(4)).toBe(4);
        expect(normalizePgMax(2)).toBe(3);
        expect(normalizePgMax(null)).toBe(3);
    });

    it('soglia alta priorità = 2/3 del R max', () => {
        expect(highPriorityThreshold(3)).toBe(6);
        expect(highPriorityThreshold(4)).toBe(10);
        expect(highPriorityThreshold(5)).toBe(16);
    });
});
