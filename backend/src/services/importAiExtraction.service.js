/**
 * Estrazione strutturata da testo documento tramite OpenAI (JSON mode).
 * Passo singolo: base per pipeline piu' avanzata (staging, tool-use, RAG).
 */

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const MAX_INPUT_CHARS = Number(process.env.OPENAI_IMPORT_MAX_CHARS) || 20000;
const DEFAULT_MODEL = process.env.OPENAI_IMPORT_MODEL || 'gpt-4o-mini';
const REQUEST_TIMEOUT_MS = Number(process.env.OPENAI_IMPORT_TIMEOUT_MS) || 90000;

function stripCodeFences(raw) {
    let s = String(raw || '').trim();
    if (s.startsWith('```')) {
        s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    }
    return s.trim();
}

/**
 * @param {object} params
 * @param {string} params.text
 * @param {string|null} params.documentTypeHint
 * @returns {Promise<{ model: string, data: object, raw_content: string }>}
 */
async function extractStructuredFromText({ text, documentTypeHint }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !String(apiKey).trim()) {
        const e = new Error('Chiave API OpenAI non configurata sul server (OPENAI_API_KEY).');
        e.code = 'AI_NOT_CONFIGURED';
        throw e;
    }

    const model = DEFAULT_MODEL;
    const bodyText = String(text || '').trim();
    if (!bodyText) {
        const e = new Error('Testo sorgente vuoto: estrarre prima il PDF.');
        e.code = 'EMPTY_SOURCE_TEXT';
        throw e;
    }
    const truncated = bodyText.length > MAX_INPUT_CHARS
        ? `${bodyText.slice(0, MAX_INPUT_CHARS)}\n\n[... testo troncato per limite ${MAX_INPUT_CHARS} caratteri ...]`
        : bodyText;

    const system = `Sei un assistente per documenti tecnici e qualita' (ISO 9001, saldatura, certificazioni).
Analizza il testo estratto da un PDF (puo' contenere errori di OCR/strato testo).
Rispondi SOLO con un oggetto JSON valido (nessun testo fuori dal JSON) con questa forma:
{
  "title": string|null,
  "document_type_guess": string|null,
  "summary": string|null,
  "key_values": { "chiave breve": "valore" },
  "dates": [ { "raw": string, "iso_date": string|null } ],
  "extraction_confidence": number,
  "warnings": string[]
}
Regole:
- Chiavi e stringhe in italiano dove ha senso.
- extraction_confidence: intero 0-100 (quanto il testo sembra completo e coerente).
- warnings: elenco problemi (testo frammentario, dati mancanti, ambiguita').
- Non inventare numeri di certificato o date: se non presenti, null o omesso.
- document_type_guess: una tra patentino_saldatore, qualifica_operatore, cert_ndt, wps, wpqr, dichiarazione_ce, cert_taratura, altro — solo se plausibile.`;

    const user = `Tipo documento indicato dall'operatore (puo' essere "non specificato"): ${documentTypeHint || 'non specificato'}

Testo documento:
---
${truncated}
---`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
        response = await fetch(OPENAI_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model,
                temperature: 0.2,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
            }),
            signal: controller.signal,
        });
    } catch (err) {
        clearTimeout(timer);
        const e = new Error(err.name === 'AbortError' ? 'Timeout richiesta OpenAI.' : String(err.message || err));
        e.code = 'AI_REQUEST_FAILED';
        throw e;
    }
    clearTimeout(timer);

    const rawJson = await response.json().catch(() => ({}));
    if (!response.ok) {
        const msg = rawJson?.error?.message || response.statusText || 'Errore OpenAI';
        const e = new Error(msg);
        e.code = 'AI_UPSTREAM_ERROR';
        e.status = response.status;
        throw e;
    }

    const content = rawJson?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
        const e = new Error('Risposta OpenAI senza contenuto testuale.');
        e.code = 'AI_EMPTY_RESPONSE';
        throw e;
    }

    let data;
    try {
        data = JSON.parse(stripCodeFences(content));
    } catch (parseErr) {
        const e = new Error('JSON dalla AI non valido.');
        e.code = 'AI_INVALID_JSON';
        throw e;
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        const e = new Error('Formato estrazione non valido.');
        e.code = 'AI_BAD_SHAPE';
        throw e;
    }

    return {
        model,
        data,
        raw_content: content,
    };
}

module.exports = {
    extractStructuredFromText,
    stripCodeFences,
    MAX_INPUT_CHARS,
};
