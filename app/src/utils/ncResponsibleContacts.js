/**
 * Caricamento opzioni responsabili NC (personale azienda + rubrica)
 */

const NC_SCOPE_ATTUAZIONE = 'attuazione';
const NC_SCOPE_VERIFICA = 'verifica';

/**
 * @param {object} apiService
 * @param {{ companyId?: number|null, scope: 'attuazione'|'verifica' }} options
 * @returns {Promise<Array>}
 */
export async function loadNcResponsibleContacts(apiService, { companyId, scope }) {
  if (companyId != null && companyId !== '' && typeof apiService.get === 'function') {
    try {
      const qs = new URLSearchParams({
        company_id: companyId,
        scope,
      }).toString();
      const res = await apiService.get(`/non-conformities/responsible-options?${qs}`);
      return res?.data || [];
    } catch {
      /* fallback sotto */
    }
  }
  return loadLegacyNotificationContacts(apiService, scope);
}

async function loadLegacyNotificationContacts(apiService, scope) {
  if (typeof apiService.getNotificationContacts !== 'function') return [];
  const params = { active: 'true' };
  if (scope === NC_SCOPE_ATTUAZIONE) {
    params.role_type = 'attuazione';
  } else if (scope === NC_SCOPE_VERIFICA) {
    /* rubrica completa: filtro lato componente */
  }
  try {
    const res = await apiService.getNotificationContacts(params);
    return res?.data || [];
  } catch {
    return [];
  }
}

export { NC_SCOPE_ATTUAZIONE, NC_SCOPE_VERIFICA };
