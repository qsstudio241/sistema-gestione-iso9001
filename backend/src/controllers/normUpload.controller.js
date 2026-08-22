/**
 * normUpload.controller.js
 * Upload batch norme → pipeline unificata → staging (IG-N) o auto-commit se match deterministico.
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const logger = require('../utils/logger');
const { resolveNormFolderId } = require('../services/normCodesImport.service');
const {
  extractNormFromPdf,
  commitNormFromFields,
  applyNormToExistingDocument,
  assertFolderIsNorms,
  listFolderNormPdfs,
} = require('../services/normIngest.service');
const { createStagingRecord } = require('../services/ingestStaging.service');
const { describeIngestFileError } = require('../utils/ingestErrorMessage');
const {
  assertMutatingAllowed,
  sendAccessDenied,
} = require('../services/companyAccess.service');
const { getIngestFolderPauseMs, pause } = require('../services/adapters/geminiKeyPool');

function unpackFolderNormPdfs(listed) {
  if (Array.isArray(listed)) {
    return { docs: listed, truncated: false, omitted: 0 };
  }
  return {
    docs: listed?.docs || [],
    truncated: listed?.truncated === true,
    omitted: Number(listed?.omitted) || 0,
  };
}

function batchHttpStatus(results, { successIfOk = 200 } = {}) {
  const successCount = results.filter((r) => r.status === 'confirmed' || r.status === 'pending_review').length;
  const pendingCount = results.filter((r) => r.status === 'pending_review').length;
  if (successCount > 0) {
    return { httpStatus: successIfOk, successCount, pendingCount };
  }
  // Duplicati/errori per file: 200 così il FE mostra `results` (non un 500 opaco).
  if (results.length > 0) {
    return { httpStatus: 200, successCount, pendingCount };
  }
  return { httpStatus: 500, successCount, pendingCount };
}

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
        { companyId: normFolder.company_id, folderId: normFolder.id },
      );

      if (extracted.status === 'duplicate') {
        try { await fs.unlink(file.path); } catch (_) {}
        results.push(flattenNormBatchEntry({
          fileName: file.originalname,
          status: 'duplicate',
          standard_code: extracted.standard_code,
          norm_title: extracted.norm_title,
          edition_year: extracted.edition_year,
          warnings: extracted.warnings || [],
          error: extracted.message || null,
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

  const { httpStatus, successCount, pendingCount } = batchHttpStatus(results, { successIfOk: 201 });

  res.status(httpStatus).json({
    success: successCount > 0,
    uploaded: successCount,
    pending_review: pendingCount,
    total: results.length,
    results,
  });
}

/**
 * POST /documents/norms/ingest-from-folder
 * Pipeline normIngest sui PDF già in registry (cartella 2.3). Nessun re-upload.
 */
async function ingestFromFolder(req, res) {
  const { user_id, organization_id } = req.user;
  const requestedFolderId = req.body?.folder_id ?? req.body?.parent_folder_id;
  const folderId = requestedFolderId != null && requestedFolderId !== ''
    ? parseInt(requestedFolderId, 10)
    : null;
  const documentIds = Array.isArray(req.body?.document_ids) ? req.body.document_ids : null;

  if (!Number.isFinite(folderId)) {
    return res.status(400).json({
      error: 'Seleziona la cartella NORME E LEGGI (folder_id).',
      code: 'FOLDER_REQUIRED',
    });
  }

  let normFolder;
  try {
    normFolder = await assertFolderIsNorms(organization_id, folderId);
  } catch (err) {
    if (err.code === 'FOLDER_NOT_NORMS') {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    logger.error('[NormUpload] ingest-from-folder lookup cartella', err.message);
    return res.status(500).json({ error: 'Errore interno', code: 'INTERNAL_ERROR' });
  }

  if (!normFolder) {
    return res.status(404).json({
      error: 'Cartella "NORME E LEGGI" (folder_code 2.3) non trovata. In Albero → vista libera, usa «Inizializza struttura documentale».',
      code: 'NORM_FOLDER_NOT_FOUND',
    });
  }

  const writeDenied = await assertMutatingAllowed(req.user, { companyId: normFolder.company_id });
  if (writeDenied) return sendAccessDenied(res, writeDenied);

  let docs;
  let truncated = false;
  let omitted = 0;
  try {
    const listed = await listFolderNormPdfs(organization_id, normFolder.id, documentIds);
    ({ docs, truncated, omitted } = unpackFolderNormPdfs(listed));
  } catch (err) {
    logger.error('[NormUpload] ingest-from-folder lista PDF', err.message);
    return res.status(500).json({ error: 'Errore interno', code: 'INTERNAL_ERROR' });
  }

  if (!docs.length) {
    return res.status(400).json({
      error: 'Nessun PDF in questa cartella. Carica i file (Import o Carica norme) prima di lanciare l\'ingest.',
      code: 'NO_FOLDER_PDFS',
    });
  }

  const results = [];
  const folderPauseMs = getIngestFolderPauseMs();
  for (let docIdx = 0; docIdx < docs.length; docIdx += 1) {
    if (docIdx > 0) await pause(folderPauseMs);
    const doc = docs[docIdx];
    const fileName = doc.file_name || doc.title || `documento-${doc.id}.pdf`;
    let entry = { fileName, status: 'error', warnings: [] };
    try {
      if (!doc.storage_path || !fsSync.existsSync(doc.storage_path)) {
        results.push(flattenNormBatchEntry({
          fileName,
          status: 'error',
          error: 'Allegato non trovato sul server',
          warnings: ['Allegato non trovato sul server'],
        }));
        continue;
      }

      const buffer = await fs.readFile(doc.storage_path);
      const extracted = await extractNormFromPdf(
        buffer,
        fileName,
        organization_id,
        normFolder.id,
        {
          excludeDocumentId: doc.id,
          companyId: doc.company_id != null ? doc.company_id : normFolder.company_id,
          folderId: normFolder.id,
        },
      );

      if (extracted.status === 'duplicate') {
        results.push(flattenNormBatchEntry({
          fileName,
          status: 'duplicate',
          standard_code: extracted.standard_code,
          norm_title: extracted.norm_title,
          edition_year: extracted.edition_year,
          warnings: extracted.warnings || [],
          error: extracted.message || null,
        }));
        continue;
      }

      const stagingFields = {
        ...extracted.fields,
        _parent_folder_id: normFolder.id,
        _extracted_text: extracted.extracted_text || null,
        _text_quality: extracted.text_quality || null,
        _target_document_id: doc.id,
      };

      if (extracted.status === 'ready_commit') {
        const applied = await applyNormToExistingDocument(doc.id, extracted.fields, organization_id, {
          userId: user_id,
          user: req.user,
          expectedFolderId: normFolder.id,
          filePath: doc.storage_path,
          fileName,
          extractedText: extracted.extracted_text,
          textQuality: extracted.text_quality,
        });
        entry = {
          fileName,
          status: 'confirmed',
          document_id: applied.document_id,
          standard_code: applied.standard_code,
          norm_title: applied.norm_title,
          validity_status: applied.validity_status,
          text_quality: applied.text_quality,
          catalog_lookup: extracted.catalog_lookup,
          warnings: extracted.warnings || [],
        };
        logger.info('[NormUpload] Ingest cartella — applicato a documento esistente', {
          documentId: applied.document_id,
          standardCode: applied.standard_code,
          organization_id,
        });
      } else {
        const stagingId = await createStagingRecord({
          organizationId: organization_id,
          companyId: doc.company_id != null ? doc.company_id : normFolder.company_id,
          docType: 'norma',
          originalName: fileName,
          storagePath: doc.storage_path,
          mimeType: doc.mime_type || 'application/pdf',
          fileSize: doc.file_size,
          fields: stagingFields,
          fieldConfidence: extracted.field_confidence,
          warnings: extracted.warnings,
          userId: user_id,
          aiModel: extracted.ai_model || null,
        });
        entry = {
          fileName,
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
      if (fileErr.code === 'DUPLICATE') {
        results.push(flattenNormBatchEntry({
          fileName,
          status: 'duplicate',
          standard_code: fileErr.standard_code || null,
          warnings: fileErr.warnings || [fileErr.message],
        }));
        continue;
      }
      const errMsg = describeIngestFileError(fileErr);
      logger.error('[NormUpload/folder] Estrazione fallita', {
        documentId: doc.id,
        fileName,
        error: errMsg,
      });
      entry = {
        fileName,
        status: 'error',
        error: errMsg,
        warnings: [errMsg],
      };
    }
    results.push(flattenNormBatchEntry(entry));
  }

  const { httpStatus, successCount, pendingCount } = batchHttpStatus(results, { successIfOk: 200 });

  res.status(httpStatus).json({
    success: successCount > 0,
    uploaded: successCount,
    pending_review: pendingCount,
    total: results.length,
    truncated,
    omitted,
    results,
  });
}

module.exports = { uploadNorms, ingestFromFolder };
