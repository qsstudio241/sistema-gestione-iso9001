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
});
