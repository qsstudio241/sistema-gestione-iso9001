/**
 * questionAssistantPrompts.service.js — Prompt specializzati per AI Assistant quesiti checklist
 *
 * Modalità:
 * - suggest_questions (Fase 1): come porre la domanda in campo (niente allegati, niente anagrafica)
 * - conformity_assessment / evidence_gap / norm_interpretation / draft_notes / om_opportunity
 */

const logger = require('../utils/logger');

const QUESTION_ASSISTANT_MODES = [
  'suggest_questions',
  'conformity_assessment',
  'evidence_gap',
  'norm_interpretation',
  'draft_notes',
  'om_opportunity',
];

/**
 * Norma assente (checklist custom, campo vuoto) — non è un codice RAG valido.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
function normalizeAssistantStandardCode(raw) {
  const code = String(raw || '').trim();
  if (!code || code.toLowerCase() === 'custom') return '';
  return code.slice(0, 80);
}

/**
 * Solo i campi ammessi verso il modello (niente P.IVA, azienda, allegati, id audit).
 * @param {object} question
 * @param {string} [notes]
 */
function sanitizeQuestionContext(question = {}, notes = '') {
  const status = question.currentStatus || question.status || '';
  return {
    clauseRef: String(question.clauseRef || '').trim().slice(0, 80),
    text: String(question.text || '').trim().slice(0, 2000),
    standardCode: normalizeAssistantStandardCode(question.standardCode),
    standardLabel: String(question.standardLabel || '').trim().slice(0, 80),
    currentStatus: String(status || '').trim().slice(0, 20),
    notes: String(notes || question.notes || '').trim().slice(0, 2000),
  };
}

function formatStatusForPrompt(status) {
  const s = String(status || '').trim();
  if (!s) return 'non ancora risposto';
  return s;
}

/**
 * Costruisce system prompt + user message per la modalità richiesta
 * @param {string} mode
 * @param {Object} context - { question, notes, attachments, ragContext, hasOfficialSource }
 * @returns {Array<Object>} [ { role, content }, ... ] per chat API
 */
function buildPromptForMode(mode, context) {
  const {
    question = {},
    notes = '',
    attachments = [],
    ragContext = '',
    hasOfficialSource = false,
  } = context;

  const safe = sanitizeQuestionContext(question, notes);
  const clauseRef = safe.clauseRef || 'non specificato';
  const questionText = safe.text || '';
  const attachmentList = mode === 'suggest_questions'
    ? 'Nessuno (non analizzare file in questa fase)'
    : (attachments.map((a) => a.name || 'allegato').join(', ') || 'Nessuno');

  // Disclaimer fonte
  const sourceDisclaimer = hasOfficialSource
    ? 'Hai accesso al testo ufficiale della norma. Basa la tua valutazione SOLO su questo documento.'
    : 'IMPORTANTE: Il testo ufficiale della norma NON è disponibile. Fornisci una valutazione basata su conoscenze generali, ma AVVISA ESPLICITAMENTE l\'utente di questa limitazione.';

  const ragBlock = ragContext
    ? `\n\nContesto normativo ufficiale:\n${ragContext}`
    : '\n\nContesto normativo ufficiale: Non disponibile';

  switch (mode) {
    case 'suggest_questions': {
      const norma = safe.standardLabel || safe.standardCode || 'non indicata';
      return [
        {
          role: 'system',
          content: `Sei un assistente per auditor ISO. Rispondi in italiano semplice e breve (massimo 180 parole).

${sourceDisclaimer}
${ragBlock}

Compito: aiuta l'auditor a CAPIRE il punto e a PORRE le domande giuste in campo.
NON certificare la conformità. NON proporre un esito C/NC/OSS/OM al posto dell'auditor.
NON chiedere e NON usare dati anagrafici del cliente (nome azienda, P.IVA, indirizzo, persone).
NON analizzare allegati.

Formato:
1. Due o tre frasi su cosa verifica questo punto (norma + clausola).
2. Se c'è già un esito o delle note, una riga su cosa è già segnato.
3. Elenco di 3-5 domande concrete da fare in campo per verificare la conformità.

Niente burocratese. Niente elenchi lunghi.`,
        },
        {
          role: 'user',
          content: `**Norma:** ${norma}
**Clausola:** §${clauseRef}
**Testo della domanda:** ${questionText || '(testo non disponibile)'}
**Stato risposta:** ${formatStatusForPrompt(safe.currentStatus)}
**Note auditor:** ${safe.notes || 'Nessuna nota'}

Suggerisci come porre la domanda per verificare la conformità.`,
        },
      ];
    }

    case 'conformity_assessment':
      return [
        {
          role: 'system',
          content: `Sei un auditor ISO esperto. Analizza il quesito della checklist, le note dell'auditor e gli allegati forniti.

${sourceDisclaimer}
${ragBlock}

Suggerisci un esito tra:
- **C** (Conforme): requisito pienamente soddisfatto con evidenze documentali adeguate
- **NC** (Non Conforme): requisito non soddisfatto, serve azione correttiva immediata
- **OSS** (Osservazione): requisito sostanzialmente soddisfatto ma con margini di miglioramento
- **OM** (Opportunità Miglioramento): requisito soddisfatto ma con possibilità di ottimizzazione

Formato risposta:
**Esito suggerito:** [C/NC/OSS/OM]
**Motivazione:** [breve spiegazione basata sulle evidenze — max 150 parole]
**Gap evidenze:** [cosa manca se applicabile, oppure "Nessun gap" se evidenze sufficienti]

Sii rigoroso ma costruttivo. Se le evidenze sono insufficienti per una valutazione, suggerisci NC o OSS con indicazione chiara di cosa serve.`,
        },
        {
          role: 'user',
          content: `**Quesito §${clauseRef}:** ${questionText}

**Note auditor:** ${notes || 'Nessuna nota presente'}

**Allegati:** ${attachmentList}

Valuta la conformità basandoti sulle evidenze disponibili.`,
        },
      ];

    case 'evidence_gap':
      return [
        {
          role: 'system',
          content: `Sei un auditor ISO esperto. Identifica quali prove documentali mancano per dimostrare piena conformità al requisito §${clauseRef}.

${ragBlock}

Elenca i documenti/registrazioni necessari ma non ancora forniti. Sii specifico e concreto:
- Nome tipo documento (es. "Verbale riunione direzione 2026", "Matrice competenze aggiornata")
- Perché è necessario per §${clauseRef}
- Priorità: [Alta/Media/Bassa]

Formato risposta:
**Documenti mancanti:**
1. [Nome documento] — [Motivazione] — Priorità: [Alta/Media/Bassa]
2. ...

Se le evidenze attuali sono sufficienti, scrivi: "Nessun documento mancante — evidenze sufficienti."`,
        },
        {
          role: 'user',
          content: `**Quesito §${clauseRef}:** ${questionText}

**Evidenze attuali:**
- Note: ${notes || 'Nessuna'}
- Allegati: ${attachmentList}

Identifica gap documentali per piena conformità.`,
        },
      ];

    case 'norm_interpretation':
      return [
        {
          role: 'system',
          content: `Sei un esperto ISO 9001. Spiega in linguaggio operativo cosa richiede concretamente il §${clauseRef}.

${ragBlock}

Fornisci:
1. **Cosa significa in pratica** per un'azienda (max 100 parole)
2. **Esempi concreti** di applicazione (2-3 esempi)
3. **Errori comuni** da evitare (2-3 punti)

Usa un linguaggio chiaro ed evita burocratese. Rispondi come se parlassi a un responsabile qualità operativo, non a un legale.`,
        },
        {
          role: 'user',
          content: `**Clausola:** §${clauseRef}
**Quesito:** ${questionText}

Spiega cosa si aspetta l'ente di certificazione quando verifica questo requisito.`,
        },
      ];

    case 'draft_notes':
      return [
        {
          role: 'system',
          content: `Sei un auditor ISO esperto. Genera una bozza di note audit per il §${clauseRef} basandoti sulle evidenze raccolte.

${ragBlock}

Usa terminologia ISO 19011 (audit, evidenza oggettiva, conformità). Sii conciso (max 200 parole).

Struttura:
- Cosa è stato verificato
- Evidenze esaminate (riferimenti precisi: numeri doc, date, nomi)
- Esito sintetico

Se le evidenze sono insufficienti, indica chiaramente cosa manca invece di scrivere note incomplete.`,
        },
        {
          role: 'user',
          content: `**Quesito §${clauseRef}:** ${questionText}

**Note attuali:** ${notes || 'Nessuna nota presente'}
**Allegati:** ${attachmentList}

Genera bozza note audit professionali.`,
        },
      ];

    case 'om_opportunity':
      return [
        {
          role: 'system',
          content: `Anche se il requisito §${clauseRef} è soddisfatto, suggerisci miglioramenti incrementali possibili.

${ragBlock}

**Contesto attuale:** ${notes || 'Non specificato'}

Focus su:
- Efficienza operativa (risparmio tempo/risorse)
- Digitalizzazione (ridurre carta, automatizzare)
- Best practice settore
- Riduzione rischi operativi

Sii pratico, fattibile e specifico. Evita generalismi tipo "migliorare la comunicazione".

Formato risposta:
**Opportunità identificate:**
1. [Descrizione breve] — Beneficio: [cosa si ottiene] — Complessità: [Bassa/Media/Alta]
2. ...

Se non ci sono opportunità realistiche, scrivi: "Nessuna opportunità di miglioramento significativa identificata."`,
        },
        {
          role: 'user',
          content: `**Quesito §${clauseRef}:** ${questionText}
**Stato attuale:** ${notes || 'Requisito soddisfatto'}

Suggerisci miglioramenti incrementali possibili.`,
        },
      ];

    default:
      logger.warn(`[questionAssistantPrompts] Mode sconosciuto: ${mode}, uso conformity_assessment`);
      return buildPromptForMode('conformity_assessment', context);
  }
}

/**
 * Estrae l'esito suggerito dalla risposta AI (C/NC/OSS/OM)
 * @param {string} aiResponse
 * @returns {string|null} 'C', 'NC', 'OSS', 'OM' o null se non trovato
 */
function extractSuggestedStatus(aiResponse) {
  const text = String(aiResponse || '');
  
  // Pattern: **Esito suggerito:** NC
  const match = text.match(/\*\*Esito\s+suggerito:\*\*\s*(C|NC|OSS|OM)/i);
  if (match) {
    return match[1].toUpperCase();
  }

  // Fallback: cerca prima occorrenza isolata
  const fallback = text.match(/\b(NC|OSS|OM)\b/);
  if (fallback) {
    return fallback[1].toUpperCase();
  }

  // Caso C isolato (attenzione: evita false positive con parole comuni)
  if (text.match(/\b(Conforme|esito\s*:\s*C)\b/i)) {
    return 'C';
  }

  return null;
}

module.exports = {
  QUESTION_ASSISTANT_MODES,
  sanitizeQuestionContext,
  normalizeAssistantStandardCode,
  formatStatusForPrompt,
  buildPromptForMode,
  extractSuggestedStatus,
};
