/**
 * normattiva.controller.js
 * Controller per ingest automatico decreti da Normattiva.it.
 * 
 * POST /api/v1/normattiva/search    - Ricerca decreto
 * POST /api/v1/normattiva/import    - Importa decreto nel second brain
 */

const logger = require('../utils/logger');
const { query } = require('../config/database');
const normattivaApi = require('../services/normattivaApi.service');
const normattivaToMarkdown = require('../services/normattivaToMarkdown.service');
const { indexDocument } = require('../services/normChunker.service');
const fs = require('fs/promises');
const path = require('path');

const DECRETI_FOLDER = path.resolve(__dirname, '../../../docs/Normative/Decreti');

/**
 * POST /api/v1/normattiva/search
 * Ricerca un decreto su Normattiva.
 * Body: { query: "D.Lgs. 81/2008" }
 * Response: { success: true, results: [{ urn, title, vigenza }] }
 */
async function searchNormattiva(req, res) {
  try {
    const { query: searchQuery } = req.body;
    const user = req.user;

    if (!user || !user.organization_id) {
      return res.status(401).json({ 
        error: 'Autenticazione richiesta', 
        code: 'AUTH_REQUIRED' 
      });
    }

    // Solo superadmin o admin possono importare norme
    if (!['superadmin', 'admin'].includes(user.role)) {
      return res.status(403).json({
        error: 'Permesso negato: solo admin possono cercare decreti',
        code: 'PERMISSION_DENIED',
      });
    }

    if (!searchQuery || !searchQuery.trim()) {
      return res.status(400).json({
        error: 'Query di ricerca richiesta',
        code: 'INVALID_PARAMS',
      });
    }

    logger.info(`[Normattiva] Ricerca per org ${user.organization_id}: ${searchQuery}`);

    const results = await normattivaApi.searchNorm(searchQuery.trim());

    res.json({
      success: true,
      results: results.map(r => ({
        urn: r.urn,
        title: r.title,
        vigenza: r.vigenza,
      })),
    });
  } catch (err) {
    logger.error('[Normattiva] Errore search:', err.message);
    
    if (err.message.includes('Timeout') || err.message.includes('connessione')) {
      return res.status(503).json({
        error: 'Servizio Normattiva temporaneamente non disponibile. Riprova tra qualche minuto.',
        code: 'SERVICE_UNAVAILABLE',
      });
    }

    res.status(500).json({
      error: 'Errore durante la ricerca su Normattiva',
      code: 'SEARCH_ERROR',
      details: err.message,
    });
  }
}

/**
 * POST /api/v1/normattiva/import
 * Importa un decreto nel second brain dell'organizzazione.
 * Body: { urn: "urn:nir:...", organizationId: 1001 }
 * 
 * Pipeline:
 * 1. Download XML da Normattiva
 * 2. Conversione → Markdown
 * 3. Salva file docs/Normative/Decreti/{filename}.md
 * 4. Crea cartelle "Origine Esterna > Legislazione" in document_registry
 * 5. INSERT document_registry (doc_type='decreto')
 * 6. INSERT norm_document_sources (link al Markdown)
 * 7. Trigger chunking automatico
 * 8. Response: { success, documentId, chunkCount }
 */
async function importNormattiva(req, res) {
  try {
    const { urn, organizationId } = req.body;
    const user = req.user;

    if (!user || !user.organization_id) {
      return res.status(401).json({ 
        error: 'Autenticazione richiesta', 
        code: 'AUTH_REQUIRED' 
      });
    }

    // Solo superadmin o admin
    if (!['superadmin', 'admin'].includes(user.role)) {
      return res.status(403).json({
        error: 'Permesso negato: solo admin possono importare decreti',
        code: 'PERMISSION_DENIED',
      });
    }

    // Validazione
    if (!urn || !urn.startsWith('urn:nir:')) {
      return res.status(400).json({
        error: 'URN non valido',
        code: 'INVALID_URN',
      });
    }

    const targetOrgId = organizationId || user.organization_id;

    // Verifica che l'utente possa operare su targetOrgId
    if (user.role !== 'superadmin' && targetOrgId !== user.organization_id) {
      return res.status(403).json({
        error: 'Non puoi importare decreti per altre organizzazioni',
        code: 'PERMISSION_DENIED',
      });
    }

    logger.info(`[Normattiva] Import URN ${urn} per org ${targetOrgId}`);

    // STEP 1: Recupera metadati
    const metadata = await normattivaApi.getNormDetails(urn);
    logger.info(`[Normattiva] Metadati recuperati: ${metadata.title}`);

    // STEP 2: Download XML
    const xml = await normattivaApi.downloadNormXml(urn);
    logger.info(`[Normattiva] XML scaricato: ${xml.length} caratteri`);

    // STEP 3: Conversione → Markdown
    const markdown = normattivaToMarkdown.convertXmlToMarkdown(xml, metadata);
    const filename = normattivaToMarkdown.generateMarkdownFilename(urn, metadata.title);
    
    // Salva Markdown
    await fs.mkdir(DECRETI_FOLDER, { recursive: true });
    const markdownPath = path.join(DECRETI_FOLDER, filename);
    await fs.writeFile(markdownPath, markdown, 'utf8');
    logger.info(`[Normattiva] Markdown salvato: ${markdownPath}`);

    // STEP 4: Crea struttura cartelle in document_registry
    // "Documenti Origine Esterna" (root) > "Legislazione" (parent) > decreto
    
    // Root "Documenti Origine Esterna"
    let rootFolder = await query(
      `SELECT id FROM document_registry 
       WHERE organization_id = @orgId 
         AND doc_type = 'folder' 
         AND title = 'Documenti Origine Esterna'
         AND (parent_id IS NULL OR parent_id = 0)`,
      { orgId: targetOrgId }
    );

    let rootId;
    if (!rootFolder.recordset || rootFolder.recordset.length === 0) {
      const insertRoot = await query(
        `INSERT INTO document_registry 
          (organization_id, doc_type, title, status, created_at, updated_at)
         OUTPUT INSERTED.id
         VALUES (@orgId, 'folder', 'Documenti Origine Esterna', 'rilasciato', GETDATE(), GETDATE())`,
        { orgId: targetOrgId }
      );
      rootId = insertRoot.recordset[0].id;
      logger.info(`[Normattiva] Creata cartella root: Documenti Origine Esterna (id=${rootId})`);
    } else {
      rootId = rootFolder.recordset[0].id;
    }

    // Sottocartella "Legislazione"
    let legislazioneFolder = await query(
      `SELECT id FROM document_registry 
       WHERE organization_id = @orgId 
         AND doc_type = 'folder' 
         AND title = 'Legislazione'
         AND parent_id = @parentId`,
      { orgId: targetOrgId, parentId: rootId }
    );

    let legislazioneId;
    if (!legislazioneFolder.recordset || legislazioneFolder.recordset.length === 0) {
      const insertLegis = await query(
        `INSERT INTO document_registry 
          (organization_id, doc_type, title, parent_id, status, created_at, updated_at)
         OUTPUT INSERTED.id
         VALUES (@orgId, 'folder', 'Legislazione', @parentId, 'rilasciato', GETDATE(), GETDATE())`,
        { orgId: targetOrgId, parentId: rootId }
      );
      legislazioneId = insertLegis.recordset[0].id;
      logger.info(`[Normattiva] Creata cartella: Legislazione (id=${legislazioneId})`);
    } else {
      legislazioneId = legislazioneFolder.recordset[0].id;
    }

    // STEP 5: INSERT document_registry (decreto)
    const standardCode = generateStandardCode(urn);
    const typeSpecificData = JSON.stringify({
      urn,
      fonte: 'Normattiva',
      validity_check_url: `https://www.normattiva.it/uri-res/N2Ls?${encodeURIComponent(urn)}`,
      standard_code: standardCode,
      vigenza: metadata.vigenza,
      dataInizioVigore: metadata.dataInizioVigore,
      dataFineVigore: metadata.dataFineVigore,
    });

    const insertDoc = await query(
      `INSERT INTO document_registry 
        (organization_id, doc_type, title, doc_code, parent_id, status, 
         type_specific_data, created_at, updated_at, created_by)
       OUTPUT INSERTED.id
       VALUES (@orgId, 'decreto', @title, @docCode, @parentId, 'rilasciato',
               @typeData, GETDATE(), GETDATE(), @userId)`,
      {
        orgId: targetOrgId,
        title: metadata.title,
        docCode: standardCode,
        parentId: legislazioneId,
        typeData: typeSpecificData,
        userId: user.id,
      }
    );

    const documentId = insertDoc.recordset[0].id;
    logger.info(`[Normattiva] Documento creato: id=${documentId}`);

    // STEP 6: INSERT norm_document_sources
    const relativePath = `docs/Normative/Decreti/${filename}`;
    
    const insertSource = await query(
      `INSERT INTO norm_document_sources 
        (organization_id, document_id, standard_code, title, edition, 
         source_type, file_path, extracted_text, validity_status, created_at, updated_at)
       OUTPUT INSERTED.id
       VALUES (@orgId, @docId, @stdCode, @title, @edition, 
               'markdown', @filePath, @text, 'vigente', GETDATE(), GETDATE())`,
      {
        orgId: targetOrgId,
        docId: documentId,
        stdCode: standardCode,
        title: metadata.title,
        edition: metadata.dataInizioVigore ? `Vigore dal ${metadata.dataInizioVigore}` : null,
        filePath: relativePath,
        text: markdown, // Testo estratto per RAG
      }
    );

    const sourceId = insertSource.recordset[0].id;
    logger.info(`[Normattiva] Fonte normativa creata: id=${sourceId}`);

    // STEP 7: Chunking automatico
    let chunkCount = 0;
    try {
      await indexDocument(sourceId);
      
      const countRes = await query(
        'SELECT COUNT(*) as cnt FROM norm_chunks WHERE document_source_id = @id',
        { id: sourceId }
      );
      chunkCount = countRes.recordset[0].cnt;
      
      logger.info(`[Normattiva] Chunking completato: ${chunkCount} chunks`);
    } catch (chunkErr) {
      logger.error('[Normattiva] Errore chunking:', chunkErr.message);
      // Non bloccante — documento comunque creato
    }

    // STEP 8: Response
    res.json({
      success: true,
      data: {
        documentId,
        sourceId,
        chunkCount,
        markdownPath: relativePath,
        title: metadata.title,
        standardCode,
      },
    });
  } catch (err) {
    logger.error('[Normattiva] Errore import:', err.message);
    
    if (err.message.includes('Timeout') || err.message.includes('connessione')) {
      return res.status(503).json({
        error: 'Servizio Normattiva temporaneamente non disponibile. Riprova tra qualche minuto.',
        code: 'SERVICE_UNAVAILABLE',
      });
    }

    res.status(500).json({
      error: 'Errore durante importazione decreto',
      code: 'IMPORT_ERROR',
      details: err.message,
    });
  }
}

/**
 * Genera standard_code da URN (es. D_Lgs_81_08 da decreto.legislativo:2008;81).
 * @param {string} urn
 * @returns {string}
 */
function generateStandardCode(urn) {
  const match = urn.match(/:(decreto\.legislativo|decreto\.legge|legge):(\d+);(\d+)/i);
  
  if (!match) {
    // Fallback: usa URN grezzo
    return urn.replace(/[^a-zA-Z0-9_]/g, '_');
  }
  
  const [, tipo, anno, numero] = match;
  const annoShort = anno.substring(2); // 2008 → 08
  
  if (tipo === 'decreto.legislativo') {
    return `D_Lgs_${numero}_${annoShort}`;
  } else if (tipo === 'decreto.legge') {
    return `D_L_${numero}_${annoShort}`;
  } else if (tipo === 'legge') {
    return `Legge_${numero}_${annoShort}`;
  }
  
  return `Decreto_${numero}_${annoShort}`;
}

module.exports = {
  searchNormattiva,
  importNormattiva,
};
