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

// Microsoft-WebDAV-MiniRedir (Windows) sonda /webdav/:orgId e /webdav/:orgId/:docId
// senza filename. Devono rispondere positivamente per non interrompere la
// sequenza WebDAV di Office (altrimenti Word apre in sola lettura).
function handleCollectionRequest(req, res) {
    const method = req.method.toUpperCase();
    if (method === 'OPTIONS') return ctrl.handleWebdavOptions(req, res);
    if (method === 'HEAD' || method === 'GET') {
        // Le directory esistono ma non si scaricano: rispondi 200 vuoto.
        res.setHeader('DAV', '1, 2');
        res.setHeader('MS-Author-Via', 'DAV');
        res.setHeader('Content-Type', 'httpd/unix-directory');
        return res.status(200).end();
    }
    if (method === 'PROPFIND') {
        // PROPFIND su collection: rispondi un multistatus minimal "è una directory".
        res.setHeader('DAV', '1, 2');
        res.setHeader('MS-Author-Via', 'DAV');
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        const href = req.path.endsWith('/') ? req.path : req.path + '/';
        const xml = `<?xml version="1.0" encoding="utf-8"?>\n` +
`<D:multistatus xmlns:D="DAV:">\n` +
`  <D:response>\n` +
`    <D:href>${href}</D:href>\n` +
`    <D:propstat>\n` +
`      <D:prop>\n` +
`        <D:resourcetype><D:collection/></D:resourcetype>\n` +
`        <D:supportedlock>\n` +
`          <D:lockentry>\n` +
`            <D:lockscope><D:exclusive/></D:lockscope>\n` +
`            <D:locktype><D:write/></D:locktype>\n` +
`          </D:lockentry>\n` +
`        </D:supportedlock>\n` +
`      </D:prop>\n` +
`      <D:status>HTTP/1.1 200 OK</D:status>\n` +
`    </D:propstat>\n` +
`  </D:response>\n` +
`</D:multistatus>`;
        return res.status(207).send(xml);
    }
    res.setHeader('Allow', 'OPTIONS, GET, HEAD, PROPFIND');
    res.status(405).end('Method Not Allowed');
}

// Dispatch standard per richieste su un file (con o senza prefisso /dt/:dt/)
function handleFileRequest(req, res) {
    switch (req.method.toUpperCase()) {
        case 'GET':      return ctrl.handleWebdavGet(req, res);
        case 'HEAD':     return ctrl.handleWebdavHead(req, res);
        case 'PUT':      return ctrl.handleWebdavPut(req, res);
        case 'PROPFIND': return ctrl.handleWebdavPropfind(req, res);
        case 'LOCK':     return ctrl.handleWebdavLock(req, res);
        case 'UNLOCK':   return ctrl.handleWebdavUnlock(req, res);
        case 'OPTIONS':  return ctrl.handleWebdavOptions(req, res);
        default:
            res.setHeader('Allow', 'GET, HEAD, PUT, PROPFIND, LOCK, UNLOCK, OPTIONS');
            res.status(405).end('Method Not Allowed');
    }
}

// Variante con token nel path: /webdav/dt/:dt/:orgId/:docId/:filename
// Microsoft-WebDAV-MiniRedir preserva il path nelle richieste, così tutte
// le operazioni (GET, LOCK, PUT, ...) restano autenticate senza prompt.
webdavRouter.all('/dt/:dt/:orgId',                            handleCollectionRequest);
webdavRouter.all('/dt/:dt/:orgId/',                           handleCollectionRequest);
webdavRouter.all('/dt/:dt/:orgId/:docId',                     handleCollectionRequest);
webdavRouter.all('/dt/:dt/:orgId/:docId/',                    handleCollectionRequest);
webdavRouter.all('/dt/:dt/:orgId/:docId/:filename',           handleFileRequest);

// Variante legacy con token in query string (mantenuta per compat)
webdavRouter.all('/:orgId',                                    handleCollectionRequest);
webdavRouter.all('/:orgId/',                                   handleCollectionRequest);
webdavRouter.all('/:orgId/:docId',                             handleCollectionRequest);
webdavRouter.all('/:orgId/:docId/',                            handleCollectionRequest);
webdavRouter.all('/:orgId/:docId/:filename',                   handleFileRequest);

module.exports = { apiRouter: router, webdavRouter };
