/**
 * @jest-environment node
 */

/* eslint-env jest */

jest.mock('./aiProviderAdapter', () => ({
    chat: jest.fn(),
    getActiveProvider: jest.fn(() => 'openai'),
}));

jest.mock('../utils/importPdfText', () => ({
    extractPdfText: jest.fn(),
}));

const { buildUserPrompt, parseRequirements } = require('./caseTextAnalysis.service');
const { CAPITOLATO_MATERIAL_FIELD_KEYS } = require('../data/capitolatoMaterialKeys');

describe('caseTextAnalysis.service — ISO-3 chiavi capitolato', () => {
    test('buildUserPrompt elenca chiavi base e apporto', () => {
        const prompt = buildUserPrompt('Capitolato prova S355 e filo G 42 4 M21 3Si1');
        expect(prompt).toContain('Capitolato prova');
        for (const row of CAPITOLATO_MATERIAL_FIELD_KEYS) {
            expect(prompt).toContain(row.key);
        }
        expect(prompt).toMatch(/material_role/);
        expect(prompt).toMatch(/filler_designation/);
        expect(prompt).toMatch(/2\.1 \| 2\.2 \| 3\.1 \| 3\.2/);
        expect(prompt).toMatch(/Non inventare soglie/);
    });

    test('parseRequirements canonizza field_key MTC → inspection_document_type', () => {
        const rows = parseRequirements(JSON.stringify({
            requirements: [
                {
                    req_type: 'spec',
                    field_key: 'MTC',
                    value_text: 'certificato 3.1 EN 10204',
                    confidence: 0.9,
                },
                {
                    req_type: 'spec',
                    field_key: 'filo',
                    value_text: 'materiale d\'apporto richiesto',
                    confidence: 0.8,
                },
            ],
        }));
        expect(rows).toHaveLength(2);
        expect(rows[0].field_key).toBe('inspection_document_type');
        expect(rows[1].field_key).toBe('material_role');
        expect(rows[0].req_type).toBe('spec');
    });

    test('parseRequirements scarta righe senza value_text', () => {
        expect(parseRequirements('{"requirements":[{"req_type":"spec","field_key":"x"}]}')).toEqual([]);
    });
});
