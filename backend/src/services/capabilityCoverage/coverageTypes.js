/**
 * coverageTypes.js — Contratto tipi motore copertura scalabile (COV-1).
 *
 * Domini plug-in (stesso spirito di jointTypeProfiles):
 *   welder_9606 | wpqr_procedure | cnd_9712 | …
 *
 * Nessuna logica di match qui — solo costanti e helper di normalizzazione.
 */

'use strict';

/** Domini noti (registry può registrarne altri). */
const COVERAGE_DOMAINS = Object.freeze({
    WELDER_9606: 'welder_9606',
    WPQR_PROCEDURE: 'wpqr_procedure',
    CND_9712: 'cnd_9712',
});

/**
 * Esiti match per CapabilityMatch.status
 * @typedef {'match'|'partial'|'no_match'|'not_implemented'} MatchStatus
 */
const MATCH_STATUS = Object.freeze({
    MATCH: 'match',
    PARTIAL: 'partial',
    NO_MATCH: 'no_match',
    NOT_IMPLEMENTED: 'not_implemented',
});

/**
 * @typedef {Object} RequirementFieldDef
 * @property {string} key
 * @property {string} label
 * @property {'text'|'number'|'select'} type
 * @property {{ value: string, label: string }[]} [options]
 * @property {boolean} [required]
 * @property {string} [hint]
 */

/**
 * @typedef {Object} Requirement
 * @property {string} domain
 * @property {number} [organization_id]
 * @property {number|null} [company_id]
 * @property {Object.<string, *>} criteria
 */

/**
 * @typedef {Object} CapabilityMatch
 * @property {string} domain
 * @property {string|number|null} capability_id
 * @property {MatchStatus} status
 * @property {string[]} [reasons]
 * @property {Object.<string, string>} [detail]
 * @property {Object} [capability]
 */

/**
 * @typedef {Object} MatchContext
 * @property {number} organizationId
 * @property {number|null} [companyId]
 * @property {object} [pool] — SQL pool opzionale (iniettato dal controller)
 * @property {string} [todayIso]
 */

/**
 * @typedef {Object} DomainAdapter
 * @property {string} domain
 * @property {string} label
 * @property {string} [standard]
 * @property {boolean} implemented — false = stub tipizzato
 * @property {RequirementFieldDef[]} requirementFields
 * @property {(req: Requirement, ctx: MatchContext) => Promise<CapabilityMatch[]>} match
 */

/**
 * Normalizza un requisito in ingresso API.
 * @param {object} body
 * @returns {Requirement}
 */
function normalizeRequirement(body = {}) {
    const domain = String(body.domain || '').trim();
    const companyRaw = body.company_id != null ? body.company_id : body.companyId;
    const company_id = companyRaw === '' || companyRaw == null ? null : Number(companyRaw);
    const criteria = body.criteria && typeof body.criteria === 'object' ? { ...body.criteria } : {};
    return {
        domain,
        organization_id: body.organization_id != null ? Number(body.organization_id) : undefined,
        company_id: Number.isFinite(company_id) ? company_id : null,
        criteria,
    };
}

/**
 * Serializza un adapter per GET /domains (senza la funzione match).
 * @param {DomainAdapter} adapter
 */
function publicDomainMeta(adapter) {
    return {
        domain: adapter.domain,
        label: adapter.label,
        standard: adapter.standard || null,
        implemented: !!adapter.implemented,
        maturity: adapter.maturity || (adapter.implemented ? 'full' : 'stub'),
        requirementFields: Array.isArray(adapter.requirementFields)
            ? adapter.requirementFields
            : [],
    };
}

module.exports = {
    COVERAGE_DOMAINS,
    MATCH_STATUS,
    normalizeRequirement,
    publicDomainMeta,
};
