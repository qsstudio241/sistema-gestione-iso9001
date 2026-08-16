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
}));

jest.mock('./normChunker.service', () => ({
    searchSimilar: jest.fn(async () => []),
}));

jest.mock('../config/database', () => ({
    query: jest.fn(async () => ({ recordset: [] })),
}));

const {
    buildReviewRequirementsContext,
    MATERIAL_CERTIFICATE_REVIEW_HINT,
} = require('./aiContextBuilder.service');

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
});
