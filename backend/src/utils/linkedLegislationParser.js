/**
 * linkedLegislationParser.js
 * Parser condiviso per la stringa `linked_legislation` (SAL + registro obblighi legali).
 * Formato atteso: "D.Lgs. 81/2008 art.28; art.29"
 */

const MAX_LEGAL_ARTICLES = 12;

/**
 * Ricava lo standard_code di un decreto dalla sua etichetta discorsiva.
 * Es. 'D.Lgs. 81/2008' -> 'DLgs_81_2008'. Ritorna null se non riconosciuto.
 * @param {string} label
 * @returns {string|null}
 */
function decreeLabelToStandardCode(label) {
  const m = String(label || '').match(/D\.?\s*Lgs\.?\s*(\d+)\s*\/\s*(\d{4})/i);
  if (!m) return null;
  return `DLgs_${m[1]}_${m[2]}`;
}

/** Etichetta canonica del decreto (es. 'D.Lgs. 81/2008'). */
function normalizeDecreeLabel(label) {
  const m = String(label || '').match(/D\.?\s*Lgs\.?\s*(\d+)\s*\/\s*(\d{4})/i);
  if (!m) return String(label || '').trim();
  return `D.Lgs. ${m[1]}/${m[2]}`;
}

/**
 * Parsea la stringa `linked_legislation` di una clausola ISO in una lista
 * ordinata di articoli di legge collegati.
 *
 * Formato atteso (matrice legislation_seed): "D.Lgs. 81/2008 art.28; art.29"
 * oppure piu' decreti "D.Lgs. 81/2008 art.15; D.Lgs. 152/2006 art.6".
 * I riferimenti articolo ("art.NN") coincidono con norm_requirements.clause_ref.
 *
 * @param {string} raw
 * @returns {Array<{decreeLabel:string, standardCode:string, clauseRef:string, articleRef:string}>}
 */
function parseLinkedLegislation(raw) {
  const str = String(raw || '').trim();
  if (!str) return [];

  const decreeRe = /D\.?\s*Lgs\.?\s*\d+\s*\/\s*\d{4}/gi;
  const artRe = /art\.\s*[\w-]+/gi;

  const out = [];
  const seen = new Set();
  let currentCode = null;
  let currentLabel = null;

  // Segmenti separati da ';' preservando l'ordine: ogni etichetta di decreto
  // incontrata aggiorna il contesto per gli articoli che seguono.
  for (const seg of str.split(';')) {
    const s = seg.trim();
    if (!s) continue;

    const decrees = s.match(decreeRe);
    if (decrees && decrees.length) {
      currentLabel = normalizeDecreeLabel(decrees[decrees.length - 1]);
      currentCode = decreeLabelToStandardCode(currentLabel);
    }
    if (!currentCode) continue;

    const arts = s.match(artRe) || [];
    for (const a of arts) {
      const clauseRef = a.replace(/\s+/g, '').toLowerCase();
      const key = `${currentCode}|${clauseRef}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        decreeLabel: currentLabel,
        standardCode: currentCode,
        clauseRef,
        articleRef: `${currentLabel} ${clauseRef}`,
      });
      if (out.length >= MAX_LEGAL_ARTICLES) return out;
    }
  }
  return out;
}

/**
 * Estrae i decreti univoci citati in linked_legislation (Tier 1 — livello atto).
 * Copre sia stringhe con soli decreti ("D.Lgs. 152/2006") sia con articoli.
 *
 * @param {string} raw
 * @returns {Array<{decreeLabel:string, standardCode:string}>}
 */
function getUniqueDecreesFromLinkedLegislation(raw) {
  const str = String(raw || '').trim();
  if (!str) return [];

  const byCode = new Map();
  const decreeRe = /D\.?\s*Lgs\.?\s*\d+\s*\/\s*\d{4}/gi;
  let match;
  while ((match = decreeRe.exec(str)) !== null) {
    const label = normalizeDecreeLabel(match[0]);
    const code = decreeLabelToStandardCode(label);
    if (code && !byCode.has(code)) {
      byCode.set(code, { decreeLabel: label, standardCode: code });
    }
  }

  for (const ref of parseLinkedLegislation(str)) {
    if (ref.standardCode && !byCode.has(ref.standardCode)) {
      byCode.set(ref.standardCode, {
        decreeLabel: ref.decreeLabel,
        standardCode: ref.standardCode,
      });
    }
  }

  return Array.from(byCode.values());
}

module.exports = {
  MAX_LEGAL_ARTICLES,
  decreeLabelToStandardCode,
  normalizeDecreeLabel,
  parseLinkedLegislation,
  getUniqueDecreesFromLinkedLegislation,
};
