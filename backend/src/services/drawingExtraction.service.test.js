/**
 * @jest-environment node
 */

/* eslint-env jest */

jest.mock('./adapters/geminiAdapter', () => ({
    generateVision: jest.fn(),
}));

const geminiAdapter = require('./adapters/geminiAdapter');
const service = require('./drawingExtraction.service');

describe('drawingExtraction.service — parseRequirementsResponse', () => {
    test('parses object with requirements array', () => {
        const out = service.parseRequirementsResponse(
            '{"requirements":[{"req_type":"material","value_text":"S355JR","field_key":"material","confidence":0.9}]}',
        );
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({
            req_type: 'material',
            value_text: 'S355JR',
            field_key: 'material',
            confidence: 0.9,
        });
    });

    test('parses a bare JSON array', () => {
        const out = service.parseRequirementsResponse(
            '[{"req_type":"dimension","value_text":"120","unit":"mm"}]',
        );
        expect(out).toHaveLength(1);
        expect(out[0].unit).toBe('mm');
    });

    test('strips markdown code fences', () => {
        const out = service.parseRequirementsResponse(
            '```json\n{"requirements":[{"req_type":"note","value_text":"saldature a piena penetrazione"}]}\n```',
        );
        expect(out).toHaveLength(1);
        expect(out[0].req_type).toBe('note');
    });

    test('recovers JSON embedded in extra prose', () => {
        const out = service.parseRequirementsResponse(
            'Ecco i requisiti: {"requirements":[{"req_type":"weld_symbol","value_text":"a4"}]} fine.',
        );
        expect(out).toHaveLength(1);
        expect(out[0].req_type).toBe('weld_symbol');
    });

    test('returns empty array on non-JSON content (defensive)', () => {
        expect(service.parseRequirementsResponse('non riesco a leggere il disegno')).toEqual([]);
        expect(service.parseRequirementsResponse('')).toEqual([]);
        expect(service.parseRequirementsResponse(null)).toEqual([]);
    });

    test('coerces unknown req_type to note and drops items without value_text', () => {
        const out = service.parseRequirementsResponse(
            '{"requirements":[{"req_type":"banana","value_text":"x"},{"req_type":"material"}]}',
        );
        expect(out).toHaveLength(1);
        expect(out[0].req_type).toBe('note');
    });

    test('clamps confidence to 0..1 range', () => {
        const out = service.parseRequirementsResponse(
            '[{"req_type":"note","value_text":"a","confidence":5},{"req_type":"note","value_text":"b","confidence":-2}]',
        );
        expect(out[0].confidence).toBe(1);
        expect(out[1].confidence).toBe(0);
    });
});

describe('drawingExtraction.service — extractFromFile (provider gemini mockato)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.DRAWING_EXTRACTION_PROVIDER;
    });

    test('invokes gemini adapter with base64 + json format and returns normalized requirements', async () => {
        geminiAdapter.generateVision.mockResolvedValue({
            content: '{"requirements":[{"req_type":"material","value_text":"S275JR","confidence":0.8}]}',
            model: 'gemini-2.5-flash',
        });

        const buffer = Buffer.from('PNGDATA');
        const result = await service.extractFromFile(buffer, 'image/png');

        expect(geminiAdapter.generateVision).toHaveBeenCalledTimes(1);
        const [payload, options] = geminiAdapter.generateVision.mock.calls[0];
        expect(payload.files[0]).toEqual({
            mimeType: 'image/png',
            data: buffer.toString('base64'),
        });
        expect(options.responseFormat).toBe('json');
        expect(result.provider).toBe('gemini');
        expect(result.requirements).toHaveLength(1);
        expect(result.requirements[0].value_text).toBe('S275JR');
    });

    test('propagates AI_NOT_CONFIGURED from adapter (managed error upstream)', async () => {
        const err = new Error('GEMINI_API_KEY is not set');
        err.code = 'AI_NOT_CONFIGURED';
        geminiAdapter.generateVision.mockRejectedValue(err);

        await expect(service.extractFromFile(Buffer.from('x'), 'image/png')).rejects.toMatchObject({
            code: 'AI_NOT_CONFIGURED',
        });
    });

    test('throws EXTRACTION_PROVIDER_NOT_SUPPORTED for unknown provider', async () => {
        await expect(
            service.extractFromFile(Buffer.from('x'), 'image/png', { provider: 'werk24' }),
        ).rejects.toMatchObject({ code: 'EXTRACTION_PROVIDER_NOT_SUPPORTED' });
    });

    test('resolveProvider honours env override', () => {
        process.env.DRAWING_EXTRACTION_PROVIDER = 'werk24';
        expect(service.resolveProvider()).toBe('werk24');
        expect(service.resolveProvider({ provider: 'gemini' })).toBe('gemini');
    });
});
