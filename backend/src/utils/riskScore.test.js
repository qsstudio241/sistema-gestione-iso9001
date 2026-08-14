/**
 * @jest-environment node
 */

const { parsePgFactor, riskScore, riskScoreLevel, decorateRiskRow } = require('./riskScore');

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

describe('riskScoreLevel — soglie attuali (non M03)', () => {
    it('1-3 basso, 4-6 medio, 7-9 alto', () => {
        expect(riskScoreLevel(1)).toBe('basso');
        expect(riskScoreLevel(3)).toBe('basso');
        expect(riskScoreLevel(4)).toBe('medio');
        expect(riskScoreLevel(6)).toBe('medio');
        expect(riskScoreLevel(7)).toBe('alto');
        expect(riskScoreLevel(9)).toBe('alto');
    });
});

describe('parsePgFactor — rifiuta la scala M03/FMEA', () => {
    it('accetta 1, 2, 3 e default', () => {
        expect(parsePgFactor(1)).toEqual({ ok: true, value: 1 });
        expect(parsePgFactor('3')).toEqual({ ok: true, value: 3 });
        expect(parsePgFactor(undefined, 2)).toEqual({ ok: true, value: 2 });
    });

    it('rifiuta G=4 (valore presente nel draft M03)', () => {
        const r = parsePgFactor(4);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/1 e 3/);
        expect(r.error).toMatch(/4/);
    });

    it('rifiuta 5 (FMEA Pagani) e 0', () => {
        expect(parsePgFactor(5).ok).toBe(false);
        expect(parsePgFactor(0).ok).toBe(false);
        expect(parsePgFactor(2.5).ok).toBe(false);
    });
});

describe('decorateRiskRow', () => {
    it('aggiunge score e score_level senza mutare P/G', () => {
        const row = decorateRiskRow({ probability: 3, impact: 3, title: 'x' });
        expect(row.score).toBe(9);
        expect(row.score_level).toBe('alto');
        expect(row.probability).toBe(3);
        expect(row.impact).toBe(3);
    });
});
