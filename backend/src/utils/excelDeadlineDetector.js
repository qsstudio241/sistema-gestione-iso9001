/**
 * Detector euristico per file Excel/CSV contenenti uno "scadenzario".
 * Analizza le intestazioni di ogni foglio e restituisce, per ciascuno,
 * la colonna-scadenza rilevata, la colonna-descrizione e un confidence score.
 *
 * Non richiede API esterne ù solo SheetJS (xlsx) giù nel progetto.
 * ADR-013 ù2.1 ù S1
 */
'use strict';

const XLSX = require('xlsx');

// ?? Pattern colonne-scadenza ??????????????????????????????????????????????????
const DEADLINE_COLUMN_PATTERNS = [
  /scadenza/i,
  /data\s*scadenza/i,
  /fine\s*validit/i,
  /validit.*fino/i,
  /rinnovo/i,
  /data\s*fine/i,
  /termine/i,
  /entro\s*il/i,
  /deadline/i,
  /expiry/i,
  /expiration/i,
  /due\s*date/i,
  /valid\s*until/i,
  /end\s*date/i,
  /renewal/i,
  /data.*verifica/i,
  /prossim.*controllo/i,
  /prossim.*(verifica|manutenzione|revisione|ispezione|controllo)/i,
  /ultima.*(verifica|manutenzione|revisione|del|scadenza)/i,
  /scad/i,
  // "data" semplice in italiano (ambiguo ma frequente negli scadenzari)
  /^data$/i,
  /^date$/i,
  // Colonne frequenti negli scadenzari italiani
  /^prossima$/i,       // prossima manutenzione/verifica (colonna standalone)
  /^ultima$/i,         // ultima verifica (data precedente ù usata come riferimento)
  /\bvalidit/i,        // validitù (senza "fine" o "fino")
  /verifica\s*periodica/i,
  /certificazione/i,
  /revisione/i,
  /manutenzione/i,
  /ispezione/i,
  /collaudo/i,
];

// ?? Pattern colonne-descrizione ??????????????????????????????????????????????
const LABEL_COLUMN_PATTERNS = [
  /descrizione/i,
  /oggetto/i,
  /titolo/i,
  /nome/i,
  /documento/i,
  /attivit/i,
  /argomento/i,
  /elemento/i,
  /item/i,
  /subject/i,
  /cosa/i,
  /riferimento/i,
  /rif/i,
  /strumento/i,
  /attrezzatura/i,
  /apparecchiatura/i,
  /impianto/i,
  /denominazione/i,
];

// ?? Helpers ???????????????????????????????????????????????????????????????????

/**
 * Verifica se un valore ù interpretabile come data.
 * Accetta: oggetti Date, serial Excel (numero), stringhe data.
 * @param {*} v
 * @returns {boolean}
 */
function isDateLike(v) {
  if (v instanceof Date) return !isNaN(v.getTime());
  if (typeof v === 'number' && v > 1 && v < 3000000) return true; // serial Excel plausibile
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return false;
    // Formati comuni: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, MM/DD/YYYY
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s)) return true;
    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(s)) return true;
    const d = new Date(s);
    return !isNaN(d.getTime()) && d.getFullYear() > 1900;
  }
  return false;
}

/**
 * Restituisce true se la maggioranza dei valori nel campione ù date-like.
 * @param {Array} sample  valori della colonna (fino a 5 righe)
 * @returns {boolean}
 */
function columnHasDates(sample) {
  const nonEmpty = sample.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return false;
  const dateCount = nonEmpty.filter(isDateLike).length;
  return dateCount / nonEmpty.length >= 0.5;
}

/**
 * Cerca la colonna il cui header matcha i pattern e i cui valori sono date.
 * Scansione per pattern (ordine prioritù) ù restituisce la prima colonna che
 * soddisfa il pattern più prioritario. Questo evita che "ultima" (passato)
 * venga preferita a "prossima" (futuro) solo perchù ha indice di colonna inferiore.
 * @param {string[]} headers
 * @param {Array[]} dataRows  prime righe dati (max 5)
 * @param {RegExp[]} patterns
 * @param {boolean} checkDates ù se true verifica che la colonna contenga date
 * @returns {number} indice colonna, -1 se non trovato
 */
function findColumnByPattern(headers, dataRows, patterns, checkDates) {
  for (const pattern of patterns) {
    for (let i = 0; i < headers.length; i++) {
      if (!pattern.test(headers[i])) continue;
      if (checkDates) {
        const colValues = dataRows.map(row => (row ? row[i] : undefined));
        if (!columnHasDates(colValues)) continue;
      }
      return i;
    }
  }
  return -1;
}

/**
 * Cerca la colonna-scadenza verificando sia nome che contenuto.
 */
function findDateColumn(headers, dataRows) {
  return findColumnByPattern(headers, dataRows, DEADLINE_COLUMN_PATTERNS, true);
}

/**
 * Cerca la colonna-descrizione (basta il nome).
 */
function findTitleColumn(headers) {
  return findColumnByPattern(headers, [], LABEL_COLUMN_PATTERNS, false);
}

/**
 * Calcola il confidence score (0ù1) per il foglio rilevato.
 * Alta (>0.8): header esplicito + date valide in >80% dei valori
 * Media (0.5ù0.8): header parziale o date poche
 * Bassa (<0.5): nessuna corrispondenza forte
 *
 * @param {string[]} headers
 * @param {Array[]} dataRows
 * @param {number} dateColIdx
 * @returns {number}
 */
function calculateConfidence(headers, dataRows, dateColIdx) {
  const header = headers[dateColIdx] || '';
  const colValues = dataRows.map(r => (r ? r[dateColIdx] : undefined)).filter(v => v !== null && v !== undefined && v !== '');

  // Punto base: quanti valori sono date
  const dateRatio = colValues.length > 0
    ? colValues.filter(isDateLike).length / colValues.length
    : 0;

  // Bonus per header molto esplicito
  const isExplicitHeader = /scadenza|due\s*date|expiry|expiration|data\s*scadenza|validit/i.test(header);
  const isAmbiguousHeader = /^(data|date|prossima|ultima|revisione|manutenzione|ispezione|collaudo)$/i.test(header.trim()) || /\bvalidit/i.test(header);

  let score = dateRatio * 0.6;
  if (isExplicitHeader) score += 0.35;
  else if (!isAmbiguousHeader) score += 0.15;
  else score += 0.1; // ambiguous ("data", "prossima", ecc.) ma con date: piccolo bonus

  return Math.min(1, Math.max(0, parseFloat(score.toFixed(2))));
}

// ?? API pubblica ??????????????????????????????????????????????????????????????

/**
 * Analizza un buffer Excel/CSV e rileva i fogli che contengono scadenzari.
 *
 * @param {Buffer} buffer  contenuto del file
 * @returns {Array<{
 *   sheetName: string,
 *   dateColumn: string,
 *   dateColumnIndex: number,
 *   titleColumn: string,
 *   titleColumnIndex: number,
 *   confidence: number,
 *   confidenceLevel: 'alta' | 'media' | 'bassa',
 *   sampleRows: Array,
 *   totalRows: number
 * }>}
 */
/**
 * Determina quale riga del foglio contiene gli header reali.
 * Molti Excel italiani hanno una riga-titolo in row 0 e gli header in row 1.
 * @param {Array[]} rows  tutte le righe del foglio
 * @returns {number}  indice della riga header (0 o 1)
 */
function detectHeaderRow(rows) {
  if (rows.length < 2) return 0;
  const row0 = (rows[0] || []).filter(c => c !== null && c !== undefined && c !== '');
  const row1 = (rows[1] || []).filter(c => c !== null && c !== undefined && c !== '');
  // Se row 0 ha meno di 3 celle non vuote e row 1 ne ha di più, usa row 1
  if (row0.length < 3 && row1.length >= 3) return 1;
  // Se row 0 ha celle molto lunghe (> 50 char) ù probabilmente un titolo
  const avgLen0 = row0.reduce((s, c) => s + String(c).length, 0) / (row0.length || 1);
  if (avgLen0 > 50 && row1.length >= row0.length) return 1;
  return 0;
}

function detectDeadlineSheets(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const results = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (json.length < 2) continue;

    const headerRowIdx = detectHeaderRow(json);
    const headers = (json[headerRowIdx] || []).map(h => String(h == null ? '' : h).trim());
    const dataRows = json.slice(headerRowIdx + 1, headerRowIdx + 6); // prime 5 righe dati
    if (dataRows.length === 0) continue;

    const dateColIdx = findDateColumn(headers, dataRows);
    const titleColIdx = findTitleColumn(headers);

    if (dateColIdx < 0 || titleColIdx < 0) continue;

    const confidence = calculateConfidence(headers, dataRows, dateColIdx);
    const confidenceLevel = confidence > 0.8 ? 'alta' : confidence >= 0.5 ? 'media' : 'bassa';
    if (confidenceLevel === 'bassa') continue;

    results.push({
      sheetName,
      dateColumn: headers[dateColIdx],
      dateColumnIndex: dateColIdx,
      titleColumn: headers[titleColIdx],
      titleColumnIndex: titleColIdx,
      headerRowIndex: headerRowIdx,
      confidence,
      confidenceLevel,
      sampleRows: json.slice(headerRowIdx + 1, headerRowIdx + 4),
      totalRows: json.length - headerRowIdx - 1,
    });
  }

  return results;
}

/**
 * Wrapper di convenienza: restituisce il risultato in formato ADR ù5.3.
 * @param {Buffer} buffer
 * @returns {{
 *   isDeadlineFile: boolean,
 *   sheets: Array,
 *   suggestedMapping: object | null
 * }}
 */
function detectDeadlineFile(buffer) {
  const sheets = detectDeadlineSheets(buffer);
  const isDeadlineFile = sheets.length > 0;
  const best = sheets.length > 0
    ? sheets.reduce((a, b) => (b.confidence > a.confidence ? b : a))
    : null;

  return {
    isDeadlineFile,
    sheets,
    suggestedMapping: best
      ? {
          sheetName: best.sheetName,
          dateColumn: best.dateColumn,
          titleColumn: best.titleColumn,
          confidence: best.confidence,
          confidenceLevel: best.confidenceLevel,
        }
      : null,
  };
}

module.exports = {
  detectDeadlineFile,
  detectDeadlineSheets,
  // esportate per test
  _isDateLike: isDateLike,
  _columnHasDates: columnHasDates,
  _calculateConfidence: calculateConfidence,
  _detectHeaderRow: detectHeaderRow,
};
