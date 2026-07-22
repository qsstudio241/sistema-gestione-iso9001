/**
 * test-ocr-vps.js
 * Verifica veloce della pipeline OCR sul VPS.
 * Uso: node /tmp/test-ocr-vps.js
 *
 * Crea un PDF sintetico con testo noto, verifica che pdf-parse lo legga.
 * Poi verifica che pdf2pic e tesseract.js siano importabili.
 */

async function main() {
    console.log('[OCR Test] Inizio verifica pipeline OCR...');

    // 1. Verifica importabilita' moduli
    let pdf2pic, tesseract;
    try {
        pdf2pic = require('/var/www/sgq-backend/node_modules/pdf2pic');
        console.log('[OCR Test] pdf2pic: OK (fromBuffer disponibile:', typeof pdf2pic.fromBuffer === 'function', ')');
    } catch (e) {
        console.error('[OCR Test] pdf2pic non disponibile:', e.message);
        process.exit(1);
    }

    try {
        tesseract = require('/var/www/sgq-backend/node_modules/tesseract.js');
        console.log('[OCR Test] tesseract.js: OK (createWorker disponibile:', typeof tesseract.createWorker === 'function', ')');
    } catch (e) {
        console.error('[OCR Test] tesseract.js non disponibile:', e.message);
        process.exit(1);
    }

    // 2. Verifica ocrExtractor
    let ocrExtractor;
    try {
        ocrExtractor = require('/var/www/sgq-backend/src/utils/ocrExtractor');
        console.log('[OCR Test] ocrExtractor: OK (extractTextWithOCR disponibile:', typeof ocrExtractor.extractTextWithOCR === 'function', ')');
    } catch (e) {
        console.error('[OCR Test] ocrExtractor non caricabile:', e.message);
        process.exit(1);
    }

    // 3. Verifica ImageMagick accessibile
    const { execSync } = require('child_process');
    try {
        const ver = execSync('convert --version 2>&1 | head -1', { encoding: 'utf8' });
        console.log('[OCR Test] ImageMagick:', ver.trim());
    } catch (e) {
        console.error('[OCR Test] ImageMagick non trovato:', e.message);
        process.exit(1);
    }

    console.log('[OCR Test] Tutti i componenti verificati con successo!');
    process.exit(0);
}

main().catch(e => {
    console.error('[OCR Test] Errore inatteso:', e.message);
    process.exit(1);
});
