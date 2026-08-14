/**
 * Lookup anagrafica ufficiale via OpenAPI Company (ADR-018 S5).
 * Human-in-the-loop: questo modulo NON scrive su company_profile.
 *
 * Token: SGQ_OPENAPI_COMPANY_TOKEN (env VPS / Cloud Secrets). Mai in Git.
 */
'use strict';

const { pickEditableFields } = require('../data/companyProfileFields');

const DEFAULT_BASE = 'https://company.openapi.com';

function getOpenapiToken() {
    const t = String(process.env.SGQ_OPENAPI_COMPANY_TOKEN || '').trim();
    return t || null;
}

function isLookupConfigured() {
    return !!getOpenapiToken();
}

function normalizeVat(raw) {
    const s = String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!s) return null;
    const digits = s.replace(/^IT/, '').replace(/\D/g, '');
    return digits || null;
}

function unwrapPayload(json) {
    if (!json || typeof json !== 'object') return null;
    if (json.data && typeof json.data === 'object' && !Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.data) && json.data[0]) return json.data[0];
    if (json.companyName || json.vatCode || json.taxCode) return json;
    return null;
}

function composeStreet(office) {
    if (!office || typeof office !== 'object') return null;
    const parts = [office.toponym, office.street || office.streetName, office.streetNumber]
        .map((x) => (x == null ? '' : String(x).trim()))
        .filter(Boolean);
    return parts.length ? parts.join(' ') : null;
}

function pickAteco(atecoClassification) {
    const src = atecoClassification && typeof atecoClassification === 'object'
        ? atecoClassification
        : {};
    const candidates = [src.ateco, src.ateco2022, src.ateco2007];
    for (const c of candidates) {
        if (c && (c.code || c.description)) {
            return {
                ateco_primary: c.code ? String(c.code).trim() : null,
                ateco_primary_desc: c.description ? String(c.description).trim() : null,
            };
        }
    }
    return { ateco_primary: null, ateco_primary_desc: null };
}

/**
 * Mappa la risposta Start/Advanced sui campi company_profile (solo livello A).
 */
function mapOpenapiCompanyToProfile(payload) {
    const src = unwrapPayload(payload) || payload || {};
    const office = src.address?.registeredOffice || src.address || {};
    const ateco = pickAteco(src.atecoClassification);
    const employeesRaw = src.balanceSheets?.last?.employees;
    const employees = Number.isFinite(employeesRaw) ? employeesRaw : parseInt(employeesRaw, 10);
    const share = src.balanceSheets?.last?.shareCapital;
    const province = office.province ? String(office.province).trim().slice(0, 2).toUpperCase() : null;

    const raw = {
        legal_name: src.companyName || null,
        vat_number: src.vatCode || null,
        fiscal_code: src.taxCode || null,
        ateco_primary: ateco.ateco_primary,
        ateco_primary_desc: ateco.ateco_primary_desc,
        legal_form: src.detailedLegalForm?.description || src.detailedLegalForm?.code || null,
        rea_number: src.reaCode || null,
        cciaa: src.cciaa || null,
        pec: src.pec || null,
        registered_street: composeStreet(office),
        registered_cap: office.zipCode || null,
        registered_city: office.town || null,
        registered_province: province,
        registered_country: office.town || src.companyName ? 'IT' : null,
        company_status: src.activityStatus || null,
        employees_count: Number.isFinite(employees) ? employees : null,
        share_capital: share != null && share !== '' ? String(share) : null,
    };
    return pickEditableFields(raw);
}

async function fetchOpenapi(path, token, baseUrl) {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            accept: 'application/json',
            Authorization: `Bearer ${token}`,
        },
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text.slice(0, 200) }; }
    return { status: res.status, json };
}

/**
 * @returns {{ ok: true, fields: object, endpoint: string, vat: string, atecoFound: boolean }
 *   | { ok: false, status: number, code: string, error: string }}
 */
async function lookupCompanyByVat(vatRaw, options = {}) {
    const token = options.token || getOpenapiToken();
    if (!token) {
        return {
            ok: false,
            status: 503,
            code: 'LOOKUP_NOT_CONFIGURED',
            error: 'Lookup registro non configurato (manca il token OpenAPI sul server)',
        };
    }
    const vat = normalizeVat(vatRaw);
    if (!vat) {
        return {
            ok: false,
            status: 400,
            code: 'MISSING_VAT',
            error: 'Serve la Partita IVA (o il codice fiscale) per interrogare il registro',
        };
    }

    const baseUrl = options.baseUrl || process.env.SGQ_OPENAPI_COMPANY_BASE || DEFAULT_BASE;
    const fetchFn = options.fetchFn || fetchOpenapi;

    const advanced = await fetchFn(`/IT-advanced/${encodeURIComponent(vat)}`, token, baseUrl);
    if (advanced.status === 200 && unwrapPayload(advanced.json)) {
        const fields = mapOpenapiCompanyToProfile(advanced.json);
        return {
            ok: true,
            fields,
            endpoint: 'IT-advanced',
            vat,
            atecoFound: !!(fields.ateco_primary),
        };
    }

    const start = await fetchFn(`/IT-start/${encodeURIComponent(vat)}`, token, baseUrl);
    if (start.status === 200 && unwrapPayload(start.json)) {
        const fields = mapOpenapiCompanyToProfile(start.json);
        return {
            ok: true,
            fields,
            endpoint: 'IT-start',
            vat,
            atecoFound: false,
            warning: 'ATECO non disponibile su Start: il piano non ha restituito IT-advanced.',
        };
    }

    if (advanced.status === 402 || start.status === 402) {
        return {
            ok: false,
            status: 402,
            code: 'LOOKUP_PAYMENT_REQUIRED',
            error: 'Credito o piano OpenAPI insufficiente per il lookup.',
        };
    }

    if (start.status === 204 || advanced.status === 204) {
        return {
            ok: false,
            status: 404,
            code: 'LOOKUP_NOT_FOUND',
            error: 'Nessuna azienda trovata per questa P.IVA',
        };
    }

    return {
        ok: false,
        status: 502,
        code: 'LOOKUP_UPSTREAM_FAILED',
        error: `Registro non raggiungibile (HTTP ${advanced.status}/${start.status})`,
    };
}

module.exports = {
    getOpenapiToken,
    isLookupConfigured,
    normalizeVat,
    unwrapPayload,
    composeStreet,
    pickAteco,
    mapOpenapiCompanyToProfile,
    lookupCompanyByVat,
};
