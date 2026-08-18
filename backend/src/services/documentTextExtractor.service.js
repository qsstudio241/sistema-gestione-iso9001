/**
 * documentTextExtractor.service.js
 * Estrazione difensiva del testo dai file allegati ai documenti del registro.
 *
 * Supporta: PDF (strato testo, con fallback OCR se vuoto o sotto soglia),
 * DOCX, e file di testo semplice (txt/csv/md).
 * Formati non supportati o non leggibili (immagini raster — slice S1b,
 * .doc legacy, file mancanti) vengono SALTATI senza bloccare la pipeline:
 * la funzione restituisce { text: null, reason }.
 *
 * OCR PDF: riusa `ocrExtractor.extractTextWithOCR` (stesso stack dell'ingest:
 * pdf2pic + tesseract.js). Fallimento → reason `ocr_unavailable` / `ocr_failed`,
 * mai throw verso il chiamante (SAL AI, Material Certificates, knowledge indexer).
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { extractPdfText } = require('../utils/importPdfText');

let extractTextWithOCR = null;
try {
  extractTextWithOCR = require('../utils/ocrExtractor').extractTextWithOCR;
} catch (_) {
  extractTextWithOCR = null;
}

/** Allineata a ingest (`INGEST_OCR_MIN_CHARS`, default 50). */
const OCR_MIN_CHARS = Number(process.env.INGEST_OCR_MIN_CHARS) || 50;

// Estensioni di testo semplice lette direttamente come UTF-8
const PLAIN_TEXT_EXTS = new Set(['.txt', '.csv', '.md', '.log']);

const PDF_EXTS = new Set(['.pdf']);
const DOCX_EXTS = new Set(['.docx']);

/**
 * Normalizza spazi/newline ridondanti mantenendo i paragrafi.
 * @param {string} raw
 * @returns {string}
 */
function normalizeWhitespace(raw) {
  return String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Classifica un errore OCR in reason stabile per i chiamanti.
 * @param {Error|string} err
 * @returns {'ocr_unavailable'|'ocr_failed'}
 */
function classifyOcrReason(err) {
  const msg = err && err.message ? err.message : String(err || '');
  if (/Nessun motore immagini|MODULE_NOT_FOUND|Cannot find module/i.test(msg)) {
    return 'ocr_unavailable';
  }
  return 'ocr_failed';
}

/**
 * Tenta OCR sul buffer PDF. Non lancia: restituisce testo normalizzato o reason.
 * @param {Buffer} buffer
 * @param {string} storagePath
 * @returns {Promise<{ text: string }|{ text: null, reason: string }>}
 */
async function tryExtractPdfOcr(buffer, storagePath) {
  if (typeof extractTextWithOCR !== 'function') {
    logger.warn(`[DocTextExtractor] OCR non disponibile (${storagePath})`);
    return { text: null, reason: 'ocr_unavailable' };
  }
  try {
    const ocrRaw = await extractTextWithOCR(buffer, { maxPages: 3, lang: 'ita+eng' });
    const ocrNorm = normalizeWhitespace(ocrRaw);
    if (!ocrNorm) {
      return { text: null, reason: 'ocr_failed' };
    }
    return { text: ocrNorm };
  } catch (ocrErr) {
    const reason = classifyOcrReason(ocrErr);
    logger.warn(
      `[DocTextExtractor] OCR ${reason} (${storagePath}): ${ocrErr && ocrErr.message ? ocrErr.message : ocrErr}`
    );
    return { text: null, reason };
  }
}

/**
 * Estrae il testo da un file fisico.
 * @param {string} storagePath percorso assoluto/relativo del file su disco
 * @param {string} [mimeType]   mime type registrato (fallback all'estensione)
 * @param {string} [fileName]   nome file originale (per determinare estensione)
 * @returns {Promise<{ text: string|null, reason?: string }>}
 */
async function extractDocumentText(storagePath, mimeType, fileName) {
  if (!storagePath) {
    return { text: null, reason: 'no_storage_path' };
  }

  const ext = path.extname(fileName || storagePath || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();

  let buffer;
  try {
    buffer = await fs.readFile(storagePath);
  } catch (err) {
    logger.warn(`[DocTextExtractor] File non leggibile (${storagePath}): ${err.message}`);
    return { text: null, reason: 'file_not_found' };
  }

  // --- PDF (strato testo; se vuoto/sotto soglia → OCR, come ingest) ---
  if (PDF_EXTS.has(ext) || mime === 'application/pdf') {
    let layerNorm = '';
    try {
      const text = await extractPdfText(buffer);
      layerNorm = normalizeWhitespace(text);
    } catch (err) {
      logger.warn(`[DocTextExtractor] Estrazione PDF fallita (${storagePath}): ${err.message}`);
    }

    if (layerNorm.length >= OCR_MIN_CHARS) {
      return { text: layerNorm };
    }

    const ocrOut = await tryExtractPdfOcr(buffer, storagePath);
    if (ocrOut.text) {
      return { text: ocrOut.text };
    }
    if (layerNorm) {
      return { text: layerNorm };
    }
    return { text: null, reason: ocrOut.reason || 'ocr_failed' };
  }

  // --- DOCX ---
  if (
    DOCX_EXTS.has(ext) ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    let mammoth;
    try {
      mammoth = require('mammoth');
    } catch (err) {
      logger.warn(`[DocTextExtractor] mammoth non installato — DOCX saltato: ${err.message}`);
      return { text: null, reason: 'mammoth_missing' };
    }
    try {
      const result = await mammoth.extractRawText({ buffer });
      const norm = normalizeWhitespace(result && result.value);
      if (!norm) return { text: null, reason: 'docx_empty' };
      return { text: norm };
    } catch (err) {
      logger.warn(`[DocTextExtractor] Estrazione DOCX fallita (${storagePath}): ${err.message}`);
      return { text: null, reason: 'docx_parse_error' };
    }
  }

  // --- Testo semplice ---
  if (PLAIN_TEXT_EXTS.has(ext) || mime.startsWith('text/')) {
    try {
      const norm = normalizeWhitespace(buffer.toString('utf8'));
      if (!norm) return { text: null, reason: 'text_empty' };
      return { text: norm };
    } catch (err) {
      logger.warn(`[DocTextExtractor] Lettura testo fallita (${storagePath}): ${err.message}`);
      return { text: null, reason: 'text_read_error' };
    }
  }

  // --- Formato non supportato (immagini, .doc legacy, archivi, ecc.) ---
  return { text: null, reason: 'unsupported_format' };
}

/**
 * Indica se un file è in linea di principio estraibile (per pre-filtro query/UI).
 * @param {string} fileName
 * @param {string} [mimeType]
 * @returns {boolean}
 */
function isExtractable(fileName, mimeType) {
  const ext = path.extname(fileName || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  return (
    PDF_EXTS.has(ext) ||
    DOCX_EXTS.has(ext) ||
    PLAIN_TEXT_EXTS.has(ext) ||
    mime === 'application/pdf' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime.startsWith('text/')
  );
}

module.exports = {
  extractDocumentText,
  isExtractable,
  normalizeWhitespace,
};
