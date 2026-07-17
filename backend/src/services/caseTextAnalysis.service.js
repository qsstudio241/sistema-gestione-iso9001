/**
 * caseTextAnalysis.service.js
 * Estrazione requisiti commerciali/tecnici da testo di capitolato o ordine.
 *
 * Output compatibile con insertRequirements (drawingExtraction.controller):
 *   { req_type, field_key, value_text, unit, confidence, source_bbox }
 *
 * req_type ammessi (mig. 116):
 *   'delivery' | 'legal' | 'commercial' | 'spec' | 'note'
 *
 * Riusa:
 *   - extractPdfText  (importPdfText.js) per estrarre testo dal buffer PDF
 *   - chat / getActiveProvider (aiProviderAdapter) per la chiamata AI
 *   - parseJsonWithRepair (jsonRepair.js) per il parsing difensivo
 */

'use strict';

const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { extractPdfText } = require('../utils/importPdfText');
const { parseJsonWithRepair } = require('../utils/jsonRepair');

const MAX_INPUT_CHARS = Number(process.env.OPENAI_IMPORT_MAX_CHARS) || 20000;

const VALID_TEXT_REQ_TYPES = new Set(['delivery', 'legal', 'commercial', 'spec', 'note']);

const SYSTEM_PROMPT =
    'Sei un esperto di qualità industriale e gestione contratti (ISO 9001, ISO 3834).' +
    ' Analizzi il testo di un capitolato tecnico o ordine d\'acquisto ed estrai i requisiti' +
    ' rilevanti per la pianificazione della produzione e il riesame contratto (ISO 9001 §8.2).' +
    ' Rispondi ESCLUSIVAMENTE con un oggetto JSON valido senza testo prima o dopo, senza markdown.';

function buildUserPrompt(text) {
    const truncated =
        text.length > MAX_INPUT_CHARS
            ? `${text.slice(0, MAX_INPUT_CHARS)}\n\n[... testo troncato ...]`
            : text;

    return (
        `Testo del documento:\n---\n${truncated}\n---\n\n` +
        'Estrai i requisiti e restituisci questo schema JSON:\n' +
        '{ "requirements": [ {\n' +
        '  "req_type": "delivery|legal|commercial|spec|note",\n' +
        '  "field_key": "chiave breve (es. delivery_date, material_standard, payment_terms)",\n' +
        '  "value_text": "valore o descrizione testuale del requisito",\n' +
        '  "unit": null,\n' +
        '  "confidence": 0..1,\n' +
        '  "source_bbox": null\n' +
        '} ] }\n\n' +
        'Tipi req_type:\n' +
        '- delivery: date consegna, tempi di esecuzione, penali ritardo\n' +
        '- legal: clausole contrattuali, responsabilità, garanzie legali\n' +
        '- commercial: prezzi, pagamenti, sconti, incoterms\n' +
        '- spec: specifiche tecniche, standard applicabili (es. ISO, EN), materiali, certificazioni richieste\n' +
        '- note: requisiti non classificabili nelle categorie precedenti\n' +
        'Includi solo requisiti esplicitamente o chiaramente presenti.\n' +
        'confidence = 0.85 se chiaro, 0.55 se implicito, 0.3 se dedotto.'
    );
}

function clampConfidence(raw) {
    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return Math.round(n * 10000) / 10000;
}

function normalizeReq(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const reqTypeRaw = String(raw.req_type || '').trim().toLowerCase();
    const req_type = VALID_TEXT_REQ_TYPES.has(reqTypeRaw) ? reqTypeRaw : 'note';
    const value_text = raw.value_text != null ? String(raw.value_text).trim() : null;
    if (!value_text) return null;
    const field_key =
        raw.field_key != null ? String(raw.field_key).trim().substring(0, 100) : null;
    return {
        req_type,
        field_key: field_key || null,
        value_text,
        unit: raw.unit != null ? String(raw.unit).trim().substring(0, 30) || null : null,
        confidence: clampConfidence(raw.confidence),
        source_bbox: null,
    };
}

function parseRequirements(content) {
    if (!content || typeof content !== 'string') return [];
    let text = content
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    let data;
    try {
        data = parseJsonWithRepair(text);
    } catch {
        try {
            data = JSON.parse(text);
        } catch {
            return [];
        }
    }

    const list = Array.isArray(data)
        ? data
        : Array.isArray(data && data.requirements)
          ? data.requirements
          : [];

    return list.map(normalizeReq).filter(Boolean);
}

/**
 * Estrae il testo dal buffer (solo PDF) e analizza con AI per ottenere requisiti.
 *
 * @param {Buffer} buffer        Buffer del file PDF
 * @param {string} mimeType      MIME type del file
 * @param {object} [options]
 * @returns {Promise<{ provider: string, requirements: Array, raw: string, model: string }>}
 * @throws {Error} con .code 'AI_NOT_CONFIGURED' | 'UNSUPPORTED_FORMAT' | 'EMPTY_TEXT' | ...
 */
async function extractTextRequirements(buffer, mimeType, options = {}) {
    if (!getActiveProvider()) {
        const e = new Error('Nessun provider AI configurato sul server.');
        e.code = 'AI_NOT_CONFIGURED';
        throw e;
    }

    // Estrai testo: per ora solo PDF
    const mime = String(mimeType || '').toLowerCase();
    if (mime !== 'application/pdf') {
        const e = new Error(`Formato non supportato per l'analisi testo: ${mimeType}`);
        e.code = 'UNSUPPORTED_FORMAT';
        throw e;
    }

    let rawText;
    try {
        rawText = await extractPdfText(buffer);
    } catch (err) {
        const e = new Error(`Errore estrazione testo PDF: ${err.message}`);
        e.code = 'PDF_PARSE_ERROR';
        throw e;
    }

    const text = String(rawText || '').trim();
    if (!text) {
        const e = new Error('Nessun testo estraibile dal PDF (possibile scansione senza strato testo).');
        e.code = 'EMPTY_TEXT';
        throw e;
    }

    const userPrompt = buildUserPrompt(text);
    const result = await chat(
        [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        { temperature: 0.1, responseFormat: 'json' },
    );

    const content = result.content;
    const requirements = parseRequirements(content || '');

    return {
        provider: getActiveProvider() || 'unknown',
        requirements,
        raw: content || '',
        model: result.model || null,
    };
}

module.exports = { extractTextRequirements };
