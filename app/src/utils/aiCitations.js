/**
 * Mapping citazioni AI ? route SGQ (History API).
 */

const MODULE_ROUTES = {
  audit_conclusion: '/audit',
  non_conformity: '/nc',
  nc_action: '/nc',
  complaint: '/reclami',
  qualification: '/qualifiche',
  risk: '/rischi',
  document: '/documents',
  norm_content: '/documents',
};

/**
 * Path navigabile per una citazione.
 * @param {{ entityType: string, entityId: string }} citation
 * @returns {string|null}
 */
export function getCitationPath({ entityType, entityId }) {
  const base = MODULE_ROUTES[entityType];
  if (!base) return null;

  if (entityType === 'non_conformity' && entityId) {
    const id = parseInt(entityId, 10);
    if (!Number.isNaN(id)) return `${base}?select=${id}`;
  }

  return base;
}

/**
 * Messaggio UX sotto la risposta assistant.
 * @param {number} sourcesCount - record SGQ distinti (citazioni)
 * @param {number} [chunkCount] - chunk usati nel contesto LLM
 * @returns {string}
 */
export function buildSourcesFootnote(sourcesCount, chunkCount) {
  if (sourcesCount > 0) {
    const recordLabel = sourcesCount === 1 ? 'record' : 'record';
    let msg = `Basato su ${sourcesCount} ${recordLabel} del SGQ`;
    if (chunkCount > sourcesCount) {
      msg += ` (${chunkCount} estratti testuali)`;
    }
    return msg;
  }
  return 'Risposta senza fonti verificabili dal registro — prova a riformulare o aggiorna l\'indice dati.';
}

export { MODULE_ROUTES };
