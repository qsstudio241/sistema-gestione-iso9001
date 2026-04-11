/**
 * @jest-environment node
 */

const { extractStructuredFromText, stripCodeFences } = require('./importAiExtraction.service');

describe('stripCodeFences', () => {
    it('rimuove fence json', () => {
        const s = '```json\n{"a":1}\n```';
        expect(stripCodeFences(s)).toBe('{"a":1}');
    });
});

describe('extractStructuredFromText', () => {
    const originalKey = process.env.OPENAI_API_KEY;
    const originalFetch = global.fetch;

    afterEach(() => {
        process.env.OPENAI_API_KEY = originalKey;
        global.fetch = originalFetch;
    });

    it('senza API key lancia AI_NOT_CONFIGURED', async () => {
        delete process.env.OPENAI_API_KEY;
        await expect(
            extractStructuredFromText({ text: 'hello', documentTypeHint: null })
        ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    });

    it('testo vuoto lancia EMPTY_SOURCE_TEXT', async () => {
        process.env.OPENAI_API_KEY = 'sk-test';
        await expect(
            extractStructuredFromText({ text: '   ', documentTypeHint: null })
        ).rejects.toMatchObject({ code: 'EMPTY_SOURCE_TEXT' });
    });

    it('parsa risposta OpenAI ok', async () => {
        process.env.OPENAI_API_KEY = 'sk-test';
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                title: 'Doc',
                                document_type_guess: 'wps',
                                summary: 'Sintesi',
                                key_values: { codice: 'W-01' },
                                dates: [],
                                extraction_confidence: 80,
                                warnings: [],
                            }),
                        },
                    },
                ],
            }),
        });

        const out = await extractStructuredFromText({
            text: 'Contenuto WPS codice W-01',
            documentTypeHint: 'wps',
        });
        expect(out.model).toBeTruthy();
        expect(out.data.title).toBe('Doc');
        expect(out.data.key_values.codice).toBe('W-01');
    });
});
