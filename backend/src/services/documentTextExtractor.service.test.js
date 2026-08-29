/**
 * @jest-environment node
 *
 * Test L1 — documentTextExtractor.service
 * Copre: estrazione PDF, fallback OCR (ok / fail / unavailable), immagini
 * raster (S1b), DOCX, testo semplice, formati non supportati, file mancante.
 */

jest.mock('fs', () => ({
  promises: { readFile: jest.fn() },
}));
jest.mock('../utils/importPdfText', () => ({
  extractPdfText: jest.fn(),
}));
jest.mock('../utils/ocrExtractor', () => ({
  extractTextWithOCR: jest.fn(),
  extractTextFromImageBuffer: jest.fn(),
}));
jest.mock('mammoth', () => ({
  extractRawText: jest.fn(),
}), { virtual: true });
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const fs = require('fs').promises;
const { extractPdfText } = require('../utils/importPdfText');
const { extractTextWithOCR, extractTextFromImageBuffer } = require('../utils/ocrExtractor');
const mammoth = require('mammoth');
const { extractDocumentText, isExtractable, normalizeWhitespace } = require('./documentTextExtractor.service');

beforeEach(() => {
  jest.clearAllMocks();
  fs.readFile.mockResolvedValue(Buffer.from('dummy'));
});

describe('extractDocumentText', () => {
  test('estrae testo da PDF con strato testo', async () => {
    extractPdfText.mockResolvedValue(
      'Contenuto   del PDF con strato testo sufficiente per superare la soglia OCR\r\n\r\n\r\nseconda riga del documento'
    );
    const out = await extractDocumentText('/x/file.pdf', 'application/pdf', 'file.pdf');
    expect(out.text).toBe(
      'Contenuto del PDF con strato testo sufficiente per superare la soglia OCR\n\nseconda riga del documento'
    );
    expect(extractPdfText).toHaveBeenCalledTimes(1);
    expect(extractTextWithOCR).not.toHaveBeenCalled();
  });

  test('riconosce PDF da mime anche senza estensione nel nome', async () => {
    extractPdfText.mockResolvedValue(
      'Testo valido del documento con lunghezza oltre la soglia minima OCR ingest'
    );
    const out = await extractDocumentText('/x/blob', 'application/pdf', 'blob');
    expect(out.text).toBe(
      'Testo valido del documento con lunghezza oltre la soglia minima OCR ingest'
    );
    expect(extractTextWithOCR).not.toHaveBeenCalled();
  });

  test('PDF scansionato: OCR ok → testo senza throw', async () => {
    extractPdfText.mockResolvedValue('   \n  ');
    extractTextWithOCR.mockResolvedValue('Testo da scansione  OCR');
    const out = await extractDocumentText('/x/scan.pdf', 'application/pdf', 'scan.pdf');
    expect(out.text).toBe('Testo da scansione OCR');
    expect(out.reason).toBe('ocr_ok');
    expect(extractTextWithOCR).toHaveBeenCalledTimes(1);
  });

  test('PDF scansionato: OCR throw → ocr_failed senza lanciare', async () => {
    extractPdfText.mockResolvedValue('');
    extractTextWithOCR.mockRejectedValue(new Error('[OCR] Tesseract non ha estratto testo utilizzabile'));
    const out = await extractDocumentText('/x/scan.pdf', 'application/pdf', 'scan.pdf');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('ocr_failed');
  });

  test('PDF scansionato: conversione Ghostscript fallita → ocr_failed (non unavailable)', async () => {
    extractPdfText.mockResolvedValue('');
    extractTextWithOCR.mockRejectedValue(
      new Error(
        '[OCR] Conversione PDF->immagine ha prodotto un output vuoto (motore: gm). Verificare che Ghostscript sia installato.'
      )
    );
    const out = await extractDocumentText('/x/scan.pdf', 'application/pdf', 'scan.pdf');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('ocr_failed');
  });

  test('PDF scansionato: motore immagini assente → ocr_unavailable', async () => {
    extractPdfText.mockResolvedValue('');
    extractTextWithOCR.mockRejectedValue(
      new Error('[OCR] Nessun motore immagini installato sul server: serve GraphicsMagick')
    );
    const out = await extractDocumentText('/x/scan.pdf', 'application/pdf', 'scan.pdf');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('ocr_unavailable');
  });

  test('PDF sotto soglia: tenta OCR; se OCR fallisce tiene lo strato testo', async () => {
    extractPdfText.mockResolvedValue('breve');
    extractTextWithOCR.mockRejectedValue(new Error('ocr boom'));
    const out = await extractDocumentText('/x/short.pdf', 'application/pdf', 'short.pdf');
    expect(out.text).toBe('breve');
    expect(extractTextWithOCR).toHaveBeenCalledTimes(1);
  });

  test('errore parsing PDF: tenta OCR e se ok restituisce testo', async () => {
    extractPdfText.mockRejectedValue(new Error('corrupt'));
    extractTextWithOCR.mockResolvedValue('Recuperato da OCR');
    const out = await extractDocumentText('/x/bad.pdf', 'application/pdf', 'bad.pdf');
    expect(out.text).toBe('Recuperato da OCR');
    expect(out.reason).toBe('ocr_ok');
  });

  test('errore parsing PDF: OCR fallito → skip senza lanciare', async () => {
    extractPdfText.mockRejectedValue(new Error('corrupt'));
    extractTextWithOCR.mockRejectedValue(new Error('ocr boom'));
    const out = await extractDocumentText('/x/bad.pdf', 'application/pdf', 'bad.pdf');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('ocr_failed');
  });

  test('estrae testo da DOCX via mammoth', async () => {
    mammoth.extractRawText.mockResolvedValue({ value: 'Paragrafo Word' });
    const out = await extractDocumentText(
      '/x/doc.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc.docx'
    );
    expect(out.text).toBe('Paragrafo Word');
    expect(mammoth.extractRawText).toHaveBeenCalledTimes(1);
  });

  test('DOCX vuoto → skip con reason', async () => {
    mammoth.extractRawText.mockResolvedValue({ value: '' });
    const out = await extractDocumentText('/x/empty.docx', null, 'empty.docx');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('docx_empty');
  });

  test('estrae testo semplice (.txt)', async () => {
    fs.readFile.mockResolvedValue(Buffer.from('riga uno\nriga due', 'utf8'));
    const out = await extractDocumentText('/x/note.txt', 'text/plain', 'note.txt');
    expect(out.text).toBe('riga uno\nriga due');
  });

  test('PNG: OCR ok → testo senza throw', async () => {
    extractTextFromImageBuffer.mockResolvedValue('Testo da  foto scansione');
    const out = await extractDocumentText('/x/foto.png', 'image/png', 'foto.png');
    expect(out.text).toBe('Testo da foto scansione');
    expect(out.reason).toBe('ocr_ok');
    expect(extractTextFromImageBuffer).toHaveBeenCalledTimes(1);
    expect(extractTextWithOCR).not.toHaveBeenCalled();
  });

  test('JPEG da mime senza estensione → OCR', async () => {
    extractTextFromImageBuffer.mockResolvedValue('Etichetta ISO 9001');
    const out = await extractDocumentText('/x/blob', 'image/jpeg', 'blob');
    expect(out.text).toBe('Etichetta ISO 9001');
    expect(out.reason).toBe('ocr_ok');
  });

  test('WebP: OCR ok', async () => {
    extractTextFromImageBuffer.mockResolvedValue('Verbale fotografato');
    const out = await extractDocumentText('/x/shot.webp', 'image/webp', 'shot.webp');
    expect(out.text).toBe('Verbale fotografato');
    expect(out.reason).toBe('ocr_ok');
  });

  test('immagine: Tesseract throw → ocr_failed senza lanciare', async () => {
    extractTextFromImageBuffer.mockRejectedValue(
      new Error('[OCR] Tesseract non ha estratto testo utilizzabile')
    );
    const out = await extractDocumentText('/x/foto.png', 'image/png', 'foto.png');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('ocr_failed');
  });

  test('immagine: tesseract.js assente → ocr_unavailable', async () => {
    extractTextFromImageBuffer.mockRejectedValue(
      new Error("Cannot find module 'tesseract.js'")
    );
    const out = await extractDocumentText('/x/foto.jpg', 'image/jpeg', 'foto.jpg');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('ocr_unavailable');
  });

  test('immagine: OCR restituisce solo spazi → ocr_failed', async () => {
    extractTextFromImageBuffer.mockResolvedValue('  \n  ');
    const out = await extractDocumentText('/x/foto.png', 'image/png', 'foto.png');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('ocr_failed');
  });

  test('immagine: buffer non raster → ocr_failed', async () => {
    extractTextFromImageBuffer.mockRejectedValue(
      new Error('[OCR] Buffer immagine non valido (serve PNG, JPEG o WebP)')
    );
    const out = await extractDocumentText('/x/foto.png', 'image/png', 'foto.png');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('ocr_failed');
  });

  test('GIF non è raster supportato → unsupported_format', async () => {
    const out = await extractDocumentText('/x/anim.gif', 'image/gif', 'anim.gif');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('unsupported_format');
    expect(extractTextFromImageBuffer).not.toHaveBeenCalled();
  });

  test('.doc legacy non supportato → skip', async () => {
    const out = await extractDocumentText('/x/old.doc', 'application/msword', 'old.doc');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('unsupported_format');
  });

  test('file mancante su disco → skip con reason', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT'));
    const out = await extractDocumentText('/x/missing.pdf', 'application/pdf', 'missing.pdf');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('file_not_found');
  });

  test('storage_path mancante → skip', async () => {
    const out = await extractDocumentText(null, 'application/pdf', 'x.pdf');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('no_storage_path');
  });
});

describe('isExtractable', () => {
  test('riconosce pdf/docx/txt e raster png/jpeg/webp', () => {
    expect(isExtractable('a.pdf')).toBe(true);
    expect(isExtractable('a.docx')).toBe(true);
    expect(isExtractable('a.txt')).toBe(true);
    expect(isExtractable('a.png', 'image/png')).toBe(true);
    expect(isExtractable('foto.jpg')).toBe(true);
    expect(isExtractable('blob', 'image/webp')).toBe(true);
  });
  test('rifiuta GIF, archivi e .doc', () => {
    expect(isExtractable('a.gif', 'image/gif')).toBe(false);
    expect(isExtractable('a.zip')).toBe(false);
    expect(isExtractable('old.doc', 'application/msword')).toBe(false);
  });
});

describe('normalizeWhitespace', () => {
  test('comprime spazi e newline multipli', () => {
    expect(normalizeWhitespace('a   b\r\n\r\n\r\nc')).toBe('a b\n\nc');
  });
});
