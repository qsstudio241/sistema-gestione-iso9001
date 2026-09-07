'use strict';

/**
 * complianceMap.controller.js — CM-1 API indice/dettaglio + HITL stub
 */

const logger = require('../utils/logger');
const {
  listMaps,
  getMapDetail,
  createMap,
  addItem,
  updateItemHitl,
} = require('../services/complianceMap.service');
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

  return { companyId, organizationId: req.user.organization_id, userId: req.user.user_id };
}

async function listComplianceMaps(req, res) {
  try {
    const scope = await resolveCompanyAccess(req, res);
    if (!scope) return undefined;

    const data = await listMaps(scope.organizationId, scope.companyId);
    if (!data) {
      return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
    }
    return res.json({ success: true, data });
  } catch (err) {
    logger.error('[ComplianceMap] list error:', err.message);
    return res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

async function getComplianceMap(req, res) {
  try {
    const scope = await resolveCompanyAccess(req, res);
    if (!scope) return undefined;

    const data = await getMapDetail(scope.organizationId, scope.companyId, req.params.mapId);
    if (!data) {
      return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
    }
    if (data.notFound) {
      return res.status(404).json({ error: 'Mappa non trovata', code: 'NOT_FOUND' });
    }
    return res.json({ success: true, data });
  } catch (err) {
    logger.error('[ComplianceMap] get error:', err.message);
    return res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

async function createComplianceMap(req, res) {
  try {
    const scope = await resolveCompanyAccess(req, res, { write: true });
    if (!scope) return undefined;

    const result = await createMap(scope.organizationId, scope.companyId, req.body || {}, scope.userId);
    if (!result) {
      return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
    }
    if (result.validationError) {
      return res.status(400).json({ error: result.validationError, code: 'VALIDATION_ERROR' });
    }
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    logger.error('[ComplianceMap] create error:', err.message);
    return res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

async function createComplianceMapItem(req, res) {
  try {
    const scope = await resolveCompanyAccess(req, res, { write: true });
    if (!scope) return undefined;

    const result = await addItem(
      scope.organizationId,
      scope.companyId,
      req.params.mapId,
      req.body || {},
      scope.userId
    );
    if (!result) {
      return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
    }
    if (result.notFound) {
      return res.status(404).json({ error: 'Mappa non trovata', code: 'NOT_FOUND' });
    }
    if (result.conflict) {
      return res.status(409).json({ error: result.conflict, code: 'CONFLICT' });
    }
    if (result.validationError) {
      return res.status(400).json({ error: result.validationError, code: 'VALIDATION_ERROR' });
    }
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    logger.error('[ComplianceMap] addItem error:', err.message);
    return res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

async function patchComplianceMapItemHitl(req, res) {
  try {
    const scope = await resolveCompanyAccess(req, res, { write: true });
    if (!scope) return undefined;

    const result = await updateItemHitl(
      scope.organizationId,
      scope.companyId,
      req.params.mapId,
      req.params.itemId,
      req.body || {},
      scope.userId
    );
    if (!result) {
      return res.status(404).json({ error: 'Azienda non trovata', code: 'NOT_FOUND' });
    }
    if (result.notFound) {
      return res.status(404).json({ error: 'Item o mappa non trovati', code: 'NOT_FOUND' });
    }
    if (result.conflict) {
      return res.status(409).json({ error: result.conflict, code: 'CONFLICT' });
    }
    if (result.validationError) {
      return res.status(400).json({ error: result.validationError, code: 'VALIDATION_ERROR' });
    }
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[ComplianceMap] hitl error:', err.message);
    return res.status(500).json({ error: err.message, code: 'SERVER_ERROR' });
  }
}

module.exports = {
  listComplianceMaps,
  getComplianceMap,
  createComplianceMap,
  createComplianceMapItem,
  patchComplianceMapItemHitl,
};
