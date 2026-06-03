/**
 * Ambito azienda per assistente AI (allineato a RBAC Fase 4).
 * - Cliente azienda (user_company_access): solo aziende consentite, mai vista studio.
 * - Studio: companyId opzionale; se presente deve appartenere a auditor_org_id.
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
    const allowedIds = getAllowedCompanyIds(accessList);
    const parsed =
      requestedCompanyId != null && requestedCompanyId !== ''
        ? parseInt(requestedCompanyId, 10)
        : null;

    if (parsed != null && Number.isFinite(parsed) && !allowedIds.includes(parsed)) {
      return {
        companyId: null,
        denied: {
          status: 403,
          body: { error: 'Azienda non accessibile', code: 'FORBIDDEN' },
        },
      };
    }

    if (parsed != null && Number.isFinite(parsed)) {
      return { companyId: parsed, denied: null };
    }

    if (allowedIds.length === 1) {
      return { companyId: allowedIds[0], denied: null };
    }

    return {
      companyId: null,
      denied: {
        status: 403,
        body: {
          error: 'Ambito azienda obbligatorio per il tuo profilo',
          code: 'COMPANY_SCOPE_REQUIRED',
        },
      },
    };
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
