/**
 * Audit Routes
 */

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const customChecklistController = require('../controllers/customChecklist.controller');
const { authenticate } = require('../middleware/auth.middleware');

// Tutti gli endpoint richiedono autenticazione
router.use(authenticate);

// GET /api/v1/audits - Lista audit con filtri e paginazione
router.get('/audits', auditController.listAudits);

// GET /api/v1/audits/next-number - prossimo numero audit disponibile
// DEVE STARE PRIMA DI /audits/:id
router.get('/audits/next-number', auditController.getNextAuditNumber);

// GET /api/v1/audits/:id - Dettagli audit singolo
router.get('/audits/:id', auditController.getAuditById);

// Custom checklist responses (Phase 5) - prima di altre route con :id
router.get('/audits/:auditId/custom-checklist-responses', customChecklistController.getCustomChecklistResponses);
router.put('/audits/:auditId/custom-checklist-responses', customChecklistController.saveCustomChecklistResponses);

// GET /api/v1/audits/:id/statistics - Statistiche audit (conformità per sezione)
router.get('/audits/:id/statistics', auditController.getAuditStatistics);

// GET /api/v1/audits/:id/pending-issues - Pending issues dall'ultimo audit completato stesso cliente
router.get('/audits/:id/pending-issues', auditController.getPendingIssues);

// POST /api/v1/audits/check-reaudit - Verifica rilievi pendenti da audit precedente stesso cliente
// DEVE STARE PRIMA DI /audits/:id
router.post('/audits/check-reaudit', auditController.checkReaudit);

// POST /api/v1/audits/sync - Upsert audit (INSERT or UPDATE)
// Usato da sync service offline-first (DEVE STARE PRIMA DI /audits/:id)
router.post('/audits/sync', auditController.upsertAudit);

// POST /api/v1/audits - Crea nuovo audit
router.post('/audits', auditController.createAudit);

// PUT /api/v1/audits/:id - Aggiorna audit esistente
router.put('/audits/:id', auditController.updateAudit);

// DELETE /api/v1/audits/:id - Elimina audit (soft delete)
router.delete('/audits/:id', auditController.deleteAudit);


// GET /api/v1/audits/:id/nc-responses - NC/OSS/OM risposte per re-audit preview
router.get('/audits/:id/nc-responses', auditController.getNcResponses);

// NOTA: POST /audits/:id/responses/bulk è gestito da response.routes.js
// (implementazione più completa: UUID/ID, conflict detection, validazione status)

module.exports = router;
