/**
 * Estrazione strutturata da testo documento tramite provider AI (modalita' JSON).
 * Passo singolo: base per pipeline piu' avanzata (staging, tool-use, RAG).
 */

const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { getSchemaForDocType } = require('../data/documentTypeSchemas');
const { parseJsonWithRepair } = require('../utils/jsonRepair');
const { buildIngestLearningPromptSection } = require('./ingestLearning.service');
const { buildMaterialGroupPromptSection } = require('../data/materialGroups15608');
const { buildWeldingProcessPromptSection } = require('../data/weldingProcesses4063');
const { buildWeldingPositionPromptSection } = require('../data/weldingPositions6947');
const { buildShieldingGasPromptSection } = require('../data/shieldingGases14175');
const { buildWeldingTemperaturePromptSection } = require('../data/weldingTemperatures13916');
const { buildWelderQualificationRulesPromptSection } = require('../data/weldingQualificationRules9606');

const MAX_INPUT_CHARS = Number(process.env.OPENAI_IMPORT_MAX_CHARS) || 20000;
/** Documentazione / fallback: il modello effettivo proviene dalla risposta dell'adapter. */
const DEFAULT_MODEL = process.env.OPENAI_IMPORT_MODEL || 'gpt-4o-mini';

function stripCodeFences(raw) {
    let s = String(raw || '').trim();
    if (s.startsWith('```')) {
        s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
    }
    return s.trim();
}

/**
 * Preserva i codici errore noti dagli adapter; normalizza il resto su AI_REQUEST_FAILED.
 * @param {unknown} err
 * @returns {never}
 */
function normalizeChatError(err) {
    const code = err && err.code;
    if (
        code === 'AI_REQUEST_FAILED' ||
        code === 'AI_UPSTREAM_ERROR' ||
        code === 'AI_EMPTY_RESPONSE'
    ) {
        throw err;
    }
    if (code === 'AI_NOT_CONFIGURED') {
        const e = new Error('Nessun provider AI configurato sul server.');
        e.code = 'AI_NOT_CONFIGURED';
        throw e;
    }
    const e = new Error(
        err && err.message ? String(err.message) : String(err || 'Richiesta AI fallita.')
    );
    e.code = 'AI_REQUEST_FAILED';
    if (err && err.status !== undefined) {
        e.status = err.status;
    }
    throw e;
}

/**
 * @param {object} params
 * @param {string} params.text
 * @param {string|null} params.documentTypeHint
 * @returns {Promise<{ model: string, data: object, raw_content: string }>}
 */
async function extractStructuredFromText({ text, documentTypeHint }) {
    if (!getActiveProvider()) {
        const e = new Error('Nessun provider AI configurato sul server.');
        e.code = 'AI_NOT_CONFIGURED';
        throw e;
    }

    const bodyText = String(text || '').trim();
    if (!bodyText) {
        const e = new Error('Testo sorgente vuoto: estrarre prima il PDF.');
        e.code = 'EMPTY_SOURCE_TEXT';
        throw e;
    }
    const truncated = bodyText.length > MAX_INPUT_CHARS
        ? `${bodyText.slice(0, MAX_INPUT_CHARS)}\n\n[... testo troncato per limite ${MAX_INPUT_CHARS} caratteri ...]`
        : bodyText;

    const system = `Sei un assistente per documenti tecnici e qualità (ISO 9001, saldatura, certificazioni).
Analizza il testo estratto da un PDF (può contenere errori di OCR/strato testo).
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
- warnings: elenco problemi (testo frammentario, dati mancanti, ambiguità).
- Non inventare numeri di certificato o date: se non presenti, null o omesso.
- document_type_guess: una tra patentino_saldatore, qualifica_14732, cert_ndt, wps, wpqr, norma, dichiarazione_ce, cert_taratura, procedura, istruzione, modulo, manuale, piano_qualita, altro — solo se plausibile.`;

    const user = `Tipo documento indicato dall'operatore (puo' essere "non specificato"): ${documentTypeHint || 'non specificato'}

Testo documento:
---
${truncated}
---`;

    let result;
    try {
        result = await chat(
            [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            { temperature: 0.2, responseFormat: 'json' }
        );
    } catch (err) {
        normalizeChatError(err);
    }

    const content = result.content;
    if (!content || typeof content !== 'string') {
        const e = new Error('Risposta OpenAI senza contenuto testuale.');
        e.code = 'AI_EMPTY_RESPONSE';
        throw e;
    }

    let data;
    try {
        data = parseJsonWithRepair(content);
    } catch (parseErr) {
        if (parseErr && parseErr.code === 'AI_BAD_SHAPE') throw parseErr;
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
        model: result.model || DEFAULT_MODEL,
        data,
        raw_content: content,
    };
}

/**
 * Estrazione strutturata con prompt specializzato per tipo documento.
 *
 * Se esiste uno schema in documentTypeSchemas.js per docType, usa il prompt
 * specializzato (aggiunto in coda al system prompt generico) e include
 * "type_specific_data" nel JSON richiesto all'AI.
 * Altrimenti delega a extractStructuredFromText.
 *
 * @param {object} params
 * @param {string} params.text
 * @param {string|null} params.docType - chiave tipo documento (es. "patentino_saldatore")
 * @param {number|null} [params.organizationId] - per few-shot IG-5
 * @returns {Promise<{ model: string, data: object, raw_content: string }>}
 */
async function extractStructuredByDocType({ text, docType, organizationId = null }) {
    const schema = getSchemaForDocType(docType);

    if (!schema) {
        return extractStructuredFromText({ text, documentTypeHint: docType });
    }

    if (!getActiveProvider()) {
        const e = new Error('Nessun provider AI configurato sul server.');
        e.code = 'AI_NOT_CONFIGURED';
        throw e;
    }

    const bodyText = String(text || '').trim();
    if (!bodyText) {
        const e = new Error('Testo sorgente vuoto: estrarre prima il PDF.');
        e.code = 'EMPTY_SOURCE_TEXT';
        throw e;
    }
    const truncated = bodyText.length > MAX_INPUT_CHARS
        ? `${bodyText.slice(0, MAX_INPUT_CHARS)}\n\n[... testo troncato per limite ${MAX_INPUT_CHARS} caratteri ...]`
        : bodyText;

    let system = `Sei un assistente per documenti tecnici e qualità (ISO 9001, saldatura, certificazioni).
Analizza il testo estratto da un PDF (può contenere errori di OCR/strato testo).
Rispondi SOLO con un oggetto JSON valido (nessun testo fuori dal JSON) con questa forma:
{
  "title": string|null,
  "document_type_guess": string|null,
  "summary": string|null,
  "key_values": { "chiave breve": "valore" },
  "dates": [ { "raw": string, "iso_date": string|null } ],
  "extraction_confidence": number,
  "warnings": string[],
  "type_specific_data": { /* campi specifici del tipo documento — vedi istruzioni sotto */ }
}
Regole generali:
- Chiavi e stringhe in italiano dove ha senso.
- extraction_confidence: intero 0-100 (quanto il testo sembra completo e coerente).
- warnings: elenco problemi (testo frammentario, dati mancanti, ambiguità).
- Non inventare numeri di certificato o date: se non presenti, null o omesso.
- document_type_guess: una tra patentino_saldatore, qualifica_14732, cert_ndt, wps, wpqr, norma, dichiarazione_ce, cert_taratura, procedura, istruzione, modulo, manuale, piano_qualita, altro — solo se plausibile.

Istruzioni specifiche per il tipo documento "${schema.label}":
${schema.aiPrompt}`;

    const MATERIAL_GROUP_DOC_TYPES = new Set([
        'patentino_saldatore',
        'wpqr',
        'wps',
    ]);
    // ISO 14732 (operatori) non ha il gruppo materiale come variabile essenziale (§4.2):
    // riceve solo processo/posizioni, non il catalogo gruppi materiale.
    const WELDING_PROCESS_DOC_TYPES = new Set([
        ...MATERIAL_GROUP_DOC_TYPES,
        'qualifica_14732',
    ]);
    const WELDING_POSITION_DOC_TYPES = new Set([
        'patentino_saldatore',
        'wpqr',
        'wps',
        'qualifica_14732',
    ]);
    // Gas ISO 14175: rilevante per patentini/WPS/WPQR (processi con shielding);
    // 14732 spesso senza campo gas esplicito — escluso per non rumorizzare il prompt.
    const SHIELDING_GAS_DOC_TYPES = new Set([
        'patentino_saldatore',
        'wpqr',
        'wps',
    ]);
    // Temperature ISO 13916: campi WPS/WPQR (preheat/interpass), non patentini.
    const WELDING_TEMPERATURE_DOC_TYPES = new Set(['wps', 'wpqr']);
    if (MATERIAL_GROUP_DOC_TYPES.has(docType)) {
        system += `\n\n${buildMaterialGroupPromptSection({ families: ['steel', 'aluminium'], maxLines: 45 })}`;
    }
    if (WELDING_PROCESS_DOC_TYPES.has(docType)) {
        system += `\n\n${buildWeldingProcessPromptSection({ maxLines: 20 })}`;
    }
    if (WELDING_POSITION_DOC_TYPES.has(docType)) {
        system += `\n\n${buildWeldingPositionPromptSection({ maxLines: 15 })}`;
    }
    if (SHIELDING_GAS_DOC_TYPES.has(docType)) {
        system += `\n\n${buildShieldingGasPromptSection({ maxLines: 16 })}`;
    }
    if (WELDING_TEMPERATURE_DOC_TYPES.has(docType)) {
        system += `\n\n${buildWeldingTemperaturePromptSection()}`;
    }
    if (docType === 'patentino_saldatore') {
        system += `\n\n${buildWelderQualificationRulesPromptSection()}`;
    }

    if (organizationId) {
        try {
            system += await buildIngestLearningPromptSection(organizationId, docType);
        } catch (fewShotErr) {
            // non bloccare estrazione
        }
    }

    const user = `Tipo documento: ${schema.label}

Testo documento:
---
${truncated}
---`;

    let result;
    try {
        result = await chat(
            [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            { temperature: 0.2, responseFormat: 'json' }
        );
    } catch (err) {
        normalizeChatError(err);
    }

    const content = result.content;
    if (!content || typeof content !== 'string') {
        const e = new Error('Risposta AI senza contenuto testuale.');
        e.code = 'AI_EMPTY_RESPONSE';
        throw e;
    }

    let data;
    try {
        data = parseJsonWithRepair(content);
    } catch (parseErr) {
        if (parseErr && parseErr.code === 'AI_BAD_SHAPE') {
            parseErr.rawContent = content;
            throw parseErr;
        }
        const e = new Error('JSON dalla AI non valido.');
        e.code = 'AI_INVALID_JSON';
        e.rawContent = content;
        throw e;
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        const e = new Error('Formato estrazione non valido.');
        e.code = 'AI_BAD_SHAPE';
        e.rawContent = content;
        throw e;
    }

    return {
        model: result.model || DEFAULT_MODEL,
        data,
        raw_content: content,
    };
}

module.exports = {
    extractStructuredFromText,
    extractStructuredByDocType,
    stripCodeFences,
    MAX_INPUT_CHARS,
};
