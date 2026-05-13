/**
 * Document Relations Routes
 * Base path: /api/v1
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/documentRelations.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');

router.use(authenticate);
router.use(requireLicensedModule('documents'));

// Relazioni per documento (create + list)
router.post('/documents/:docId/relations', ctrl.createRelation);
router.get('/documents/:docId/relations', ctrl.getRelations);

// Elimina relazione per id
router.delete('/document-relations/:id', ctrl.deleteRelation);

module.exports = router;
