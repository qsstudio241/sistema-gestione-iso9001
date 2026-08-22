'use strict';

/**
 * normIngest.service.js — ingest norme via pipeline unificata + staging (IG-N)
 */

const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { query } = require('../config/database');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const {
  buildNormTypeSpecificData,
  guessStandardCodeFromFilename,
  clampNormTitle,
} = require('./documentRegistryNorm.service');
const normCatalog = require('./normCatalogLookup.service');
const normChunker = require('./normChunker.service');
const { resolveNormFolderId } = require('./normCodesImport.service');
const { calculatePathCache } = require('./documentTreeProvisioner.service');
const { assertMutatingAllowed } = require('./companyAccess.service');
const { ingestFiguresFromPdf } = require('./figureIngest.service');
const {
  parseStandardCode,
  normalizeStandardCodeForStorage,
  normFamilyKey,
  editionYearFromCode,
} = require('./standardCodeNormalizer.service');

const REVIEW_CONFIDENCE_THRESHOLD = Number(process.env.INGEST_NORM_REVIEW_CONFIDENCE) || 55;

/**
 * Se il filename è affidabile e il codice estratto (AI/regole) ha numero diverso, preferisce il filename.
 */
function reconcileStandardCodeWithFilename(fields, fileName) {
  if (!fileName) return fields;
  const fromName = guessStandardCodeFromFilename(fileName);
  const parsedName = fromName ? parseStandardCode(fromName) : null;
  const nameCanonical = parsedName?.canonical
    || (fromName ? normalizeStandardCodeForStorage(fromName) : null);
  if (!nameCanonical) return fields;

  const next = { ...fields };
  const current = next.standard_code;
  const parsedCurrent = current ? parseStandardCode(current, next.edition_year) : null;
  const falseCopyright = current && /^ISO\s+20\d{2}$/i.test(String(current).trim());
  const numberMismatch = parsedName?.number && parsedCurrent?.number
    && parsedName.number !== parsedCurrent.number;

  if (!current || falseCopyright || numberMismatch) {
    next.standard_code = nameCanonical;
    if (parsedName?.year != null) next.edition_year = parsedName.year;
  }
  return next;
}

function assessTextQuality(text) {
  if (!text) return 'ocr_poor';
  const len = text.length;
  if (len < 500) return 'ocr_poor';
  if (len < 5000) return 'partial';
  return 'good';
}

function formatReadableTitle(metadata) {
  const { standard_code, norm_title, issuing_body } = metadata;
  if (!norm_title) return null;
  if (!standard_code) return norm_title;

  let prefix = String(standard_code).trim();
  if (issuing_body && issuing_body.toUpperCase() === 'UNI' && !prefix.toUpperCase().startsWith('UNI')) {
    prefix = `UNI EN ${prefix}`;
  }
  return `${prefix} — ${norm_title}`;
}

function mapCatalogToValidity(catalogLookup) {
  if (!catalogLookup || catalogLookup.status === 'unknown') return 'da_verificare';
  if (catalogLookup.status === 'active') return 'vigente';
  return 'superata';
}

function buildCatalogLookupPayload(catalogLookup) {
  if (!catalogLookup) return null;
  const warning = catalogLookup.error === 'ambiguous_match'
    ? 'Catalogo UNI: più candidati possibili — seleziona o verifica il codice'
    : catalogLookup.status === 'unknown'
      ? 'Catalogo non raggiunto o norma non trovata — verifica il codice'
      : null;
  return {
    status: catalogLookup.status,
    matchedQuery: catalogLookup.matchedQuery || null,
    matchedCode: catalogLookup.matchedCode || null,
    catalogUrl: catalogLookup.catalogUrl || null,
    warning,
    error: catalogLookup.error || null,
  };
}

/**
 * Arricchisce i campi estratti con lookup catalogo UNI e normalizzazione codice.
 */
async function enrichNormFields(rawFields, pipelineWarnings = []) {
  const warnings = [...pipelineWarnings];
  const fields = reconcileStandardCodeWithFilename(
    { ...rawFields },
    rawFields._fileName || '',
  );

  if (!fields.standard_code) {
    const fromName = guessStandardCodeFromFilename(fields._fileName || '');
    if (fromName) fields.standard_code = fromName;
  }
  if (!fields.issuing_body && fields.standard_code) {
    const u = String(fields.standard_code).toUpperCase();
    if (u.startsWith('UNI')) fields.issuing_body = 'UNI';
    else if (/\bISO\b|\bIEC\b/.test(u)) fields.issuing_body = 'ISO';
  }
  fields.norm_title = clampNormTitle(fields.norm_title);

  const preliminary = buildNormTypeSpecificData(fields);
  if (!preliminary?.standard_code) {
    warnings.push('Codice norma non rilevato — revisione obbligatoria');
    return {
      fields,
      catalogLookup: null,
      catalog_lookup: null,
      warnings,
      needsReview: true,
    };
  }

  fields.standard_code = preliminary.standard_code;
  if (preliminary.edition_year != null) fields.edition_year = preliminary.edition_year;

  let catalogLookup = null;
  try {
    catalogLookup = await normCatalog.lookupNormStatus(
      preliminary.standard_code,
      preliminary.issuing_body,
      preliminary.edition_year,
    );
  } catch (lookupErr) {
    logger.warn('[NormIngest] Catalog lookup fallito', { error: lookupErr.message });
    warnings.push(`Lookup catalogo: ${lookupErr.message}`);
  }

  const validityStatus = mapCatalogToValidity(catalogLookup);
  fields.validity_status = validityStatus;
  if (catalogLookup?.checkedAt) fields.last_validity_check = catalogLookup.checkedAt;
  if (catalogLookup?.catalogUrl) fields.validity_check_url = catalogLookup.catalogUrl;
  if (catalogLookup?.supersededBy) fields.superseded_by = catalogLookup.supersededBy;

  const catalog_lookup = buildCatalogLookupPayload(catalogLookup);
  if (catalog_lookup?.warning) warnings.push(catalog_lookup.warning);

  const needsReview = catalogLookup?.error === 'ambiguous_match'
    || catalogLookup?.status === 'unknown'
    || validityStatus === 'da_verificare';

  return { fields, catalogLookup, catalog_lookup, warnings, needsReview };
}

function emptyNormDuplicateResult(standardCode, editionYear) {
  return {
    duplicate: false,
    obsolete: false,
    newer: false,
    familyKey: standardCode ? normFamilyKey(standardCode, editionYear) : null,
    incomingYear: editionYearFromCode(standardCode, editionYear),
    matches: [],
    vigente: null,
    message: null,
  };
}

function formatNormLabel(row) {
  if (!row) return '';
  const code = row.standard_code || '';
  const year = editionYearFromCode(row.standard_code, row.edition_year);
  if (code && year) return `${code}, ${year}`;
  return code || String(year || '');
}

/**
 * Confronta la famiglia (EN/ISO/IEC + numero) nella stessa org + cartella/azienda.
 * Stesso anno = duplicato; anno più vecchio di un vigente = obsoleto; anno più nuovo = newer.
 * @returns {Promise<{duplicate: boolean, obsolete: boolean, newer: boolean, familyKey: string|null, incomingYear: number|null, matches: object[], vigente: object|null, message: string|null}>}
 */
async function checkNormDuplicate(standardCode, organizationId, excludeDocumentId = null, scope = {}) {
  if (!standardCode) return emptyNormDuplicateResult(standardCode, scope.editionYear);
  const excludeId = excludeDocumentId != null ? parseInt(excludeDocumentId, 10) : null;
  const companyId = scope.companyId != null && scope.companyId !== ''
    ? parseInt(scope.companyId, 10)
    : null;
  const folderId = scope.folderId != null && scope.folderId !== ''
    ? parseInt(scope.folderId, 10)
    : null;
  const incomingYear = editionYearFromCode(standardCode, scope.editionYear);
  const incomingFamily = normFamilyKey(standardCode, incomingYear);
  const incomingCanonical = normalizeStandardCodeForStorage(standardCode, incomingYear);

  const result = await query(`
    SELECT id, company_id, parent_id,
      JSON_VALUE(type_specific_data, '$.standard_code') AS standard_code,
      JSON_VALUE(type_specific_data, '$.edition_year') AS edition_year,
      JSON_VALUE(type_specific_data, '$.validity_status') AS validity_status
    FROM document_registry
    WHERE organization_id = @orgId
      AND doc_type = 'norma'
      AND ISNULL(status, 'rilasciato') NOT IN ('eliminato', 'obsoleto')
      AND (@excludeId IS NULL OR id <> @excludeId)
      AND (@companyId IS NULL OR company_id = @companyId)
      AND (@folderId IS NULL OR parent_id = @folderId)
  `, {
    orgId: organizationId,
    excludeId: Number.isFinite(excludeId) ? excludeId : null,
    companyId: Number.isFinite(companyId) ? companyId : null,
    folderId: Number.isFinite(folderId) ? folderId : null,
  });

  const familyMatches = (result.recordset || []).filter((row) => {
    const code = row.standard_code;
    if (!code) return false;
    const year = editionYearFromCode(code, row.edition_year);
    const family = normFamilyKey(code, year);
    const canonical = normalizeStandardCodeForStorage(code, year);
    return family === incomingFamily
      || canonical === incomingCanonical
      || String(code).trim() === String(standardCode).trim();
  }).map((row) => ({
    ...row,
    edition_year: editionYearFromCode(row.standard_code, row.edition_year),
  }));

  const sameEdition = familyMatches.filter((row) => {
    const sameYear = incomingYear != null && row.edition_year != null && row.edition_year === incomingYear;
    const sameCode = normalizeStandardCodeForStorage(row.standard_code, row.edition_year) === incomingCanonical;
    return sameYear || sameCode;
  });

  const vigenteMatches = familyMatches.filter((row) => {
    const vs = String(row.validity_status || '').toLowerCase();
    return vs === 'vigente' || vs === 'active';
  });
  const vigentePool = vigenteMatches.length > 0 ? vigenteMatches : familyMatches;
  const vigente = vigentePool.reduce((best, row) => {
    if (!best) return row;
    const by = best.edition_year;
    const ry = row.edition_year;
    if (ry != null && (by == null || ry > by)) return row;
    return best;
  }, null);

  if (sameEdition.length > 0) {
    const hit = sameEdition[0];
    return {
      duplicate: true,
      obsolete: false,
      newer: false,
      familyKey: incomingFamily,
      incomingYear,
      matches: familyMatches,
      vigente: vigente || hit,
      message: `Duplicato: in questa cartella esiste già la stessa famiglia e la stessa edizione (${formatNormLabel(hit)}). Non è stato creato un secondo documento.`,
    };
  }

  const vigenteYear = vigente ? vigente.edition_year : null;
  const obsolete = incomingYear != null && vigenteYear != null && incomingYear < vigenteYear;
  const newer = incomingYear != null && vigenteYear != null && incomingYear > vigenteYear;

  let message = null;
  if (obsolete) {
    message = `Esiste già un'edizione più recente (${formatNormLabel(vigente)}). Puoi tenere questa come obsoleta.`;
  } else if (newer) {
    message = `Trovata un'edizione precedente (${formatNormLabel(vigente)}). Verrà impostata come non vigente.`;
  }

  return {
    duplicate: false,
    obsolete,
    newer,
    familyKey: incomingFamily,
    incomingYear,
    matches: familyMatches,
    vigente,
    message,
  };
}

async function markOlderEditionsSuperseded(organizationId, check, excludeDocumentId) {
  if (!check || !check.newer || !Array.isArray(check.matches)) return [];
  const incomingYear = check.incomingYear;
  const excludeId = excludeDocumentId != null ? parseInt(excludeDocumentId, 10) : null;
  const older = check.matches.filter((row) => {
    if (excludeId != null && parseInt(row.id, 10) === excludeId) return false;
    const vs = String(row.validity_status || '').toLowerCase();
    const already = vs === 'superata' || vs === 'ritirata';
    if (already) return false;
    if (incomingYear == null) return vs === 'vigente' || vs === 'active' || !vs;
    return row.edition_year == null || row.edition_year < incomingYear;
  });

  const updated = [];
  for (const row of older) {
    await query(`
      UPDATE document_registry
      SET type_specific_data = JSON_MODIFY(
            CASE WHEN ISJSON(type_specific_data) = 1 THEN type_specific_data ELSE '{}' END,
            '$.validity_status',
            @status
          ),
          updated_at = GETDATE()
      WHERE id = @id AND organization_id = @orgId
    `, { id: row.id, orgId: organizationId, status: 'superata' });
    await query(`
      UPDATE norm_document_sources
      SET validity_status = @status, updated_at = GETDATE()
      WHERE document_id = @id AND organization_id = @orgId
    `, { id: row.id, orgId: organizationId, status: 'superata' });
    updated.push(row.id);
  }
  return updated;
}

/**
 * Estrae metadati norma da PDF via pipeline unificata + lookup catalogo.
 */
async function extractNormFromPdf(pdfBuffer, fileName, organizationId, parentFolderId = null, options = {}) {
  const excludeDocumentId = options.excludeDocumentId != null ? options.excludeDocumentId : null;
  const folderId = options.folderId != null && options.folderId !== ''
    ? options.folderId
    : parentFolderId;
  const companyId = options.companyId != null ? options.companyId : null;
  const pipeline = await runDocumentIngest({
    pdfBuffer,
    docType: 'norma',
    fileName,
    organizationId,
  });

  const enriched = await enrichNormFields(
    { ...pipeline.fields, _fileName: fileName },
    pipeline.warnings,
  );

  const standardCode = enriched.fields.standard_code;
  const dupCheck = standardCode
    ? await checkNormDuplicate(standardCode, organizationId, excludeDocumentId, {
      companyId,
      folderId,
      editionYear: enriched.fields.edition_year,
    })
    : emptyNormDuplicateResult(standardCode, enriched.fields.edition_year);

  if (dupCheck.duplicate) {
    return {
      status: 'duplicate',
      standard_code: standardCode,
      norm_title: enriched.fields.norm_title || null,
      edition_year: enriched.fields.edition_year ?? dupCheck.incomingYear,
      warnings: [...enriched.warnings, dupCheck.message].filter(Boolean),
      message: dupCheck.message,
    };
  }

  if (dupCheck.obsolete) {
    enriched.fields.validity_status = 'superata';
    if (dupCheck.message) enriched.warnings.push(dupCheck.message);
  } else if (dupCheck.newer && dupCheck.message) {
    enriched.warnings.push(dupCheck.message);
  }

  const needsReview = enriched.needsReview
    || pipeline.extractionConfidence < REVIEW_CONFIDENCE_THRESHOLD
    || !standardCode
    || dupCheck.obsolete;

  return {
    status: needsReview ? 'pending_review' : 'ready_commit',
    fields: enriched.fields,
    field_confidence: pipeline.fieldConfidence,
    catalog_lookup: enriched.catalog_lookup,
    warnings: enriched.warnings,
    confidence: pipeline.extractionConfidence,
    ai_model: pipeline.aiModel,
    parent_folder_id: parentFolderId,
    extracted_text: pipeline.text,
    text_quality: assessTextQuality(pipeline.text),
    edition_conflict: dupCheck.obsolete ? 'obsolete' : dupCheck.newer ? 'newer' : null,
  };
}

/**
 * Commit norma in document_registry + norm_document_sources (da staging o auto-commit).
 */
async function commitNormFromFields(fields, organizationId, options = {}) {
  const {
    userId,
    filePath,
    fileName = 'documento.pdf',
    parentFolderId = null,
    extractedText = null,
    textQuality = null,
    mimeType = 'application/pdf',
    fileSize = null,
  } = options;

  const normFolder = await resolveNormFolderId(organizationId, parentFolderId);
  if (!normFolder) {
    const err = new Error('Cartella "NORME E LEGGI" (folder_code 2.3) non trovata');
    err.code = 'NORM_FOLDER_NOT_FOUND';
    throw err;
  }

  const cleanFields = { ...fields };
  delete cleanFields._fileName;
  delete cleanFields.catalog_lookup;

  const normTsd = buildNormTypeSpecificData(cleanFields);
  if (!normTsd?.standard_code) {
    const err = new Error('Codice norma obbligatorio per il commit (standard_code)');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const dupCheck = await checkNormDuplicate(normTsd.standard_code, organizationId, null, {
    companyId: normFolder.company_id,
    folderId: normFolder.id,
    editionYear: normTsd.edition_year,
  });
  if (dupCheck.duplicate) {
    const err = new Error(dupCheck.message || `Duplicato: norma già presente (${normTsd.standard_code}).`);
    err.code = 'DUPLICATE';
    err.standard_code = normTsd.standard_code;
    err.warnings = [err.message];
    throw err;
  }
  if (dupCheck.obsolete) {
    normTsd.validity_status = 'superata';
    cleanFields.validity_status = 'superata';
  }

  const metadata = {
    ...cleanFields,
    standard_code: normTsd.standard_code,
    edition_year: normTsd.edition_year,
    validity_status: normTsd.validity_status,
  };

  const docTitle = formatReadableTitle(metadata)
    || path.basename(fileName, path.extname(fileName));
  const editionYear = normTsd.edition_year ?? null;
  const typeSpecificData = JSON.stringify(normTsd);
  const tQuality = textQuality || assessTextQuality(extractedText);

  const docResult = await query(`
    INSERT INTO document_registry (
      organization_id, company_id, parent_id, title, doc_type, status,
      is_system_folder, issue_date, type_specific_data,
      created_by, created_at, updated_at
    )
    OUTPUT INSERTED.id
    VALUES (
      @orgId, @companyId, @parentId, @title, 'norma', 'rilasciato',
      0,
      CASE WHEN @editionYear IS NOT NULL THEN DATEFROMPARTS(@editionYear, 1, 1) ELSE NULL END,
      @typeSpecificData,
      @userId, GETDATE(), GETDATE()
    )
  `, {
    orgId: organizationId,
    companyId: normFolder.company_id,
    parentId: normFolder.id,
    title: docTitle.substring(0, 255),
    editionYear,
    typeSpecificData,
    userId: userId || null,
  });

  const documentId = docResult.recordset[0].id;
  const pathCache = await calculatePathCache(documentId, organizationId);
  await query(
    `UPDATE document_registry SET path_cache = @path_cache WHERE id = @id`,
    { path_cache: pathCache, id: documentId },
  );

  let attachmentId = null;
  if (filePath) {
    const attResult = await query(`
      INSERT INTO attachments (
        document_id, file_name, file_type, file_size, mime_type,
        storage_path, category, description, uploaded_by, created_at,
        is_current_doc_version, doc_file_version
      )
      OUTPUT INSERTED.attachment_id
      VALUES (
        @documentId, @fileName, @fileType, @fileSize, @mimeType,
        @storagePath, 'document', @description, @userId, GETDATE(),
        1, 1
      )
    `, {
      documentId,
      fileName,
      fileType: path.extname(fileName).toLowerCase(),
      fileSize,
      mimeType,
      storagePath: filePath,
      description: `Norma: ${docTitle.substring(0, 200)}`,
      userId: userId || null,
    });
    attachmentId = attResult.recordset[0].attachment_id;
    await query(
      `UPDATE document_registry SET attachment_id = @attId WHERE id = @docId`,
      { attId: attachmentId, docId: documentId },
    );
  }

  const srcResult = await query(`
    INSERT INTO norm_document_sources (
      document_id, organization_id, standard_code, norm_title,
      edition_year, issuing_body, extracted_text, text_quality,
      validity_status, created_at, updated_at
    )
    OUTPUT INSERTED.id
    VALUES (
      @docId, @orgId, @stdCode, @normTitle,
      @editionYear, @issuingBody, @extractedText, @textQuality,
      @validityStatus, GETDATE(), GETDATE()
    )
  `, {
    docId: documentId,
    orgId: organizationId,
    stdCode: normTsd.standard_code,
    normTitle: normTsd.norm_title || null,
    editionYear: normTsd.edition_year ?? null,
    issuingBody: normTsd.issuing_body || null,
    extractedText: extractedText || null,
    textQuality: tQuality,
    validityStatus: normTsd.validity_status || 'da_verificare',
  });

  const sourceId = srcResult.recordset?.[0]?.id;
  if (sourceId) {
    setImmediate(() => {
      normChunker.indexDocument(sourceId).catch((err) => {
        logger.warn('[NormIngest] Async indexing failed', { sourceId, error: err.message });
      });
    });
  }

  // FW-0: tavole CLIP sullo stesso PDF. Fallimento extract/CLIP non rollback della norma.
  if (filePath) {
    try {
      await ingestFiguresFromPdf({
        organizationId,
        companyId: normFolder.company_id,
        pdfPath: filePath,
      });
    } catch (figErr) {
      logger.warn('[NormIngest] Ingest figure fallito (norma già committata)', {
        documentId,
        organizationId,
        error: figErr && figErr.message,
      });
    }
  }

  let supersededIds = [];
  if (dupCheck.newer) {
    supersededIds = await markOlderEditionsSuperseded(organizationId, dupCheck, documentId);
  }

  return {
    document_id: documentId,
    attachment_id: attachmentId,
    standard_code: normTsd.standard_code,
    norm_title: normTsd.norm_title || docTitle,
    validity_status: normTsd.validity_status,
    text_quality: tQuality,
    superseded_ids: supersededIds,
  };
}

const FOLDER_INGEST_LIMIT = 20;

async function assertFolderIsNorms(organizationId, folderId) {
  const folder = parseInt(folderId, 10);
  if (!Number.isFinite(folder)) return null;
  const result = await query(`
    SELECT id, company_id, folder_code
    FROM document_registry
    WHERE id = @folderId
      AND organization_id = @orgId
      AND doc_type = 'folder'
  `, { folderId: folder, orgId: organizationId });
  const row = result.recordset[0];
  if (!row) return null;
  if (String(row.folder_code || '') !== '2.3') {
    const err = new Error('La cartella selezionata non è NORME E LEGGI.');
    err.code = 'FOLDER_NOT_NORMS';
    throw err;
  }
  return { id: row.id, company_id: row.company_id ?? null };
}

/**
 * PDF già in registry sotto la cartella NORME E LEGGI (allegato corrente).
 * Non richiede re-upload: IA-12.
 */
const FOLDER_PDF_FROM_WHERE = `
    FROM document_registry d
    INNER JOIN attachments a
      ON a.document_id = d.id
     AND ISNULL(a.is_current_doc_version, 1) = 1
    WHERE d.organization_id = @orgId
      AND d.parent_id = @folderId
      AND d.doc_type <> 'folder'
      AND ISNULL(d.status, 'rilasciato') NOT IN ('eliminato')
      AND (
        a.mime_type = 'application/pdf'
        OR LOWER(ISNULL(a.file_name, '')) LIKE '%.pdf'
      )`;

async function listFolderNormPdfs(organizationId, folderId, documentIds = null) {
  const folder = parseInt(folderId, 10);
  if (!Number.isFinite(folder)) {
    return { docs: [], total: 0, truncated: false, omitted: 0 };
  }

  const params = { orgId: organizationId, folderId: folder };
  const countResult = await query(
    `SELECT COUNT(*) AS total ${FOLDER_PDF_FROM_WHERE}`,
    params,
  );
  const total = Number(countResult.recordset?.[0]?.total) || 0;

  const result = await query(`
    SELECT TOP ${FOLDER_INGEST_LIMIT}
      d.id,
      d.title,
      d.doc_type,
      d.company_id,
      d.parent_id,
      a.storage_path,
      a.file_name,
      a.mime_type,
      a.file_size
    ${FOLDER_PDF_FROM_WHERE}
    ORDER BY d.id ASC
  `, params);

  let rows = result.recordset || [];
  if (Array.isArray(documentIds) && documentIds.length > 0) {
    const allowed = new Set(
      documentIds.map((id) => parseInt(id, 10)).filter((id) => Number.isFinite(id)),
    );
    rows = rows.filter((r) => allowed.has(r.id));
  }
  const omitted = Math.max(0, total - FOLDER_INGEST_LIMIT);
  return {
    docs: rows,
    total,
    truncated: omitted > 0,
    omitted,
  };
}

/**
 * Applica i campi norma a un documento già in registry (niente INSERT, niente nuovo allegato).
 */
async function applyNormToExistingDocument(documentId, fields, organizationId, options = {}) {
  const {
    userId,
    user = null,
    expectedFolderId = null,
    extractedText = null,
    textQuality = null,
    filePath = null,
  } = options;

  const docId = parseInt(documentId, 10);
  if (!Number.isFinite(docId)) {
    const err = new Error('Documento non valido');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const existing = await query(`
    SELECT id, company_id, parent_id, title
    FROM document_registry
    WHERE id = @documentId
      AND organization_id = @orgId
      AND doc_type <> 'folder'
      AND ISNULL(status, 'rilasciato') NOT IN ('eliminato')
  `, { documentId: docId, orgId: organizationId });

  const doc = existing.recordset[0];
  if (!doc) {
    const err = new Error('Documento non trovato');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (expectedFolderId != null && expectedFolderId !== '') {
    const expected = parseInt(expectedFolderId, 10);
    if (Number.isFinite(expected) && parseInt(doc.parent_id, 10) !== expected) {
      const err = new Error('Il documento non appartiene alla cartella NORME E LEGGI selezionata.');
      err.code = 'DOC_NOT_IN_FOLDER';
      err.status = 400;
      throw err;
    }
  }

  if (user) {
    const denied = await assertMutatingAllowed(user, { companyId: doc.company_id });
    if (denied) {
      const err = new Error(denied.body?.error || 'Permesso negato');
      err.code = denied.body?.code || 'AUTH_FORBIDDEN';
      err.status = denied.status;
      throw err;
    }
  }

  const cleanFields = { ...fields };
  delete cleanFields._fileName;
  delete cleanFields.catalog_lookup;
  delete cleanFields._parent_folder_id;
  delete cleanFields._extracted_text;
  delete cleanFields._text_quality;
  delete cleanFields._target_document_id;

  const normTsd = buildNormTypeSpecificData(cleanFields);
  if (!normTsd?.standard_code) {
    const err = new Error('Codice norma obbligatorio per il commit (standard_code)');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const dupCheck = await checkNormDuplicate(normTsd.standard_code, organizationId, docId, {
    companyId: doc.company_id,
    folderId: doc.parent_id,
    editionYear: normTsd.edition_year,
  });
  if (dupCheck.duplicate) {
    const err = new Error(dupCheck.message || `Duplicato: norma già presente (${normTsd.standard_code}).`);
    err.code = 'DUPLICATE';
    err.standard_code = normTsd.standard_code;
    err.warnings = [err.message];
    throw err;
  }
  if (dupCheck.obsolete) {
    normTsd.validity_status = 'superata';
    cleanFields.validity_status = 'superata';
  }

  const metadata = {
    ...cleanFields,
    standard_code: normTsd.standard_code,
    edition_year: normTsd.edition_year,
    validity_status: normTsd.validity_status,
  };

  const fileNameHint = options.fileName || doc.title || 'documento.pdf';
  const docTitle = formatReadableTitle(metadata)
    || path.basename(fileNameHint, path.extname(fileNameHint));
  const editionYear = normTsd.edition_year ?? null;
  const typeSpecificData = JSON.stringify(normTsd);
  const tQuality = textQuality || assessTextQuality(extractedText);

  await query(`
    UPDATE document_registry SET
      title = @title,
      doc_type = 'norma',
      issue_date = CASE
        WHEN @editionYear IS NOT NULL THEN DATEFROMPARTS(@editionYear, 1, 1)
        ELSE issue_date
      END,
      type_specific_data = @typeSpecificData,
      updated_at = GETDATE()
    WHERE id = @id AND organization_id = @orgId
  `, {
    id: docId,
    orgId: organizationId,
    title: String(docTitle).substring(0, 255),
    editionYear,
    typeSpecificData,
  });

  const srcExisting = await query(
    `SELECT TOP 1 id FROM norm_document_sources WHERE document_id = @docId`,
    { docId },
  );

  if (srcExisting.recordset[0]) {
    await query(`
      UPDATE norm_document_sources SET
        standard_code = @stdCode,
        norm_title = @normTitle,
        edition_year = @editionYear,
        issuing_body = @issuingBody,
        extracted_text = COALESCE(@extractedText, extracted_text),
        text_quality = @textQuality,
        validity_status = @validityStatus,
        updated_at = GETDATE()
      WHERE document_id = @docId
    `, {
      docId,
      stdCode: normTsd.standard_code,
      normTitle: normTsd.norm_title || null,
      editionYear,
      issuingBody: normTsd.issuing_body || null,
      extractedText: extractedText || null,
      textQuality: tQuality,
      validityStatus: normTsd.validity_status || 'da_verificare',
    });
  } else {
    await query(`
      INSERT INTO norm_document_sources (
        document_id, organization_id, standard_code, norm_title,
        edition_year, issuing_body, extracted_text, text_quality,
        validity_status, created_at, updated_at
      )
      VALUES (
        @docId, @orgId, @stdCode, @normTitle,
        @editionYear, @issuingBody, @extractedText, @textQuality,
        @validityStatus, GETDATE(), GETDATE()
      )
    `, {
      docId,
      orgId: organizationId,
      stdCode: normTsd.standard_code,
      normTitle: normTsd.norm_title || null,
      editionYear,
      issuingBody: normTsd.issuing_body || null,
      extractedText: extractedText || null,
      textQuality: tQuality,
      validityStatus: normTsd.validity_status || 'da_verificare',
    });
  }

  const srcIdRow = await query(
    `SELECT TOP 1 id FROM norm_document_sources WHERE document_id = @docId`,
    { docId },
  );
  const sourceId = srcIdRow.recordset?.[0]?.id;
  if (sourceId) {
    setImmediate(() => {
      normChunker.indexDocument(sourceId).catch((err) => {
        logger.warn('[NormIngest] Async indexing failed', { sourceId, error: err.message });
      });
    });
  }

  if (filePath) {
    try {
      await ingestFiguresFromPdf({
        organizationId,
        companyId: doc.company_id,
        pdfPath: filePath,
      });
    } catch (figErr) {
      logger.warn('[NormIngest] Ingest figure fallito (norma già aggiornata)', {
        documentId: docId,
        organizationId,
        error: figErr && figErr.message,
      });
    }
  }

  let supersededIds = [];
  if (dupCheck.newer) {
    supersededIds = await markOlderEditionsSuperseded(organizationId, dupCheck, docId);
  }

  return {
    document_id: docId,
    attachment_id: null,
    standard_code: normTsd.standard_code,
    norm_title: normTsd.norm_title || docTitle,
    validity_status: normTsd.validity_status,
    text_quality: tQuality,
    superseded_ids: supersededIds,
  };
}

module.exports = {
  assessTextQuality,
  enrichNormFields,
  extractNormFromPdf,
  commitNormFromFields,
  applyNormToExistingDocument,
  assertFolderIsNorms,
  listFolderNormPdfs,
  checkNormDuplicate,
  markOlderEditionsSuperseded,
  normFamilyKey,
  FOLDER_INGEST_LIMIT,
  REVIEW_CONFIDENCE_THRESHOLD,
};
