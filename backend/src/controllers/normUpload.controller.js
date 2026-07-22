/**
 * normUpload.controller.js
 * Upload batch norme → pipeline unificata → staging (IG-N) o auto-commit se match deterministico.
 */

const fs = require('fs').promises;
const logger = require('../utils/logger');
const { resolveNormFolderId } = require('../services/normCodesImport.service');
const { extractNormFromPdf, commitNormFromFields } = require('../services/normIngest.service');
const { createStagingRecord } = require('../services/ingestStaging.service');
const { describeIngestFileError } = require('../utils/ingestErrorMessage');

/** Campi piatti per UI (NormUploadButton). */
function flattenNormBatchEntry(entry) {
  const fields = entry.fields || {};
  return {
    fileName: entry.fileName || entry.filename || null,
    status: entry.status,
    staging_id: entry.staging_id || null,
    document_id: entry.document_id || null,
    fields: entry.fields || null,
    field_confidence: entry.field_confidence || null,
    catalog_lookup: entry.catalog_lookup || null,
    standard_code: fields.standard_code || entry.standard_code || null,
    norm_title: fields.norm_title || entry.norm_title || null,
    edition_year: fields.edition_year ?? entry.edition_year ?? null,
    issuing_body: fields.issuing_body || entry.issuing_body || null,
    validity_status: fields.validity_status || entry.validity_status || null,
    text_quality: entry.text_quality || null,
    catalog_lookup_status: entry.catalog_lookup?.status || null,
    catalog_lookup_warning: entry.catalog_lookup?.warning || null,
    warnings: entry.warnings || [],
    error: entry.error || null,
    success: entry.status === 'confirmed',
    documentId: entry.document_id || null,
  };
}

/**
 * POST /documents/norms/upload
 * Multer array field "files", max 10, solo PDF.
 */
async function uploadNorms(req, res) {
  const results = [];
  const { user_id, organization_id } = req.user;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Nessun file caricato', code: 'VALIDATION_ERROR' });
  }

  const requestedFolderId = req.body?.parent_folder_id
    ? parseInt(req.body.parent_folder_id, 10)
    : null;

  let normFolder;
  try {
    normFolder = await resolveNormFolderId(organization_id, requestedFolderId);
    if (!normFolder) {
      for (const f of req.files) await fs.unlink(f.path).catch(() => {});
      return res.status(404).json({
        error: 'Cartella "NORME E LEGGI" (folder_code 2.3) non trovata. In Albero → vista libera, usa «Inizializza struttura documentale».',
        code: 'NORM_FOLDER_NOT_FOUND',
      });
    }
  } catch (err) {
    for (const f of req.files) await fs.unlink(f.path).catch(() => {});
    logger.error('[NormUpload] Errore lookup cartella norme:', err.message);
    return res.status(500).json({ error: 'Errore interno', code: 'INTERNAL_ERROR' });
  }

  for (const file of req.files) {
    let entry = { fileName: file.originalname, status: 'error', warnings: [] };
    try {
      const buffer = await fs.readFile(file.path);
      const extracted = await extractNormFromPdf(
        buffer,
        file.originalname,
        organization_id,
        normFolder.id,
      );

      if (extracted.status === 'duplicate') {
        try { await fs.unlink(file.path); } catch (_) {}
        results.push(flattenNormBatchEntry({
          fileName: file.originalname,
          status: 'duplicate',
          standard_code: extracted.standard_code,
          norm_title: extracted.norm_title,
          warnings: extracted.warnings || [],
        }));
        continue;
      }

      const stagingFields = {
        ...extracted.fields,
        _parent_folder_id: normFolder.id,
        _extracted_text: extracted.extracted_text || null,
        _text_quality: extracted.text_quality || null,
      };

      if (extracted.status === 'ready_commit') {
        const committed = await commitNormFromFields(extracted.fields, organization_id, {
          userId: user_id,
          filePath: file.path,
          fileName: file.originalname,
          parentFolderId: normFolder.id,
          extractedText: extracted.extracted_text,
          textQuality: extracted.text_quality,
          mimeType: file.mimetype,
          fileSize: file.size,
        });
        entry = {
          fileName: file.originalname,
          status: 'confirmed',
          document_id: committed.document_id,
          standard_code: committed.standard_code,
          norm_title: committed.norm_title,
          validity_status: committed.validity_status,
          text_quality: committed.text_quality,
          catalog_lookup: extracted.catalog_lookup,
          warnings: extracted.warnings || [],
        };
        logger.info('[NormUpload] Auto-commit catalogo deterministico', {
          documentId: committed.document_id,
          standardCode: committed.standard_code,
          organization_id,
        });
      } else {
        const stagingId = await createStagingRecord({
          organizationId: organization_id,
          companyId: normFolder.company_id,
          docType: 'norma',
          originalName: file.originalname,
          storagePath: file.path,
          mimeType: file.mimetype,
          fileSize: file.size,
          fields: stagingFields,
          fieldConfidence: extracted.field_confidence,
          warnings: extracted.warnings,
          userId: user_id,
          aiModel: extracted.ai_model || null,
        });

        entry = {
          fileName: file.originalname,
          status: 'pending_review',
          staging_id: stagingId,
          fields: extracted.fields,
          field_confidence: extracted.field_confidence,
          catalog_lookup: extracted.catalog_lookup,
          text_quality: extracted.text_quality,
          warnings: extracted.warnings || [],
        };
      }
    } catch (fileErr) {
      const errMsg = describeIngestFileError(fileErr);
      logger.error('[NormUpload/batch] Estrazione fallita', {
        fileName: file.originalname,
        error: errMsg,
        stack: fileErr?.stack || null,
      });
      entry = {
        fileName: file.originalname,
        status: 'error',
        error: errMsg,
        warnings: [errMsg],
      };
      try { await fs.unlink(file.path); } catch (_) {}
    }
    results.push(flattenNormBatchEntry(entry));
  }

  const successCount = results.filter((r) => r.status === 'confirmed' || r.status === 'pending_review').length;
  const pendingCount = results.filter((r) => r.status === 'pending_review').length;

  res.status(successCount > 0 ? 201 : 500).json({
    success: successCount > 0,
    uploaded: successCount,
    pending_review: pendingCount,
    total: results.length,
    results,
  });
}

module.exports = { uploadNorms };
