/**
 * Non-Conformities Routes
 */

const express = require('express');
const router = express.Router();
const ncController = require('../controllers/nc.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');

// Tutti gli endpoint richiedono autenticazione
router.use(authenticate);
router.use(requireLicensedModule('nc'));

// GET /api/v1/non-conformities - Lista NC con filtri
router.get('/non-conformities', ncController.listNonConformities);

// GET /api/v1/non-conformities/statistics/overview - Statistiche generali NC
router.get('/non-conformities/statistics/overview', ncController.getNonConformitiesStatistics);

// GET /api/v1/non-conformities/:id - Dettagli singola NC
router.get('/non-conformities/:id', ncController.getNonConformityById);

// POST /api/v1/non-conformities - Crea nuova NC
router.post('/non-conformities', ncController.createNonConformity);

// PUT /api/v1/non-conformities/:id - Aggiorna NC (workflow)
router.put('/non-conformities/:id', ncController.updateNonConformity);

// DELETE /api/v1/non-conformities/:id - Elimina NC
router.delete('/non-conformities/:id', ncController.deleteNonConformity);

// ─── NC ACTIONS ───────────────────────────────────────────────────────────────

// GET /api/v1/non-conformities/:id/actions - Lista azioni correttive
router.get('/non-conformities/:id/actions', ncController.listNcActions);

// POST /api/v1/non-conformities/:id/actions - Crea azione correttiva
router.post('/non-conformities/:id/actions', ncController.createNcAction);

// PUT /api/v1/non-conformities/:id/actions/:actionId - Aggiorna azione
router.put('/non-conformities/:id/actions/:actionId', ncController.updateNcAction);

// DELETE /api/v1/non-conformities/:id/actions/:actionId - Elimina azione
router.delete('/non-conformities/:id/actions/:actionId', ncController.deleteNcAction);

// ─── BULK PUSH AUDIT → REGISTRO NC ───────────────────────────────────────────
// Trasferisce tutte le NC/OSS rilevate nella checklist di un audit nel registro
// organizzativo non_conformities. Idempotente (skip se gia presenti).
// Richiede licenza modulo 'nc' (gia applicata da router.use sopra).

// POST /api/v1/audits/:auditRef/push-to-nc-register
router.post('/audits/:auditRef/push-to-nc-register', ncController.pushAuditToNcRegister);

// DELETE /api/v1/audits/:auditRef/push-to-nc-register - Undo (entro 10s, solo NC open)
router.delete('/audits/:auditRef/push-to-nc-register', ncController.undoPushAuditToNcRegister);

module.exports = router;
