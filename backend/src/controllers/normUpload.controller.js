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
const normChunker = require('../services/normChunker.service');

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
 * Da standard_code grezzo (es. "ISO_9016_2012") + norm_title + issuing_body
 * produce un titolo leggibile: "ISO 9016:2012 � Destructive tests on welds�"
 * Se issuing_body � "UNI" e il codice non inizia gi� con UNI, prefissa "UNI EN".
 */
function formatReadableTitle(metadata) {
  const { standard_code, norm_title, issuing_body } = metadata;
  if (!norm_title) return null;
  if (!standard_code) return norm_title;

  const parts = standard_code.split('_');
  let year = '';
  let codeParts = [...parts];
  if (parts.length > 1 && /^\d{4}$/.test(parts[parts.length - 1])) {
    year = parts[parts.length - 1];
    codeParts = parts.slice(0, -1);
  }

  const codeStr = codeParts.join(' ');
  const formattedCode = year ? `${codeStr}:${year}` : codeStr;

  let prefix = formattedCode;
  if (issuing_body && issuing_body.toUpperCase() === 'UNI' && !codeStr.toUpperCase().startsWith('UNI')) {
    prefix = `UNI EN ${formattedCode}`;
  }

  return `${prefix} � ${norm_title}`;
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

      const docTitle = formatReadableTitle(metadata)
        || path.basename(file.originalname, '.pdf');

      const editionYear = metadata.edition_year
        ? parseInt(metadata.edition_year, 10) || null
        : null;

      // (c) Create document_registry row under norm folder
      const docResult = await query(
        `INSERT INTO document_registry (
           organization_id, parent_id, title, doc_type, status,
           is_system_folder, issue_date, created_by, created_at, updated_at
         )
         OUTPUT INSERTED.id
         VALUES (
           @orgId, @parentId, @title, 'norma', 'vigente',
           0,
           CASE WHEN @editionYear IS NOT NULL
                THEN DATEFROMPARTS(@editionYear, 1, 1)
                ELSE NULL END,
           @userId, GETDATE(), GETDATE()
         )`,
        {
          orgId: organization_id,
          parentId: normFolderId,
          title: docTitle.substring(0, 255),
          editionYear,
          userId: user_id,
        }
      );
      const documentId = docResult.recordset[0].id;
      entry.documentId = documentId;

      // (d) Create attachments row linked to this document
      const attResult = await query(
        `INSERT INTO attachments (
           document_id,
           file_name, file_type, file_size, mime_type,
           storage_path, category, description, uploaded_by, created_at,
           is_current_doc_version, doc_file_version
         )
         OUTPUT INSERTED.attachment_id
         VALUES (
           @documentId,
           @fileName, @fileType, @fileSize, @mimeType,
           @storagePath, 'document', @description, @userId, GETDATE(),
           1, 1
         )`,
        {
          documentId,
          fileName: file.originalname,
          fileType: path.extname(file.originalname).toLowerCase(),
          fileSize: file.size,
          mimeType: file.mimetype,
          storagePath: file.path,
          description: `Norma: ${docTitle.substring(0, 200)}`,
          userId: user_id,
        }
      );
      const attachmentId = attResult.recordset[0].attachment_id;

      // (d2) Link attachment back to document_registry
      await query(
        `UPDATE document_registry SET attachment_id = @attId WHERE id = @docId`,
        { attId: attachmentId, docId: documentId }
      );

      // (e) Create norm_document_sources row
      const srcResult = await query(
        `INSERT INTO norm_document_sources (
           document_id, organization_id, standard_code, norm_title,
           edition_year, issuing_body, extracted_text, text_quality,
           validity_status, created_at, updated_at
         )
         OUTPUT INSERTED.id
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

      // (f) Semantic indexing (async, non-blocking)
      const sourceId = srcResult.recordset && srcResult.recordset[0] && srcResult.recordset[0].id;
      if (sourceId) {
        setImmediate(() => {
          normChunker.indexDocument(sourceId).catch(err => {
            logger.warn(`[NormUpload] Async indexing failed for source ${sourceId}:`, err.message);
          });
        });
      }

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
      // Don't delete the file � it's already on disk; the partial state can be cleaned up manually
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
