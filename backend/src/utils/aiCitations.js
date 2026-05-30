/**
 * Costruisce citazioni strutturate dai chunk di knowledge retrieval.
 */

const ENTITY_TYPE_LABELS = {
  audit_conclusion: 'Audit',
  non_conformity: 'Non conformit\u00e0',
  nc_action: 'Azione NC',
  complaint: 'Reclamo',
  qualification: 'Qualifica',
  risk: 'Rischio',
  document: 'Documento',
  norm_content: 'Contenuto norma',
};

/**
 * Etichetta leggibile dal testo del chunk (prima frase, max 100 caratteri).
 * @param {string} entityType
 * @param {string} chunkText
 * @returns {string}
 */
function extractCitationLabel(entityType, chunkText) {
  const fallback = ENTITY_TYPE_LABELS[entityType] || 'Record SGQ';
  if (!chunkText || typeof chunkText !== 'string') return fallback;

  const trimmed = chunkText.trim();
  const firstSentence = (trimmed.split(/\.\s+/)[0] || trimmed).trim();
  if (!firstSentence) return fallback;
  if (firstSentence.length <= 100) return firstSentence;
  return `${firstSentence.substring(0, 97)}...`;
}

/**
 * Deduplica per entity_type + entity_id, mantiene lo score più alto.
 * @param {Array<{id?, entity_type, entity_id, chunk_text, score}>} chunks
 * @returns {Array<{entityType: string, entityId: string, label: string, score: number}>}
 */
function buildCitationsFromChunks(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];

  const byKey = new Map();

  for (const chunk of chunks) {
    const entityType = chunk.entity_type;
    const entityId = chunk.entity_id;
    if (!entityType || entityId == null || entityId === '') continue;

    const key = `${entityType}:${entityId}`;
    const score = typeof chunk.score === 'number' ? chunk.score : 0;
    const candidate = {
      entityType,
      entityId: String(entityId),
      label: extractCitationLabel(entityType, chunk.chunk_text),
      score: parseFloat(score.toFixed(4)),
    };

    const prev = byKey.get(key);
    if (!prev || candidate.score > prev.score) {
      byKey.set(key, candidate);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => b.score - a.score);
}

module.exports = {
  buildCitationsFromChunks,
  extractCitationLabel,
  ENTITY_TYPE_LABELS,
};
