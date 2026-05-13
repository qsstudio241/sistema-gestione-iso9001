/**
 * @jest-environment node
 */

jest.mock('./aiProviderAdapter', () => ({
    chat: jest.fn(),
    getActiveProvider: jest.fn(),
}));

const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { extractStructuredFromText, stripCodeFences } = require('./importAiExtraction.service');

describe('stripCodeFences', () => {
    it('rimuove fence json', () => {
        const s = '```json\n{"a":1}\n```';
        expect(stripCodeFences(s)).toBe('{"a":1}');
    });
});

describe('extractStructuredFromText', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('senza provider attivo lancia AI_NOT_CONFIGURED', async () => {
        getActiveProvider.mockReturnValue(null);
        await expect(
            extractStructuredFromText({ text: 'hello', documentTypeHint: null })
        ).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
        expect(chat).not.toHaveBeenCalled();
    });

    it('testo vuoto lancia EMPTY_SOURCE_TEXT', async () => {
        getActiveProvider.mockReturnValue('gemini');
        await expect(
            extractStructuredFromText({ text: '   ', documentTypeHint: null })
        ).rejects.toMatchObject({ code: 'EMPTY_SOURCE_TEXT' });
        expect(chat).not.toHaveBeenCalled();
    });

    it('parsa risposta AI ok', async () => {
        getActiveProvider.mockReturnValue('gemini');
        const payload = {
            title: 'Doc',
            document_type_guess: 'wps',
            summary: 'Sintesi',
            key_values: { codice: 'W-01' },
            dates: [],
            extraction_confidence: 80,
            warnings: [],
        };
        chat.mockResolvedValue({
            content: JSON.stringify(payload),
            model: 'gemini-1.5-flash',
            tokens: { input: 100, output: 50 },
            cost: 0,
        });

        const out = await extractStructuredFromText({
            text: 'Contenuto WPS codice W-01',
            documentTypeHint: 'wps',
        });
        expect(out.model).toBe('gemini-1.5-flash');
        expect(out.data.title).toBe('Doc');
        expect(out.data.key_values.codice).toBe('W-01');
        expect(out.raw_content).toBe(JSON.stringify(payload));
        expect(chat).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ role: 'system' }),
                expect.objectContaining({ role: 'user' }),
            ]),
            { temperature: 0.2, responseFormat: 'json' }
        );
    });

    it('JSON non valido lancia AI_INVALID_JSON', async () => {
        getActiveProvider.mockReturnValue('gemini');
        chat.mockResolvedValue({
            content: 'not-json',
            model: 'gemini-1.5-flash',
            tokens: { input: 1, output: 1 },
            cost: 0,
        });
        await expect(
            extractStructuredFromText({ text: 'x', documentTypeHint: null })
        ).rejects.toMatchObject({ code: 'AI_INVALID_JSON' });
    });

    it('JSON con forma non oggetto lancia AI_BAD_SHAPE', async () => {
        getActiveProvider.mockReturnValue('gemini');
        chat.mockResolvedValue({
            content: JSON.stringify([1, 2]),
            model: 'gemini-1.5-flash',
            tokens: { input: 1, output: 1 },
            cost: 0,
        });
        await expect(
            extractStructuredFromText({ text: 'x', documentTypeHint: null })
        ).rejects.toMatchObject({ code: 'AI_BAD_SHAPE' });
    });

    it('contenuto vuoto lancia AI_EMPTY_RESPONSE', async () => {
        getActiveProvider.mockReturnValue('gemini');
        chat.mockResolvedValue({
            content: '',
            model: 'gemini-1.5-flash',
            tokens: { input: 1, output: 0 },
            cost: 0,
        });
        await expect(
            extractStructuredFromText({ text: 'x', documentTypeHint: null })
        ).rejects.toMatchObject({ code: 'AI_EMPTY_RESPONSE' });
    });

    it('propaga AI_UPSTREAM_ERROR da chat', async () => {
        getActiveProvider.mockReturnValue('gemini');
        const upstream = new Error('rate limit');
        upstream.code = 'AI_UPSTREAM_ERROR';
        upstream.status = 429;
        chat.mockRejectedValue(upstream);
        await expect(
            extractStructuredFromText({ text: 'x', documentTypeHint: null })
        ).rejects.toMatchObject({ code: 'AI_UPSTREAM_ERROR', status: 429 });
    });

    it('errore senza codice da chat diventa AI_REQUEST_FAILED', async () => {
        getActiveProvider.mockReturnValue('gemini');
        chat.mockRejectedValue(new Error('boom'));
        await expect(
            extractStructuredFromText({ text: 'x', documentTypeHint: null })
        ).rejects.toMatchObject({ code: 'AI_REQUEST_FAILED' });
    });
});
