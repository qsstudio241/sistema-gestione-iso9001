/**
 * Risolve path relativi tipo `/uploads/...` in URL assoluti verso il backend.
 *
 * Il frontend gira su Netlify; i file statici sono su VPS (`express.static('/uploads')`).
 * Un `<a href="/uploads/...">` punta al dominio Netlify (404) invece che al backend.
 * Pattern già usato per template report e loghi azienda.
 *
 * @param {string|null|undefined} fileUrl
 * @param {string} [apiBaseUrl] — tipicamente `apiService.baseUrl` (.../api/v1)
 * @returns {string|null}
 */
export function resolveBackendUploadUrl(fileUrl, apiBaseUrl) {
  if (fileUrl == null) return null;
  const s = String(fileUrl).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s) || s.startsWith("blob:") || s.startsWith("data:")) {
    return s;
  }
  const backendBase = String(apiBaseUrl || "").replace(/\/api\/v1\/?$/, "");
  const path = s.startsWith("/") ? s : `/${s}`;
  if (!backendBase) return path;
  return `${backendBase}${path}`;
}

export default resolveBackendUploadUrl;
