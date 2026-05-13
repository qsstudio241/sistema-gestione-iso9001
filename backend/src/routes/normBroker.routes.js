/**
 * NormBroker HTTP routes (authenticated).
 * Mount in server.js, e.g.: app.use(API_BASE, normBrokerRoutes);
 */
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const logger = require('../utils/logger');
const normBroker = require('../services/normBroker.service');

function sendNormHttpError(res, err, logPrefix) {
  logger.error(`${logPrefix}`, { error: err.message, code: err.code });
  const code = err.code || 'NORM_BROKER_ERROR';
  return res.status(500).json({
    error: err.message || 'Errore durante la consultazione delle norme',
    code,
  });
}

router.get('/norms/standards', authenticate, async (req, res) => {
  try {
    const rows = await normBroker.listAvailableStandards();
    return res.json({ standards: rows });
  } catch (err) {
    return sendNormHttpError(res, err, '[normBroker.routes] GET /norms/standards');
  }
});

router.get('/norms/search', authenticate, async (req, res) => {
  try {
    const q = req.query.q;
    const standard = req.query.standard || undefined;
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({
        error: 'Parametro q obbligatorio',
        code: 'NORM_SEARCH_MISSING_QUERY',
      });
    }
    const rows = await normBroker.searchClauses(q, standard);
    return res.json({ results: rows });
  } catch (err) {
    return sendNormHttpError(res, err, '[normBroker.routes] GET /norms/search');
  }
});

router.get('/norms/:standardCode/clauses', authenticate, async (req, res) => {
  try {
    const { standardCode } = req.params;
    const rows = await normBroker.getFullNorm(standardCode);
    return res.json({ standard_code: standardCode, clauses: rows });
  } catch (err) {
    return sendNormHttpError(res, err, '[normBroker.routes] GET /norms/:standardCode/clauses');
  }
});

router.get('/norms/:standardCode/clauses/:clauseRef', authenticate, async (req, res) => {
  try {
    const { standardCode, clauseRef } = req.params;
    const row = await normBroker.getClauseText(standardCode, clauseRef);
    if (!row) {
      return res.status(404).json({
        error: 'Clausola non trovata',
        code: 'NORM_CLAUSE_NOT_FOUND',
      });
    }
    return res.json(row);
  } catch (err) {
    return sendNormHttpError(res, err, '[normBroker.routes] GET clause detail');
  }
});

module.exports = router;
