/**
 * Document Tags & Categories Routes
 * Base path: /api/v1
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/documentTags.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');

router.use(authenticate);
router.use(requireLicensedModule('documents'));

// Tag CRUD
router.get('/document-tags', ctrl.listTags);
router.post('/document-tags', ctrl.createTag);
router.put('/document-tags/:id', ctrl.updateTag);
router.delete('/document-tags/:id', ctrl.deleteTag);

// Categorie
router.get('/tag-categories', ctrl.listCategories);
router.post('/tag-categories', ctrl.createCategory);

// Assegnazioni tag ? documento
router.post('/documents/:docId/tags', ctrl.assignTags);
router.delete('/documents/:docId/tags/:tagId', ctrl.removeTag);

// Documenti filtrati per tag
router.get('/documents/by-tag/:tagId', ctrl.getDocumentsByTag);

module.exports = router;
