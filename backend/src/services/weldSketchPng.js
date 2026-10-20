/**
 * PNG 8-bit RGB/RGBA: decode, encode, row-ink e split orizzontale.
 * Niente dipendenze native: zlib di Node. Non disegna lo schizzo.
 */

const zlib = require('zlib');

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
        let c = n;
        for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i += 1) {
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

function decodePng(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) return null;
    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    const idats = [];
    while (offset + 12 <= buf.length) {
        const len = buf.readUInt32BE(offset);
        const type = buf.toString('ascii', offset + 4, offset + 8);
        const data = buf.subarray(offset + 8, offset + 8 + len);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
        } else if (type === 'IDAT') {
            idats.push(data);
        } else if (type === 'IEND') {
            break;
        }
        offset += 12 + len;
    }
    const bppByType = { 0: 1, 2: 3, 4: 2, 6: 4 };
    if (!width || !height || bitDepth !== 8 || !bppByType[colorType]) return null;
    const bpp = bppByType[colorType];
    let inflated;
    try {
        inflated = zlib.inflateSync(Buffer.concat(idats));
    } catch (_) {
        return null;
    }
    const stride = width * bpp;
    const rgba = Buffer.alloc(width * height * 4);
    let src = 0;
    const prev = Buffer.alloc(stride);
    for (let y = 0; y < height; y += 1) {
        const filter = inflated[src];
        src += 1;
        const row = inflated.subarray(src, src + stride);
        src += stride;
        const recon = Buffer.alloc(stride);
        for (let i = 0; i < stride; i += 1) {
            const x = row[i];
            const a = i >= bpp ? recon[i - bpp] : 0;
            const b = prev[i];
            const c = i >= bpp ? prev[i - bpp] : 0;
            let val = x;
            if (filter === 1) val = (x + a) & 255;
            else if (filter === 2) val = (x + b) & 255;
            else if (filter === 3) val = (x + ((a + b) >> 1)) & 255;
            else if (filter === 4) val = (x + paeth(a, b, c)) & 255;
            else if (filter !== 0) return null;
            recon[i] = val;
        }
        recon.copy(prev);
        for (let x = 0; x < width; x += 1) {
            const di = (y * width + x) * 4;
            const si = x * bpp;
            if (colorType === 0) {
                rgba[di] = recon[si];
                rgba[di + 1] = recon[si];
                rgba[di + 2] = recon[si];
                rgba[di + 3] = 255;
            } else if (colorType === 4) {
                rgba[di] = recon[si];
                rgba[di + 1] = recon[si];
                rgba[di + 2] = recon[si];
                rgba[di + 3] = recon[si + 1];
            } else {
                rgba[di] = recon[si];
                rgba[di + 1] = recon[si + 1];
                rgba[di + 2] = recon[si + 2];
                rgba[di + 3] = colorType === 6 ? recon[si + 3] : 255;
            }
        }
    }
    return { width, height, rgba };
}

function chunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
    const stride = width * 3;
    const raw = Buffer.alloc((stride + 1) * height);
    for (let y = 0; y < height; y += 1) {
        const dest = y * (stride + 1);
        raw[dest] = 0;
        for (let x = 0; x < width; x += 1) {
            const si = (y * width + x) * 4;
            const di = dest + 1 + x * 3;
            raw[di] = rgba[si];
            raw[di + 1] = rgba[si + 1];
            raw[di + 2] = rgba[si + 2];
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 2;
    return Buffer.concat([
        PNG_SIG,
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

function cropRgba(rgba, width, height, x0, y0, cropW, cropH) {
    const w = Math.max(1, Math.min(width - x0, cropW));
    const h = Math.max(1, Math.min(height - y0, cropH));
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y += 1) {
        const src = ((y0 + y) * width + x0) * 4;
        rgba.copy(out, y * w * 4, src, src + w * 4);
    }
    return { width: w, height: h, rgba: out };
}

function isDarkPixel(rgba, i, threshold) {
    return rgba[i] < threshold || rgba[i + 1] < threshold || rgba[i + 2] < threshold;
}

function darkMaskFromRgba(rgba, width, height, threshold = 240) {
    const mask = new Uint8Array(width * height);
    for (let p = 0; p < mask.length; p += 1) {
        if (isDarkPixel(rgba, p * 4, threshold)) mask[p] = 1;
    }
    return mask;
}

/**
 * Profilo riga: frazione di pixel scuri.
 * `maxThinRun` ignora run orizzontali corti (linee di quota verticali da 1–4 px).
 */
function rowInkFromRgba(rgba, width, height, threshold = 240, opts = {}) {
    const maxThinRun = opts.maxThinRun != null ? opts.maxThinRun : 0;
    const rows = new Array(height);
    for (let y = 0; y < height; y += 1) {
        let dark = 0;
        let x = 0;
        while (x < width) {
            const i = (y * width + x) * 4;
            if (!isDarkPixel(rgba, i, threshold)) {
                x += 1;
                continue;
            }
            const runStart = x;
            x += 1;
            while (x < width && isDarkPixel(rgba, (y * width + x) * 4, threshold)) x += 1;
            const runLen = x - runStart;
            if (runLen > maxThinRun) dark += runLen;
        }
        rows[y] = dark / width;
    }
    return rows;
}

function closeSmallGaps(binary, closeW) {
    const out = binary.slice();
    const n = out.length;
    let i = 0;
    while (i < n) {
        if (out[i] === 0) {
            let j = i;
            while (j < n && out[j] === 0) j += 1;
            if (i > 0 && j < n && (j - i) <= closeW) {
                for (let k = i; k < j; k += 1) out[k] = 1;
            }
            i = j;
        } else {
            i += 1;
        }
    }
    return out;
}

function runsOf(binary, value) {
    const out = [];
    const n = binary.length;
    let start = null;
    for (let i = 0; i < n; i += 1) {
        if (binary[i] === value) {
            if (start == null) start = i;
        } else if (start != null) {
            out.push({ y0: start, y1: i - 1, h: i - start });
            start = null;
        }
    }
    if (start != null) out.push({ y0: start, y1: n - 1, h: n - start });
    return out;
}

function maxDarkRunWidth(mask, width, y0, y1) {
    if (!mask) return 0;
    let maxRun = 0;
    for (let y = y0; y <= y1; y += 1) {
        let run = 0;
        const row = y * width;
        for (let x = 0; x < width; x += 1) {
            if (mask[row + x]) {
                run += 1;
                if (run > maxRun) maxRun = run;
            } else {
                run = 0;
            }
        }
    }
    return maxRun;
}

/**
 * Tratti corti nel gap (linea di quota orizzontale, lettera tipo «g»):
 * non spezzano la banda a basso inchiostro. Un ponte largo no.
 */
function suppressQuoteSpikes(high, rowInk, opts = {}) {
    const { mask = null, width = 0, height: H = high.length } = opts;
    const maxSpikeH = opts.maxSpikeH != null ? opts.maxSpikeH : Math.max(16, Math.floor(H * 0.08));
    const maxLetterW = opts.maxLetterW != null ? opts.maxLetterW : 14;
    const out = high.slice();
    const spikes = runsOf(out, 1);
    for (const s of spikes) {
        if (s.y0 === 0 || s.y1 === H - 1) continue;
        if (out[s.y0 - 1] !== 0 || out[s.y1 + 1] !== 0) continue;
        let suppress = s.h <= 4;
        if (!suppress && s.h <= maxSpikeH) {
            let maxInk = 0;
            for (let y = s.y0; y <= s.y1; y += 1) {
                if (rowInk[y] > maxInk) maxInk = rowInk[y];
            }
            const runW = mask && width
                ? maxDarkRunWidth(mask, width, s.y0, s.y1)
                : Math.round(maxInk * (width || 1));
            if (runW <= maxLetterW && maxInk <= 0.25) suppress = true;
        }
        if (suppress) {
            for (let y = s.y0; y <= s.y1; y += 1) out[y] = 0;
        }
    }
    return out;
}

function connectedComponents(mask, width, height) {
    const n = width * height;
    const seen = new Uint8Array(n);
    const ccs = [];
    const stack = [];
    for (let i = 0; i < n; i += 1) {
        if (!mask[i] || seen[i]) continue;
        let area = 0;
        let x0 = width;
        let y0 = height;
        let x1 = 0;
        let y1 = 0;
        stack.push(i);
        seen[i] = 1;
        while (stack.length) {
            const p = stack.pop();
            const x = p % width;
            const y = (p / width) | 0;
            area += 1;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
            if (x > 0 && mask[p - 1] && !seen[p - 1]) {
                seen[p - 1] = 1;
                stack.push(p - 1);
            }
            if (x + 1 < width && mask[p + 1] && !seen[p + 1]) {
                seen[p + 1] = 1;
                stack.push(p + 1);
            }
            if (y > 0 && mask[p - width] && !seen[p - width]) {
                seen[p - width] = 1;
                stack.push(p - width);
            }
            if (y + 1 < height && mask[p + width] && !seen[p + width]) {
                seen[p + width] = 1;
                stack.push(p + width);
            }
        }
        ccs.push({
            area, x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1,
        });
    }
    return ccs;
}

function largeComponentCrossesY(ccs, y, opts = {}) {
    const minWidth = opts.minBlobWidth != null ? opts.minBlobWidth : 8;
    const minArea = opts.minLargeArea != null ? opts.minLargeArea : 80;
    for (let i = 0; i < ccs.length; i += 1) {
        const c = ccs[i];
        if (c.y0 < y && c.y1 >= y && c.w >= minWidth && c.area >= minArea) return true;
    }
    return false;
}

function pickYInBand(rowInk, band) {
    let bestY = band.y0;
    let bestInk = Infinity;
    let bestCentrality = -1;
    const mid = (band.y0 + band.y1) / 2;
    const half = Math.max(1, (band.h - 1) / 2);
    for (let y = band.y0; y <= band.y1; y += 1) {
        const ink = rowInk[y];
        const centrality = 1 - Math.abs(y - mid) / half;
        if (ink < bestInk - 1e-9 || (Math.abs(ink - bestInk) <= 1e-9 && centrality > bestCentrality)) {
            bestInk = ink;
            bestCentrality = centrality;
            bestY = y;
        }
    }
    return bestY;
}

function inkMass(rowInk, y0, y1, thresh) {
    let n = 0;
    const a = Math.max(0, y0);
    const b = Math.min(rowInk.length - 1, y1);
    for (let y = a; y <= b; y += 1) {
        if (rowInk[y] > thresh) n += 1;
    }
    return n;
}

function findHorizontalSplitY(rowInk, opts = {}) {
    const ink = Array.isArray(rowInk) ? rowInk : [];
    const H = ink.length;
    if (H < 40) return null;
    const thresh = opts.thresh != null ? opts.thresh : 0.04;
    const closeW = opts.closeW != null ? opts.closeW : 2;
    const minGap = opts.minGap != null ? opts.minGap : 6;
    const minBand = opts.minBand != null ? opts.minBand : Math.max(18, Math.floor(H * 0.08));
    const { mask = null, width = 0 } = opts;
    let high = closeSmallGaps(ink.map((v) => (v > thresh ? 1 : 0)), closeW);
    high = suppressQuoteSpikes(high, ink, {
        mask, width, height: H, maxSpikeH: opts.maxSpikeH, maxLetterW: opts.maxLetterW,
    });
    const bands = runsOf(high, 0);
    const ccs = mask && width ? connectedComponents(mask, width, H) : null;
    let best = null;
    for (let i = 0; i < bands.length; i += 1) {
        const band = bands[i];
        if (band.h < minGap) continue;
        const mid = Math.floor((band.y0 + band.y1) / 2);
        if (mid < H * 0.18 || mid > H * 0.82) continue;
        const above = inkMass(ink, 0, band.y0 - 1, thresh);
        const below = inkMass(ink, band.y1 + 1, H - 1, thresh);
        if (above < minBand || below < minBand) continue;
        const centrality = 1 - Math.abs(mid - H / 2) / (H / 2);
        const score = band.h * (1 + centrality);
        if (!best || score > best.score) best = { score, band, centrality };
    }
    if (!best) return null;
    const candidates = [];
    const yMin = pickYInBand(ink, best.band);
    candidates.push(yMin);
    const mid = Math.floor((best.band.y0 + best.band.y1) / 2);
    if (mid !== yMin) candidates.push(mid);
    for (let y = best.band.y0; y <= best.band.y1; y += 1) {
        if (ink[y] <= thresh && y !== yMin && y !== mid) candidates.push(y);
    }
    for (let i = 0; i < candidates.length; i += 1) {
        const y = candidates[i];
        if (y < 8 || y > H - 8) continue;
        if (ccs && largeComponentCrossesY(ccs, y, opts)) continue;
        return y;
    }
    return null;
}

function splitCombinedIfNeeded(pngBuffer) {
    const decoded = decodePng(pngBuffer);
    if (!decoded) return { ok: false, reason: 'decode' };
    const { width, height, rgba } = decoded;
    const ink = rowInkFromRgba(rgba, width, height, 240, { maxThinRun: 4 });
    const mask = darkMaskFromRgba(rgba, width, height);
    const y = findHorizontalSplitY(ink, { mask, width, height });
    if (y == null || y < 8 || y > height - 8) {
        return { ok: false, reason: 'no_gap', width, height };
    }
    const top = cropRgba(rgba, width, height, 0, 0, width, y);
    const bottom = cropRgba(rgba, width, height, 0, y, width, height - y);
    return {
        ok: true,
        y,
        top: encodePng(top.width, top.height, top.rgba),
        bottom: encodePng(bottom.width, bottom.height, bottom.rgba),
        topSize: { width: top.width, height: top.height },
        bottomSize: { width: bottom.width, height: bottom.height },
        width,
        height,
    };
}

module.exports = {
    decodePng,
    encodePng,
    cropRgba,
    darkMaskFromRgba,
    rowInkFromRgba,
    findHorizontalSplitY,
    splitCombinedIfNeeded,
};
