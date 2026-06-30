/**
 * gapAnalysis.controller.js — GET /gap-analysis
 * Requires: ai_norms license (guard in route)
 */

const logger = require('../utils/logger');
const { runGapAnalysis } = require('../services/gapAnalysis.service');

async function getGapAnalysis(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const companyId = parseInt(req.query.companyId, 10);
    const standardCode = req.query.standardCode || 'ISO_9001_2015';

    if (!companyId || !Number.isFinite(companyId) || companyId <= 0) {
      return res.status(400).json({ error: 'companyId obbligatorio (intero > 0)', code: 'VALIDATION_ERROR' });
    }

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

module.exports = { getGapAnalysis };
