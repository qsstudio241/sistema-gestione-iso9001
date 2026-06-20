/**
 * drawingExtraction.service.js — Estrazione requisiti tecnici dai disegni di commessa.
 *
 * Architettura PROVIDER-AGNOSTIC: l'interfaccia pubblica `extractFromFile(buffer, mimeType)`
 * delega a un adapter selezionato per nome (gemini ora; werk24 in futuro). Aggiungere
 * un nuovo provider significa solo registrarlo in ADAPTERS, senza toccare controller/DB/UI.
 *
 * Ogni adapter restituisce un array di requisiti normalizzati nella forma:
 *   { req_type, field_key, value_text, unit, confidence, source_bbox }
 *
 * Riusa l'integrazione Gemini esistente (adapters/geminiAdapter.generateVision) — nessuna
 * seconda integrazione AI: stessa chiave env GEMINI_API_KEY, stesso retry/backoff.
 */

'use strict';

const geminiAdapter = require('./adapters/geminiAdapter');

const VALID_REQ_TYPES = new Set([
    'dimension', 'tolerance', 'gdt', 'material',
    'weld_symbol', 'surface', 'note', 'title_block',
]);

// Prompt di sistema: vincola Gemini a restituire SOLO JSON strutturato.
const DRAWING_SYSTEM_PROMPT = [
    'Sei un tecnico esperto di disegno meccanico e fabbricazione metallica (ISO 9001 / ISO 3834).',
    'Analizzi un disegno tecnico (immagine o PDF) ed estrai i requisiti tecnici rilevanti per la',
    'pianificazione della produzione e per la verifica delle qualifiche di saldatura.',
    'Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, senza markdown.',
].join(' ');

// Prompt utente: descrive lo schema JSON atteso.
const DRAWING_USER_PROMPT = [
    'Estrai dal disegno i requisiti tecnici e restituisci questo schema JSON:',
    '{ "requirements": [ {',
    '  "req_type": "dimension|tolerance|gdt|material|weld_symbol|surface|note|title_block",',
    '  "field_key": "chiave breve opzionale (es. material_group, thickness, welding_process)",',
    '  "value_text": "valore o descrizione testuale del requisito",',
    '  "unit": "unita di misura se applicabile (mm, deg, ...) altrimenti null",',
    '  "confidence": "numero 0..1 sulla certezza dell estrazione",',
    '  "source_bbox": "bounding box opzionale come stringa x,y,w,h altrimenti null"',
    '} ] }',
    'Includi in particolare: materiale base e gruppo, quote principali, tolleranze dimensionali e',
    'geometriche (GD&T), simboli e processi di saldatura, trattamenti superficiali, note del cartiglio',
    '(title_block: committente, codice disegno, scala, revisione). Se un campo non e leggibile, ometti',
    'il requisito invece di inventarlo. Non aggiungere requisiti non presenti nel disegno.',
].join(' ');

function clampConfidence(raw) {
    if (raw == null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    if (n < 0) return 0;
    if (n > 1) return 1;
    // 4 decimali (coerente con DECIMAL(5,4) della colonna)
    return Math.round(n * 10000) / 10000;
}

function toTrimmedStringOrNull(raw, maxLen) {
    if (raw == null) return null;
    const s = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const t = s.trim();
    if (!t) return null;
    return maxLen ? t.substring(0, maxLen) : t;
}

/**
 * Normalizza un singolo requisito grezzo nello shape canonico.
 * Scarta i requisiti senza un value_text utile.
 * @returns {object|null}
 */
function normalizeRequirement(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const reqTypeRaw = String(raw.req_type || raw.type || '').trim().toLowerCase();
    const req_type = VALID_REQ_TYPES.has(reqTypeRaw) ? reqTypeRaw : 'note';
    const value_text = toTrimmedStringOrNull(raw.value_text ?? raw.value ?? raw.text);
    if (!value_text) return null;
    return {
        req_type,
        field_key: toTrimmedStringOrNull(raw.field_key ?? raw.key, 100),
        value_text,
        unit: toTrimmedStringOrNull(raw.unit, 30),
        confidence: clampConfidence(raw.confidence),
        source_bbox: toTrimmedStringOrNull(raw.source_bbox ?? raw.bbox, 200),
    };
}

/**
 * Parsing difensivo della risposta del provider: accetta JSON puro, JSON con
 * fence markdown, oggetto { requirements: [...] } o array diretto. In caso di
 * risposta non interpretabile restituisce array vuoto (gestione non-JSON).
 * @param {string} content
 * @returns {Array<object>}
 */
function parseRequirementsResponse(content) {
    if (!content || typeof content !== 'string') return [];
    let text = content.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    let data;
    try {
        data = JSON.parse(text);
    } catch {
        // Tentativo di recupero: isola il primo blocco {...} o [...]
        const match = text.match(/[[{][\s\S]*[\]}]/);
        if (!match) return [];
        try {
            data = JSON.parse(match[0]);
        } catch {
            return [];
        }
    }

    const list = Array.isArray(data)
        ? data
        : Array.isArray(data && data.requirements)
            ? data.requirements
            : [];

    return list.map(normalizeRequirement).filter(Boolean);
}

/**
 * Adapter Gemini: invia il file come inlineData a Gemini vision e normalizza l'output.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {object} options
 * @returns {Promise<{provider:string, requirements:Array, raw:string, model:string}>}
 */
async function geminiExtract(buffer, mimeType, options = {}) {
    const base64 = Buffer.isBuffer(buffer) ? buffer.toString('base64') : String(buffer);
    const result = await geminiAdapter.generateVision(
        {
            systemText: DRAWING_SYSTEM_PROMPT,
            userText: DRAWING_USER_PROMPT,
            files: [{ mimeType: mimeType || 'application/octet-stream', data: base64 }],
        },
        {
            temperature: 0.1,
            responseFormat: 'json',
            timeout: options.timeout,
        },
    );
    return {
        provider: 'gemini',
        requirements: parseRequirementsResponse(result.content),
        raw: result.content,
        model: result.model || null,
    };
}

const ADAPTERS = {
    gemini: geminiExtract,
    // werk24: werk24Extract,  // <-- aggiungere qui in futuro senza toccare controller/DB/UI
};

/**
 * Risolve il provider attivo per l'estrazione disegni.
 * Priorita': option esplicita > env DRAWING_EXTRACTION_PROVIDER > 'gemini'.
 */
function resolveProvider(options = {}) {
    return (
        options.provider ||
        process.env.DRAWING_EXTRACTION_PROVIDER ||
        'gemini'
    );
}

/**
 * Interfaccia pubblica provider-agnostic.
 * @param {Buffer} buffer       - contenuto del file (immagine o PDF)
 * @param {string} mimeType     - mime type del file
 * @param {object} [options]    - { provider, timeout }
 * @returns {Promise<{provider:string, requirements:Array, raw:string, model:string}>}
 */
async function extractFromFile(buffer, mimeType, options = {}) {
    const provider = resolveProvider(options);
    const adapter = ADAPTERS[provider];
    if (!adapter) {
        const err = new Error(`Provider di estrazione non supportato: ${provider}`);
        err.code = 'EXTRACTION_PROVIDER_NOT_SUPPORTED';
        throw err;
    }
    return adapter(buffer, mimeType, options);
}

module.exports = {
    extractFromFile,
    resolveProvider,
    // Esportati per test e riuso
    parseRequirementsResponse,
    normalizeRequirement,
    VALID_REQ_TYPES,
    DRAWING_SYSTEM_PROMPT,
    DRAWING_USER_PROMPT,
};
