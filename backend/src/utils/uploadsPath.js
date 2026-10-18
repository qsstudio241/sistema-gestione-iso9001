/**
 * Percorsi file sotto UPLOAD_DIR: parsing sicuro dell'URL legacy `/uploads/<rel>`
 * e risoluzione fisica con controllo di contenimento (anche contro symlink).
 */

const fs = require('fs');
const path = require('path');

const MAX_URL_LENGTH = 1024;
const UPLOADS_PREFIX = '/uploads/';

const CONTENT_TYPES = {
    '.pdf': { type: 'application/pdf', inline: true },
    '.png': { type: 'image/png', inline: true },
    '.jpg': { type: 'image/jpeg', inline: true },
    '.jpeg': { type: 'image/jpeg', inline: true },
};

function getUploadRoot() {
    return path.resolve(process.env.UPLOAD_DIR || './uploads');
}

/**
 * Valida un valore `/uploads/<rel>` (come salvato in DB o inviato dal client).
 * Rifiuta: tipi non stringa, byte nulli/controllo, backslash, escape `%xx`
 * (anche doppia codifica), segmenti vuoti / `.` / `..` / nascosti, lettere di unità.
 * @returns {{ rel: string, url: string, segments: string[] } | null}
 */
function parseUploadsUrl(raw) {
    if (typeof raw !== 'string') return null;
    if (raw.length === 0 || raw.length > MAX_URL_LENGTH) return null;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
    if (/%[0-9a-f]{2}/i.test(raw)) return null;
    if (!raw.startsWith(UPLOADS_PREFIX)) return null;

    const segments = raw.slice(UPLOADS_PREFIX.length).split('/');
    for (const seg of segments) {
        if (seg === '' || seg === '.' || seg === '..') return null;
        if (seg.startsWith('.')) return null;
        if (/^[a-zA-Z]:/.test(seg)) return null;
    }
    const rel = segments.join('/');
    return { rel, url: UPLOADS_PREFIX + rel, segments };
}

function isInside(root, candidate) {
    return candidate === root || candidate.startsWith(root + path.sep);
}

/**
 * Risolve `rel` sotto la root uploads con `realpath` (segue i symlink e verifica
 * che il file reale resti dentro la root reale).
 * @returns {Promise<{ realRoot: string, realFile: string, relReal: string, size: number } | null>}
 *   null se il file non esiste, non è un file regolare o esce dalla root.
 */
async function resolveUploadFile(rel) {
    let realRoot;
    try {
        realRoot = await fs.promises.realpath(getUploadRoot());
    } catch {
        return null;
    }
    const lexical = path.resolve(realRoot, rel);
    if (!isInside(realRoot, lexical) || lexical === realRoot) return null;

    let realFile;
    try {
        realFile = await fs.promises.realpath(lexical);
    } catch {
        return null;
    }
    if (!isInside(realRoot, realFile) || realFile === realRoot) return null;

    let st;
    try {
        st = await fs.promises.stat(realFile);
    } catch {
        return null;
    }
    if (!st.isFile()) return null;

    return {
        realRoot,
        realFile,
        relReal: path.relative(realRoot, realFile),
        size: st.size,
    };
}

/** Content-Type + modalità di presentazione; tipi sconosciuti sono sempre scaricati. */
function contentTypeFor(fileName) {
    const ext = path.extname(String(fileName || '')).toLowerCase();
    const known = CONTENT_TYPES[ext];
    if (known) return { type: known.type, inline: known.inline, ext };
    return { type: 'application/octet-stream', inline: false, ext: ext.replace(/[^.a-z0-9]/g, '') };
}

module.exports = {
    UPLOADS_PREFIX,
    getUploadRoot,
    parseUploadsUrl,
    resolveUploadFile,
    contentTypeFor,
};
