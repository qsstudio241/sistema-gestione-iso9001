/**
 * Estrazione testo da PDF (strato testo) + euristica confidence senza API esterne.
 * PDF scansionati senza OCR producono poco testo: confidence bassa, revisione umana obbligatoria.
 */

/**
 * @param {number} charCount lunghezza testo estratto
 * @returns {number} 0–100
 */
function confidenceFromTextLength(charCount) {
    const n = Math.floor(Number(charCount) || 0);
    if (n > 2000) return 85;
    if (n > 500) return 70;
    if (n > 100) return 55;
    if (n > 20) return 40;
    return 25;
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function extractPdfText(buffer) {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return String(data.text || '').trim();
}

module.exports = { confidenceFromTextLength, extractPdfText };
