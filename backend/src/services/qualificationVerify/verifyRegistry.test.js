'use strict';

const registry = require('./verifyRegistry');
const { ensureDefaultPacks, DEFAULT_PACKS } = require('./registerDefaultPacks');

const okRule = (id, extra = {}) => ({ id, family: 'completezza', run: () => [], ...extra });
const pack = (over = {}) => ({
    id: 'test.pack',
    standardFamily: '9606-1',
    editions: ['2017'],
    profiles: ['9606-1:BW'],
    rules: [okRule('T.COMP.A')],
    ...over,
});

describe('verifyRegistry', () => {
    beforeEach(() => registry.clearRulePacks());
    afterAll(() => {
        registry.clearRulePacks();
        ensureDefaultPacks();
    });

    test('registra e lista i pack', () => {
        registry.registerRulePack(pack());
        expect(registry.listRulePacks().map((p) => p.id)).toEqual(['test.pack']);
        expect(registry.getRulePack('test.pack').standardFamily).toBe('9606-1');
    });

    test('valida la forma del pack e delle regole', () => {
        expect(() => registry.registerRulePack(null)).toThrow();
        expect(() => registry.registerRulePack(pack({ id: '' }))).toThrow(/id/);
        expect(() => registry.registerRulePack(pack({ standardFamily: '' }))).toThrow(/standardFamily/);
        expect(() => registry.registerRulePack(pack({ editions: [] }))).toThrow(/editions/);
        expect(() => registry.registerRulePack(pack({ profiles: [] }))).toThrow(/profiles/);
        expect(() => registry.registerRulePack(pack({ rules: null }))).toThrow(/rules/);
        expect(() => registry.registerRulePack(pack({ rules: [{ id: 'X', family: 'boh', run() {} }] }))).toThrow(/family/);
        expect(() => registry.registerRulePack(pack({ rules: [{ id: 'X', family: 'completezza' }] }))).toThrow(/run/);
    });

    test('pack con rules vuote è valido (stub)', () => {
        expect(() => registry.registerRulePack(pack({ rules: [] }))).not.toThrow();
    });

    test('id pack duplicato = errore di registrazione', () => {
        registry.registerRulePack(pack());
        expect(() => registry.registerRulePack(pack({ rules: [okRule('T.COMP.B')] }))).toThrow(/duplicato/);
    });

    test('code duplicato tra pack o nello stesso pack = errore di registrazione', () => {
        registry.registerRulePack(pack());
        expect(() => registry.registerRulePack(pack({ id: 'altro', rules: [okRule('T.COMP.A')] }))).toThrow(/Codice finding duplicato/);
        expect(() => registry.registerRulePack(pack({ id: 'altro2', rules: [okRule('T.COMP.C'), okRule('T.COMP.C')] }))).toThrow(/duplicato/);
        expect(() => registry.registerRulePack(pack({ id: 'altro3', rules: [okRule('R', { codes: ['T.COMP.A'] })] }))).toThrow(/duplicato/);
        expect(registry.listRulePacks()).toHaveLength(1);
    });

    test('codici riservati all\'engine non registrabili', () => {
        expect(() => registry.registerRulePack(pack({ rules: [okRule('QV.ENGINE.RULE_ERROR')] }))).toThrow(/riservato/);
    });

    test('isStandardCovered: edizione nota, ignota e non dichiarata', () => {
        registry.registerRulePack(pack());
        expect(registry.isStandardCovered({ family: '9606-1', edition: '2017' })).toBe(true);
        expect(registry.isStandardCovered({ family: '9606-1', edition: null })).toBe(true);
        expect(registry.isStandardCovered({ family: '9606-1', edition: '2004' })).toBe(false);
        expect(registry.isStandardCovered({ family: '9606-2', edition: '2004' })).toBe(false);
        expect(registry.isStandardCovered({ family: null, edition: null })).toBe(false);
    });

    test('getRulesForProfile e resolveProfileKey', () => {
        registry.registerRulePack(pack());
        expect(registry.getRulesForProfile('9606-1:BW').map((x) => x.rule.id)).toEqual(['T.COMP.A']);
        expect(registry.getRulesForProfile('9606-1:FW')).toEqual([]);
        expect(registry.resolveProfileKey({ profile: '9606-1:BW' })).toBe('9606-1:BW');
        expect(registry.resolveProfileKey({})).toBeNull();
        expect(registry.resolveProfileKey(null)).toBeNull();
    });

    test('registerDefaultPacks registra i quattro pack stub, in modo idempotente', () => {
        ensureDefaultPacks();
        ensureDefaultPacks();
        expect(registry.listRulePacks().map((p) => p.id).sort()).toEqual(DEFAULT_PACKS.map((p) => p.id).sort());
        expect(DEFAULT_PACKS).toHaveLength(4);
        expect(DEFAULT_PACKS.every((p) => p.rules.length === 0)).toBe(true);
    });
});
