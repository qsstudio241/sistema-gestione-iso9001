/**
 * ocrExtractor.js
 * OCR fallback per PDF scansionati (immagini fotografate/scannerizzate).
 * Pipeline: pdf2pic (conversione pagine -> PNG) + tesseract.js (OCR).
 *
 * Prerequisito sul server: Ghostscript + un motore di rendering immagini,
 * ovvero GraphicsMagick (`gm`) OPPURE ImageMagick (`convert`/`magick`).
 *
 * NB: pdf2pic v3 di default invoca GraphicsMagick (`gm`). Se sul server è
 * installato solo ImageMagick, pdf2pic NON lancia un errore ma restituisce
 * silenziosamente un buffer vuoto (0 byte) — quindi l'OCR non estrae nulla.
 * Per questo rileviamo il motore disponibile e configuriamo pdf2pic di
 * conseguenza (vedi _detectMagickEngine + converter.setGMClass).
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Rileva (una sola volta, con cache) quale motore immagini è disponibile.
 * @returns {'gm'|'imagemagick'|'none'}
 * @private
 */
let _magickEngineCache = null;
function _detectMagickEngine() {
    if (_magickEngineCache !== null) return _magickEngineCache;

    // Override esplicito via env (utile per debugging / ambienti misti)
    const forced = String(process.env.OCR_MAGICK_ENGINE || '').trim().toLowerCase();
    if (forced === 'gm' || forced === 'graphicsmagick') { _magickEngineCache = 'gm'; return 'gm'; }
    if (forced === 'imagemagick' || forced === 'im') { _magickEngineCache = 'imagemagick'; return 'imagemagick'; }

    const has = (cmd) => {
        try {
            execFileSync('command', ['-v', cmd], { stdio: 'ignore', shell: '/bin/sh' });
            return true;
        } catch (_) {
            try {
                execFileSync(cmd, ['-version'], { stdio: 'ignore' });
                return true;
            } catch (_) {
                return false;
            }
        }
    };

    if (has('gm')) _magickEngineCache = 'gm';
    else if (has('convert') || has('magick')) _magickEngineCache = 'imagemagick';
    else _magickEngineCache = 'none';
    return _magickEngineCache;
}

const _PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);   // \x89PNG
const _JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * Verifica che un buffer sia davvero un'immagine raster (PNG/JPEG).
 * Serve perché, richiedendo una pagina oltre l'ultima, GraphicsMagick/ImageMagick
 * NON lanciano un'eccezione ma restituiscono un breve messaggio di errore testuale
 * (es. ~126 byte). Se questo finisse a Tesseract ? "pixReadStream: Unknown format"
 * e l'intero OCR fallirebbe, scartando anche le pagine valide.
 * @param {Buffer} buf
 * @returns {boolean}
 * @private
 */
function _isRasterImage(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 8) return false;
    if (buf.subarray(0, 4).equals(_PNG_MAGIC)) return true;
    if (buf.subarray(0, 3).equals(_JPEG_MAGIC)) return true;
    return false;
}

/**
 * Estrae testo da un PDF scansionato tramite OCR.
 *
 * @param {Buffer} pdfBuffer   - Buffer del PDF da analizzare
 * @param {object} options
 * @param {number} [options.maxPages=3]     - Numero max di pagine da analizzare
 * @param {string} [options.lang='ita+eng'] - Lingue Tesseract (codici ISO 639-2)
 * @returns {Promise<string>} Testo estratto via OCR
 * @throws {Error} Se la conversione o l'OCR falliscono completamente
 */
async function extractTextWithOCR(pdfBuffer, options = {}) {
    const { maxPages = 3, lang = 'ita+eng' } = options;

    const imgBuffers = await _convertPdfToImages(pdfBuffer, maxPages);

    if (imgBuffers.length === 0) {
        throw new Error('[OCR] Nessuna immagine estratta dal PDF');
    }

    const { createWorker } = require('tesseract.js');
    const worker = await createWorker(lang, 1, {
        // Disabilita log Tesseract in produzione per ridurre rumore console
        logger: () => {},
        errorHandler: () => {},
    });

    // PSM 3 = Fully automatic page segmentation (no OSD).
    // Il default di tesseract.js su questi PDF scansionati si comporta come
    // PSM 6 (blocco uniforme) e salta titoli/nomi grandi centrati — visto su
    // certificato TEC-Eurolab UT Level II: "LUIGI LA FORGIA" assente con default,
    // presente con PSM 3/4 (02/08/2026).
    const pageSegMode = String(process.env.OCR_PSM || '3');
    try {
        await worker.setParameters({ tessedit_pageseg_mode: pageSegMode });
    } catch (_) { /* parametri non critici: prosegui con default worker */ }

    const textParts = [];
    let lastRecErr = null;
    try {
        for (const imgBuf of imgBuffers) {
            // Il fallimento di una singola pagina non deve azzerare l'intero OCR
            try {
                const { data: { text } } = await worker.recognize(imgBuf);
                if (text && text.trim().length > 10) {
                    textParts.push(text.trim());
                }
            } catch (recErr) {
                lastRecErr = recErr;
            }
        }
    } finally {
        await worker.terminate();
    }

    if (textParts.length === 0) {
        const detail = lastRecErr && lastRecErr.message ? `: ${lastRecErr.message}` : '';
        throw new Error(`[OCR] Tesseract non ha estratto testo utilizzabile${detail}`);
    }

    return textParts.join('\n\n');
}

/**
 * Converte le prime N pagine di un PDF in buffer PNG tramite pdf2pic.
 * @private
 */
async function _convertPdfToImages(pdfBuffer, maxPages) {
    const engine = _detectMagickEngine();
    if (engine === 'none') {
        throw new Error(
            '[OCR] Nessun motore immagini installato sul server: '
            + 'serve GraphicsMagick (gm) o ImageMagick (convert/magick). '
            + 'Installare uno dei due (es. apt-get install graphicsmagick).'
        );
    }

    const { fromBuffer } = require('pdf2pic');
    const tmpDir = os.tmpdir();
    const sessionId = `ocr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const converter = fromBuffer(pdfBuffer, {
        density:       150,          // DPI — compromesso velocita'/qualita'
        saveFilename:  sessionId,
        savePath:      tmpDir,
        format:        'png',
        width:         1700,
        height:        2200,
    });

    // pdf2pic v3 usa GraphicsMagick di default; se sul server c'è solo
    // ImageMagick dobbiamo dirglielo, altrimenti restituisce buffer vuoti.
    if (engine === 'imagemagick' && typeof converter.setGMClass === 'function') {
        converter.setGMClass('imagemagick');
    }

    const buffers = [];
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
            const result = await converter(pageNum, { responseType: 'buffer' });

            // Estrai il buffer immagine (da memoria o da file temporaneo)
            let imgBuf = null;
            if (result && Buffer.isBuffer(result.buffer) && result.buffer.length > 0) {
                imgBuf = result.buffer;
            } else if (result && result.path && fs.existsSync(result.path) && fs.statSync(result.path).size > 0) {
                imgBuf = fs.readFileSync(result.path);
                try { fs.unlinkSync(result.path); } catch (_) {}
            }

            if (imgBuf && _isRasterImage(imgBuf)) {
                buffers.push(imgBuf);
            } else if (pageNum === 1) {
                // Prima pagina senza immagine valida = conversione fallita.
                // Distinguo output vuoto (motore assente/permessi) da output non-immagine.
                if (!imgBuf) {
                    throw new Error(
                        `[OCR] Conversione PDF->immagine ha prodotto un output vuoto (motore: ${engine}). `
                        + 'Verificare che Ghostscript sia installato e che il motore immagini possa leggere i PDF.'
                    );
                }
                throw new Error(
                    `[OCR] Conversione PDF->immagine non valida alla pagina 1 (motore: ${engine}). `
                    + 'Il motore non ha restituito un\'immagine raster.'
                );
            } else {
                // Pagina oltre l'ultima: gm/IM restituiscono un breve messaggio di
                // errore testuale (NON un'immagine) senza lanciare eccezione. Stop.
                break;
            }
        } catch (pageErr) {
            // Pagine oltre l'ultima causano errore — interrompi senza propagare
            if (pageNum === 1) {
                const msg = (pageErr && pageErr.message) ? pageErr.message : String(pageErr);
                throw new Error(`[OCR] pdf2pic fallito alla pagina 1 (motore: ${engine}): ${msg}`);
            }
            break;
        }
    }

    // Pulizia file temporanei residui con il sessionId
    try {
        const tmpFiles = fs.readdirSync(tmpDir).filter(f => f.startsWith(sessionId));
        tmpFiles.forEach(f => { try { fs.unlinkSync(path.join(tmpDir, f)); } catch (_) {} });
    } catch (_) {}

    return buffers;
}

module.exports = { extractTextWithOCR, _detectMagickEngine, _isRasterImage };
