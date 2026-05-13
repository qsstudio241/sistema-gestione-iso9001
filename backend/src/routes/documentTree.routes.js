/**
 * Document Tree & History Routes
 * Base path: /api/v1
 */

const express     = require('express');
const router      = express.Router();
const treeCtrl    = require('../controllers/documentTree.controller');
const historyCtrl = require('../controllers/documentHistory.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');

router.use(authenticate);
router.use(requireLicensedModule('documents'));

// Albero documentale
router.get ('/documents/tree',                       treeCtrl.getTree);
router.get ('/documents/tree/:parentId/children',    treeCtrl.getChildren);
router.put ('/documents/:docId/move',                treeCtrl.moveDocument);
router.post('/documents/folder',                     treeCtrl.createFolder);
router.get ('/documents/:docId/breadcrumb',          treeCtrl.getBreadcrumb);

// Provisioning
router.post('/documents/provision-tree',             treeCtrl.provisionTree);

// Template
router.get ('/document-tree-templates',              treeCtrl.listTemplates);

// History
router.get ('/documents/:docId/history',             historyCtrl.getHistory);

module.exports = router;
