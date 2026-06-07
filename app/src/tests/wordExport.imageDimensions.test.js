/**
 * EXIF orientation e dimensioni immagini per export Word.
 */
import { describe, it, expect } from 'vitest';
import {
    getJpegExifOrientation,
    getImagePixelDimensions,
    getDisplayImagePixelDimensions,
    jpegNeedsExifNormalization,
    scaleImageToMaxEmu,
} from '../utils/wordExportHelpers.js';

function uint8ToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

/** JPEG minimale con segmento APP1 EXIF (tag Orientation) + SOF0 w�h. */
function buildMinimalJpegWithExifOrientation(orientation, w = 160, h = 120) {
    const tiff = new Uint8Array([
        0x49, 0x49, // little-endian
        0x2a, 0x00,
        0x08, 0x00, 0x00, 0x00, // IFD0 @ offset 8
        0x01, 0x00, // 1 tag
        0x12, 0x01, // Orientation 0x0112
        0x03, 0x00, // SHORT
        0x01, 0x00, 0x00, 0x00, // count 1
        orientation & 0xff, (orientation >> 8) & 0xff, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, // next IFD
    ]);
    const exifPayload = new Uint8Array(6 + tiff.length);
    exifPayload.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0); // "Exif\0\0"
    exifPayload.set(tiff, 6);
    const app1Len = exifPayload.length + 2;
    const sof = new Uint8Array([
        0xff, 0xc0, 0x00, 0x0b, 0x08,
        (h >> 8) & 0xff, h & 0xff,
        (w >> 8) & 0xff, w & 0xff,
        0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    ]);
    const out = new Uint8Array(2 + 4 + exifPayload.length + sof.length + 2);
    let o = 0;
    out[o++] = 0xff; out[o++] = 0xd8;
    out[o++] = 0xff; out[o++] = 0xe1;
    out[o++] = (app1Len >> 8) & 0xff; out[o++] = app1Len & 0xff;
    out.set(exifPayload, o); o += exifPayload.length;
    out.set(sof, o); o += sof.length;
    out[o++] = 0xff; out[o++] = 0xd9;
    return uint8ToBase64(out);
}

describe('wordExport EXIF / dimensioni immagini', () => {
    it('getJpegExifOrientation legge orientation 1 e 6 da fixture minimale', () => {
        const b64Norm = buildMinimalJpegWithExifOrientation(1);
        const b64Rot = buildMinimalJpegWithExifOrientation(6);
        expect(getJpegExifOrientation(b64Norm, 'image/jpeg')).toBe(1);
        expect(getJpegExifOrientation(b64Rot, 'image/jpeg')).toBe(6);
    });

    it('getImagePixelDimensions legge w/h dal SOF0', () => {
        const b64 = buildMinimalJpegWithExifOrientation(6, 4032, 3024);
        expect(getImagePixelDimensions(b64, 'image/jpeg')).toEqual({ w: 4032, h: 3024 });
    });

    it('getDisplayImagePixelDimensions scambia w/h per orientation 6 (90�)', () => {
        const b64 = buildMinimalJpegWithExifOrientation(6, 4032, 3024);
        expect(getDisplayImagePixelDimensions(b64, 'image/jpeg')).toEqual({ w: 3024, h: 4032 });
    });

    it('getDisplayImagePixelDimensions non scambia per orientation 1', () => {
        const b64 = buildMinimalJpegWithExifOrientation(1, 800, 600);
        expect(getDisplayImagePixelDimensions(b64, 'image/jpeg')).toEqual({ w: 800, h: 600 });
    });

    it('jpegNeedsExifNormalization true solo per JPEG con EXIF != 1', () => {
        const upright = buildMinimalJpegWithExifOrientation(1);
        const rotated = buildMinimalJpegWithExifOrientation(6);
        expect(jpegNeedsExifNormalization(upright, 'image/jpeg')).toBe(false);
        expect(jpegNeedsExifNormalization(rotated, 'image/jpeg')).toBe(true);
        expect(jpegNeedsExifNormalization(upright, 'image/png')).toBe(false);
    });

    it('scaleImageToMaxEmu mantiene aspect ratio entro i limiti', () => {
        const portrait = scaleImageToMaxEmu(3024, 4032, 1905000, 4286250);
        expect(portrait.cx).toBe(1905000);
        expect(portrait.cy).toBeGreaterThan(portrait.cx);
        expect(portrait.cy).toBeLessThanOrEqual(4286250);
    });
});
