/**
 * @jest-environment node
 *
 * extractHeaderTextWithOCR: OCR della sola fascia alta della prima pagina (moduli OCR mockati).
 */

process.env.OCR_MAGICK_ENGINE = 'gm';

function fakePng(width, height) {
    const b = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
    b.writeUInt32BE(13, 8);
    b.write('IHDR', 12, 'ascii');
    b.writeUInt32BE(width, 16);
    b.writeUInt32BE(height, 20);
    return b;
}

const mockConverter = jest.fn();
const mockFromBuffer = jest.fn(() => mockConverter);
jest.mock('pdf2pic', () => ({ fromBuffer: (...a) => mockFromBuffer(...a) }));

const mockCrop = jest.fn();
const mockToBuffer = jest.fn();
const mockGmChain = { crop: (...a) => { mockCrop(...a); return mockGmChain; }, toBuffer: (...a) => mockToBuffer(...a) };
const mockGmFactory = jest.fn(() => mockGmChain);
jest.mock('gm', () => ({ subClass: jest.fn(() => (...a) => mockGmFactory(...a)) }));

const mockRecognize = jest.fn();
const mockTerminate = jest.fn(() => Promise.resolve());
const mockCreateWorker = jest.fn(() => Promise.resolve({
    setParameters: jest.fn(() => Promise.resolve()),
    recognize: (...a) => mockRecognize(...a),
    terminate: () => mockTerminate(),
}));
jest.mock('tesseract.js', () => ({ createWorker: (...a) => mockCreateWorker(...a) }));

const {
    extractHeaderTextWithOCR,
    HEADER_OCR_HEIGHT_FRACTION,
    HEADER_OCR_TIMEOUT_MS,
} = require('./ocrExtractor');

const PAGE = fakePng(1654, 2339);
const BAND = fakePng(1654, 585);

beforeEach(() => {
    jest.clearAllMocks();
    mockConverter.mockResolvedValue({ buffer: PAGE });
    mockToBuffer.mockImplementation((fmt, cb) => cb(null, BAND));
    mockRecognize.mockResolvedValue({ data: { text: '  A) TEC-Eurolab\nCERTIFICATION BODY \n' } });
});

describe('extractHeaderTextWithOCR', () => {
    it('costanti: fascia iniziale 25% e timeout 20 s', () => {
        expect(HEADER_OCR_HEIGHT_FRACTION).toBe(0.25);
        expect(HEADER_OCR_TIMEOUT_MS).toBe(20000);
    });

    it('renderizza SOLO la pagina 1 e riconosce solo la fascia alta ritagliata', async () => {
        const text = await extractHeaderTextWithOCR(Buffer.from('%PDF'));
        expect(text).toBe('A) TEC-Eurolab\nCERTIFICATION BODY');
        expect(mockConverter).toHaveBeenCalledTimes(1);
        expect(mockConverter).toHaveBeenCalledWith(1, { responseType: 'buffer' });
        expect(mockCrop).toHaveBeenCalledWith(1654, Math.round(2339 * 0.25), 0, 0);
        expect(mockRecognize).toHaveBeenCalledTimes(1);
        expect(mockRecognize).toHaveBeenCalledWith(BAND);
        expect(mockCreateWorker).toHaveBeenCalledWith('ita+eng', 1, expect.any(Object));
        expect(mockTerminate).toHaveBeenCalled();
    });

    it('la frazione e configurabile; valori non validi tornano al default', async () => {
        await extractHeaderTextWithOCR(Buffer.from('%PDF'), { heightFraction: 0.2 });
        expect(mockCrop).toHaveBeenLastCalledWith(1654, Math.round(2339 * 0.2), 0, 0);
        await extractHeaderTextWithOCR(Buffer.from('%PDF'), { heightFraction: 3 });
        expect(mockCrop).toHaveBeenLastCalledWith(1654, Math.round(2339 * HEADER_OCR_HEIGHT_FRACTION), 0, 0);
    });

    it('OCR vuoto: restituisce stringa vuota senza lanciare', async () => {
        mockRecognize.mockResolvedValue({ data: { text: '   ' } });
        await expect(extractHeaderTextWithOCR(Buffer.from('%PDF'))).resolves.toBe('');
    });

    it('rendering non valido: errore (il chiamante fa il fallback)', async () => {
        mockConverter.mockResolvedValue({ buffer: Buffer.from('Error: page out of range') });
        await expect(extractHeaderTextWithOCR(Buffer.from('%PDF'))).rejects.toThrow(/non valido/);
        expect(mockRecognize).not.toHaveBeenCalled();
    });

    it('errore di pdf2pic o del ritaglio: errore, nessun worker aperto', async () => {
        mockConverter.mockRejectedValue(new Error('gs mancante'));
        await expect(extractHeaderTextWithOCR(Buffer.from('%PDF'))).rejects.toThrow('gs mancante');
        mockConverter.mockResolvedValue({ buffer: PAGE });
        mockToBuffer.mockImplementation((fmt, cb) => cb(new Error('crop fallito')));
        await expect(extractHeaderTextWithOCR(Buffer.from('%PDF'))).rejects.toThrow('crop fallito');
        expect(mockCreateWorker).not.toHaveBeenCalled();
    });

    it('errore di Tesseract: errore e worker terminato', async () => {
        mockRecognize.mockRejectedValue(new Error('tesseract ko'));
        await expect(extractHeaderTextWithOCR(Buffer.from('%PDF'))).rejects.toThrow('tesseract ko');
        expect(mockTerminate).toHaveBeenCalled();
    });

    it('timeout: rifiuta entro il limite e termina il worker', async () => {
        mockRecognize.mockImplementation(() => new Promise(() => {}));
        await expect(extractHeaderTextWithOCR(Buffer.from('%PDF'), { timeoutMs: 50 })).rejects.toThrow(/Timeout/);
        expect(mockTerminate).toHaveBeenCalled();
    });
});
