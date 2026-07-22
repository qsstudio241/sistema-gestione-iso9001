/**
 * documentTextExtractor.service.js
 * Estrazione difensiva del testo dai file allegati ai documenti del registro.
 *
 * Supporta: PDF (strato testo), DOCX, e file di testo semplice (txt/csv/md).
 * Formati non supportati o non leggibili (immagini, PDF scansionati senza
 * strato testo, .doc legacy, file mancanti) vengono SALTATI senza bloccare la
 * pipeline: la funzione restituisce { text: null, reason }.
 *
 * Nessun OCR in questo passo: i PDF immagine producono poco/zero testo e vengono
 * scartati tramite la soglia minima di lunghezza gestita dal chiamante.
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { extractPdfText } = require('../utils/importPdfText');

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

  // --- PDF ---
  if (PDF_EXTS.has(ext) || mime === 'application/pdf') {
    try {
      const text = await extractPdfText(buffer);
      const norm = normalizeWhitespace(text);
      if (!norm) return { text: null, reason: 'pdf_no_text_layer' };
      return { text: norm };
    } catch (err) {
      logger.warn(`[DocTextExtractor] Estrazione PDF fallita (${storagePath}): ${err.message}`);
      return { text: null, reason: 'pdf_parse_error' };
    }
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
