/**
 * normUpload.controller.js
 * Gestisce upload multiplo di PDF normativi, estrazione testo con pdf-parse,
 * arricchimento metadati via AI, salvataggio in document_registry + norm_document_sources.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const { chat, getActiveProvider } = require('../services/aiProviderAdapter');
const { buildExtractNormMetadataContext } = require('../services/aiContextBuilder.service');

function stripCodeFences(raw) {
  let s = String(raw || '').trim();
  if (s.startsWith('```')) s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  return s.trim();
}

function assessTextQuality(text) {
  if (!text) return 'ocr_poor';
  const len = text.length;
  if (len < 500) return 'ocr_poor';
  if (len < 5000) return 'partial';
  return 'good';
}

/**
 * POST /documents/norms/upload
 * Multer array field "files", max 10, solo PDF, 50 MB ciascuno.
 */
async function uploadNorms(req, res) {
  const results = [];
  const { user_id, organization_id } = req.user;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Nessun file caricato', code: 'VALIDATION_ERROR' });
  }

  // Find the "NORME E LEGGI" system folder for this org
  let normFolderId;
  try {
    const folderResult = await query(
      `SELECT id FROM document_registry
       WHERE folder_code = '2.3'
         AND organization_id = @orgId
         AND is_system_folder = 1`,
      { orgId: organization_id }
    );
    if (folderResult.recordset.length === 0) {
      // cleanup uploaded files
      for (const f of req.files) await fs.unlink(f.path).catch(() => {});
      return res.status(404).json({
        error: 'Cartella "NORME E LEGGI" (folder_code 2.3) non trovata. Eseguire il provisioning dell\'albero documentale.',
        code: 'NORM_FOLDER_NOT_FOUND',
      });
    }
    normFolderId = folderResult.recordset[0].id;
  } catch (err) {
    for (const f of req.files) await fs.unlink(f.path).catch(() => {});
    logger.error('[NormUpload] Errore lookup cartella norme:', err.message);
    return res.status(500).json({ error: 'Errore interno', code: 'INTERNAL_ERROR' });
  }

  const hasAiProvider = !!getActiveProvider();

  for (const file of req.files) {
    const entry = { filename: file.originalname, success: false, metadata: null, documentId: null, textQuality: null };
    try {
      // (a) Extract text with pdf-parse
      const fileBuffer = await fs.readFile(file.path);
      let extractedText = '';
      try {
        const parsed = await pdfParse(fileBuffer);
        extractedText = parsed.text || '';
      } catch (parseErr) {
        logger.warn(`[NormUpload] pdf-parse fallito per ${file.originalname}:`, parseErr.message);
      }

      const textQuality = assessTextQuality(extractedText);
      entry.textQuality = textQuality;

      // (b) AI metadata extraction (best effort)
      let metadata = { norm_title: null, standard_code: null, issuing_body: null, edition_year: null, language: null, abstract: null };
      if (hasAiProvider && extractedText.length > 50) {
        try {
          const ctx = buildExtractNormMetadataContext({ text: extractedText });
          const aiResult = await chat(
            [
              { role: 'system', content: ctx.systemPrompt },
              { role: 'user', content: ctx.userPrompt },
            ],
            { temperature: 0.1, responseFormat: 'json' }
          );
          const cleaned = stripCodeFences(aiResult.content);
          const parsed = JSON.parse(cleaned);
          metadata = { ...metadata, ...parsed };
        } catch (aiErr) {
          logger.warn(`[NormUpload] AI extraction fallita per ${file.originalname}:`, aiErr.message);
        }
      }
      entry.metadata = metadata;

      const docTitle = metadata.norm_title
        ? `${metadata.standard_code || ''} ${metadata.norm_title}`.trim()
        : path.basename(file.originalname, '.pdf');

      // (c) Create document_registry row under norm folder
      const docResult = await query(
        `INSERT INTO document_registry (
           organization_id, parent_id, title, doc_type, status,
           is_folder, is_system_folder, created_by, created_at, updated_at
         )
         OUTPUT INSERTED.id
         VALUES (
           @orgId, @parentId, @title, 'norma', 'attivo',
           0, 0, @userId, GETDATE(), GETDATE()
         )`,
        {
          orgId: organization_id,
          parentId: normFolderId,
          title: docTitle.substring(0, 255),
          userId: user_id,
        }
      );
      const documentId = docResult.recordset[0].id;
      entry.documentId = documentId;

      // (d) Create attachments row linked to this document
      await query(
        `INSERT INTO attachments (
           audit_id, nc_id, question_id, custom_item_id,
           file_name, file_type, file_size, mime_type,
           storage_path, category, description, uploaded_by, created_at
         )
         VALUES (
           NULL, NULL, NULL, NULL,
           @fileName, @fileType, @fileSize, @mimeType,
           @storagePath, 'document', @description, @userId, GETDATE()
         )`,
        {
          fileName: file.originalname,
          fileType: path.extname(file.originalname).toLowerCase(),
          fileSize: file.size,
          mimeType: file.mimetype,
          storagePath: file.path,
          description: `Norma: ${docTitle.substring(0, 200)}`,
          userId: user_id,
        }
      );

      // (e) Create norm_document_sources row
      await query(
        `INSERT INTO norm_document_sources (
           document_id, organization_id, standard_code, norm_title,
           edition_year, issuing_body, extracted_text, text_quality,
           validity_status, created_at, updated_at
         )
         VALUES (
           @docId, @orgId, @stdCode, @normTitle,
           @editionYear, @issuingBody, @extractedText, @textQuality,
           'vigente', GETDATE(), GETDATE()
         )`,
        {
          docId: documentId,
          orgId: organization_id,
          stdCode: metadata.standard_code || null,
          normTitle: metadata.norm_title || null,
          editionYear: metadata.edition_year || null,
          issuingBody: metadata.issuing_body || null,
          extractedText: extractedText || null,
          textQuality,
        }
      );

      entry.success = true;
      logger.info('[NormUpload] Norma caricata con successo', {
        documentId,
        filename: file.originalname,
        textQuality,
        standardCode: metadata.standard_code,
        organization_id,
      });
    } catch (err) {
      logger.error(`[NormUpload] Errore per ${file.originalname}:`, err.message);
      entry.error = err.message;
      // Don't delete the file — it's already on disk; the partial state can be cleaned up manually
    }
    results.push(entry);
  }

  const successCount = results.filter(r => r.success).length;
  res.status(successCount > 0 ? 201 : 500).json({
    success: successCount > 0,
    uploaded: successCount,
    total: results.length,
    results,
  });
}

module.exports = { uploadNorms };
