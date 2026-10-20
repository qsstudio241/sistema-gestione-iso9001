/**
 * @jest-environment node
 */

const {
    encodePng,
    decodePng,
    rowInkFromRgba,
    findHorizontalSplitY,
    splitCombinedIfNeeded,
} = require('./weldSketchPng');

function paintBand(rgba, width, y0, y1, rgb) {
    for (let y = y0; y < y1; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4;
            rgba[i] = rgb[0];
            rgba[i + 1] = rgb[1];
            rgba[i + 2] = rgb[2];
            rgba[i + 3] = 255;
        }
    }
}

function stackedPng({ width = 60, height = 80, topEnd = 30, botStart = 48 } = {}) {
    const rgba = Buffer.alloc(width * height * 4, 255);
    paintBand(rgba, width, 4, topEnd, [20, 20, 20]);
    paintBand(rgba, width, botStart, height - 4, [20, 20, 20]);
    return { png: encodePng(width, height, rgba), width, height, rgba };
}

describe('weldSketchPng — split orizzontale IIS', () => {
    it('roundtrip encode/decode RGB', () => {
        const width = 8;
        const height = 6;
        const rgba = Buffer.alloc(width * height * 4, 255);
        rgba[0] = 10;
        rgba[1] = 20;
        rgba[2] = 30;
        const png = encodePng(width, height, rgba);
        const decoded = decodePng(png);
        expect(decoded.width).toBe(8);
        expect(decoded.height).toBe(6);
        expect(decoded.rgba[0]).toBe(10);
        expect(decoded.rgba[1]).toBe(20);
        expect(decoded.rgba[2]).toBe(30);
    });

    it('trova il gap bianco tra due bande di inchiostro', () => {
        const { rgba, width, height } = stackedPng();
        const ink = rowInkFromRgba(rgba, width, height);
        const y = findHorizontalSplitY(ink);
        expect(y).toBeGreaterThanOrEqual(30);
        expect(y).toBeLessThanOrEqual(48);
    });

    it('splitCombinedIfNeeded salva due PNG (joint sopra, sequenza sotto)', () => {
        const { png, height } = stackedPng();
        const out = splitCombinedIfNeeded(png);
        expect(out.ok).toBe(true);
        expect(out.y).toBeGreaterThan(8);
        expect(out.y).toBeLessThan(height - 8);
        const top = decodePng(out.top);
        const bot = decodePng(out.bottom);
        expect(top.height + bot.height).toBe(height);
        expect(top.width).toBe(60);
        expect(bot.width).toBe(60);
    });

    it('senza gap chiaro restituisce no_gap', () => {
        const width = 50;
        const height = 50;
        const rgba = Buffer.alloc(width * height * 4, 255);
        paintBand(rgba, width, 0, height, [30, 30, 30]);
        const out = splitCombinedIfNeeded(encodePng(width, height, rgba));
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('no_gap');
    });
});
