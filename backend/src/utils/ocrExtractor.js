/**
 * ocrExtractor.js
 * OCR fallback per PDF scansionati (immagini fotografate/scannerizzate).
 * Pipeline: pdf2pic (conversione pagine -> PNG) + tesseract.js (OCR).
 *
 * Prerequisito sul server: ImageMagick (convert) + Ghostscript.
 * Se pdf2pic non e' disponibile, lancia un errore chiaro.
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');

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

    const buffers = [];
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
            const result = await converter(pageNum, { responseType: 'buffer' });
            if (result && result.buffer) {
                buffers.push(result.buffer);
            } else if (result && result.path && fs.existsSync(result.path)) {
                buffers.push(fs.readFileSync(result.path));
                // pulizia file temporaneo
                try { fs.unlinkSync(result.path); } catch (_) {}
            }
        } catch (pageErr) {
            // Pagine oltre l'ultima causano errore — interrompi senza propagare
            if (pageNum === 1) {
                throw new Error(`[OCR] pdf2pic fallito alla pagina 1: ${pageErr.message}`);
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

module.exports = { extractTextWithOCR };
