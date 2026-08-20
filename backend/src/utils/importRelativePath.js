/**
 * Path relativo da picker cartella (webkitdirectory) per import PDF.
 * Si salva in import_job_files.original_name (NVARCHAR 500): niente migrazione.
 */

const MAX_IMPORT_RELATIVE_PATH = 500;

/**
 * Normalizza e valida un path relativo inviato dal client.
 * Rifiuta path assoluti e `..`. Qualsiasi estensione (docx, xlsx, dwg, …).
 * @param {unknown} raw
 * @returns {string|null}
 */
function sanitizeImportRelativePath(raw) {
    if (raw == null) return null;
    let s = String(raw).replace(/\\/g, '/').trim();
    if (!s || s.length > MAX_IMPORT_RELATIVE_PATH) return null;
    if (/^[a-zA-Z]:/.test(s) || s.startsWith('/')) return null;
    const parts = s.split('/').filter(Boolean);
    if (!parts.length) return null;
    if (parts.some((p) => p === '.' || p === '..')) return null;
    return parts.join('/');
}

function isPdfImportName(name) {
    return /\.pdf$/i.test(String(name || ''));
}

/**
 * Ultimo segmento del path (nome file). Path vuoto → stringa vuota.
 * @param {unknown} stored
 * @returns {string}
 */
function basenameImportRelativePath(stored) {
    if (stored == null) return '';
    const s = String(stored).replace(/\\/g, '/').trim();
    if (!s) return '';
    const i = s.lastIndexOf('/');
    return i >= 0 ? s.slice(i + 1) : s;
}

/**
 * Nome da persistere in original_name: path relativo sanitizzato, altrimenti basename multer.
 * @param {unknown} multerOriginalName
 * @param {unknown} relativeFromClient
 * @returns {string}
 */
function resolveImportOriginalName(multerOriginalName, relativeFromClient) {
    const sanitized = sanitizeImportRelativePath(relativeFromClient);
    if (sanitized) return sanitized.substring(0, MAX_IMPORT_RELATIVE_PATH);
    const fallback = String(multerOriginalName || 'documento');
    return fallback.substring(0, MAX_IMPORT_RELATIVE_PATH);
}

/**
 * relative_paths da multipart: stringa singola o array allineato a files[].
 * @param {object|undefined} body
 * @returns {string[]}
 */
function relativePathsFromBody(body) {
    const raw = body?.relative_paths;
    if (Array.isArray(raw)) return raw;
    if (raw == null || raw === '') return [];
    return [raw];
}

module.exports = {
    MAX_IMPORT_RELATIVE_PATH,
    sanitizeImportRelativePath,
    isPdfImportName,
    basenameImportRelativePath,
    resolveImportOriginalName,
    relativePathsFromBody,
};
