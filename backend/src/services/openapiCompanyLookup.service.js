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

const SEARCH_LIMIT = 8;
const MIN_NAME_LEN = 3;

function mapSearchHit(row) {
    if (!row || typeof row !== 'object') return null;
    const office = row.address?.registeredOffice || row.address || {};
    return {
        registry_id: row.id || null,
        legal_name: row.companyName || null,
        vat_number: row.vatCode || null,
        fiscal_code: row.taxCode || null,
        city: office.town || null,
        street: composeStreet(office),
        cap: office.zipCode || null,
        province: office.province ? String(office.province).trim().slice(0, 2).toUpperCase() : null,
        status: row.activityStatus || null,
    };
}

function fieldsToCandidate(fields, extra = {}) {
    const src = fields && typeof fields === 'object' ? fields : {};
    return {
        registry_id: extra.registry_id || null,
        legal_name: src.legal_name || null,
        vat_number: src.vat_number || extra.vat || null,
        fiscal_code: src.fiscal_code || null,
        city: src.registered_city || null,
        street: src.registered_street || null,
        cap: src.registered_cap || null,
        province: src.registered_province || null,
        status: src.company_status || null,
    };
}

function formatCandidateAddress(candidate) {
    if (!candidate || typeof candidate !== 'object') return '';
    const cityLine = [candidate.cap, candidate.city].filter(Boolean).join(' ');
    return [candidate.street, cityLine, candidate.province].filter(Boolean).join(', ');
}

function buildSearchQuery(name) {
    const q = String(name || '').trim();
    if (!q) return '';
    if (q.includes('*') || /\s/.test(q)) return q;
    return `${q}*`;
}

/**
 * Ricerca human-in-the-loop: P.IVA → 1 risultato (IT-advanced/start);
 * solo nome → IT-search name (max 8). Non scrive.
 */
async function searchCompanies(query = {}, options = {}) {
    const token = options.token !== undefined ? options.token : getOpenapiToken();
    if (!token) {
        return {
            ok: false,
            status: 503,
            code: 'LOOKUP_NOT_CONFIGURED',
            error: 'Lookup registro non configurato (manca il token OpenAPI sul server)',
        };
    }

    const vat = normalizeVat(query.vatNumber || query.vat_number);
    const name = String(query.companyName || query.company_name || query.name || '').trim();
    if (!vat && name.length < MIN_NAME_LEN) {
        return {
            ok: false,
            status: 400,
            code: 'MISSING_QUERY',
            error: 'Inserisci la Partita IVA oppure almeno 3 lettere del nome',
        };
    }

    const baseUrl = options.baseUrl || process.env.SGQ_OPENAPI_COMPANY_BASE || DEFAULT_BASE;
    const fetchFn = options.fetchFn || fetchOpenapi;

    if (vat) {
        const byVat = await lookupCompanyByVat(vat, { token, fetchFn, baseUrl });
        if (byVat.ok) {
            return {
                ok: true,
                source: byVat.endpoint,
                results: [fieldsToCandidate(byVat.fields, { vat: byVat.vat })],
                warning: byVat.warning || null,
            };
        }
        if (byVat.code === 'LOOKUP_NOT_CONFIGURED' || byVat.code === 'LOOKUP_PAYMENT_REQUIRED') {
            return byVat;
        }
        if (name.length < MIN_NAME_LEN) {
            return byVat;
        }
    }

    const path = `/IT-search?dataEnrichment=name&companyName=${encodeURIComponent(buildSearchQuery(name))}&limit=${SEARCH_LIMIT}`;
    const res = await fetchFn(path, token, baseUrl);
    if (res.status === 402) {
        return {
            ok: false,
            status: 402,
            code: 'LOOKUP_PAYMENT_REQUIRED',
            error: 'Credito o piano OpenAPI insufficiente per la ricerca.',
        };
    }
    if (res.status === 204) {
        return {
            ok: false,
            status: 404,
            code: 'LOOKUP_NOT_FOUND',
            error: 'Nessuna azienda trovata per questo nome',
        };
    }
    if (res.status !== 200) {
        return {
            ok: false,
            status: 502,
            code: 'LOOKUP_UPSTREAM_FAILED',
            error: `Registro non raggiungibile (HTTP ${res.status})`,
        };
    }

    const raw = res.json;
    const list = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);
    const results = list
        .map(mapSearchHit)
        .filter((c) => c && (c.legal_name || c.vat_number))
        .slice(0, SEARCH_LIMIT);

    if (!results.length) {
        return {
            ok: false,
            status: 404,
            code: 'LOOKUP_NOT_FOUND',
            error: 'Nessuna azienda trovata per questo nome',
        };
    }

    return { ok: true, source: 'IT-search', results, warning: null };
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
    searchCompanies,
    mapSearchHit,
    formatCandidateAddress,
    buildSearchQuery,
    SEARCH_LIMIT,
    MIN_NAME_LEN,
};
