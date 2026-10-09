/**
 * @jest-environment node
 */

describe('ocrExtractor._detectMagickEngine', () => {
    const OLD_ENV = process.env.OCR_MAGICK_ENGINE;

    afterEach(() => {
        jest.resetModules();
        if (OLD_ENV === undefined) delete process.env.OCR_MAGICK_ENGINE;
        else process.env.OCR_MAGICK_ENGINE = OLD_ENV;
    });

    it('rispetta override env = imagemagick', () => {
        jest.resetModules();
        process.env.OCR_MAGICK_ENGINE = 'imagemagick';
        const { _detectMagickEngine } = require('./ocrExtractor');
        expect(_detectMagickEngine()).toBe('imagemagick');
    });

    it('rispetta override env = gm', () => {
        jest.resetModules();
        process.env.OCR_MAGICK_ENGINE = 'graphicsmagick';
        const { _detectMagickEngine } = require('./ocrExtractor');
        expect(_detectMagickEngine()).toBe('gm');
    });

    it('senza override rileva un valore valido', () => {
        jest.resetModules();
        delete process.env.OCR_MAGICK_ENGINE;
        const { _detectMagickEngine } = require('./ocrExtractor');
        expect(['gm', 'imagemagick', 'none']).toContain(_detectMagickEngine());
    });
});

describe('ocrExtractor._isRasterImage', () => {
    const { _isRasterImage } = require('./ocrExtractor');

    it('riconosce un buffer PNG', () => {
        const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
        expect(_isRasterImage(png)).toBe(true);
    });

    it('riconosce un buffer JPEG', () => {
        const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
        expect(_isRasterImage(jpg)).toBe(true);
    });

    it('rifiuta il messaggio di errore testuale di gm per pagina inesistente', () => {
        // gm restituisce ~126 byte di testo tipo "\nRequest did not..." per pagine oltre l'ultima
        const gmError = Buffer.from('\nRequest for page 3 exceeds page count\n'.padEnd(126, ' '));
        expect(_isRasterImage(gmError)).toBe(false);
    });

    it('rifiuta buffer vuoti o troppo corti', () => {
        expect(_isRasterImage(Buffer.alloc(0))).toBe(false);
        expect(_isRasterImage(Buffer.from([0x89, 0x50]))).toBe(false);
        expect(_isRasterImage(null)).toBe(false);
    });

    it('non tratta WebP come PNG/JPEG (pdf2pic non lo produce)', () => {
        const webp = Buffer.concat([
            Buffer.from('RIFF'),
            Buffer.alloc(4),
            Buffer.from('WEBP'),
            Buffer.alloc(8),
        ]);
        expect(_isRasterImage(webp)).toBe(false);
    });
});

describe('ocrExtractor._isOcrableImage', () => {
    const { _isOcrableImage } = require('./ocrExtractor');

    it('accetta PNG, JPEG e WebP', () => {
        const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
        const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
        const webp = Buffer.concat([
            Buffer.from('RIFF'),
            Buffer.alloc(4),
            Buffer.from('WEBP'),
            Buffer.alloc(8),
        ]);
        expect(_isOcrableImage(png)).toBe(true);
        expect(_isOcrableImage(jpg)).toBe(true);
        expect(_isOcrableImage(webp)).toBe(true);
    });

    it('rifiuta testo e buffer corti', () => {
        expect(_isOcrableImage(Buffer.from('not an image'))).toBe(false);
        expect(_isOcrableImage(Buffer.from('RIFF'))).toBe(false);
        expect(_isOcrableImage(null)).toBe(false);
    });
});

describe('ocrExtractor.extractTextFromImageBuffer', () => {
    function pngStub() {
        return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
    }

    afterEach(() => {
        jest.resetModules();
        jest.dontMock('tesseract.js');
    });

    it('riconosce testo da PNG con worker mock', async () => {
        const terminate = jest.fn();
        jest.doMock('tesseract.js', () => ({
            createWorker: jest.fn(async () => ({
                setParameters: jest.fn(),
                recognize: jest.fn(async () => ({ data: { text: '  Procedura acquisti  ' } })),
                terminate,
            })),
        }));
        jest.resetModules();
        const { extractTextFromImageBuffer } = require('./ocrExtractor');
        const text = await extractTextFromImageBuffer(pngStub());
        expect(text).toBe('Procedura acquisti');
        expect(terminate).toHaveBeenCalled();
    });

    it('throw su buffer non immagine senza aprire Tesseract', async () => {
        const createWorker = jest.fn();
        jest.doMock('tesseract.js', () => ({ createWorker }));
        jest.resetModules();
        const { extractTextFromImageBuffer } = require('./ocrExtractor');
        await expect(extractTextFromImageBuffer(Buffer.from('ciao'))).rejects.toThrow('Buffer immagine non valido');
        expect(createWorker).not.toHaveBeenCalled();
    });

    it('throw se Tesseract restituisce vuoto e termina il worker', async () => {
        const terminate = jest.fn();
        jest.doMock('tesseract.js', () => ({
            createWorker: jest.fn(async () => ({
                setParameters: jest.fn(),
                recognize: jest.fn(async () => ({ data: { text: '   \n' } })),
                terminate,
            })),
        }));
        jest.resetModules();
        const { extractTextFromImageBuffer } = require('./ocrExtractor');
        await expect(extractTextFromImageBuffer(pngStub())).rejects.toThrow('non ha estratto testo');
        expect(terminate).toHaveBeenCalled();
    });

    it('throw da recognize: termina comunque il worker', async () => {
        const terminate = jest.fn();
        jest.doMock('tesseract.js', () => ({
            createWorker: jest.fn(async () => ({
                setParameters: jest.fn(),
                recognize: jest.fn(async () => { throw new Error('pixReadStream'); }),
                terminate,
            })),
        }));
        jest.resetModules();
        const { extractTextFromImageBuffer } = require('./ocrExtractor');
        await expect(extractTextFromImageBuffer(pngStub())).rejects.toThrow('pixReadStream');
        expect(terminate).toHaveBeenCalled();
    });
});

describe('ocrExtractor.extractTextWithOCR (retrocompatibilita + layoutSink)', () => {
    const OLD_ENV = process.env.OCR_MAGICK_ENGINE;
    const png = () => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
    const PAGE_1 = {
        text: '  Pagina uno con testo sufficiente  ',
        lines: [
            { text: '4.1 c) ISO 9606\n', bbox: { x0: 10, y0: 220, x1: 500, y1: 250 } },
            { text: '   ', bbox: { x0: 0, y0: 0, x1: 1, y1: 1 } },
            { text: 'x', bbox: { x0: 900, y0: 226, x1: 916, y1: 244 } },
        ],
    };
    const PAGE_2 = {
        text: 'Pagina due con testo sufficiente',
        blocks: [{ paragraphs: [{ lines: [{ text: 'riga blocco', bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }] }] }],
    };

    function mockEngines(pages) {
        process.env.OCR_MAGICK_ENGINE = 'gm';
        const recognize = jest.fn();
        pages.forEach((d) => recognize.mockResolvedValueOnce({ data: d }));
        const terminate = jest.fn();
        jest.doMock('tesseract.js', () => ({
            createWorker: jest.fn(async () => ({ setParameters: jest.fn(), recognize, terminate })),
        }));
        jest.doMock('pdf2pic', () => ({
            fromBuffer: jest.fn(() => async (pageNum) => (
                pageNum <= pages.length ? { buffer: png() } : { buffer: Buffer.from('Request exceeds page count'.padEnd(126, ' ')) }
            )),
        }));
        jest.resetModules();
        return { recognize, terminate };
    }

    afterEach(() => {
        jest.resetModules();
        jest.dontMock('tesseract.js');
        jest.dontMock('pdf2pic');
        if (OLD_ENV === undefined) delete process.env.OCR_MAGICK_ENGINE;
        else process.env.OCR_MAGICK_ENGINE = OLD_ENV;
    });

    it('senza layoutSink: testo identico a prima (pagine unite da riga vuota, trim per pagina)', async () => {
        const { terminate } = mockEngines([PAGE_1, PAGE_2]);
        const { extractTextWithOCR } = require('./ocrExtractor');
        const text = await extractTextWithOCR(Buffer.from('%PDF'), { maxPages: 3 });
        expect(text).toBe('Pagina uno con testo sufficiente\n\nPagina due con testo sufficiente');
        expect(terminate).toHaveBeenCalled();
    });

    it('con layoutSink: stesso testo + righe con bbox per pagina (da data.lines o data.blocks)', async () => {
        mockEngines([PAGE_1, PAGE_2]);
        const { extractTextWithOCR } = require('./ocrExtractor');
        const layoutSink = [];
        const text = await extractTextWithOCR(Buffer.from('%PDF'), { maxPages: 3, layoutSink });
        expect(text).toBe('Pagina uno con testo sufficiente\n\nPagina due con testo sufficiente');
        expect(layoutSink).toEqual([
            {
                page: 1,
                lines: [
                    { text: '4.1 c) ISO 9606', bbox: { x0: 10, y0: 220, x1: 500, y1: 250 } },
                    { text: 'x', bbox: { x0: 900, y0: 226, x1: 916, y1: 244 } },
                ],
            },
            { page: 2, lines: [{ text: 'riga blocco', bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } }] },
        ]);
    });

    it('layoutSink non array (o assente) viene ignorato senza errori', async () => {
        mockEngines([PAGE_1]);
        const { extractTextWithOCR } = require('./ocrExtractor');
        await expect(extractTextWithOCR(Buffer.from('%PDF'), { layoutSink: 'no' })).resolves.toBe('Pagina uno con testo sufficiente');
    });

    it('una pagina con testo troppo corto non produce ne testo ne layout', async () => {
        mockEngines([{ text: 'breve', lines: [] }, PAGE_2]);
        const { extractTextWithOCR } = require('./ocrExtractor');
        const layoutSink = [];
        const text = await extractTextWithOCR(Buffer.from('%PDF'), { layoutSink });
        expect(text).toBe('Pagina due con testo sufficiente');
        expect(layoutSink.map((p) => p.page)).toEqual([2]);
    });
});
