'use strict';

const logger = require('../utils/logger');
const {
  listForOrganization,
  upsertGapRequest,
} = require('../services/librarySourceRequest.service');

/**
 * GET /library/source-requests
 * Elenco richieste gap per l'organizzazione del chiamante (studio admin).
 */
async function listSourceRequests(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const status = req.query.status || null;
    const rows = await listForOrganization(organizationId, { status });
    res.json({ items: rows, count: rows.length });
  } catch (err) {
    logger.error('[LibrarySourceRequest] list failed:', err.message);
    res.status(500).json({ error: 'Errore lettura richieste Libreria.', code: 'LSR_LIST_ERROR' });
  }
}

/**
 * POST /library/source-requests
 * Creazione manuale da Libreria (stesso modello delle gap AI).
 */
async function createSourceRequest(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.user_id;
    const body = req.body || {};
    const result = await upsertGapRequest(
      {
        code: body.code || body.source_code,
        title: body.title || body.source_title,
        reason: body.reason || body.notes,
        qualityNotes: body.qualityNotes || body.quality_notes,
        closurePath: body.closurePath || body.closure_path || 'platform',
      },
      {
        organizationId,
        userId,
        companyId: body.companyId || body.company_id || null,
        messagePreview: body.messagePreview || null,
      }
    );
    if (!result.row) {
      return res.status(400).json({ error: 'Codice fonte obbligatorio.', code: 'LSR_INVALID' });
    }
    res.status(result.created ? 201 : 200).json({
      item: result.row,
      created: result.created,
      emailed: result.emailed,
    });
  } catch (err) {
    logger.error('[LibrarySourceRequest] create failed:', err.message);
    res.status(500).json({ error: 'Errore creazione richiesta.', code: 'LSR_CREATE_ERROR' });
  }
}

module.exports = { listSourceRequests, createSourceRequest };
