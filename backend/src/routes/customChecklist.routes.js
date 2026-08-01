/**
 * Custom Checklist Routes
 * Phase 5 - API checklist personalizzate, sezioni, voci
 */

const express = require('express');
const router = express.Router();
const customChecklistController = require('../controllers/customChecklist.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// CRUD checklist
router.get('/custom-checklists', customChecklistController.listChecklists);
router.post('/custom-checklists', authorize('admin', 'auditor'), customChecklistController.createChecklist);
router.post(
  '/custom-checklists/seed/legislativo-ambientale',
  authorize('admin', 'auditor'),
  customChecklistController.seedLegislativoAmbientale
);
router.post(
  '/custom-checklists/seed/legislativo-sicurezza',
  authorize('admin', 'auditor'),
  customChecklistController.seedLegislativoSicurezza
);
router.post(
  '/custom-checklists/seed/qtafi-vis001',
  authorize('admin', 'auditor'),
  customChecklistController.seedQtafiVis001
);
router.get('/custom-checklists/:id', customChecklistController.getChecklist);
router.put('/custom-checklists/:id', authorize('admin', 'auditor'), customChecklistController.updateChecklist);
router.delete('/custom-checklists/:id', authorize('admin', 'auditor'), customChecklistController.deleteChecklist);

// Sezioni
router.get('/custom-checklists/:id/sections', customChecklistController.listSections);
router.post('/custom-checklists/:id/sections', authorize('admin', 'auditor'), customChecklistController.createSection);
router.put('/custom-checklists/:id/sections/order', authorize('admin', 'auditor'), customChecklistController.updateSectionsOrder);
router.put('/custom-checklists/:id/sections/:sectionId', authorize('admin', 'auditor'), customChecklistController.updateSection);
router.delete('/custom-checklists/:id/sections/:sectionId', authorize('admin', 'auditor'), customChecklistController.deleteSection);

// Voci (items)
router.get('/custom-checklists/:id/items', customChecklistController.listItems);
router.post('/custom-checklists/:id/items', authorize('admin', 'auditor'), customChecklistController.createItem);
router.put('/custom-checklists/:id/items/:itemId', authorize('admin', 'auditor'), customChecklistController.updateItem);
router.delete('/custom-checklists/:id/items/:itemId', authorize('admin', 'auditor'), customChecklistController.deleteItem);

module.exports = router;
