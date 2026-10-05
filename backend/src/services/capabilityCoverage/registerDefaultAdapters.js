/**
 * registerDefaultAdapters.js — registra i tre domini di base una sola volta.
 */

'use strict';

const { registerDomainAdapter, getDomainAdapter } = require('./coverageRegistry');
const { COVERAGE_DOMAINS } = require('./coverageTypes');
const welder9606Adapter = require('./adapters/welder9606.adapter');
const wpqrProcedureAdapter = require('./adapters/wpqrProcedure.adapter');
const cnd9712Adapter = require('./adapters/cnd9712.adapter');

function ensureDefaultAdapters() {
    if (!getDomainAdapter(COVERAGE_DOMAINS.WELDER_9606)) {
        registerDomainAdapter(welder9606Adapter);
    }
    if (!getDomainAdapter(COVERAGE_DOMAINS.WPQR_PROCEDURE)) {
        registerDomainAdapter(wpqrProcedureAdapter);
    }
    if (!getDomainAdapter(COVERAGE_DOMAINS.CND_9712)) {
        registerDomainAdapter(cnd9712Adapter);
    }
}

ensureDefaultAdapters();

module.exports = { ensureDefaultAdapters };
