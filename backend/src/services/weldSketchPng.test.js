/**
 * @jest-environment node
 *
 * Fixture PNG sintetici (nessun PDF/crop cliente). stackedPng ≈ VB0377 (gap pulito).
 */

const {
    encodePng,
    decodePng,
    darkMaskFromRgba,
    rowInkFromRgba,
    findHorizontalSplit,
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

function fillRect(rgba, width, x0, y0, x1, y1, rgb) {
    for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
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

/** Due masse (giunto / sequenza) + quota verticale e «g» nel gap, come VB0387. */
function dimLineCrossingGapPng() {
    const width = 120;
    const height = 160;
    const rgba = Buffer.alloc(width * height * 4, 255);
    fillRect(rgba, width, 18, 8, 102, 62, [25, 25, 25]);
    fillRect(rgba, width, 22, 98, 100, 152, [25, 25, 25]);
    fillRect(rgba, width, 8, 8, 11, 152, [20, 20, 20]);
    fillRect(rgba, width, 70, 74, 82, 88, [30, 30, 30]);
    fillRect(rgba, width, 14, 79, 68, 81, [20, 20, 20]);
    return {
        png: encodePng(width, height, rgba),
        width,
        height,
        rgba,
        gapY0: 62,
        gapY1: 98,
    };
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

    it('maxThinRun azzera le righe con sola linea verticale sottile', () => {
        const width = 80;
        const height = 50;
        const rgba = Buffer.alloc(width * height * 4, 255);
        fillRect(rgba, width, 10, 0, 13, height, [15, 15, 15]);
        const raw = rowInkFromRgba(rgba, width, height);
        const thin = rowInkFromRgba(rgba, width, height, 240, { maxThinRun: 4 });
        expect(raw[20]).toBeGreaterThan(0.02);
        expect(thin[20]).toBe(0);
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
        expect(['no_gap', 'single_joint']).toContain(out.reason);
    });

    it('decodePng accetta grayscale 8-bit (colorType 0)', () => {
        const zlib = require('zlib');
        const width = 4;
        const height = 3;
        const raw = Buffer.alloc((width + 1) * height, 80);
        for (let y = 0; y < height; y += 1) raw[y * (width + 1)] = 0;
        const ihdr = Buffer.alloc(13);
        ihdr.writeUInt32BE(width, 0);
        ihdr.writeUInt32BE(height, 4);
        ihdr[8] = 8;
        ihdr[9] = 0;
        const crc32 = (buf) => {
            let c = 0xffffffff;
            const table = new Uint32Array(256);
            for (let n = 0; n < 256; n += 1) {
                let x = n;
                for (let k = 0; k < 8; k += 1) x = (x & 1) ? (0xedb88320 ^ (x >>> 1)) : (x >>> 1);
                table[n] = x >>> 0;
            }
            for (let i = 0; i < buf.length; i += 1) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
            return (c ^ 0xffffffff) >>> 0;
        };
        const chunk = (type, data) => {
            const typeBuf = Buffer.from(type, 'ascii');
            const len = Buffer.alloc(4);
            len.writeUInt32BE(data.length, 0);
            const crcBuf = Buffer.alloc(4);
            crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
            return Buffer.concat([len, typeBuf, data, crcBuf]);
        };
        const png = Buffer.concat([
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            chunk('IHDR', ihdr),
            chunk('IDAT', zlib.deflateSync(raw)),
            chunk('IEND', Buffer.alloc(0)),
        ]);
        const decoded = decodePng(png);
        expect(decoded).toBeTruthy();
        expect(decoded.width).toBe(4);
        expect(decoded.height).toBe(3);
        expect(decoded.rgba[0]).toBe(80);
        expect(decoded.rgba[1]).toBe(80);
        expect(decoded.rgba[2]).toBe(80);
        expect(decoded.rgba[3]).toBe(255);
    });

    it('VB0377-like: gap pulito, split tra le due bande (non regressione)', () => {
        const { png, height } = stackedPng({ width: 80, height: 100, topEnd: 38, botStart: 58 });
        const out = splitCombinedIfNeeded(png);
        expect(out.ok).toBe(true);
        expect(out.y).toBeGreaterThanOrEqual(38);
        expect(out.y).toBeLessThanOrEqual(58);
        expect(decodePng(out.top).height + decodePng(out.bottom).height).toBe(height);
    });

    it('quota verticale + lettera nel gap: split automatico nel bianco (VB0387-like)', () => {
        const fx = dimLineCrossingGapPng();
        const ink = rowInkFromRgba(fx.rgba, fx.width, fx.height, 240, { maxThinRun: 4 });
        const mask = darkMaskFromRgba(fx.rgba, fx.width, fx.height);
        const y = findHorizontalSplitY(ink, { mask, width: fx.width, height: fx.height });
        expect(y).not.toBeNull();
        expect(y).toBeGreaterThanOrEqual(fx.gapY0);
        expect(y).toBeLessThanOrEqual(fx.gapY1);
        const out = splitCombinedIfNeeded(fx.png);
        expect(out.ok).toBe(true);
        expect(out.y).toBeGreaterThanOrEqual(fx.gapY0);
        expect(out.y).toBeLessThanOrEqual(fx.gapY1);
        expect(out.y).toBeLessThan(74);
        expect(out.y).toBeGreaterThan(8);
    });

    it('quota 3px attaccata al giunto (un solo CC): split nel gap, non no_gap', () => {
        const width = 120;
        const height = 160;
        const rgba = Buffer.alloc(width * height * 4, 255);
        fillRect(rgba, width, 18, 8, 102, 62, [25, 25, 25]);
        fillRect(rgba, width, 22, 98, 100, 152, [25, 25, 25]);
        fillRect(rgba, width, 20, 8, 23, 152, [20, 20, 20]);
        const out = splitCombinedIfNeeded(encodePng(width, height, rgba));
        expect(out.ok).toBe(true);
        expect(out.y).toBeGreaterThanOrEqual(62);
        expect(out.y).toBeLessThanOrEqual(98);
    });

    it('ponte largo tra giunto e sequenza: non taglia, no_gap', () => {
        const width = 100;
        const height = 120;
        const rgba = Buffer.alloc(width * height * 4, 255);
        fillRect(rgba, width, 10, 6, 90, 48, [20, 20, 20]);
        fillRect(rgba, width, 10, 72, 90, 114, [20, 20, 20]);
        fillRect(rgba, width, 40, 40, 60, 80, [20, 20, 20]);
        const out = splitCombinedIfNeeded(encodePng(width, height, rgba));
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('no_gap');
    });

    /** Nessuna riga bianca: in ogni riga del gap c'è un trattino (inchiostro > soglia). */
    function speckledGapPng() {
        const width = 120;
        const height = 160;
        const rgba = Buffer.alloc(width * height * 4, 255);
        fillRect(rgba, width, 16, 8, 104, 58, [22, 22, 22]);
        fillRect(rgba, width, 18, 104, 102, 152, [22, 22, 22]);
        for (let y = 60; y < 102; y += 1) {
            const x0 = 8 + ((y * 7) % 90);
            fillRect(rgba, width, x0, y, x0 + 8, y + 1, [18, 18, 18]);
        }
        return { png: encodePng(width, height, rgba), width, height, gapY0: 58, gapY1: 104 };
    }

    it('gap con inchiostro sparso (nessuna riga bianca): valle + CC, split', () => {
        const fx = speckledGapPng();
        const out = splitCombinedIfNeeded(fx.png);
        expect(out.ok).toBe(true);
        expect(out.y).toBeGreaterThanOrEqual(fx.gapY0);
        expect(out.y).toBeLessThanOrEqual(fx.gapY1);
        expect(out.confidence).toBeGreaterThanOrEqual(0.55);
        expect(out.reason).toBe('valley');
    });

    /** Giunto a tratti sottili + sequenza piena, quote nel gap (VB0387-like). */
    function sparseJointFilledSequencePng() {
        const width = 140;
        const height = 180;
        const rgba = Buffer.alloc(width * height * 4, 255);
        fillRect(rgba, width, 30, 12, 32, 68, [20, 20, 20]);
        fillRect(rgba, width, 108, 12, 110, 68, [20, 20, 20]);
        fillRect(rgba, width, 30, 66, 110, 68, [20, 20, 20]);
        fillRect(rgba, width, 68, 12, 72, 40, [20, 20, 20]);
        fillRect(rgba, width, 12, 12, 14, 168, [25, 25, 25]);
        fillRect(rgba, width, 50, 78, 78, 86, [30, 30, 30]);
        fillRect(rgba, width, 16, 81, 100, 83, [20, 20, 20]);
        fillRect(rgba, width, 28, 108, 116, 168, [25, 25, 25]);
        return { png: encodePng(width, height, rgba), width, height, gapY0: 68, gapY1: 108 };
    }

    it('giunto a linee sottili + sequenza piena e quote: split automatico', () => {
        const fx = sparseJointFilledSequencePng();
        const out = splitCombinedIfNeeded(fx.png);
        expect(out.ok).toBe(true);
        expect(out.y).toBeGreaterThanOrEqual(fx.gapY0);
        expect(out.y).toBeLessThanOrEqual(fx.gapY1);
        expect(out.confidence).toBeGreaterThanOrEqual(0.55);
    });

    it('rettangolo cavo con vuoto centrale (V-joint-like): single_joint', () => {
        const width = 120;
        const height = 100;
        const rgba = Buffer.alloc(width * height * 4, 255);
        fillRect(rgba, width, 10, 20, 110, 80, [20, 20, 20]);
        fillRect(rgba, width, 14, 24, 106, 76, [255, 255, 255]);
        fillRect(rgba, width, 48, 20, 72, 50, [255, 255, 255]);
        const out = splitCombinedIfNeeded(encodePng(width, height, rgba));
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('single_joint');
    });

    it('T-joint a linee 2px: non spezza stelo e base', () => {
        const width = 100;
        const height = 160;
        const rgba = Buffer.alloc(width * height * 4, 255);
        fillRect(rgba, width, 46, 16, 54, 88, [20, 20, 20]);
        fillRect(rgba, width, 48, 16, 52, 88, [255, 255, 255]);
        fillRect(rgba, width, 12, 90, 88, 128, [20, 20, 20]);
        fillRect(rgba, width, 16, 94, 84, 124, [255, 255, 255]);
        const out = splitCombinedIfNeeded(encodePng(width, height, rgba));
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('single_joint');
    });

    it('T-joint cavo (stelo e base quasi a contatto): single_joint', () => {
        const width = 100;
        const height = 140;
        const rgba = Buffer.alloc(width * height * 4, 255);
        fillRect(rgba, width, 42, 12, 58, 78, [20, 20, 20]);
        fillRect(rgba, width, 12, 80, 88, 126, [20, 20, 20]);
        const out = splitCombinedIfNeeded(encodePng(width, height, rgba));
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('single_joint');
    });

    it('T-joint unico (stelo+base connessi): single_joint', () => {
        const width = 100;
        const height = 140;
        const rgba = Buffer.alloc(width * height * 4, 255);
        fillRect(rgba, width, 40, 10, 60, 80, [20, 20, 20]);
        fillRect(rgba, width, 10, 80, 90, 128, [20, 20, 20]);
        const out = splitCombinedIfNeeded(encodePng(width, height, rgba));
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('single_joint');
    });

    /** Due piastre cave tratteggiate + V centrale (un solo disegno, come le bozze 31/36). */
    function hatchedVGroovePng() {
        const width = 200;
        const height = 120;
        const rgba = Buffer.alloc(width * height * 4, 255);
        const ink = [22, 22, 22];
        fillRect(rgba, width, 8, 28, 92, 88, ink);
        fillRect(rgba, width, 12, 32, 88, 84, [255, 255, 255]);
        fillRect(rgba, width, 108, 28, 192, 88, ink);
        fillRect(rgba, width, 112, 32, 188, 84, [255, 255, 255]);
        for (let y = 34; y < 82; y += 6) {
            fillRect(rgba, width, 14, y, 86, y + 1, ink);
            fillRect(rgba, width, 114, y, 186, y + 1, ink);
        }
        for (let i = 0; i < 22; i += 1) {
            fillRect(rgba, width, 86 - i, 28, 88 - i, 30 + i, [255, 255, 255]);
            fillRect(rgba, width, 112 + i, 28, 114 + i, 30 + i, [255, 255, 255]);
        }
        return { png: encodePng(width, height, rgba), width, height };
    }

    it('V-groove tratteggiato (un solo disegno): single_joint', () => {
        const fx = hatchedVGroovePng();
        const out = splitCombinedIfNeeded(fx.png);
        expect(out.ok).toBe(false);
        expect(out.reason).toBe('single_joint');
    });

    it('findHorizontalSplit espone y e confidenza', () => {
        const { rgba, width, height } = stackedPng();
        const ink = rowInkFromRgba(rgba, width, height, 240, { maxThinRun: 4 });
        const mask = darkMaskFromRgba(rgba, width, height);
        const found = findHorizontalSplit(ink, { mask, width, height });
        expect(found.y).toBeGreaterThanOrEqual(30);
        expect(found.y).toBeLessThanOrEqual(48);
        expect(found.confidence).toBeGreaterThan(0.5);
        expect(['white_band', 'valley']).toContain(found.reason);
    });
});
