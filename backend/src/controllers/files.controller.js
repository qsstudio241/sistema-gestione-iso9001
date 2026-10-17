/**
 * files.controller.js — file di /uploads serviti solo ad utenti autenticati.
 *
 * GET /api/v1/files/content?path=/uploads/<rel>
 *
 * Il percorso è quello già salvato nei record (certificate_file_url, storage_path):
 * nessuna migrazione. Il file viene servito solo se un record della stessa
 * organizzazione lo referenzia e l'utente può leggere l'azienda del record.
 * Il path viaggia in query (non in req.path) così non finisce nei log di richiesta.
 */

const path = require('path');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const {
    ensureCompanyAccessLoaded,
    hasCompanyAccessRows,
    assertCompanyRead,
} = require('../services/companyAccess.service');
const {
    getLicensedModuleKeysForOrg,
    expandWithImpliedModuleKeys,
    hasMaterialComplianceCapability,
} = require('../services/moduleLicense.service');
const {
    getUploadRoot,
    parseUploadsUrl,
    resolveUploadFile,
    contentTypeFor,
} = require('../utils/uploadsPath');

/** Cartelle il cui secondo segmento è l'organization_id del proprietario. */
const ORG_SCOPED_DIRS = new Set(['docs', 'imports', 'norms', 'templates', 'material-certificates']);

const URL_OWNERS = [
    { kind: 'qualifica', table: 'qualifications', moduleKey: 'qualifiche' },
    { kind: 'wpqr', table: 'wpqr_records', moduleKey: 'saldatura' },
    { kind: 'wps', table: 'welding_procedures', moduleKey: 'saldatura' },
];

function notFound(res) {
    return res.status(404).json({ error: 'File non trovato', code: 'FILE_NOT_FOUND' });
}

function escapeLike(value) {
    return String(value).replace(/[\\%_[]/g, (c) => `\\${c}`);
}

function belongsToOtherOrgByPath(segments, organizationId) {
    if (!ORG_SCOPED_DIRS.has(segments[0])) return false;
    return segments[1] !== String(organizationId);
}

async function findUrlOwnerRows(url, organizationId) {
    const rows = [];
    for (const owner of URL_OWNERS) {
        const r = await query(
            `SELECT id, company_id, certificate_file_url
             FROM ${owner.table}
             WHERE organization_id = @organizationId AND certificate_file_url = @url`,
            { organizationId, url },
        );
        for (const row of r.recordset || []) {
            // Collation SQL case-insensitive: il valore deve coincidere esattamente.
            if (row.certificate_file_url === url) rows.push({ ...owner, id: row.id, company_id: row.company_id });
        }
    }
    return rows;
}

async function findMaterialOwnerRows(parsed, organizationId, realRoot) {
    const base = parsed.segments[parsed.segments.length - 1];
    const r = await query(
        `SELECT id, company_id, storage_path
         FROM material_certificates
         WHERE organization_id = @organizationId
           AND storage_path LIKE @tail ESCAPE '\\'`,
        { organizationId, tail: `%${escapeLike(base)}` },
    );
    const targets = new Set([
        path.resolve(getUploadRoot(), parsed.rel),
        path.resolve(realRoot, parsed.rel),
    ]);
    return (r.recordset || [])
        .filter((row) => row.storage_path && targets.has(path.resolve(row.storage_path)))
        .map((row) => ({ kind: 'materiale', id: row.id, company_id: row.company_id, moduleKey: null }));
}

/** true se lo stesso file è referenziato da un record di un'altra organizzazione. */
async function isClaimedByOtherOrg(url, organizationId) {
    const parts = URL_OWNERS.map(
        (o) => `SELECT TOP 1 1 AS hit FROM ${o.table}
                WHERE organization_id <> @organizationId AND certificate_file_url = @url`,
    );
    const r = await query(parts.join('\nUNION ALL\n'), { organizationId, url });
    return (r.recordset || []).length > 0;
}

async function moduleAllowed(req, owner) {
    const role = String(req.user.role || '').trim().toLowerCase();
    if (role === 'superadmin' || role === 'admin') return true;
    if (owner.kind === 'materiale') {
        return hasMaterialComplianceCapability(req.user.organization_id, role);
    }
    const keys = expandWithImpliedModuleKeys(await getLicensedModuleKeysForOrg(req.user.organization_id));
    return keys.includes(owner.moduleKey);
}

/** Stessa regola di getOneQualif: i clienti azienda leggono solo le proprie aziende. */
async function companyReadDenied(req, owner) {
    const accessList = await ensureCompanyAccessLoaded(req.user);
    if (!hasCompanyAccessRows(accessList)) return null;
    if (!owner.company_id) {
        return { status: 403, body: { error: 'Accesso non consentito', code: 'FORBIDDEN' } };
    }
    return assertCompanyRead(req.user, owner.company_id);
}

function setProtectedHeaders(res, { kind, id, file }) {
    const ct = contentTypeFor(file.relReal);
    const ext = ct.ext && /^\.[a-z0-9]{1,8}$/.test(ct.ext) ? ct.ext : '';
    const disposition = ct.inline ? 'inline' : 'attachment';
    res.setHeader('Content-Type', ct.type);
    res.setHeader('Content-Disposition', `${disposition}; filename="${kind}-${id}${ext}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Pragma', 'no-cache');
}

async function getFileContent(req, res) {
    try {
        const parsed = parseUploadsUrl(req.query.path);
        if (!parsed) {
            return res.status(400).json({ error: 'Percorso file non valido', code: 'INVALID_FILE_PATH' });
        }

        const organizationId = req.user.organization_id;
        if (belongsToOtherOrgByPath(parsed.segments, organizationId)) return notFound(res);

        const file = await resolveUploadFile(parsed.rel);
        if (!file) return notFound(res);

        const owners = [
            ...(await findUrlOwnerRows(parsed.url, organizationId)),
            ...(parsed.segments[0] === 'material-certificates'
                ? await findMaterialOwnerRows(parsed, organizationId, file.realRoot)
                : []),
        ];
        if (!owners.length) return notFound(res);

        if (await isClaimedByOtherOrg(parsed.url, organizationId)) {
            logger.warn('[Files] file referenziato da più organizzazioni: accesso negato', {
                org: organizationId,
                user_id: req.user.user_id,
            });
            return notFound(res);
        }

        let denied = null;
        let allowedOwner = null;
        for (const owner of owners) {
            if (!(await moduleAllowed(req, owner))) {
                denied = denied || {
                    status: 403,
                    body: { error: 'Modulo non abilitato per la tua organizzazione', code: 'MODULE_NOT_LICENSED' },
                };
                continue;
            }
            const d = await companyReadDenied(req, owner);
            if (d) {
                denied = denied || d;
                continue;
            }
            allowedOwner = owner;
            break;
        }
        if (!allowedOwner) {
            logger.warn('[Files] accesso negato', { org: organizationId, user_id: req.user.user_id });
            return res.status(denied.status).json(denied.body);
        }

        setProtectedHeaders(res, { kind: allowedOwner.kind, id: allowedOwner.id, file });
        return res.sendFile(file.relReal, {
            root: file.realRoot,
            dotfiles: 'allow',
            etag: false,
            lastModified: false,
            cacheControl: false,
        }, (err) => {
            if (!err || res.headersSent) return;
            res.removeHeader('Content-Disposition');
            if (err.code === 'ENOENT' || err.status === 404) return notFound(res);
            logger.error('[Files] errore lettura file', { code: err.code, status: err.status });
            return res.status(500).json({ error: 'Errore lettura file', code: 'FILE_READ_ERROR' });
        });
    } catch (error) {
        logger.error('[Files] getFileContent', { error: error.message });
        return res.status(500).json({ error: 'Errore interno del server', code: 'FILES_ERROR' });
    }
}

module.exports = { getFileContent };
