/**
 * @jest-environment node
 *
 * Test L1 — documentTextExtractor.service
 * Copre: estrazione PDF, fallback OCR (ok / fail / unavailable), DOCX,
 * testo semplice, formati non supportati, file mancante.
 */

jest.mock('fs', () => ({
  promises: { readFile: jest.fn() },
}));
jest.mock('../utils/importPdfText', () => ({
  extractPdfText: jest.fn(),
}));
jest.mock('../utils/ocrExtractor', () => ({
  extractTextWithOCR: jest.fn(),
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
const { extractTextWithOCR } = require('../utils/ocrExtractor');
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
    expect(out.reason).toBeUndefined();
    expect(extractTextWithOCR).toHaveBeenCalledTimes(1);
  });

  test('PDF scansionato: OCR throw → ocr_failed senza lanciare', async () => {
    extractPdfText.mockResolvedValue('');
    extractTextWithOCR.mockRejectedValue(new Error('[OCR] Tesseract non ha estratto testo utilizzabile'));
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

  test('formato non supportato (immagine) → skip', async () => {
    const out = await extractDocumentText('/x/foto.png', 'image/png', 'foto.png');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('unsupported_format');
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
  test('riconosce pdf/docx/txt', () => {
    expect(isExtractable('a.pdf')).toBe(true);
    expect(isExtractable('a.docx')).toBe(true);
    expect(isExtractable('a.txt')).toBe(true);
  });
  test('rifiuta immagini e archivi', () => {
    expect(isExtractable('a.png', 'image/png')).toBe(false);
    expect(isExtractable('a.zip')).toBe(false);
  });
});

describe('normalizeWhitespace', () => {
  test('comprime spazi e newline multipli', () => {
    expect(normalizeWhitespace('a   b\r\n\r\n\r\nc')).toBe('a b\n\nc');
  });
});
