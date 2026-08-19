/**
 * VLM locale sulle tavole (Multimodal RAG MR-5).
 *
 * Ollama qwen2.5vl: commenta il ritaglio e cita le tavole CLIP.
 * I byte PNG non vanno a Gemini / aiProviderAdapter.
 * Ollama assente → reply null, niente throw (MR-4 resta usabile).
 * L1 mocka fetch: niente download pesi in CI.
 */

const fs = require('fs').promises;
const logger = require('../utils/logger');

const DEFAULT_HOST = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'qwen2.5vl:7b';
const DISCLAIMER =
  'Questa lettura non certifica la copertura di WPQR, patentino o WPS. Va verificata sui documenti del SGQ.';

function ollamaHost() {
  return String(process.env.OLLAMA_HOST || DEFAULT_HOST).replace(/\/$/, '');
}

function vlmModel() {
  const raw = (process.env.FIGURE_VLM_MODEL || '').trim();
  return raw || DEFAULT_MODEL;
}

function toBase64(buf) {
  if (!buf) return null;
  if (Buffer.isBuffer(buf)) return buf.toString('base64');
  if (typeof buf === 'string' && buf.length > 0) return buf;
  return null;
}

function queryImageBase64(queryImage) {
  if (!queryImage) return null;
  if (queryImage.buffer) return toBase64(queryImage.buffer);
  if (Buffer.isBuffer(queryImage)) return queryImage.toString('base64');
  return null;
}

function buildPrompt(figures) {
  const rows = (Array.isArray(figures) ? figures : [])
    .slice(0, 5)
    .map((f, i) => {
      const page = f.page != null ? f.page : '?';
      const cap = f.caption ? String(f.caption).slice(0, 180) : 'senza didascalia';
      return `${i + 1}. pagina ${page} — ${cap}`;
    });
  const list = rows.length ? rows.join('\n') : '(nessuna tavola recuperata)';
  return [
    "Sei l'assistente visivo del sistema di gestione qualità.",
    'Descrivi il ritaglio del disegno e confrontalo con le tavole normative elencate.',
    "Cita pagina e didascalia. Non dire se l'azienda è qualificata per il giunto.",
    'Non certificare conformità, copertura WPQR o patentino.',
    'Rispondi in italiano, al massimo 8 righe.',
    '',
    'Tavole recuperate:',
    list,
  ].join('\n');
}

function withDisclaimer(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (t.includes('non certifica')) return t;
  return `${t}\n\n${DISCLAIMER}`;
}

async function extraFigureImages(figures) {
  const out = [];
  const list = Array.isArray(figures) ? figures.slice(0, 2) : [];
  for (const f of list) {
    const p = f && (f.path || f.png_path);
    if (!p || typeof p !== 'string') continue;
    try {
      const buf = await fs.readFile(p);
      if (buf && buf.length > 32 && buf.length < 1.5 * 1024 * 1024) {
        out.push(buf.toString('base64'));
      }
    } catch {
      /* file assente: si cita solo in testo */
    }
  }
  return out;
}

/**
 * @param {object} opts
 * @param {object} [opts.queryImage] file multer o Buffer
 * @param {Array<object>} [opts.figures]
 * @param {Function} [opts.fetchImpl]
 * @returns {Promise<{ reply: string|null, model: string, unavailable: boolean }>}
 */
async function describeCropAgainstFigures(opts = {}) {
  const model = vlmModel();
  const queryB64 = queryImageBase64(opts.queryImage);
  if (!queryB64) {
    return { reply: null, model, unavailable: false };
  }

  const figures = Array.isArray(opts.figures) ? opts.figures : [];
  const images = [queryB64, ...(await extraFigureImages(figures))];
  const fetchFn = opts.fetchImpl || global.fetch;
  if (typeof fetchFn !== 'function') {
    logger.warn('[figureVlm] fetch non disponibile, salto VLM');
    return { reply: null, model, unavailable: true };
  }

  const url = `${ollamaHost()}/api/chat`;
  const body = {
    model,
    stream: false,
    messages: [
      {
        role: 'user',
        content: buildPrompt(figures),
        images,
      },
    ],
  };

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    let res;
    try {
      res = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
    if (!res || !res.ok) {
      logger.warn('[figureVlm] Ollama HTTP %s', res && res.status);
      return { reply: null, model, unavailable: true };
    }
    const data = await res.json();
    const raw =
      (data && data.message && data.message.content) ||
      (data && data.response) ||
      '';
    return { reply: withDisclaimer(raw), model, unavailable: false };
  } catch (err) {
    logger.warn('[figureVlm] Ollama non raggiungibile: %s', err.message);
    return { reply: null, model, unavailable: true };
  }
}

module.exports = {
  DEFAULT_MODEL,
  DISCLAIMER,
  describeCropAgainstFigures,
  buildPrompt,
  withDisclaimer,
};
