/**
 * verifyRegistry.js — registry dei pack di regole (plug-in), stesso schema di
 * capabilityCoverage/coverageRegistry.js. L'engine non conosce le norme: chiede al registry.
 */

'use strict';

const { FAMILY, ENGINE_CODES } = require('./findingTypes');

/**
 * @typedef {{id: string, family: string, codes?: string[], run: function(object): object[]}} Rule
 * @typedef {{id: string, standardFamily: string, editions: string[], profiles: string[], rules: Rule[]}} RulePack
 */

/** @type {Map<string, RulePack>} */
const packs = new Map();
/** @type {Map<string, string>} codice finding → id pack che lo dichiara */
const codeOwners = new Map();

const RESERVED_CODES = new Set(Object.values(ENGINE_CODES));
const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

function ruleCodes(rule) {
    return Array.isArray(rule.codes) && rule.codes.length ? rule.codes : [rule.id];
}

function validatePackShape(pack) {
    if (!pack || typeof pack !== 'object') throw new Error('RulePack: oggetto obbligatorio');
    if (!isNonEmptyString(pack.id)) throw new Error('RulePack: id obbligatorio');
    if (!isNonEmptyString(pack.standardFamily)) throw new Error(`RulePack ${pack.id}: standardFamily obbligatoria`);
    if (!Array.isArray(pack.editions) || !pack.editions.length || !pack.editions.every(isNonEmptyString)) {
        throw new Error(`RulePack ${pack.id}: editions[] obbligatorio (edizioni coperte)`);
    }
    if (!Array.isArray(pack.profiles) || !pack.profiles.length || !pack.profiles.every(isNonEmptyString)) {
        throw new Error(`RulePack ${pack.id}: profiles[] obbligatorio`);
    }
    if (!Array.isArray(pack.rules)) throw new Error(`RulePack ${pack.id}: rules[] obbligatorio (può essere vuoto)`);
    const families = Object.values(FAMILY);
    for (const rule of pack.rules) {
        if (!rule || !isNonEmptyString(rule.id)) throw new Error(`RulePack ${pack.id}: ogni regola richiede id`);
        if (!families.includes(rule.family)) throw new Error(`Regola ${rule.id}: family non valida (${rule.family})`);
        if (typeof rule.run !== 'function') throw new Error(`Regola ${rule.id}: run(view) obbligatorio`);
    }
}

/** @param {RulePack} pack */
function registerRulePack(pack) {
    validatePackShape(pack);
    if (packs.has(pack.id)) throw new Error(`RulePack duplicato: ${pack.id}`);

    const newCodes = new Map();
    for (const rule of pack.rules) {
        for (const code of ruleCodes(rule)) {
            if (RESERVED_CODES.has(code)) throw new Error(`Codice riservato all'engine: ${code}`);
            if (codeOwners.has(code) || newCodes.has(code)) throw new Error(`Codice finding duplicato: ${code}`);
            newCodes.set(code, pack.id);
        }
    }

    packs.set(pack.id, pack);
    for (const [code, owner] of newCodes) codeOwners.set(code, owner);
}

function getRulePack(id) {
    return packs.get(String(id || '')) || null;
}

/** @returns {RulePack[]} */
function listRulePacks() {
    return Array.from(packs.values());
}

/** Chiave profilo calcolata dalla vista record (`null` = norma non riconosciuta o giunto non leggibile). */
function resolveProfileKey(view) {
    return (view && view.profile) || null;
}

/** La norma/edizione è coperta da almeno un pack? Edizione non dichiarata = coperta (non si inventa un rifiuto). */
function isStandardCovered(standard) {
    if (!standard || !standard.family) return false;
    return listRulePacks().some((p) => p.standardFamily === standard.family
        && (!standard.edition || p.editions.includes(standard.edition)));
}

/** Regole dei pack che servono il profilo, nell'ordine di registrazione. */
function getRulesForProfile(profileKey) {
    const out = [];
    for (const pack of listRulePacks()) {
        if (!pack.profiles.includes(profileKey)) continue;
        for (const rule of pack.rules) out.push({ packId: pack.id, rule });
    }
    return out;
}

function getDeclaredCodes(rule) {
    return ruleCodes(rule);
}

/** Solo test / hot-reload. */
function clearRulePacks() {
    packs.clear();
    codeOwners.clear();
}

module.exports = {
    registerRulePack,
    getRulePack,
    listRulePacks,
    resolveProfileKey,
    isStandardCovered,
    getRulesForProfile,
    getDeclaredCodes,
    clearRulePacks,
};
