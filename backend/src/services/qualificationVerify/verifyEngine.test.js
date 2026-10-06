'use strict';

const { verifyQualification, validateFinding, listRulePacks } = require('./index');
const { ENGINE_VERSION } = require('./verifyEngine');
const { makeFinding, FAMILY, SEVERITY, STATUS, TEXT_STATUS, ENGINE_CODES } = require('./findingTypes');
const registry = require('./verifyRegistry');
const { ensureDefaultPacks, DEFAULT_PACKS } = require('./registerDefaultPacks');

const rec9606 = (over = {}) => ({
    qualification_type: 'Saldatore ISO 9606-1',
    standard_reference: 'EN ISO 9606-1:2017',
    joint_type: 'BW',
    ...over,
});

const finding = (over = {}) => makeFinding({
    code: 'T.CORR.X',
    family: FAMILY.CORRETTEZZA,
    severity: SEVERITY.INFO,
    status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
    field: 'thickness_max_mm',
    message_it: 'Dato di prova assente.',
    ...over,
});

function useTestPack(rules, profiles = ['9606-1:BW']) {
    registry.registerRulePack({ id: 'test.pack', standardFamily: '9606-1', editions: ['2017', '2013', '2012'], profiles, rules });
}

// Meccanica dell'engine isolata dal contenuto dei pack: i pack di default entrano vuoti.
function useEmptyDefaultPacks() {
    registry.clearRulePacks();
    for (const pack of DEFAULT_PACKS) registry.registerRulePack({ ...pack, rules: [] });
}

beforeEach(useEmptyDefaultPacks);

afterAll(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

describe('verifyQualification — pack vuoti', () => {
    test.each([
        [rec9606(), '9606-1:BW'],
        [rec9606({ joint_type: 'FW' }), '9606-1:FW'],
        [rec9606({ joint_type: null }), '9606-1:UNKNOWN'],
        [rec9606({ standard_reference: 'ISO 9606-1:2013' }), '9606-1:BW'],
        [rec9606({ standard_reference: 'ISO 9606-1:2012' }), '9606-1:BW'],
        [{ qualification_type: 'Saldatore ISO 9606-2', standard_reference: 'ISO 9606-2:2004', joint_type: 'FW' }, '9606-2:FW'],
        [{ qualification_type: 'Operatore ISO 14732', standard_reference: 'ISO 14732:2013' }, '14732'],
    ])('norma coperta %j → profilo %s, nessun finding, summary a zero', (input, profile) => {
        const r = verifyQualification(input, { mode: 'review' });
        expect(r.profile).toBe(profile);
        expect(r.findings).toEqual([]);
        expect(r.summary).toEqual({ warn: 0, info: 0, verificabili: 0, non_verificabili: 0 });
        expect(r.engine_version).toBe(ENGINE_VERSION);
        expect(r.mode).toBe('review');
    });

    test('mode: ingest/db accettati, valore ignoto → review', () => {
        expect(verifyQualification(rec9606(), { mode: 'ingest' }).mode).toBe('ingest');
        expect(verifyQualification(rec9606(), { mode: 'db' }).mode).toBe('db');
        expect(verifyQualification(rec9606(), { mode: 'xx' }).mode).toBe('review');
        expect(verifyQualification(rec9606()).mode).toBe('review');
    });

    test('mode db legge gli alias della riga DB', () => {
        const seen = [];
        useTestPack([{ id: 'T.COMP.POS', family: 'completezza', run: (v) => { seen.push(v.positions); return []; } }]);
        verifyQualification(rec9606({ position_range: 'PA, PB' }), { mode: 'db' });
        verifyQualification(rec9606({ welding_positions: ['PC'] }), { mode: 'review' });
        expect(seen).toEqual([['PA', 'PB'], ['PC']]);
    });
});

describe('verifyQualification — norma o edizione non coperta', () => {
    test.each([
        ['EN 287-1', { qualification_type: 'Saldatore ISO 9606-1', standard_reference: 'EN 287-1:2011', joint_type: 'BW' }],
        ['9606-1:2004', rec9606({ standard_reference: 'ISO 9606-1:2004' })],
        ['9606-3', { qualification_type: 'ISO 9606-3', joint_type: 'BW' }],
        ['sconosciuta', { qualification_type: 'Operatore NDT UT', standard_reference: 'ISO 9712' }],
        ['vuoto', {}],
        ['null', null],
    ])('%s → un solo finding non_verificabile_fonte_mancante', (_n, input) => {
        const r = verifyQualification(input);
        expect(r.profile).toBeNull();
        expect(r.findings).toHaveLength(1);
        const [f] = r.findings;
        expect(f.code).toBe(ENGINE_CODES.SOURCE_MISSING);
        expect(f.status).toBe(STATUS.NON_VERIFICABILE_FONTE_MANCANTE);
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.source.text_status).toBe(TEXT_STATUS.ASSENTE);
        expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
        expect(r.summary).toEqual({ warn: 0, info: 1, verificabili: 0, non_verificabili: 1 });
    });

    test('EN 287-1 non esegue le regole dei pack', () => {
        const run = jest.fn(() => []);
        useTestPack([{ id: 'T.COMP.A', family: 'completezza', run }]);
        verifyQualification({ standard_reference: 'EN 287-1:2011', joint_type: 'BW' });
        expect(run).not.toHaveBeenCalled();
    });

    test('9606-2 senza tipo giunto → un solo finding dato_mancante (norma coperta)', () => {
        const r = verifyQualification({ qualification_type: 'Saldatore ISO 9606-2', standard_reference: 'ISO 9606-2:2004' });
        expect(r.profile).toBeNull();
        expect(r.standard).toEqual({ family: '9606-2', edition: '2004' });
        expect(r.findings).toHaveLength(1);
        expect(r.findings[0].code).toBe(ENGINE_CODES.PROFILE_UNRESOLVED);
        expect(r.findings[0].status).toBe(STATUS.NON_VERIFICABILE_DATO_MANCANTE);
    });
});

describe('verifyQualification — esecuzione regole', () => {
    test('regola che lancia → finding info RULE_ERROR, nessuna eccezione, le altre regole girano', () => {
        useTestPack([
            { id: 'T.COMP.BOOM', family: 'completezza', run: () => { throw new Error('boom'); } },
            { id: 'T.COMP.OK', family: 'completezza', run: () => [finding({ code: 'T.COMP.OK', family: FAMILY.COMPLETEZZA })] },
        ]);
        let r;
        expect(() => { r = verifyQualification(rec9606()); }).not.toThrow();
        expect(r.findings).toHaveLength(2);
        const err = r.findings.find((f) => f.code === ENGINE_CODES.RULE_ERROR);
        expect(err.severity).toBe(SEVERITY.INFO);
        expect(err.message_it).toMatch(/T\.COMP\.BOOM.*boom/);
        expect(validateFinding(err).ok).toBe(true);
        expect(r.findings.some((f) => f.code === 'T.COMP.OK')).toBe(true);
    });

    test('finding non valido, codice non dichiarato o output non array → RULE_ERROR', () => {
        useTestPack([
            { id: 'T.COMP.BLOCK', family: 'completezza', run: () => [{ ...finding({ code: 'T.COMP.BLOCK' }), severity: 'error' }] },
            { id: 'T.COMP.ALIEN', family: 'completezza', run: () => [finding({ code: 'ALTRO.CODICE' })] },
            { id: 'T.COMP.OBJ', family: 'completezza', run: () => ({ a: 1 }) },
            { id: 'T.COMP.NIL', family: 'completezza', run: () => undefined },
        ]);
        const r = verifyQualification(rec9606());
        expect(r.findings).toHaveLength(3);
        expect(r.findings.every((f) => f.code === ENGINE_CODES.RULE_ERROR)).toBe(true);
    });

    test('ordinamento: warn prima di info, completezza prima di correttezza, stabile', () => {
        const mk = (code, family, severity) => finding({
            code,
            family,
            severity,
            status: severity === SEVERITY.WARN ? STATUS.VERIFICABILE : STATUS.NON_VERIFICABILE_DATO_MANCANTE,
            source: severity === SEVERITY.WARN ? { clause: '§5.1', text_status: TEXT_STATUS.MD_INTEGRALE } : {},
            message_it: severity === SEVERITY.WARN ? `Controllo ${code} (§5.1)` : `Controllo ${code}`,
        });
        useTestPack([
            { id: 'T.R1', family: 'correttezza', codes: ['T.CORR.I1', 'T.CORR.W1'], run: () => [mk('T.CORR.I1', 'correttezza', 'info'), mk('T.CORR.W1', 'correttezza', 'warn')] },
            { id: 'T.R2', family: 'completezza', codes: ['T.COMP.I1', 'T.COMP.W1', 'T.COMP.W2'], run: () => [mk('T.COMP.I1', 'completezza', 'info'), mk('T.COMP.W1', 'completezza', 'warn'), mk('T.COMP.W2', 'completezza', 'warn')] },
        ]);
        const order = verifyQualification(rec9606()).findings.map((f) => f.code);
        expect(order).toEqual(['T.COMP.W1', 'T.COMP.W2', 'T.CORR.W1', 'T.COMP.I1', 'T.CORR.I1']);
        expect(verifyQualification(rec9606()).findings.map((f) => f.code)).toEqual(order);
        const { summary } = verifyQualification(rec9606());
        expect(summary).toEqual({ warn: 3, info: 2, verificabili: 3, non_verificabili: 2 });
    });

    test('regole solo per i pack del profilo risolto', () => {
        const bw = jest.fn(() => []);
        const fw = jest.fn(() => []);
        registry.registerRulePack({ id: 'test.bw', standardFamily: '9606-1', editions: ['2017'], profiles: ['9606-1:BW'], rules: [{ id: 'T.BW', family: 'completezza', run: bw }] });
        registry.registerRulePack({ id: 'test.fw', standardFamily: '9606-1', editions: ['2017'], profiles: ['9606-1:FW'], rules: [{ id: 'T.FW', family: 'completezza', run: fw }] });
        verifyQualification(rec9606({ joint_type: 'FW' }));
        expect(bw).not.toHaveBeenCalled();
        expect(fw).toHaveBeenCalledTimes(1);
    });
});

describe('contratto su tutti i pack registrati', () => {
    beforeEach(() => {
        registry.clearRulePacks();
        ensureDefaultPacks();
    });

    const fixtures = [
        rec9606(),
        rec9606({ joint_type: 'FW', product_type: 'T', thickness_t_test_mm: 8, welding_positions: ['PF'] }),
        rec9606({ joint_type: null }),
        { qualification_type: 'Saldatore ISO 9606-2', standard_reference: 'ISO 9606-2:2004', joint_type: 'BW' },
        { qualification_type: 'Saldatore ISO 9606-2', standard_reference: 'ISO 9606-2:2004', joint_type: 'FW' },
        { qualification_type: 'Operatore ISO 14732', standard_reference: 'ISO 14732:2013' },
        { qualification_type: 'Saldatore ISO 9606-1', standard_reference: 'EN 287-1:2011' },
        {},
    ];

    test('ogni finding prodotto dal registry è valido e ha severity info|warn', () => {
        expect(listRulePacks().length).toBeGreaterThan(0);
        for (const input of fixtures) {
            for (const mode of ['ingest', 'review', 'db']) {
                const r = verifyQualification(input, { mode });
                for (const f of r.findings) {
                    expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
                    expect([SEVERITY.INFO, SEVERITY.WARN]).toContain(f.severity);
                }
            }
        }
    });

    test('ogni regola di ogni pack, eseguita su ogni fixture, produce solo finding validi con codice dichiarato', () => {
        const { toRecordView } = require('./qualificationRecordView');
        for (const pack of listRulePacks()) {
            for (const rule of pack.rules) {
                for (const input of fixtures) {
                    const out = rule.run(toRecordView(input));
                    for (const raw of out || []) {
                        const f = makeFinding(raw);
                        expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
                        expect(registry.getDeclaredCodes(rule)).toContain(f.code);
                    }
                }
            }
        }
    });

    test('i codici sono unici nel registry', () => {
        const codes = listRulePacks().flatMap((p) => p.rules.flatMap((r) => registry.getDeclaredCodes(r)));
        expect(new Set(codes).size).toBe(codes.length);
    });
});
