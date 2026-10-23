/**
 * Registro degli avvisi di discrepanza. Oggi c'è la WPQR.
 * WPS e qualifiche saldatore si aggiungono con registerDiscrepancyDomain,
 * senza spargere condizioni nel controller.
 */

'use strict';

const { evaluateWpqrNotices, DOMAIN } = require('./wpqrRules');
const status = require('./status');

const evaluators = new Map([
    [DOMAIN, evaluateWpqrNotices],
]);

function registerDiscrepancyDomain(domain, evaluate) {
    if (!domain || typeof evaluate !== 'function') {
        throw new Error('dominio e funzione di valutazione obbligatori');
    }
    evaluators.set(domain, evaluate);
}

function evaluateDiscrepancy(domain, record, context) {
    const fn = evaluators.get(domain);
    if (!fn) return [];
    return fn(record, context);
}

function listDiscrepancyDomains() {
    return [...evaluators.keys()];
}

module.exports = {
    registerDiscrepancyDomain,
    evaluateDiscrepancy,
    listDiscrepancyDomains,
    evaluateWpqrNotices,
    ...status,
};
