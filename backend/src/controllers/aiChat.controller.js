/**
 * aiChat.controller.js — Assistente AI globale SGQ
 *
 * POST /ai/chat  — risponde a domande libere usando il contesto indicizzato
 * POST /ai/reindex — re-indicizza tutti i dati per l'organizzazione (admin)
 */

const logger = require('../utils/logger');
const { chat, getActiveProvider } = require('../services/aiProviderAdapter');
const { searchKnowledge, indexAllEntities } = require('../services/knowledgeIndexer.service');

const SYSTEM_PROMPT = `Sei l'assistente AI del Sistema di Gestione Qualità ISO 9001 di questa organizzazione.
Rispondi in italiano in modo chiaro, professionale e sintetico.
Basati ESCLUSIVAMENTE sui dati forniti nel contesto. Se non hai informazioni sufficienti per rispondere, dillo chiaramente.
Non inventare dati, numeri o riferimenti non presenti nel contesto.
Quando citi dati specifici (audit, NC, documenti, rischi), indica il riferimento (numero, codice, data) per permettere all'utente di verificare.
Formatta le risposte in modo leggibile: usa elenchi puntati per liste, grassetto per i punti chiave.`;

/**
 * POST /ai/chat
 * Body: { message: string }
 */
async function aiChat(req, res) {
  try {
    const provider = getActiveProvider();
    if (!provider) {
      return res.status(503).json({
        error: 'Nessun provider AI configurato.',
        code: 'AI_NOT_CONFIGURED',
      });
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Il campo "message" è obbligatorio.',
        code: 'MISSING_PARAMS',
      });
    }

    const organizationId = req.user.organization_id;

    // Ricerca contesto semantico
    let contextChunks = [];
    try {
      contextChunks = await searchKnowledge(message.trim(), organizationId, { topK: 15, minScore: 0.2 });
    } catch (err) {
      logger.warn('[AI_CHAT] searchKnowledge failed, proceeding without context:', err.message);
    }

    // Costruisci il prompt utente con contesto
    let contextBlock = '';
    if (contextChunks.length > 0) {
      const contextLines = contextChunks.map((c, i) =>
        `[${i + 1}] (${c.entity_type}, score: ${c.score.toFixed(2)})\n${c.chunk_text}`
      );
      contextBlock = `\n\n--- CONTESTO DALL'ORGANIZZAZIONE ---\n${contextLines.join('\n\n')}\n--- FINE CONTESTO ---\n\n`;
    } else {
      contextBlock = '\n\n[Nessun dato indicizzato trovato per questa domanda. Rispondi indicando che non ci sono dati disponibili e suggerisci di eseguire la re-indicizzazione.]\n\n';
    }

    const userPrompt = `${contextBlock}Domanda dell'utente: ${message.trim()}`;

    const result = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, timeout: 90000 }
    );

    res.json({
      reply: result.content,
      contextUsed: contextChunks.length,
      _aiMeta: {
        provider,
        model: result.model,
        tokens: result.tokens,
        cost: result.cost,
      },
    });
  } catch (err) {
    logger.error('[AI_CHAT] Error:', err.message);
    const status = err.code === 'AI_NOT_CONFIGURED' ? 503 : err.status || 500;
    res.status(status).json({
      error: err.message,
      code: err.code || 'AI_CHAT_ERROR',
    });
  }
}

/**
 * POST /ai/reindex
 * Avvia la re-indicizzazione di tutti i dati SGQ per l'organizzazione.
 */
async function aiReindex(req, res) {
  try {
    const organizationId = req.user.organization_id;
    logger.info(`[AI_REINDEX] Manual reindex requested by user ${req.user.user_id} for org ${organizationId}`);

    const totalChunks = await indexAllEntities(organizationId);

    res.json({
      success: true,
      message: `Indicizzazione completata: ${totalChunks} chunk generati.`,
      totalChunks,
    });
  } catch (err) {
    logger.error('[AI_REINDEX] Error:', err.message);
    res.status(500).json({
      error: 'Errore durante la re-indicizzazione.',
      code: 'REINDEX_ERROR',
    });
  }
}

module.exports = { aiChat, aiReindex };
