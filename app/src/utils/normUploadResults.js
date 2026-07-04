/**
 * Normalizza le voci di risposta POST /documents/norms/upload (IG-N staging + auto-commit).
 */
export function normalizeNormUploadResults(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return { status: 'error', error: 'Risposta non valida', fileName: '?' };
    }
    const m = entry.metadata || {};
    const fields = entry.fields || {};
    const status = entry.status
      || (entry.success ? 'confirmed' : entry.error ? 'error' : 'pending_review');
    return {
      status,
      success: status === 'confirmed',
      error: entry.error || null,
      fileName: entry.fileName || entry.filename || null,
      staging_id: entry.staging_id || null,
      fields: entry.fields || null,
      field_confidence: entry.field_confidence || null,
      catalog_lookup: entry.catalog_lookup || null,
      norm_title: entry.norm_title || fields.norm_title || m.norm_title || null,
      standard_code: entry.standard_code || fields.standard_code || m.standard_code || null,
      edition_year: entry.edition_year ?? fields.edition_year ?? m.edition_year ?? null,
      issuing_body: entry.issuing_body || fields.issuing_body || m.issuing_body || null,
      validity_status: entry.validity_status || fields.validity_status || null,
      text_quality: entry.text_quality || entry.textQuality || null,
      documentId: entry.documentId ?? entry.document_id ?? null,
      catalog_lookup_status: entry.catalog_lookup_status || entry.catalog_lookup?.status || null,
      catalog_lookup_warning: entry.catalog_lookup_warning || entry.catalog_lookup?.warning || null,
      warnings: entry.warnings || [],
    };
  });
}

export function countNormUploadSuccesses(results) {
  return normalizeNormUploadResults(results).filter(
    (r) => (r.status === 'confirmed' && r.documentId) || r.status === 'pending_review',
  ).length;
}
