'use strict';

/**
 * Test L1 -- excelDeadlineDetector.js
 * Verifica il rilevamento colonne-scadenza su buffer Excel generati in-memory con SheetJS.
 * ADR-013 S1
 */

const XLSX = require('xlsx');
const {
  detectDeadlineFile,
  detectDeadlineSheets,
  _isDateLike,
  _columnHasDates,
  _calculateConfidence,
} = require('./excelDeadlineDetector');

// Helper: crea buffer Excel da array di righe

function makeXlsxBuffer(rows, sheetName = 'Foglio1') {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Dati di test

const SCADENZARIO_TARATURE = [
  ['N.', 'Strumento', 'S/N', 'Data Taratura', 'Data Scadenza', 'Responsabile'],
  [1, 'Torsiometro', 'T-001', '10/01/2026', '10/01/2027', 'Rossi'],
  [2, 'Calibro',     'C-015', '05/03/2025', '05/03/2026', 'Bianchi'],
  [3, 'Amperometro', 'A-008', '20/05/2026', '20/06/2026', 'Rossi'],
];

const SCADENZARIO_POLIZZE = [
  ['Compagnia', 'Polizza', 'Descrizione', 'Scadenza', 'Premio annuo'],
  ['AXA', 'RC-001', 'Responsabilita civile', '31/12/2026', 2500],
  ['Generali', 'IN-002', 'Incendio e furto', '30/06/2026', 1800],
];

const SCADENZARIO_INGLESE = [
  ['Item', 'Due Date', 'Category', 'Notes'],
  ['Calibration report', '2026-12-01', 'Equipment', 'Annual'],
  ['Safety training', '2026-08-15', 'Personnel', 'Mandatory'],
];

const FOGLIO_GENERICO = [
  ['Cliente', 'Fattura', 'Importo', 'Pagato'],
  ['Rossi Srl', 'F-001', 1000, 'Si'],
  ['Bianchi SpA', 'F-002', 2500, 'No'],
];

const FOGLIO_NUMERI_NON_DATE = [
  ['Prodotto', 'Data', 'Quantita'],
  ['A', 42, 100],
  ['B', 55, 200],
];

// Suite

describe('_isDateLike', () => {
  test('accetta oggetti Date validi', () => {
    expect(_isDateLike(new Date('2026-06-08'))).toBe(true);
  });
  test('rifiuta Date non valide', () => {
    expect(_isDateLike(new Date('not-a-date'))).toBe(false);
  });
  test('accetta serial Excel plausibili', () => {
    expect(_isDateLike(45000)).toBe(true);
  });
  test('rifiuta numeri non plausibili come serial', () => {
    expect(_isDateLike(0)).toBe(false);
    expect(_isDateLike(-1)).toBe(false);
  });
  test('accetta stringhe data DD/MM/YYYY', () => {
    expect(_isDateLike('10/01/2027')).toBe(true);
  });
  test('accetta stringhe data YYYY-MM-DD', () => {
    expect(_isDateLike('2026-06-20')).toBe(true);
  });
  test('rifiuta stringhe non data', () => {
    expect(_isDateLike('Torsiometro')).toBe(false);
    expect(_isDateLike('')).toBe(false);
    expect(_isDateLike('N/A')).toBe(false);
  });
  test('rifiuta null e undefined', () => {
    expect(_isDateLike(null)).toBe(false);
    expect(_isDateLike(undefined)).toBe(false);
  });
});

describe('_columnHasDates', () => {
  test('ritorna true se almeno 50% dei valori sono date', () => {
    expect(_columnHasDates(['10/01/2027', '05/03/2026', '20/06/2026'])).toBe(true);
  });
  test('ritorna false se nessun valore e data', () => {
    expect(_columnHasDates(['Torsiometro', 'Calibro', 'Amperometro'])).toBe(false);
  });
  test('ritorna false su array vuoto', () => {
    expect(_columnHasDates([])).toBe(false);
    expect(_columnHasDates([null, '', undefined])).toBe(false);
  });
  test('gestisce mix date e non-date', () => {
    expect(_columnHasDates(['10/01/2027', 'N/A', '20/06/2026'])).toBe(true);
    expect(_columnHasDates(['Testo', 'Altro', '20/06/2026'])).toBe(false);
  });
});

describe('detectDeadlineFile - scadenzario tarature (italiano)', () => {
  let result;

  beforeAll(() => {
    const buf = makeXlsxBuffer(SCADENZARIO_TARATURE, 'Tarature');
    result = detectDeadlineFile(buf);
  });

  test('riconosce il file come scadenzario', () => {
    expect(result.isDeadlineFile).toBe(true);
  });

  test('suggestedMapping contiene la colonna scadenza corretta', () => {
    expect(result.suggestedMapping).not.toBeNull();
    expect(result.suggestedMapping.dateColumn).toMatch(/scadenza/i);
  });

  test('suggestedMapping contiene una colonna descrizione', () => {
    expect(result.suggestedMapping.titleColumn).toBeTruthy();
  });

  test('confidence e alta (>0.8)', () => {
    expect(result.suggestedMapping.confidence).toBeGreaterThan(0.8);
    expect(result.suggestedMapping.confidenceLevel).toBe('alta');
  });

  test('sheets contiene il foglio Tarature', () => {
    expect(result.sheets.length).toBeGreaterThanOrEqual(1);
    expect(result.sheets[0].sheetName).toBe('Tarature');
  });

  test('totalRows e corretto', () => {
    expect(result.sheets[0].totalRows).toBe(SCADENZARIO_TARATURE.length - 1);
  });

  test('sampleRows non e vuoto', () => {
    expect(result.sheets[0].sampleRows.length).toBeGreaterThan(0);
  });
});

describe('detectDeadlineFile - scadenzario polizze', () => {
  let result;

  beforeAll(() => {
    const buf = makeXlsxBuffer(SCADENZARIO_POLIZZE, 'Polizze');
    result = detectDeadlineFile(buf);
  });

  test('riconosce il file come scadenzario', () => {
    expect(result.isDeadlineFile).toBe(true);
  });

  test('colonna scadenza rilevata', () => {
    expect(result.suggestedMapping.dateColumn).toMatch(/scadenza/i);
  });
});

describe('detectDeadlineFile - scadenzario in inglese (Due Date)', () => {
  let result;

  beforeAll(() => {
    const buf = makeXlsxBuffer(SCADENZARIO_INGLESE, 'Schedule');
    result = detectDeadlineFile(buf);
  });

  test('riconosce il file come scadenzario', () => {
    expect(result.isDeadlineFile).toBe(true);
  });

  test('colonna scadenza: Due Date', () => {
    expect(result.suggestedMapping.dateColumn).toMatch(/due\s*date/i);
  });
});

describe('detectDeadlineFile - file NON scadenzario', () => {
  test('foglio clienti/fatture non viene rilevato', () => {
    const buf = makeXlsxBuffer(FOGLIO_GENERICO, 'Fatture');
    const result = detectDeadlineFile(buf);
    expect(result.isDeadlineFile).toBe(false);
    expect(result.suggestedMapping).toBeNull();
    expect(result.sheets).toHaveLength(0);
  });

  test('colonna Data con valori numerici non viene rilevata come scadenza', () => {
    const buf = makeXlsxBuffer(FOGLIO_NUMERI_NON_DATE);
    const result = detectDeadlineFile(buf);
    expect(result.isDeadlineFile).toBe(false);
  });
});

describe('detectDeadlineFile - buffer non valido', () => {
  test('buffer vuoto restituisce isDeadlineFile=false senza eccezioni', () => {
    // xlsx@0.18.5 non lancia su buffer vuoto: restituisce un workbook senza fogli.
    let result;
    expect(() => { result = detectDeadlineFile(Buffer.from('')); }).not.toThrow();
    expect(result.isDeadlineFile).toBe(false);
  });
});

describe('detectDeadlineFile - workbook multi-foglio', () => {
  test('rileva lo scadenzario nel foglio corretto e ignora quello generico', () => {
    const ws1 = XLSX.utils.aoa_to_sheet(FOGLIO_GENERICO);
    const ws2 = XLSX.utils.aoa_to_sheet(SCADENZARIO_TARATURE);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Fatture');
    XLSX.utils.book_append_sheet(wb, ws2, 'Tarature');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = detectDeadlineFile(buf);
    expect(result.isDeadlineFile).toBe(true);
    expect(result.sheets).toHaveLength(1);
    expect(result.sheets[0].sheetName).toBe('Tarature');
  });
});
