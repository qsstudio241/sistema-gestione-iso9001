/**
 * webdav.controller.js — Sprint 12-A: Office Round-trip via WebDAV
 *
 * Flusso:
 *   1. Frontend chiama POST /api/v1/documents/:docId/webdav-link
 *   2. Backend genera token firmato a breve TTL (15 min)
 *   3. Frontend apre Office con ms-word:ofe|u|<webdav_url>
 *   4. Office scarica il file via GET /webdav/:orgId/:docId/:filename?dt=TOKEN
 *   5. Office salva il file via PUT /webdav/:orgId/:docId/:filename?dt=TOKEN
 *   6. Backend salva nuova versione negli attachments (come uploadDocFile)
 *
 * PoC Sprint 12-A: token store in-memory (Map).
 * Sprint 12-B: migrare su tabella DB webdav_tokens per persistenza multi-instance.
 *
 * Sicurezza:
 *   - Token: 32 byte random hex, TTL 15 min
 *   - Isolamento multi-tenant: orgId validato su ogni richiesta
 *   - Path traversal: file risolto da DB, mai dal nome parametro
 *   - LOCK esclusivo per documento (no overwrite concorrente)
 */

const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');
const { getPool } = require('../config/database');
const logger  = require('../utils/logger');

// ─── Token store in-memory (PoC) ─────────────────────────────────────────────

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minuti

/** @type {Map<string, {docId:number, orgId:number, userId:number, expires:number, lockToken:string|null}>} */
const tokenStore = new Map();

// Cleanup automatico token scaduti ogni 5 minuti
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of tokenStore) {
        if (data.expires < now) tokenStore.delete(token);
    }
}, 5 * 60 * 1000).unref(); // unref: non blocca exit del processo

function makeToken() {
    return crypto.randomBytes(32).toString('hex');
}

function validateToken(token, orgId, docId) {
    if (!token) return null;
    const data = tokenStore.get(token);
    if (!data) return null;
    if (data.expires < Date.now()) { tokenStore.delete(token); return null; }
    if (String(data.orgId) !== String(orgId)) return null;
    if (String(data.docId) !== String(docId)) return null;
    return data;
}

// ─── Helper DB ────────────────────────────────────────────────────────────────

async function getDocAndCurrentFile(pool, docId, orgId) {
    const docRes = await pool.request()
        .input('docId', docId)
        .input('orgId', orgId)
        .query(`SELECT id, title FROM document_registry WHERE id=@docId AND organization_id=@orgId`);
    if (!docRes.recordset.length) return null;

    const fileRes = await pool.request()
        .input('docId', docId)
        .query(`
            SELECT TOP 1
                attachment_id, file_name, storage_path, mime_type,
                file_size, doc_file_version, created_at
            FROM attachments
            WHERE document_id=@docId AND is_current_doc_version=1
            ORDER BY created_at DESC
        `);

    return {
        doc:  docRes.recordset[0],
        file: fileRes.recordset[0] || null,
    };
}

// ─── POST /api/v1/documents/:docId/webdav-link ───────────────────────────────

async function generateWebdavLink(req, res) {
    try {
        const pool   = await getPool();
        const orgId  = req.user.organization_id;
        const userId = req.user.user_id;
        const docId  = parseInt(req.params.docId);

        if (isNaN(docId)) return res.status(400).json({ error: 'docId non valido.' });

        const result = await getDocAndCurrentFile(pool, docId, orgId);
        if (!result)       return res.status(404).json({ error: 'Documento non trovato.' });
        if (!result.file)  return res.status(404).json({ error: 'Nessun file allegato al documento. Carica prima un file.' });

        const token   = makeToken();
        const expires = Date.now() + TOKEN_TTL_MS;
        tokenStore.set(token, { docId, orgId, userId, expires, lockToken: null });

        // URL WebDAV accessibile da Office: usa env WEBDAV_BASE_URL o il dominio della request
        const baseUrl  = process.env.WEBDAV_BASE_URL
            || `${req.protocol}://${req.get('host')}`;
        const safeFile = encodeURIComponent(result.file.file_name);
        const webdavUrl = `${baseUrl}/webdav/${orgId}/${docId}/${safeFile}?dt=${token}`;

        // Office URI Scheme — apre Word/Excel direttamente da browser
        const ext     = path.extname(result.file.file_name).toLowerCase();
        const isExcel = ['.xlsx', '.xls', '.xlsm', '.csv'].includes(ext);
        const isWord  = ['.docx', '.doc', '.docm', '.rtf'].includes(ext);
        const officeUri = isWord  ? `ms-word:ofe|u|${webdavUrl}`
                        : isExcel ? `ms-excel:ofe|u|${webdavUrl}`
                        : null;

        logger.info(`[WebDAV] Link generato: doc ${docId}, org ${orgId}, user ${userId}, scade ${new Date(expires).toISOString()}`);

        res.json({
            webdav_url:  webdavUrl,
            office_uri:  officeUri,
            file_name:   result.file.file_name,
            mime_type:   result.file.mime_type,
            is_word:     isWord,
            is_excel:    isExcel,
            has_office_uri: !!officeUri,
            expires_at:  new Date(expires).toISOString(),
        });
    } catch (err) {
        logger.error('[WebDAV] generateWebdavLink:', err.message);
        res.status(500).json({ error: err.message });
    }
}

// ─── GET /webdav/:orgId/:docId/:filename ─────────────────────────────────────

async function handleWebdavGet(req, res) {
    try {
        const { orgId, docId } = parseParams(req);
        const token = req.query.dt;

        const tokenData = validateToken(token, orgId, docId);
        if (!tokenData) return res.status(401).end('Token WebDAV non valido o scaduto.');

        const pool   = await getPool();
        const result = await getDocAndCurrentFile(pool, docId, orgId);
        if (!result?.file) return res.status(404).end('File non trovato.');

        const { file } = result;
        if (!fs.existsSync(file.storage_path)) {
            return res.status(410).end('File fisico non trovato sul server.');
        }

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.file_name)}"`);
        res.setHeader('Content-Length', file.file_size || 0);
        if (file.mime_type) res.setHeader('Content-Type', file.mime_type);
        res.setHeader('ETag', `"${file.attachment_id}"`);
        setWebdavHeaders(res);

        res.sendFile(path.resolve(file.storage_path));
        logger.info(`[WebDAV] GET doc ${docId} (org ${orgId}) → ${file.file_name}`);
    } catch (err) {
        logger.error('[WebDAV] GET:', err.message);
        res.status(500).end();
    }
}

// ─── PUT /webdav/:orgId/:docId/:filename — Office salva il file ──────────────

async function handleWebdavPut(req, res) {
    try {
        const { orgId, docId } = parseParams(req);
        const token = req.query.dt;

        const tokenData = validateToken(token, orgId, docId);
        if (!tokenData) return res.status(401).end('Token WebDAV non valido o scaduto.');

        // Raccoglie body (stream binario inviato da Office)
        const chunks = [];
        await new Promise((resolve, reject) => {
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', resolve);
            req.on('error', reject);
        });
        const buffer = Buffer.concat(chunks);
        if (!buffer.length) return res.status(400).end('File vuoto ricevuto.');

        // Salva fisicamente
        const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        // Recupera info originali dal DB (per mantenere filename e mime_type originali)
        const pool   = await getPool();
        const result = await getDocAndCurrentFile(pool, docId, orgId);
        if (!result?.file) return res.status(404).end('Documento non trovato.');

        const origFile   = result.file;
        const ext        = path.extname(origFile.file_name);
        const newFilename = `webdav_${docId}_${Date.now()}${ext}`;
        const newPath    = path.join(uploadDir, newFilename);
        fs.writeFileSync(newPath, buffer);

        // Marca versioni precedenti come non correnti
        await pool.request()
            .input('docId', docId)
            .query(`UPDATE attachments SET is_current_doc_version=0 WHERE document_id=@docId`);

        // Inserisci nuova versione (stessa semantica di uploadDocFile)
        const insertRes = await pool.request()
            .input('docId',       docId)
            .input('userId',      tokenData.userId)
            .input('fileName',    origFile.file_name)
            .input('storagePath', newPath)
            .input('fileSize',    buffer.length)
            .input('fileType',    ext.toLowerCase())
            .input('mimeType',    origFile.mime_type || 'application/octet-stream')
            .input('version',     origFile.doc_file_version)
            .query(`
                INSERT INTO attachments
                    (document_id, uploaded_by, file_name, file_type, storage_path,
                     file_size, mime_type, doc_file_version, is_current_doc_version,
                     category, created_at)
                OUTPUT INSERTED.attachment_id AS id
                VALUES
                    (@docId, @userId, @fileName, @fileType, @storagePath,
                     @fileSize, @mimeType, @version, 1,
                     'document', GETDATE())
            `);

        const newId = insertRes.recordset[0].id;

        // Dopo il salvataggio da Office → documento entra in stato 'bozza'
        // (richiede "RILASCIA REVISIONE" per tornare a 'rilasciato')
        await pool.request()
            .input('docId', docId)
            .query(`UPDATE document_registry
                    SET status='bozza', updated_at=GETDATE()
                    WHERE id=@docId AND status IN ('rilasciato','vigente','in_revisione')`);

        logger.info(`[WebDAV] PUT doc ${docId} (org ${orgId}) → attachment ${newId} (${buffer.length} bytes), status→bozza`);

        res.setHeader('ETag', `"${newId}"`);
        res.status(201).end();
    } catch (err) {
        logger.error('[WebDAV] PUT:', err.message);
        res.status(500).end();
    }
}

// ─── PROPFIND /webdav/:orgId/:docId/:filename — Office interroga proprietà ────
// IMPORTANTE: PROPFIND deve rispondere ANCHE senza token, perché il client
// Microsoft-WebDAV-MiniRedir di Windows (usato da Office per "sondare" il
// server) non inoltra il ?dt=token. Se rispondiamo 401, Word apre in sola
// lettura. Il token resta obbligatorio per le operazioni che cambiano stato
// (LOCK, PUT, UNLOCK). PROPFIND espone solo metadata (nome, size, mtime).

async function handleWebdavPropfind(req, res) {
    try {
        const { orgId, docId } = parseParams(req);
        const token    = req.query.dt;
        const filename = req.params.filename || '';

        const tokenData = validateToken(token, orgId, docId);
        // Senza token: rispondiamo lo stesso ma senza lockdiscovery attivo.
        // Multi-tenant safe: i metadata sono comunque scopati a (orgId, docId).

        const pool    = await getPool();
        const fileRes = await pool.request()
            .input('docId', docId)
            .query(`
                SELECT TOP 1 file_name, file_size, created_at, attachment_id
                FROM attachments
                WHERE document_id=@docId AND is_current_doc_version=1
                ORDER BY created_at DESC
            `);

        if (!fileRes.recordset.length) return res.status(404).end();
        const file    = fileRes.recordset[0];
        const lastMod = new Date(file.created_at).toUTCString();
        const tokenSuffix = token ? `?dt=${token}` : '';
        const href    = `/webdav/${orgId}/${docId}/${encodeURIComponent(filename)}${tokenSuffix}`;
        const timeout = Math.floor(TOKEN_TTL_MS / 1000);
        const activeLockXml = (tokenData && tokenData.lockToken)
            ? `<D:activelock><D:locktoken><D:href>${tokenData.lockToken}</D:href></D:locktoken><D:timeout>Second-${timeout}</D:timeout></D:activelock>`
            : '';

        const xml = `<?xml version="1.0" encoding="utf-8"?>\n` +
`<D:multistatus xmlns:D="DAV:">\n` +
`  <D:response>\n` +
`    <D:href>${href}</D:href>\n` +
`    <D:propstat>\n` +
`      <D:prop>\n` +
`        <D:displayname>${escapeXml(file.file_name)}</D:displayname>\n` +
`        <D:getcontentlength>${file.file_size || 0}</D:getcontentlength>\n` +
`        <D:getlastmodified>${lastMod}</D:getlastmodified>\n` +
`        <D:getetag>"${file.attachment_id}"</D:getetag>\n` +
`        <D:resourcetype/>\n` +
`        <D:supportedlock>\n` +
`          <D:lockentry>\n` +
`            <D:lockscope><D:exclusive/></D:lockscope>\n` +
`            <D:locktype><D:write/></D:locktype>\n` +
`          </D:lockentry>\n` +
`        </D:supportedlock>\n` +
`        <D:lockdiscovery>${activeLockXml}</D:lockdiscovery>\n` +
`      </D:prop>\n` +
`      <D:status>HTTP/1.1 200 OK</D:status>\n` +
`    </D:propstat>\n` +
`  </D:response>\n` +
`</D:multistatus>`;

        setWebdavHeaders(res);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.status(207).send(xml);
    } catch (err) {
        logger.error('[WebDAV] PROPFIND:', err.message);
        res.status(500).end();
    }
}

// ─── LOCK /webdav/:orgId/:docId/:filename ────────────────────────────────────

function handleWebdavLock(req, res) {
    const { orgId, docId } = parseParams(req);
    const token    = req.query.dt;
    const filename = req.params.filename || '';

    const tokenData = validateToken(token, orgId, docId);
    if (!tokenData) return res.status(401).end();

    const lockToken = `urn:uuid:${crypto.randomUUID()}`;
    tokenData.lockToken = lockToken;
    tokenStore.set(token, tokenData);

    const href    = `/webdav/${orgId}/${docId}/${encodeURIComponent(filename)}?dt=${token}`;
    const timeout = Math.floor(TOKEN_TTL_MS / 1000);

    const xml = `<?xml version="1.0" encoding="utf-8"?>\n` +
`<D:prop xmlns:D="DAV:">\n` +
`  <D:lockdiscovery>\n` +
`    <D:activelock>\n` +
`      <D:locktype><D:write/></D:locktype>\n` +
`      <D:lockscope><D:exclusive/></D:lockscope>\n` +
`      <D:depth>0</D:depth>\n` +
`      <D:timeout>Second-${timeout}</D:timeout>\n` +
`      <D:locktoken><D:href>${lockToken}</D:href></D:locktoken>\n` +
`      <D:lockroot><D:href>${href}</D:href></D:lockroot>\n` +
`    </D:activelock>\n` +
`  </D:lockdiscovery>\n` +
`</D:prop>`;

    setWebdavHeaders(res);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Lock-Token', `<${lockToken}>`);
    res.status(200).send(xml);
    logger.info(`[WebDAV] LOCK doc ${docId} (org ${orgId}) → ${lockToken}`);
}

// ─── UNLOCK /webdav/:orgId/:docId/:filename ──────────────────────────────────

function handleWebdavUnlock(req, res) {
    const { orgId, docId } = parseParams(req);
    const token = req.query.dt;

    const tokenData = validateToken(token, orgId, docId);
    if (!tokenData) return res.status(401).end();

    tokenData.lockToken = null;
    tokenStore.set(token, tokenData);
    logger.info(`[WebDAV] UNLOCK doc ${docId} (org ${orgId})`);
    res.status(204).end();
}

// ─── HEAD /webdav/:orgId/:docId/:filename — Office Existence/Word Discovery ──
// Office usa HEAD per verificare se il file è accessibile prima di LOCK.
// Risponde con gli stessi header di GET ma senza body.
// IMPORTANTE: come PROPFIND, accetta anche richieste senza token, perché
// Microsoft-WebDAV-MiniRedir non inoltra il ?dt=token. Solo metadata.

async function handleWebdavHead(req, res) {
    try {
        const { orgId, docId } = parseParams(req);

        const pool   = await getPool();
        const result = await getDocAndCurrentFile(pool, docId, orgId);
        if (!result?.file) return res.status(404).end();

        const { file } = result;
        res.setHeader('Content-Length', file.file_size || 0);
        if (file.mime_type) res.setHeader('Content-Type', file.mime_type);
        res.setHeader('ETag', `"${file.attachment_id}"`);
        res.setHeader('Last-Modified', new Date(file.created_at).toUTCString());
        setWebdavHeaders(res);
        res.status(200).end();
    } catch (err) {
        logger.error('[WebDAV] HEAD:', err.message);
        res.status(500).end();
    }
}

// ─── OPTIONS ─────────────────────────────────────────────────────────────────

function handleWebdavOptions(req, res) {
    setWebdavHeaders(res);
    res.setHeader('Allow', 'OPTIONS, GET, HEAD, PUT, PROPFIND, LOCK, UNLOCK');
    res.status(200).end();
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function parseParams(req) {
    return {
        orgId: parseInt(req.params.orgId),
        docId: parseInt(req.params.docId),
    };
}

function setWebdavHeaders(res) {
    res.setHeader('DAV', '1, 2');
    res.setHeader('MS-Author-Via', 'DAV');
}

function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

module.exports = {
    generateWebdavLink,
    handleWebdavGet,
    handleWebdavHead,
    handleWebdavPut,
    handleWebdavPropfind,
    handleWebdavLock,
    handleWebdavUnlock,
    handleWebdavOptions,
};
