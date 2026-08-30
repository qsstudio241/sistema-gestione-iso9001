'use strict';

/**
 * Estrae e rimuove il blocco macchina SGQ_SOURCE_GAPS dalla risposta Gemini.
 * Formato atteso:
 * <<<SGQ_SOURCE_GAPS
 * [{ "code": "...", "title": "...", "reason": "...", "qualityNotes": "...", "closurePath": "platform"|"tenant" }]
 * SGQ_SOURCE_GAPS>>>
 */

const BLOCK_RE =
  /<<<SGQ_SOURCE_GAPS\s*([\s\S]*?)\s*SGQ_SOURCE_GAPS>>>/i;

function normalizeGap(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const code = String(raw.code || raw.source_code || '').trim();
  if (!code) return null;
  const closurePath =
    raw.closurePath === 'tenant' || raw.closure_path === 'tenant'
      ? 'tenant'
      : 'platform';
  return {
    code,
    title: String(raw.title || raw.source_title || '').trim() || null,
    reason: String(raw.reason || '').trim() || null,
    qualityNotes: String(raw.qualityNotes || raw.quality_notes || '').trim() || null,
    closurePath,
  };
}

/**
 * @param {string} reply
 * @returns {{ cleanReply: string, gaps: Array<object> }}
 */
function parseSourceGapsFromReply(reply) {
  const text = String(reply || '');
  const match = text.match(BLOCK_RE);
  if (!match) {
    return { cleanReply: text.trim(), gaps: [] };
  }
  let gaps = [];
  try {
    const parsed = JSON.parse(String(match[1] || '').trim());
    const list = Array.isArray(parsed) ? parsed : [parsed];
    gaps = list.map(normalizeGap).filter(Boolean);
  } catch {
    gaps = [];
  }
  const cleanReply = text.replace(BLOCK_RE, '').trim();
  return { cleanReply, gaps };
}

/**
 * Istruzioni da aggiungere al system prompt (LG-1).
 */
const SOURCE_GAPS_PROMPT_BLOCK = `
--- GAP FONTI (OBBLIGATORIO SE APPLICABILE) ---
Se per rispondere in modo accurato manca una norma, un libro o altra fonte di know-how
di piattaforma (non inventare soglie o clausole), DEVI:
1) Spiegarlo chiaramente all'utente in italiano, indicando dove nella risposta servirebbe.
2) Alla fine della risposta aggiungere ESATTAMENTE questo blocco macchina (l'interfaccia lo nasconde):

<<<SGQ_SOURCE_GAPS
[{"code":"ISO xxxx:yyyy","title":"titolo breve","reason":"per quale parte della risposta serve","qualityNotes":"dubbi di qualit\u00e0 o secondo passaggio necessario, se ci sono","closurePath":"platform"}]
SGQ_SOURCE_GAPS>>>

closurePath = "platform" se serve digitalizzazione del know-how prodotto (superadmin);
"tenant" se basta che l'organizzazione carichi un proprio documento in Libreria.
Se non ci sono gap, NON aggiungere il blocco.
--- FINE GAP FONTI ---`;

module.exports = {
  parseSourceGapsFromReply,
  normalizeGap,
  SOURCE_GAPS_PROMPT_BLOCK,
  BLOCK_RE,
};
