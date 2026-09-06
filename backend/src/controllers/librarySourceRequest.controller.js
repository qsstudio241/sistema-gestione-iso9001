'use strict';

const logger = require('../utils/logger');
const {
  listForOrganization,
  listPlatformQueue,
  countOpenPlatformGaps,
  acknowledgePlatformRequest,
  markPlatformDigitized,
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
 * GET /library/source-requests/platform-queue
 * LG-3 — coda cross-tenant gap via piattaforma (solo superadmin).
 */
async function listPlatformQueueHandler(req, res) {
  try {
    const status = req.query.status || null;
    const rows = await listPlatformQueue({ status });
    res.json({ items: rows, count: rows.length });
  } catch (err) {
    logger.error('[LibrarySourceRequest] platform-queue failed:', err.message);
    res.status(500).json({
      error: 'Errore lettura coda gap piattaforma.',
      code: 'LSR_PLATFORM_QUEUE_ERROR',
    });
  }
}

/**
 * GET /library/source-requests/platform-gap-count
 * LUX-B — COUNT gap piattaforma open/in_progress (badge menu; solo superadmin).
 */
async function countPlatformGapsHandler(req, res) {
  try {
    const count = await countOpenPlatformGaps();
    res.json({ count });
  } catch (err) {
    logger.error('[LibrarySourceRequest] platform-gap-count failed:', err.message);
    res.status(500).json({
      error: 'Errore conteggio gap piattaforma.',
      code: 'LSR_PLATFORM_GAP_COUNT_ERROR',
    });
  }
}

/**
 * PATCH /library/source-requests/:id/acknowledge
 * LG-3 — azione leggera: open → in_progress (solo superadmin). Niente digitalizzazione.
 */
async function acknowledgeSourceRequest(req, res) {
  try {
    const result = await acknowledgePlatformRequest(req.params.id);
    if (result.error === 'invalid_id') {
      return res.status(400).json({ error: 'Id non valido.', code: 'LSR_INVALID_ID' });
    }
    if (result.error === 'not_found') {
      return res.status(404).json({ error: 'Richiesta non trovata.', code: 'LSR_NOT_FOUND' });
    }
    if (result.error === 'not_platform') {
      return res.status(400).json({
        error: 'Solo richieste via piattaforma.',
        code: 'LSR_NOT_PLATFORM',
      });
    }
    if (result.error === 'bad_status') {
      return res.status(409).json({
        error: 'Stato non ammette presa in carico (solo open).',
        code: 'LSR_BAD_STATUS',
      });
    }
    res.json({ item: result.row, changed: !!result.changed });
  } catch (err) {
    logger.error('[LibrarySourceRequest] acknowledge failed:', err.message);
    res.status(500).json({
      error: 'Errore presa in carico richiesta.',
      code: 'LSR_ACK_ERROR',
    });
  }
}

/**
 * PATCH /library/source-requests/:id/mark-digitized
 * LG-5 — segna digitalizzata piattaforma + note qualità; opz. ack tenant.
 * Niente avvio pdf-to-json.
 */
async function markDigitizedSourceRequest(req, res) {
  try {
    const body = req.body || {};
    const result = await markPlatformDigitized(req.params.id, {
      qualityNotes: body.qualityNotes || body.quality_notes || '',
      notifyTenant: !!(body.notifyTenant ?? body.notify_tenant),
    });
    if (result.error === 'invalid_id') {
      return res.status(400).json({ error: 'Id non valido.', code: 'LSR_INVALID_ID' });
    }
    if (result.error === 'not_found') {
      return res.status(404).json({ error: 'Richiesta non trovata.', code: 'LSR_NOT_FOUND' });
    }
    if (result.error === 'not_platform') {
      return res.status(400).json({
        error: 'Solo richieste via piattaforma.',
        code: 'LSR_NOT_PLATFORM',
      });
    }
    if (result.error === 'bad_status') {
      return res.status(409).json({
        error: 'Stato non ammette digitalizzazione (solo open / in_progress).',
        code: 'LSR_BAD_STATUS',
      });
    }
    res.json({
      item: result.row,
      changed: !!result.changed,
      tenantEmailed: !!result.tenantEmailed,
    });
  } catch (err) {
    logger.error('[LibrarySourceRequest] mark-digitized failed:', err.message);
    res.status(500).json({
      error: 'Errore chiusura digitalizzata piattaforma.',
      code: 'LSR_DIGITIZED_ERROR',
    });
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

module.exports = {
  listSourceRequests,
  listPlatformQueueHandler,
  countPlatformGapsHandler,
  acknowledgeSourceRequest,
  markDigitizedSourceRequest,
  createSourceRequest,
};
