/**
 * Ambito azienda per assistente AI (allineato a RBAC Fase 4).
 *
 * REGOLA DI PRODOTTO (committente, PR #91):
 * - Cliente azienda (user_company_access): ambito SEMPRE forzato sulla propria
 *   anagrafica primaria (azienda di appartenenza). Non puo' scegliere altre aziende
 *   e non riceve mai 403 "scegli azienda". Qualsiasi companyId passato dal client
 *   viene ignorato: vale solo la sua azienda primaria.
 *   - Anagrafica primaria = primo record di user_company_access ordinato per
 *     company_id (company_id piu' basso). Scelta deterministica e documentata:
 *     se il cliente ha accesso a piu' aziende via RBAC, l'AI resta bloccata sulla
 *     primaria.
 * - Studio (auditor_org / superadmin studio): companyId opzionale; se presente
 *   deve appartenere a auditor_org_id (puo' selezionare tra le SOLE aziende clienti).
 */

const { query } = require('../config/database');
const {
  ensureCompanyAccessLoaded,
  hasCompanyAccessRows,
  getAllowedCompanyIds,
  assertCompanyRead,
} = require('./companyAccess.service');

/**
 * @param {object} user - req.user
 * @param {number|string|null|undefined} requestedCompanyId - dal body client
 * @returns {Promise<{ companyId: number|null, denied: null|{ status: number, body: object } }>}
 */
async function resolveAiCompanyScope(user, requestedCompanyId) {
  await ensureCompanyAccessLoaded(user);
  const accessList = user?.company_access || [];

  if (hasCompanyAccessRows(accessList)) {
    // Utente azienda cliente: ambito SEMPRE forzato sulla propria anagrafica
    // primaria. Ignoriamo qualsiasi companyId passato dal client e non emettiamo
    // mai 403: il cliente vede solo i propri contenuti, niente "scegli azienda".
    const allowedIds = getAllowedCompanyIds(accessList);
    const primaryCompanyId = allowedIds[0];
    return { companyId: primaryCompanyId, denied: null };
  }

  if (requestedCompanyId == null || requestedCompanyId === '') {
    return { companyId: null, denied: null };
  }

  const cid = parseInt(requestedCompanyId, 10);
  if (!Number.isFinite(cid)) {
    return {
      companyId: null,
      denied: {
        status: 400,
        body: { error: 'companyId non valido', code: 'INVALID_COMPANY_ID' },
      },
    };
  }

  const readDenied = await assertCompanyRead(user, cid);
  if (readDenied) {
    return { companyId: null, denied: readDenied };
  }

  const auditorOrgId = user?.auditor_org_id;
  if (auditorOrgId) {
    try {
      const r = await query(
        `SELECT id FROM companies WHERE id = @id AND auditor_org_id = @auditorOrgId`,
        { id: cid, auditorOrgId }
      );
      if (!(r.recordset || []).length) {
        return {
          companyId: null,
          denied: {
            status: 403,
            body: { error: 'Azienda non nel tuo ambito studio', code: 'FORBIDDEN' },
          },
        };
      }
    } catch (_) {
      return {
        companyId: null,
        denied: {
          status: 500,
          body: { error: 'Verifica ambito azienda non riuscita', code: 'SCOPE_CHECK_ERROR' },
        },
      };
    }
  }

  return { companyId: cid, denied: null };
}

module.exports = {
  resolveAiCompanyScope,
};
