/**
 * Document Registry Routes
 * Base path: /api/v1
 */

const express    = require('express');
const router     = express.Router();
const docCtrl    = require('../controllers/document.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');

router.use(authenticate);
router.use(requireLicensedModule('documents'));

// Statistiche (prima del :id per evitare conflitti di routing)
router.get('/documents/stats', docCtrl.getDocumentStats);

// Suggerimento cartella per tipo documento (prima di :id)
router.get('/documents/folder-suggestion', docCtrl.getFolderSuggestion);

// CRUD
router.get   ('/documents',                      docCtrl.listDocuments);
router.get   ('/documents/:id',                  docCtrl.getDocumentById);
router.post  ('/documents',                      docCtrl.createDocument);
router.put   ('/documents/:id',                  docCtrl.updateDocument);
router.delete('/documents/:id',                  docCtrl.deleteDocument);
// Lifecycle: bozza → rilasciato con incremento revision_number
router.post  ('/documents/:id/release-revision', docCtrl.releaseRevision);

module.exports = router;
