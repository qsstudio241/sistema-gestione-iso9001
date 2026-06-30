/**
 * gapAnalysis.service.js — Gap analysis MVP (HK-8, ADR-010 Fase 2)
 *
 * Per ogni clausola normativa (standard_code, is_current=1) cerca copertura
 * nella document_registry dell'azienda (company_id, organization_id).
 * Logica euristica:
 *   - covered  : >=2 doc o almeno 1 con match nel titolo
 *   - partial  : 1 doc con match keyword nel JSON dei metadati
 *   - missing  : nessun match
 */

const logger = require('../utils/logger');
const { query } = require('../config/database');

/**
 * Tokenizza un testo in termini significativi (>= 3 caratteri, no stopwords).
 */
const STOPWORDS = new Set(['del', 'della', 'dei', 'per', 'con', 'che', 'una', 'uno', 'gli', 'and', 'the', 'for', 'with', 'von', 'und']);
function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9àèéìòùáéíóú\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Conta quanti token di `clauseTokens` appaiono nel testo `haystack`.
 */
function matchScore(clauseTokens, haystack) {
  const lower = (haystack || '').toLowerCase();
  return clauseTokens.filter((t) => lower.includes(t)).length;
}

/**
 * Esegui gap analysis per un'azienda e uno standard.
 *
 * @param {{ organizationId: number, companyId: number, standardCode: string }} params
 * @returns {Promise<Array<{ clauseRef: string, title: string, coverage: 'covered'|'partial'|'missing', evidence: Array<{docId:number,title:string}> }>>}
 */
async function runGapAnalysis({ organizationId, companyId, standardCode }) {
  // 1. Carica clausole normative
  const clauseRes = await query(
    `SELECT clause_ref, clause_title, requirement_text
     FROM norm_requirements
     WHERE standard_code = @stdCode AND is_current = 1
     ORDER BY clause_ref`,
    { stdCode: standardCode }
  );
  const clauses = clauseRes.recordset;

  if (!clauses.length) {
    logger.warn(`[GapAnalysis] Nessuna clausola trovata per ${standardCode}`);
    return [];
  }

  // 2. Carica documenti dell'azienda (titolo + metadati JSON)
  const docRes = await query(
    `SELECT id, title, document_type, type_specific_data
     FROM document_registry
     WHERE organization_id = @orgId AND company_id = @compId AND is_current = 1`,
    { orgId: organizationId, compId: companyId }
  );
  const docs = docRes.recordset;

  // 3. Calcola copertura per clausola
  return clauses.map((clause) => {
    const clauseTokens = [
      ...tokenize(clause.clause_title || ''),
      ...tokenize((clause.requirement_text || '').substring(0, 400)),
    ];

    const evidence = [];
    for (const doc of docs) {
      const metaStr = doc.type_specific_data
        ? (typeof doc.type_specific_data === 'string' ? doc.type_specific_data : JSON.stringify(doc.type_specific_data))
        : '';
      const haystack = `${doc.title || ''} ${doc.document_type || ''} ${metaStr}`;
      const score = matchScore(clauseTokens, haystack);
      if (score >= 1) {
        evidence.push({ docId: doc.id, title: doc.title || `Doc ${doc.id}`, score });
      }
    }
    evidence.sort((a, b) => b.score - a.score);

    const titleMatchCount = evidence.filter((e) => {
      const titleTokens = tokenize(e.title);
      return clauseTokens.some((t) => titleTokens.includes(t));
    }).length;

    let coverage;
    if (evidence.length >= 2 || titleMatchCount >= 1) {
      coverage = 'covered';
    } else if (evidence.length === 1) {
      coverage = 'partial';
    } else {
      coverage = 'missing';
    }

    return {
      clauseRef: clause.clause_ref,
      title: clause.clause_title || clause.clause_ref,
      coverage,
      evidence: evidence.slice(0, 5).map(({ docId, title }) => ({ docId, title })),
    };
  });
}

module.exports = { runGapAnalysis };
