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
