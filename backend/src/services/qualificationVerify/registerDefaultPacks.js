/**
 * registerDefaultPacks.js — elenco ESPLICITO dei pack registrati di default
 * (stesso stile di capabilityCoverage/registerDefaultAdapters.js).
 * Ogni slice sovrascrive solo il proprio `*.pack.js`: questo file non cambia.
 */

'use strict';

const { registerRulePack, getRulePack } = require('./verifyRegistry');
const welder9606Completeness = require('./packs/welder9606Completeness.pack');
const welder9606Correctness = require('./packs/welder9606Correctness.pack');
const welder9606Part2 = require('./packs/welder9606Part2.pack');
const operator14732 = require('./packs/operator14732.pack');

const DEFAULT_PACKS = [
    welder9606Completeness,
    welder9606Correctness,
    welder9606Part2,
    operator14732,
];

function ensureDefaultPacks() {
    for (const pack of DEFAULT_PACKS) {
        if (!getRulePack(pack.id)) registerRulePack(pack);
    }
}

ensureDefaultPacks();

module.exports = { ensureDefaultPacks, DEFAULT_PACKS };
