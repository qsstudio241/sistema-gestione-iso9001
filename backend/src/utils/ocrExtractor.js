/**
 * ocrExtractor.js
 * OCR fallback per PDF scansionati e per immagini raster (PNG/JPEG/WebP).
 * PDF: pdf2pic (pagine -> PNG) + tesseract.js.
 * Immagine: tesseract.js diretto sul buffer (niente Ghostscript / pdf2pic).
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
const _WEBP_RIFF = Buffer.from('RIFF');
const _WEBP_WEBP = Buffer.from('WEBP');

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
 * WebP: RIFF....WEBP (Tesseract/leptonica lo accettano; pdf2pic non lo produce).
 * @param {Buffer} buf
 * @returns {boolean}
 * @private
 */
function _isWebP(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 12) return false;
    return buf.subarray(0, 4).equals(_WEBP_RIFF) && buf.subarray(8, 12).equals(_WEBP_WEBP);
}

/**
 * Buffer accettato da OCR diretto (PNG/JPEG da pdf2pic o foto; WebP da allegati).
 * @param {Buffer} buf
 * @returns {boolean}
 */
function _isOcrableImage(buf) {
    return _isRasterImage(buf) || _isWebP(buf);
}

/**
 * Worker Tesseract condiviso (PDF pagine e foto singola).
 * @param {string} lang
 * @returns {Promise<object>}
 * @private
 */
async function _createTesseractWorker(lang) {
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
    return worker;
}

/**
 * OCR su un buffer immagine (PNG/JPEG/WebP). Non usa pdf2pic.
 * Testo vuoto o buffer non raster: throw (il chiamante classifica reason).
 *
 * @param {Buffer} imageBuffer
 * @param {object} [options]
 * @param {string} [options.lang='ita+eng']
 * @returns {Promise<string>}
 */
async function extractTextFromImageBuffer(imageBuffer, options = {}) {
    const { lang = 'ita+eng' } = options;
    if (!_isOcrableImage(imageBuffer)) {
        throw new Error('[OCR] Buffer immagine non valido (serve PNG, JPEG o WebP)');
    }

    const worker = await _createTesseractWorker(lang);
    try {
        const { data: { text } } = await worker.recognize(imageBuffer);
        const trimmed = text && String(text).trim();
        if (!trimmed) {
            throw new Error('[OCR] Tesseract non ha estratto testo utilizzabile');
        }
        return trimmed;
    } finally {
        await worker.terminate();
    }
}

/**
 * Righe OCR con bounding box (da `data.lines` o, in mancanza, da `data.blocks`).
 * Non altera il testo: serve a chi deve ragionare sulla posizione (es. marcatori 14732 4.1).
 * @param {object} data - `data` restituito da worker.recognize
 * @param {number} page - numero pagina (1-based)
 * @returns {{ page: number, lines: Array<{ text: string, bbox: {x0:number,y0:number,x1:number,y1:number} }> }}
 * @private
 */
function _buildPageLayout(data, page) {
    let rawLines = Array.isArray(data.lines) ? data.lines : null;
    if (!rawLines && Array.isArray(data.blocks)) {
        rawLines = [];
        for (const block of data.blocks) {
            for (const para of (block && block.paragraphs) || []) rawLines.push(...((para && para.lines) || []));
        }
    }
    const lines = (rawLines || [])
        .filter((l) => l && l.bbox && String(l.text || '').trim())
        .map((l) => ({
            text: String(l.text).trim(),
            bbox: { x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1 },
        }));
    return { page, lines };
}

/**
 * Estrae testo da un PDF scansionato tramite OCR.
 *
 * @param {Buffer} pdfBuffer   - Buffer del PDF da analizzare
 * @param {object} options
 * @param {number} [options.maxPages=3]     - Numero max di pagine da analizzare
 * @param {string} [options.lang='ita+eng'] - Lingue Tesseract (codici ISO 639-2)
 * @param {Array} [options.layoutSink] - Se presente, riceve per ogni pagina letta
 *   `{ page, lines: [{ text, bbox }] }` (coordinate pixel Tesseract). Opzionale e
 *   additivo: il valore di ritorno (testo) non cambia.
 * @returns {Promise<string>} Testo estratto via OCR
 * @throws {Error} Se la conversione o l'OCR falliscono completamente
 */
async function extractTextWithOCR(pdfBuffer, options = {}) {
    const { maxPages = 3, lang = 'ita+eng', layoutSink = null } = options;

    const imgBuffers = await _convertPdfToImages(pdfBuffer, maxPages);

    if (imgBuffers.length === 0) {
        throw new Error('[OCR] Nessuna immagine estratta dal PDF');
    }

    const worker = await _createTesseractWorker(lang);

    const textParts = [];
    let lastRecErr = null;
    try {
        for (let pageIdx = 0; pageIdx < imgBuffers.length; pageIdx += 1) {
            // Il fallimento di una singola pagina non deve azzerare l'intero OCR
            try {
                const { data } = await worker.recognize(imgBuffers[pageIdx]);
                const text = data.text;
                if (text && text.trim().length > 10) {
                    textParts.push(text.trim());
                    if (Array.isArray(layoutSink)) layoutSink.push(_buildPageLayout(data, pageIdx + 1));
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

/**
 * Fascia alta della pagina usata per l'OCR dell'intestazione (carta intestata dell'ente certificatore).
 * Valore iniziale 25%: da validare sui PDF reali (override: OCR_HEADER_HEIGHT_FRACTION, es. 0.2).
 */
const HEADER_OCR_HEIGHT_FRACTION = (() => {
    const v = Number(process.env.OCR_HEADER_HEIGHT_FRACTION);
    return v > 0 && v <= 1 ? v : 0.25;
})();
const HEADER_OCR_TIMEOUT_MS = Number(process.env.OCR_HEADER_TIMEOUT_MS) || 20000;
// A4 a 200 dpi (1654x2339): pdf2pic forza la dimensione richiesta, quindi la fascia e' deterministica.
const HEADER_OCR_RENDER = Object.freeze({ density: 200, width: 1654, height: 2339 });

/**
 * Dimensioni (px) di un PNG dall'header IHDR; null se il buffer non e' un PNG leggibile.
 * @param {Buffer} buf
 * @returns {{ width: number, height: number }|null}
 * @private
 */
function _pngSize(buf) {
    if (!Buffer.isBuffer(buf) || buf.length < 24 || !buf.subarray(0, 4).equals(_PNG_MAGIC)) return null;
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Renderizza UNA sola pagina di un PDF in PNG (pdf2pic + GraphicsMagick/ImageMagick).
 * @private
 */
async function _renderPdfPage(pdfBuffer, pageNumber, { density, width, height }) {
    const engine = _detectMagickEngine();
    if (engine === 'none') {
        throw new Error('[OCR] Nessun motore immagini installato sul server (serve GraphicsMagick o ImageMagick)');
    }
    const { fromBuffer } = require('pdf2pic');
    const converter = fromBuffer(pdfBuffer, { density, format: 'png', width, height });
    if (engine === 'imagemagick' && typeof converter.setGMClass === 'function') {
        converter.setGMClass('imagemagick');
    }
    const result = await converter(pageNumber, { responseType: 'buffer' });
    const img = result && result.buffer;
    if (!_isRasterImage(img)) {
        throw new Error(`[OCR] Rendering della pagina ${pageNumber} non valido (motore: ${engine})`);
    }
    return img;
}

/**
 * Ritaglia la fascia alta (frazione dell'altezza) di un PNG con GraphicsMagick/ImageMagick.
 * `gm` e' gia' installato come dipendenza di pdf2pic. Il rettangolo di Tesseract (`rectangle`) non e' usato:
 * con tesseract.js 5.1.1 restituisce testo spurio.
 * @private
 */
function _cropTopBand(png, heightFraction) {
    const size = _pngSize(png);
    if (!size) throw new Error('[OCR] Dimensioni immagine non leggibili per il ritaglio');
    const cropHeight = Math.max(1, Math.round(size.height * heightFraction));
    const gm = require('gm').subClass({ imageMagick: _detectMagickEngine() === 'imagemagick' });
    return new Promise((resolve, reject) => {
        gm(png).crop(size.width, cropHeight, 0, 0).toBuffer('PNG', (err, out) => {
            if (err) return reject(err);
            return _isRasterImage(out) ? resolve(out) : reject(new Error('[OCR] Ritaglio intestazione non valido'));
        });
    });
}

/**
 * OCR della sola fascia alta di una pagina (intestazione / carta intestata), anche per PDF con livello di testo
 * in cui logo e ragione sociale sono grafica. Renderizza SOLO la pagina richiesta, ritaglia la fascia alta e
 * fa riconoscere a Tesseract solo quella (nessuna dipendenza nuova: pdf2pic + gm + tesseract.js).
 *
 * Errori e timeout vengono lanciati: il chiamante decide il fallback (l'ingest non deve rompersi).
 *
 * @param {Buffer} pdfBuffer
 * @param {object} [options]
 * @param {number} [options.pageNumber=1]
 * @param {number} [options.heightFraction=HEADER_OCR_HEIGHT_FRACTION] - frazione (0-1] dell'altezza da leggere
 * @param {string} [options.lang='ita+eng']
 * @param {number} [options.timeoutMs=HEADER_OCR_TIMEOUT_MS]
 * @returns {Promise<string>} testo dell'intestazione ('' se Tesseract non legge nulla)
 */
async function extractHeaderTextWithOCR(pdfBuffer, options = {}) {
    const { pageNumber = 1, lang = 'ita+eng', timeoutMs = HEADER_OCR_TIMEOUT_MS } = options;
    const heightFraction = options.heightFraction > 0 && options.heightFraction <= 1
        ? options.heightFraction
        : HEADER_OCR_HEIGHT_FRACTION;

    let worker = null;
    let timedOut = false;
    let timer = null;

    const work = async () => {
        const page = await _renderPdfPage(pdfBuffer, pageNumber, HEADER_OCR_RENDER);
        const band = await _cropTopBand(page, heightFraction);
        const w = await _createTesseractWorker(lang);
        if (timedOut) {
            await w.terminate().catch(() => {});
            return '';
        }
        worker = w;
        const { data: { text } } = await worker.recognize(band);
        return String(text || '').trim();
    };

    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            timedOut = true;
            reject(new Error(`[OCR] Timeout OCR intestazione dopo ${timeoutMs} ms`));
        }, timeoutMs);
    });
    const job = work();
    job.catch(() => {});

    try {
        return await Promise.race([job, timeout]);
    } finally {
        clearTimeout(timer);
        if (worker) await worker.terminate().catch(() => {});
    }
}

module.exports = {
    extractTextWithOCR,
    extractTextFromImageBuffer,
    extractHeaderTextWithOCR,
    HEADER_OCR_HEIGHT_FRACTION,
    HEADER_OCR_TIMEOUT_MS,
    _detectMagickEngine,
    _isRasterImage,
    _isOcrableImage,
};
