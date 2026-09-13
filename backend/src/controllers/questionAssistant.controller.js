/**
 * questionAssistant.controller.js — AI Assistant contestuale per quesiti checklist
 * 
 * POST /api/v1/ai/question-assistant
 * 
 * Pipeline:
 * 1. Check fonte normativa disponibile (document_registry + norm_chunks)
 * 2. RAG retrieval se fonte presente
 * 3. Text extraction allegati (se OCR non già disponibile)
 * 4. Costruzione prompt specializzato per mode
 * 5. Chiamata AI
 * 6. Log usage + notifica admin (se fonte mancante)
 * 7. Response con disclaimer fonte
 */

const logger = require('../utils/logger');
const { query } = require('../config/database');
const { chat } = require('../services/aiProviderAdapter');
const { checkNormSourceAvailability } = require('./aiChat.controller');
const { buildPromptForMode, extractSuggestedStatus } = require('../services/questionAssistantPrompts.service');
const { extractDocumentText } = require('../services/documentTextExtractor.service');
const { searchSimilar } = require('../services/normChunker.service');
const { hasLicensedModule } = require('../services/moduleLicense.service');

const MAX_ATTACHMENTS = 8;
const MAX_EXTRACT_CHARS = 1800;

/**
 * Verifica se allegato è estraibile (PDF/Word/TXT)
 */
function isTextExtractable(attachment) {
  const name = String(attachment.name || '').toLowerCase();
  const type = String(attachment.type || '').toLowerCase();
  return (
    name.endsWith('.pdf') ||
    name.endsWith('.docx') ||
    name.endsWith('.txt') ||
    type === 'application/pdf' ||
    type.includes('wordprocessingml') ||
    type.startsWith('text/')
  );
}

/**
 * Costruisce disclaimer fonte per UI
 */
function buildSourceDisclaimer(normSource) {
  if (!normSource || !normSource.has_chunks) {
    return '⚠️ Risposta basata su conoscenze generali dell\'AI. Per conformità certificata, carica la norma ufficiale in Libreria.';
  }

  const editionText = normSource.edition ? ` (${normSource.edition})` : '';
  const dateText = normSource.upload_date 
    ? ` — caricata il ${new Date(normSource.upload_date).toLocaleDateString('it-IT')}`
    : '';

  return `✅ Fonte: ${normSource.title}${editionText}${dateText}`;
}

/**
 * Estrae citazioni dalla risposta AI (solo se fonte ufficiale)
 */
function extractCitations(aiResponse, normSource) {
  if (!normSource || !normSource.has_chunks) {
    return [];
  }

  const text = String(aiResponse || '');
  const citations = [];

  // Pattern: §X.Y o §X.Y.Z
  const matches = text.matchAll(/§\s*(\d+\.\d+(?:\.\d+)?)/g);
  for (const match of matches) {
    const clause = match[1];
    citations.push({
      text: `§${clause}`,
      source: normSource.title || 'Norma ufficiale',
      page: null, // TODO: recuperare da norm_chunks se disponibile
    });
  }

  return citations;
}

/**
 * Log utilizzo AI senza fonte ufficiale
 */
async function logAiUsageWithoutSource(organizationId, userId, standardCode) {
  try {
    await query(
      `INSERT INTO ai_assistant_usage 
        (organization_id, user_id, feature, standard_code, has_source, logged_at)
       VALUES (@orgId, @userId, 'question_assistant', @stdCode, 0, GETDATE())`,
      { orgId: organizationId, userId, stdCode: standardCode }
    );
  } catch (err) {
    logger.error('[logAiUsageWithoutSource] Errore log:', err);
  }
}

/**
 * Crea notifica admin se fonte mancante (throttling 1/giorno per org+standard)
 */
async function maybeNotifyAdminNoSource(organizationId, standardCode) {
  try {
    // Check se già notificato oggi
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const checkRes = await query(
      `SELECT id FROM ai_assistant_notifications
       WHERE organization_id = @orgId 
         AND standard_code = @stdCode 
         AND notification_date = @today`,
      { orgId: organizationId, stdCode: standardCode, today }
    );

    if (checkRes.recordset && checkRes.recordset.length > 0) {
      // Già notificato oggi
      return;
    }

    // Registra notifica
    await query(
      `INSERT INTO ai_assistant_notifications 
        (organization_id, standard_code, notification_date, created_at)
       VALUES (@orgId, @stdCode, @today, GETDATE())`,
      { orgId: organizationId, stdCode: standardCode, today }
    );

    // Crea alert per admin
    const standardLabel = standardCode.replace(/_/g, ' ');
    await query(
      `INSERT INTO alerts 
        (organization_id, alert_type, severity, title, message, related_entity_type, action_url, created_at)
       VALUES (@orgId, 'ai_usage_no_source', 'medium', @title, @message, 'library', @actionUrl, GETDATE())`,
      {
        orgId: organizationId,
        title: `AI usata senza norma ufficiale (${standardLabel})`,
        message: `Gli utenti stanno chiedendo all'AI assistenza su ${standardLabel} senza che la norma ufficiale sia caricata in Libreria. Per garantire conformità certificata, carica il PDF della norma.`,
        actionUrl: `/library?standard=${standardCode}`,
      }
    );

    logger.info(`[maybeNotifyAdminNoSource] Alert creato per org ${organizationId}, standard ${standardCode}`);
  } catch (err) {
    logger.error('[maybeNotifyAdminNoSource] Errore notifica:', err);
  }
}

/**
 * POST /api/v1/ai/question-assistant
 * Body: { mode, question, attachments[], auditContext }
 */
async function handleQuestionAssistant(req, res) {
  const { mode, question, attachments = [], auditContext = {} } = req.body;
  const user = req.user;

  if (!user || !user.organization_id) {
    return res.status(401).json({ error: 'Autenticazione richiesta', code: 'AUTH_REQUIRED' });
  }

  // Check licenza ai_chat
  if (!hasLicensedModule(user, 'ai_chat')) {
    return res.status(403).json({
      error: 'Licenza AI Chat non attiva per questa organizzazione',
      code: 'LICENSE_AI_CHAT_REQUIRED',
    });
  }

  // Validazione input
  if (!mode || !question || !question.text) {
    return res.status(400).json({
      error: 'Parametri mancanti: mode, question.text richiesti',
      code: 'INVALID_PARAMS',
    });
  }

  const validModes = ['conformity_assessment', 'evidence_gap', 'norm_interpretation', 'draft_notes', 'om_opportunity'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({
      error: `Mode non valido. Valori ammessi: ${validModes.join(', ')}`,
      code: 'INVALID_MODE',
    });
  }

  const organizationId = user.organization_id;
  const userId = user.id;
  const standardCode = question.standardCode || 'ISO_9001_2015'; // Default se non specificato
  const notes = question.notes || '';

  try {
    // STEP 1: Check fonte normativa disponibile
    logger.info(`[questionAssistant] Org ${organizationId}, mode=${mode}, standard=${standardCode}`);
    const normSource = await checkNormSourceAvailability(standardCode, organizationId);
    const hasOfficialSource = normSource && normSource.has_chunks;

    // STEP 2: RAG retrieval (se fonte disponibile)
    let ragContext = '';
    if (hasOfficialSource) {
      try {
        const queryText = `${question.text} ${notes}`.trim();
        const chunks = await searchSimilar(queryText, organizationId, {
          standardCodes: [standardCode],
          topK: 5,
          minScore: 0.3,
        });

        if (chunks && chunks.length > 0) {
          ragContext = chunks.map((c) => c.chunk_text || '').join('\n\n');
          logger.info(`[questionAssistant] RAG: ${chunks.length} chunks trovati`);
        }
      } catch (ragErr) {
        logger.error('[questionAssistant] Errore RAG retrieval:', ragErr);
        // Non bloccante — procedi senza RAG
      }
    }

    // STEP 3: Text extraction allegati (se non già presente extractedText)
    const processedAttachments = [];
    const attachmentsToProcess = (attachments || []).slice(0, MAX_ATTACHMENTS);

    for (const att of attachmentsToProcess) {
      const processed = { ...att };

      if (!processed.extractedText && isTextExtractable(att)) {
        try {
          // Assume att.storagePath esista o costruisci path da att.id
          // Per semplicità: se att.extractedText manca, skippiamo (frontend può precalcolare)
          // In produzione: recuperare path da DB attachment e usare extractDocumentText
          logger.info(`[questionAssistant] Allegato ${att.name} — text extraction skippato (pre-calcolo frontend)`);
        } catch (extractErr) {
          logger.warn(`[questionAssistant] Errore estrazione ${att.name}:`, extractErr.message);
        }
      }

      processedAttachments.push(processed);
    }

    // STEP 4: Costruzione prompt specializzato
    const promptContext = {
      question,
      notes,
      attachments: processedAttachments,
      ragContext,
      hasOfficialSource,
    };

    const messages = buildPromptForMode(mode, promptContext);

    // STEP 5: Chiamata AI
    logger.info(`[questionAssistant] Chiamata AI con ${messages.length} messaggi`);
    const aiResponse = await chat(messages, { temperature: 0.3 });

    // STEP 6: Log usage + notifica (se fonte mancante)
    if (!hasOfficialSource) {
      await logAiUsageWithoutSource(organizationId, userId, standardCode);
      await maybeNotifyAdminNoSource(organizationId, standardCode);
    }

    // STEP 7: Response con disclaimer
    const sourceDisclaimer = buildSourceDisclaimer(normSource);
    const citations = extractCitations(aiResponse, normSource);
    const suggestedStatus = mode === 'conformity_assessment' ? extractSuggestedStatus(aiResponse) : null;

    res.json({
      success: true,
      data: {
        answer: aiResponse,
        sourceDisclaimer,
        hasOfficialSource,
        citations,
        suggestedStatus,
        mode,
      },
    });
  } catch (err) {
    logger.error('[questionAssistant] Errore:', err);
    res.status(500).json({
      error: 'Errore durante elaborazione richiesta AI',
      code: 'AI_PROCESSING_ERROR',
      details: err.message,
    });
  }
}

module.exports = {
  handleQuestionAssistant,
};
