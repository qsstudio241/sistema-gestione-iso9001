/**
 * gapAnalysis.controller.js
 * - GET /gap-analysis — euristica documenti (licenza ai_norms)
 * - /companies/:companyId/gap-* — motore SAL Fase 0 (licenza sal)
 */

const logger = require('../utils/logger');
const {
  runGapAnalysis,
  getGapMatrix,
  listStatuses,
  upsertStatus,
  seedForCompany,
  SAL_DEFAULT_STANDARD_CODES,
} = require('../services/gapAnalysis.service');
const {
  assertCompanyRead,
  assertMutatingAllowed,
  sendAccessDenied,
} = require('../services/companyAccess.service');

async function resolveCompanyAccess(req, res, { write = false } = {}) {
  const companyId = parseInt(req.params.companyId, 10);
  if (!Number.isFinite(companyId) || companyId <= 0) {
    res.status(400).json({ error: 'companyId non valido', code: 'INVALID_COMPANY_ID' });
    return null;
  }

  if (write) {
    const writeDenied = await assertMutatingAllowed(req.user, { companyId });
    if (writeDenied) {
      sendAccessDenied(res, writeDenied);
      return null;
    }
  } else {
    const readDenied = await assertCompanyRead(req.user, companyId);
    if (readDenied) {
      sendAccessDenied(res, readDenied);
      return null;
    }
  }

  return { companyId, organizationId: req.user.organization_id };
}

// ─── AI Norm heuristic (HK-8) ────────────────────────────────────────────────

async function getGapAnalysis(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const companyId = parseInt(req.query.companyId, 10);
    const standardCode = req.query.standardCode || 'ISO_9001_2015';

    if (!companyId || !Number.isFinite(companyId) || companyId <= 0) {
      return res.status(400).json({ error: 'companyId obbligatorio (intero > 0)', code: 'VALIDATION_ERROR' });
    }

    const readDenied = await assertCompanyRead(req.user, companyId);
    if (readDenied) return sendAccessDenied(res, readDenied);

    const matrix = await runGapAnalysis({ organizationId, companyId, standardCode });

    const summary = {
      covered: matrix.filter((r) => r.coverage === 'covered').length,
      partial: matrix.filter((r) => r.coverage === 'partial').length,
      missing: matrix.filter((r) => r.coverage === 'missing').length,
      total: matrix.length,
    };

    return res.json({ standardCode, companyId, summary, matrix });
  } catch (err) {
    logger.error('[GapAnalysis] Error:', err.message);
    return res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

// ─── SAL Fase 0 — motore dati operativo ──────────────────────────────────────

async function getSalGapMatrix(req, res) {
  try {
    const scope = await resolveCompanyAccess(req, res);
    if (!scope) return undefined;

    const { standardCode, dateFrom } = req.query;
    const data = await getGapMatrix(scope.organizationId, scope.companyId, { standardCode, dateFrom });

    if (!data) {
      return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
    }

    return res.json({ success: true, data });
  } catch (err) {
    logger.error('[SalGapMatrix] Error:', err.message);
    return res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

async function listSalGapStatuses(req, res) {
  try {
    const scope = await resolveCompanyAccess(req, res);
    if (!scope) return undefined;

    const { standardCode } = req.query;
    const data = await listStatuses(scope.organizationId, scope.companyId, { standardCode });

    if (!data) {
      return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
    }

    return res.json({ success: true, data });
  } catch (err) {
    logger.error('[SalGapStatuses] Error:', err.message);
    return res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

async function upsertSalGapStatus(req, res) {
  try {
    const scope = await resolveCompanyAccess(req, res, { write: true });
    if (!scope) return undefined;

    const normRequirementId = parseInt(
      req.params.normRequirementId || req.body.normRequirementId || req.body.norm_requirement_id,
      10,
    );

    const result = await upsertStatus(
      scope.organizationId,
      scope.companyId,
      req.user.user_id,
      { ...req.body, normRequirementId },
    );

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
    }
    if (result.error === 'VALIDATION') {
      return res.status(400).json({ error: result.message, code: 'VALIDATION_ERROR' });
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[SalGapUpsert] Error:', err.message);
    return res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

async function seedSalGapMatrix(req, res) {
  try {
    const scope = await resolveCompanyAccess(req, res, { write: true });
    if (!scope) return undefined;

    const standardCodes = Array.isArray(req.body?.standardCodes) && req.body.standardCodes.length
      ? req.body.standardCodes
      : SAL_DEFAULT_STANDARD_CODES;

    const data = await seedForCompany(scope.organizationId, scope.companyId, standardCodes);

    if (!data) {
      return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
    }

    return res.json({ success: true, data });
  } catch (err) {
    logger.error('[SalGapSeed] Error:', err.message);
    return res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

module.exports = {
  getGapAnalysis,
  getSalGapMatrix,
  listSalGapStatuses,
  upsertSalGapStatus,
  seedSalGapMatrix,
};
