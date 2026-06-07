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

// Documenti orfani (inbox) — prima di :id per evitare conflitti
router.get('/documents/orphans', docCtrl.listOrphanDocuments);

// Pre-estrazione metadati AI da PDF (nessun record DB — solo analisi temporanea)
router.post('/documents/pre-extract', docCtrl.preExtractMetadata);

// Lookup stato norma su catalogo pubblico ente (BSI / ISO / UNI)
router.post('/documents/norm-lookup', docCtrl.lookupNormStatus);

// Import batch da lista codici (senza PDF obbligatorio)
router.post('/documents/norm-import-codes', docCtrl.importNormCodes);

// CRUD
router.get   ('/documents',                      docCtrl.listDocuments);
router.get   ('/documents/:id',                  docCtrl.getDocumentById);
router.post  ('/documents',                      docCtrl.createDocument);
router.put   ('/documents/:id',                  docCtrl.updateDocument);
router.delete('/documents/:id',                  docCtrl.deleteDocument);
// Lifecycle: bozza → rilasciato con incremento revision_number
router.post  ('/documents/:id/release-revision', docCtrl.releaseRevision);

module.exports = router;
