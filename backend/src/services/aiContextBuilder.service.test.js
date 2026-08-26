/**
 * @jest-environment node
 */

/* eslint-env jest */

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

jest.mock('./normBroker.service', () => ({
    getFullNorm: jest.fn(async () => []),
    getClauseText: jest.fn(async () => null),
    buildNormAbsentMessage: jest.fn(({ standardCode, clauseRef, kind } = {}) => (
        `Il testo di ${standardCode || 'norma'}${clauseRef ? ` §${clauseRef}` : ''} non è presente nell'archivio locale (${kind || 'clause'}). Non valuto a caso.`
    )),
}));

jest.mock('./normChunker.service', () => ({
    searchSimilar: jest.fn(async () => []),
}));

jest.mock('../config/database', () => ({
    query: jest.fn(async () => ({ recordset: [] })),
}));

const {
    buildReviewRequirementsContext,
    buildAuditConclusionsContext,
    MATERIAL_CERTIFICATE_REVIEW_HINT,
} = require('./aiContextBuilder.service');
const normBroker = require('./normBroker.service');

describe('aiContextBuilder.service — ISO-3 identified_standards', () => {
    test('userPrompt cita norme certificato e distingue base/apporto', async () => {
        const built = await buildReviewRequirementsContext({
            capitolatoText: 'Richiesta certificato 3.1 EN 10204 su S355 e filo ISO 14341',
            companyId: null,
            organizationId: 1,
        });
        expect(built.userPrompt).toContain(MATERIAL_CERTIFICATE_REVIEW_HINT);
        expect(built.userPrompt).toContain('EN 10204');
        expect(built.userPrompt).toContain('ISO 14341');
        expect(built.userPrompt).toContain('field_key');
        expect(built.userPrompt).toMatch(/APPORTO/);
        expect(built.userPrompt).toContain('Richiesta certificato 3.1 EN 10204');
    });

    test('standard assente: systemPrompt avvisa e vieta di inventare requisiti', async () => {
        normBroker.getFullNorm.mockResolvedValueOnce([]);
        const built = await buildReviewRequirementsContext({
            capitolatoText: 'Capitolato senza norme in archivio',
            companyId: null,
            organizationId: 1,
            standardCodes: ['ISO_9712_2022'],
        });
        expect(built.systemPrompt).toContain('NORMA ASSENTE');
        expect(built.systemPrompt).toMatch(/ISO_9712_2022/);
        expect(built.systemPrompt).toMatch(/Non valuto a caso/);
        expect(built.systemPrompt).toMatch(/NON inventare requisiti/);
    });
});

describe('aiContextBuilder.service — NG-4 clausola assente', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        normBroker.getClauseText.mockResolvedValue(null);
        normBroker.getFullNorm.mockResolvedValue([]);
    });

    test('getClauseText null: non inietta testo norma, aggiunge avviso onesto', async () => {
        const built = await buildAuditConclusionsContext({
            auditMetrics: { total: 1, nc: 1, oss: 0, om: 0, nv: 0, conformities: 0 },
            standardCodes: ['ISO_9001_2015'],
            findings: [{ clauseRef: '8.4.2', status: 'NON_COMPLIANT', notes: 'Fornitore non valutato', standardCode: 'ISO_9001_2015' }],
            organizationId: 1,
        });
        expect(normBroker.getClauseText).toHaveBeenCalledWith('ISO_9001_2015', '8.4');
        expect(built.systemPrompt).toContain('NORMA ASSENTE');
        expect(built.systemPrompt).toMatch(/8\.4/);
        expect(built.systemPrompt).not.toMatch(/§8\.4 \(ISO 9001 2015\):/);
        expect(built.systemPrompt).toMatch(/NON inventare il testo delle clausole assenti/);
    });
});
