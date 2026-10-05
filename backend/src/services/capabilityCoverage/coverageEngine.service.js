/**
 * coverageEngine.service.js — Orchestrazione verifica copertura per dominio.
 */

'use strict';

const { normalizeRequirement, MATCH_STATUS } = require('./coverageTypes');
const { getDomainAdapter, listDomainMeta } = require('./coverageRegistry');

// Side-effect: registra i 3 adapter di base
require('./registerDefaultAdapters');

/**
 * Elenco domini pubblici (API GET).
 */
function listCoverageDomains() {
    return listDomainMeta();
}

/**
 * Esegue il match per un requisito tipizzato.
 * @param {object} body — { domain, company_id?, criteria }
 * @param {import('./coverageTypes').MatchContext} ctx
 */
async function verifyCoverage(body, ctx) {
    const requirement = normalizeRequirement(body);
    if (!requirement.domain) {
        const err = new Error('domain richiesto');
        err.httpStatus = 400;
        err.code = 'DOMAIN_REQUIRED';
        throw err;
    }
    const adapter = getDomainAdapter(requirement.domain);
    if (!adapter) {
        const err = new Error(`Dominio sconosciuto: ${requirement.domain}`);
        err.httpStatus = 400;
        err.code = 'DOMAIN_UNKNOWN';
        throw err;
    }

    const matches = await adapter.match(requirement, {
        organizationId: ctx.organizationId,
        companyId: requirement.company_id != null ? requirement.company_id : ctx.companyId,
        pool: ctx.pool,
        todayIso: ctx.todayIso,
    });

    const summary = summarizeMatches(matches);
    const message = summary.total === 0 && adapter.emptyMessage ? adapter.emptyMessage : null;
    return {
        domain: adapter.domain,
        label: adapter.label,
        implemented: !!adapter.implemented,
        maturity: adapter.maturity || (adapter.implemented ? 'full' : 'stub'),
        requirement: {
            domain: requirement.domain,
            company_id: requirement.company_id,
            criteria: requirement.criteria,
        },
        matches,
        summary,
        ...(message ? { message } : {}),
    };
}

/**
 * @param {import('./coverageTypes').CapabilityMatch[]} matches
 */
function summarizeMatches(matches) {
    const list = Array.isArray(matches) ? matches : [];
    return {
        total: list.length,
        match: list.filter((m) => m.status === MATCH_STATUS.MATCH).length,
        partial: list.filter((m) => m.status === MATCH_STATUS.PARTIAL).length,
        no_match: list.filter((m) => m.status === MATCH_STATUS.NO_MATCH).length,
        not_implemented: list.filter((m) => m.status === MATCH_STATUS.NOT_IMPLEMENTED).length,
    };
}

module.exports = {
    listCoverageDomains,
    verifyCoverage,
    summarizeMatches,
};
