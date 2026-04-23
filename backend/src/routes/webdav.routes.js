/**
 * webdav.routes.js — Sprint 12-A: rotte WebDAV per Office Round-trip
 *
 * Due gruppi di rotte:
 *   1. /api/v1/documents/:docId/webdav-link  (REST autenticato JWT)
 *      → genera token e restituisce URL WebDAV + Office URI Scheme
 *
 *   2. /webdav/:orgId/:docId/:filename  (WebDAV — autenticato via token ?dt=)
 *      → GET, PUT, PROPFIND, LOCK, UNLOCK, OPTIONS
 *      → NON usa Bearer JWT: Office non lo gestisce; usa il token ?dt= generato al punto 1
 *
 * NOTA: i metodi WebDAV non standard (PROPFIND, LOCK, UNLOCK) vengono
 * gestiti con router.use() + switch su req.method.
 */

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireLicensedModule } = require('../middleware/moduleLicense.middleware');
const ctrl = require('../controllers/webdav.controller');

// ─── 1. Endpoint REST: genera link WebDAV (richiede JWT) ─────────────────────

router.post(
    '/documents/:docId/webdav-link',
    authenticate,
    requireLicensedModule('documents'),
    ctrl.generateWebdavLink,
);

// ─── 2. Endpoint WebDAV: serve file a Office (autenticato via ?dt=token) ─────
// Prefisso /webdav/ — registrato in server.js FUORI da /api/v1/

const webdavRouter = express.Router();

// Tutti i metodi WebDAV su /:orgId/:docId/:filename
webdavRouter.all('/:orgId/:docId/:filename', (req, res) => {
    switch (req.method.toUpperCase()) {
        case 'GET':      return ctrl.handleWebdavGet(req, res);
        case 'PUT':      return ctrl.handleWebdavPut(req, res);
        case 'PROPFIND': return ctrl.handleWebdavPropfind(req, res);
        case 'LOCK':     return ctrl.handleWebdavLock(req, res);
        case 'UNLOCK':   return ctrl.handleWebdavUnlock(req, res);
        case 'OPTIONS':  return ctrl.handleWebdavOptions(req, res);
        default:
            res.setHeader('Allow', 'GET, PUT, PROPFIND, LOCK, UNLOCK, OPTIONS');
            res.status(405).end('Method Not Allowed');
    }
});

module.exports = { apiRouter: router, webdavRouter };
