/**
 * qualificationVerify.controller.js — POST /qualifications/verify (epic VQ, slice VQ-7).
 *
 * Verifica stateless di una qualifica rispetto alla norma: nessuna scrittura, nessun accesso
 * al DB, esiti sempre informativi (mai bloccanti). Autenticazione e licenza modulo sono
 * applicate dal router (`qualifications.routes.js`); qui si pretende solo un utente con
 * `organization_id` (stesso scope multi-tenant delle altre rotte Qualifiche).
 *
 * Body: `{ fields: object, qualification_type?: string }` — contratto di
 * `apiService.verifyQualification`. Risposta: `{ verification: VerifyResult }`
 * (contratto: docs/agent-tasks/PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md § 1.3).
 */

'use strict';

const logger = require('../utils/logger');

const MAX_FIELDS = 200;
const MAX_STRING_LENGTH = 5000;
const MAX_ARRAY_LENGTH = 50;
const MAX_QUALIFICATION_TYPE_LENGTH = 200;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isAllowedScalar(v) {
    if (v === null) return true;
    if (typeof v === 'string') return v.length <= MAX_STRING_LENGTH;
    if (typeof v === 'number') return Number.isFinite(v);
    return typeof v === 'boolean';
}

/**
 * Valida e ripulisce il body. Ritorna `{ ok: true, input }` oppure `{ ok: false, error }`.
 * I valori ammessi sono scalari o array di scalari (es. `welding_positions`).
 */
function parseVerifyBody(body) {
    if (!isPlainObject(body)) {
        return { ok: false, error: 'Body non valido: atteso un oggetto JSON { fields, qualification_type }.' };
    }
    const { fields, qualification_type: qualificationType } = body;
    if (!isPlainObject(fields)) {
        return { ok: false, error: 'Campo "fields" obbligatorio: atteso un oggetto.' };
    }

    const keys = Object.keys(fields);
    if (keys.length === 0) {
        return { ok: false, error: 'Campo "fields" vuoto: nessun dato da verificare.' };
    }
    if (keys.length > MAX_FIELDS) {
        return { ok: false, error: `Campo "fields" troppo grande (massimo ${MAX_FIELDS} chiavi).` };
    }

    const input = {};
    for (const key of keys) {
        if (FORBIDDEN_KEYS.has(key)) continue;
        const value = fields[key];
        if (Array.isArray(value)) {
            if (value.length > MAX_ARRAY_LENGTH || !value.every(isAllowedScalar)) {
                return { ok: false, error: `Valore non valido per il campo "${key}".` };
            }
        } else if (!isAllowedScalar(value)) {
            return { ok: false, error: `Valore non valido per il campo "${key}".` };
        }
        input[key] = value;
    }

    if (qualificationType !== undefined && qualificationType !== null) {
        if (typeof qualificationType !== 'string' || qualificationType.length > MAX_QUALIFICATION_TYPE_LENGTH) {
            return { ok: false, error: 'Campo "qualification_type" non valido: atteso testo breve.' };
        }
        if (qualificationType.trim()) input.qualification_type = qualificationType.trim();
    }

    return { ok: true, input };
}

/** POST /qualifications/verify */
async function verifyQualificationFields(req, res) {
    try {
        if (!req.user || req.user.organization_id == null) {
            return res.status(403).json({ error: 'Organizzazione non determinata per l\'utente.' });
        }

        const parsed = parseVerifyBody(req.body);
        if (!parsed.ok) return res.status(400).json({ error: parsed.error });

        const { verifyQualification } = require('../services/qualificationVerify');
        const verification = verifyQualification(parsed.input, { mode: 'review' });
        return res.json({ verification });
    } catch (err) {
        logger.error(`verifyQualificationFields: ${(err && err.message) || err}`);
        return res.status(500).json({ error: 'Verifica non disponibile. Riprovare.' });
    }
}

module.exports = {
    verifyQualificationFields,
    parseVerifyBody,
};
