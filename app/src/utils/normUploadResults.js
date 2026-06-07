/**
 * Normalizza le voci di risposta POST /documents/norms/upload per la UI.
 * Accetta sia payload legacy (campi piatti) sia { metadata: { ... } }.
 */
export function normalizeNormUploadResults(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return { error: 'Risposta non valida', fileName: '?' };
    }
    const m = entry.metadata || {};
    return {
      success: !!entry.success,
      error: entry.error || null,
      fileName: entry.fileName || entry.filename || null,
      norm_title: entry.norm_title || m.norm_title || null,
      standard_code: entry.standard_code || m.standard_code || null,
      edition_year: entry.edition_year ?? m.edition_year ?? null,
      issuing_body: entry.issuing_body || m.issuing_body || null,
      text_quality: entry.text_quality || entry.textQuality || null,
      documentId: entry.documentId ?? null,
    };
  });
}

export function countNormUploadSuccesses(results) {
  return normalizeNormUploadResults(results).filter(
    (r) => r.success && r.documentId && !r.error
  ).length;
}
