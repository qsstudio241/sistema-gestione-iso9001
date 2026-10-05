/**
 * coverageRegistry.js — Registry domini copertura (plug-in).
 * Nessun if (welder) else nel motore: si registra un adapter per dominio.
 */

'use strict';

const { publicDomainMeta } = require('./coverageTypes');

/** @type {Map<string, import('./coverageTypes').DomainAdapter>} */
const adapters = new Map();

/**
 * @param {import('./coverageTypes').DomainAdapter} adapter
 */
function registerDomainAdapter(adapter) {
    if (!adapter || !adapter.domain) {
        throw new Error('DomainAdapter richiede domain');
    }
    if (typeof adapter.match !== 'function') {
        throw new Error(`DomainAdapter ${adapter.domain}: match() obbligatorio`);
    }
    adapters.set(String(adapter.domain), adapter);
}

/**
 * @param {string} domain
 * @returns {import('./coverageTypes').DomainAdapter|null}
 */
function getDomainAdapter(domain) {
    return adapters.get(String(domain || '').trim()) || null;
}

/** @returns {import('./coverageTypes').DomainAdapter[]} */
function listDomainAdapters() {
    return Array.from(adapters.values());
}

/** Meta pubbliche per API/UI. */
function listDomainMeta() {
    return listDomainAdapters().map(publicDomainMeta);
}

/** Solo test / hot-reload. */
function clearDomainAdapters() {
    adapters.clear();
}

function domainCount() {
    return adapters.size;
}

module.exports = {
    registerDomainAdapter,
    getDomainAdapter,
    listDomainAdapters,
    listDomainMeta,
    clearDomainAdapters,
    domainCount,
};
