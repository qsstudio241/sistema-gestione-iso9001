/**
 * @jest-environment node
 *
 * Test L1 — documentTextExtractor.service
 * Copre: estrazione PDF, DOCX, testo semplice, formati non supportati,
 * file mancante e PDF senza strato testo (scansione).
 */

jest.mock('fs', () => ({
  promises: { readFile: jest.fn() },
}));
jest.mock('../utils/importPdfText', () => ({
  extractPdfText: jest.fn(),
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
const mammoth = require('mammoth');
const { extractDocumentText, isExtractable, normalizeWhitespace } = require('./documentTextExtractor.service');

beforeEach(() => {
  jest.clearAllMocks();
  fs.readFile.mockResolvedValue(Buffer.from('dummy'));
});

describe('extractDocumentText', () => {
  test('estrae testo da PDF con strato testo', async () => {
    extractPdfText.mockResolvedValue('Contenuto   del PDF\r\n\r\n\r\nseconda riga');
    const out = await extractDocumentText('/x/file.pdf', 'application/pdf', 'file.pdf');
    expect(out.text).toBe('Contenuto del PDF\n\nseconda riga');
    expect(extractPdfText).toHaveBeenCalledTimes(1);
  });

  test('riconosce PDF da mime anche senza estensione nel nome', async () => {
    extractPdfText.mockResolvedValue('Testo valido del documento');
    const out = await extractDocumentText('/x/blob', 'application/pdf', 'blob');
    expect(out.text).toBe('Testo valido del documento');
  });

  test('PDF scansionato senza testo → skip con reason', async () => {
    extractPdfText.mockResolvedValue('   \n  ');
    const out = await extractDocumentText('/x/scan.pdf', 'application/pdf', 'scan.pdf');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('pdf_no_text_layer');
  });

  test('errore parsing PDF → skip senza lanciare', async () => {
    extractPdfText.mockRejectedValue(new Error('corrupt'));
    const out = await extractDocumentText('/x/bad.pdf', 'application/pdf', 'bad.pdf');
    expect(out.text).toBeNull();
    expect(out.reason).toBe('pdf_parse_error');
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
