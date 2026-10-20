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
    if (!width || !height || bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) return null;
    const bpp = colorType === 6 ? 4 : 3;
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
            rgba[di] = recon[si];
            rgba[di + 1] = recon[si + 1];
            rgba[di + 2] = recon[si + 2];
            rgba[di + 3] = bpp === 4 ? recon[si + 3] : 255;
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

function rowInkFromRgba(rgba, width, height, threshold = 240) {
    const rows = new Array(height);
    for (let y = 0; y < height; y += 1) {
        let dark = 0;
        for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4;
            if (rgba[i] < threshold || rgba[i + 1] < threshold || rgba[i + 2] < threshold) dark += 1;
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

function findHorizontalSplitY(rowInk, opts = {}) {
    const ink = Array.isArray(rowInk) ? rowInk : [];
    const H = ink.length;
    if (H < 40) return null;
    const thresh = opts.thresh != null ? opts.thresh : 0.015;
    const closeW = opts.closeW != null ? opts.closeW : 10;
    const minGap = opts.minGap != null ? opts.minGap : 6;
    const minBand = opts.minBand != null ? opts.minBand : Math.max(18, Math.floor(H * 0.08));
    const binary = closeSmallGaps(ink.map((v) => (v > thresh ? 1 : 0)), closeW);
    const comps = [];
    let start = null;
    for (let y = 0; y < H; y += 1) {
        if (binary[y]) {
            if (start == null) start = y;
        } else if (start != null) {
            comps.push({ y0: start, y1: y - 1, h: y - start });
            start = null;
        }
    }
    if (start != null) comps.push({ y0: start, y1: H - 1, h: H - start });
    const big = comps.filter((c) => c.h >= minBand);
    if (big.length < 2) return null;
    let best = null;
    for (let i = 0; i < big.length - 1; i += 1) {
        const gs = big[i].y1 + 1;
        const ge = big[i + 1].y0 - 1;
        const gh = ge - gs + 1;
        const mid = Math.floor((gs + ge) / 2);
        if (gh < minGap) continue;
        if (mid < H * 0.18 || mid > H * 0.82) continue;
        const centrality = 1 - Math.abs(mid - H / 2) / (H / 2);
        const score = gh * (1 + centrality);
        if (!best || score > best.score) best = { score, y: mid };
    }
    return best ? best.y : null;
}

function splitCombinedIfNeeded(pngBuffer) {
    const decoded = decodePng(pngBuffer);
    if (!decoded) return { ok: false, reason: 'decode' };
    const ink = rowInkFromRgba(decoded.rgba, decoded.width, decoded.height);
    const y = findHorizontalSplitY(ink);
    if (y == null || y < 8 || y > decoded.height - 8) {
        return { ok: false, reason: 'no_gap', width: decoded.width, height: decoded.height };
    }
    const top = cropRgba(decoded.rgba, decoded.width, decoded.height, 0, 0, decoded.width, y);
    const bottom = cropRgba(
        decoded.rgba, decoded.width, decoded.height, 0, y, decoded.width, decoded.height - y,
    );
    return {
        ok: true,
        y,
        top: encodePng(top.width, top.height, top.rgba),
        bottom: encodePng(bottom.width, bottom.height, bottom.rgba),
        topSize: { width: top.width, height: top.height },
        bottomSize: { width: bottom.width, height: bottom.height },
        width: decoded.width,
        height: decoded.height,
    };
}

module.exports = {
    decodePng,
    encodePng,
    cropRgba,
    rowInkFromRgba,
    findHorizontalSplitY,
    splitCombinedIfNeeded,
};
