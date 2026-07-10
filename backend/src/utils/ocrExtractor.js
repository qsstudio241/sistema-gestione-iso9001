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

    const textParts = [];
    try {
        for (const imgBuf of imgBuffers) {
            const { data: { text } } = await worker.recognize(imgBuf);
            if (text && text.trim().length > 10) {
                textParts.push(text.trim());
            }
        }
    } finally {
        await worker.terminate();
    }

    if (textParts.length === 0) {
        throw new Error('[OCR] Tesseract non ha estratto testo utilizzabile');
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
            if (result && result.buffer && result.buffer.length > 0) {
                buffers.push(result.buffer);
            } else if (result && result.path && fs.existsSync(result.path) && fs.statSync(result.path).size > 0) {
                buffers.push(fs.readFileSync(result.path));
                // pulizia file temporaneo
                try { fs.unlinkSync(result.path); } catch (_) {}
            } else if (pageNum === 1) {
                // Buffer vuoto alla prima pagina = conversione fallita silenziosamente
                // (tipico quando pdf2pic invoca un motore assente o senza permessi PDF).
                throw new Error(
                    `[OCR] Conversione PDF?immagine ha prodotto un output vuoto (motore: ${engine}). `
                    + 'Verificare che Ghostscript sia installato e che il motore immagini possa leggere i PDF.'
                );
            } else {
                // Pagine oltre l'ultima: interrompi senza errore
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

module.exports = { extractTextWithOCR, _detectMagickEngine };
