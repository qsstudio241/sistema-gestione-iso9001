'use strict';

const { verifyWpqr, verifyQualification, validateFinding } = require('./index');
const { ENGINE_VERSION } = require('./verifyEngine');
const {
    makeFinding, FAMILY, SEVERITY, STATUS, TEXT_STATUS, ENGINE_CODES,
} = require('./findingTypes');
const registry = require('./verifyRegistry');
const { ensureDefaultPacks, DEFAULT_PACKS } = require('./registerDefaultPacks');

const wpqr = (over = {}) => ({
    standard_reference: 'ISO 15614-1:2017',
    joint_type: 'BW',
    welding_process: '135',
    thickness_test_mm: 12,
    ...over,
});

const verifiable = (over = {}) => makeFinding({
    code: 'T.WPQR.X',
    family: FAMILY.CORRETTEZZA,
    severity: SEVERITY.WARN,
    status: STATUS.VERIFICABILE,
    field: 'thickness_max',
    direction: 'over_claim',
    source: { clause: 'T-1 §1', text_status: TEXT_STATUS.MD_INTEGRALE },
    message_it: 'Spessore oltre il campo (T-1 §1).',
    ...over,
});

afterEach(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

describe('verifyWpqr — pack stub (nessuna regola)', () => {
    const covered = [
        [{ standard_reference: 'ISO 15614-1:2017', joint_type: 'BW' }, '15614-1:BW', '15614-1', '2017'],
        [{ standard_reference: 'ISO 15614-1:2017+A1:2019', joint_type: 'FW' }, '15614-1:FW', '15614-1', '2017+A1:2019'],
        [{ standard_reference: 'ISO 15614-1:2017' }, '15614-1:UNKNOWN', '15614-1', '2017'],
        [{ standard_reference: 'ISO 15614-2:2025', joint_type: 'BW' }, '15614-2:BW', '15614-2', '2025'],
        [{ standard_reference: 'ISO 15614-2:2025', joint_type: 'FW' }, '15614-2:FW', '15614-2', '2025'],
        [{ standard_reference: 'ISO 14555:2025' }, '14555:SW', '14555', '2025'],
    ];

    test.each(covered)('%j → profilo %s, findings vuoti, summary a zero', (input, profile, family, edition) => {
        for (const mode of ['ingest', 'review', 'db']) {
            const r = verifyWpqr(input, { mode });
            expect(r).toEqual({
                profile,
                standard: { family, edition },
                findings: [],
                summary: {
                    warn: 0, info: 0, verificabili: 0, non_verificabili: 0,
                },
                engine_version: ENGINE_VERSION,
                mode,
                domain: 'wpqr',
            });
        }
    });

    test('mode non valido → review; engine_version presente', () => {
        const r = verifyWpqr(wpqr(), { mode: 'boh' });
        expect(r.mode).toBe('review');
        expect(r.engine_version).toBe(ENGINE_VERSION);
        expect(verifyWpqr(wpqr()).mode).toBe('review');
    });

    test('record sconosciuto, vuoto o non oggetto: un solo finding valido, nessun errore', () => {
        for (const bad of [null, undefined, {}, 'x']) {
            const r = verifyWpqr(bad);
            expect(r.domain).toBe('wpqr');
            expect(r.findings).toHaveLength(1);
            expect(r.findings[0].code).toBe(ENGINE_CODES.SOURCE_MISSING);
            expect(validateFinding(r.findings[0])).toEqual({ ok: true, errors: [] });
        }
    });
});

describe('verifyWpqr — norma o edizione non coperta / dato mancante', () => {
    test.each([
        ['ISO 15614-1:2004+A2:2012', 'ISO 15614-1:2004+A2:2012'],
        ['EN ISO 15614-1:2012', 'ISO 15614-1:2004+A2:2012'],
        ['ISO 15614-2:2005', 'ISO 15614-2:2005'],
        ['ISO 14555:2017', 'ISO 14555:2017'],
        ['ISO 15614-3:2008', 'ISO 15614-3:2008'],
        ['ISO 15614-10:2005', 'ISO 15614-10:2005'],
        ['Norma interna', null],
    ])('%s → un solo non_verificabile_fonte_mancante', (ref, named) => {
        const r = verifyWpqr(wpqr({ standard_reference: ref, joint_type: 'BW' }));
        expect(r.profile).toBeNull();
        expect(r.findings).toHaveLength(1);
        const [f] = r.findings;
        expect(f).toMatchObject({
            code: ENGINE_CODES.SOURCE_MISSING, status: STATUS.NON_VERIFICABILE_FONTE_MANCANTE, severity: SEVERITY.INFO,
        });
        if (named) expect(f.message_it).toContain(named);
        expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
        expect(r.summary).toEqual({
            warn: 0, info: 1, verificabili: 0, non_verificabili: 1,
        });
    });

    test('15614-2 senza tipo giunto leggibile → un solo non_verificabile_dato_mancante', () => {
        const r = verifyWpqr({ standard_reference: 'ISO 15614-2:2025' });
        expect(r.profile).toBeNull();
        expect(r.findings).toHaveLength(1);
        expect(r.findings[0]).toMatchObject({
            code: ENGINE_CODES.PROFILE_UNRESOLVED, status: STATUS.NON_VERIFICABILE_DATO_MANCANTE, field: 'joint_type',
        });
    });

    test('ISO 15613 senza parte 15614 → un solo finding informativo non_verificabile_dato_mancante', () => {
        const r = verifyWpqr({ standard_reference: 'EN ISO 15613:2025', joint_type: 'BW' });
        expect(r.profile).toBeNull();
        expect(r.findings).toHaveLength(1);
        const [f] = r.findings;
        expect(f).toMatchObject({
            code: ENGINE_CODES.PROFILE_UNRESOLVED,
            status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
            severity: SEVERITY.INFO,
            field: 'range_standard_reference',
        });
        expect(f.message_it).toContain('15613');
        expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
    });

    test('ISO 15613 con range espresso secondo 15614-1 → profilo della parte dichiarata', () => {
        const r = verifyWpqr({
            standard_reference: 'ISO 15613:2025',
            range_standard_reference: 'ISO 15614-1:2017+A1:2019 Level 2',
            joint_type: 'FW',
        });
        expect(r.profile).toBe('15614-1:FW');
        expect(r.standard).toEqual({ family: '15614-1', edition: '2017+A1:2019' });
        expect(r.findings).toEqual([]);
    });
});

describe('verifyWpqr — dispatch via registry', () => {
    function useRulePack(rules, extra = {}) {
        registry.clearRulePacks();
        registry.registerRulePack({
            id: 'test.wpqr', standardFamily: '15614-1', editions: ['2017'], profiles: ['15614-1:BW'], rules, ...extra,
        });
    }

    test('le regole del pack ricevono la vista WPQR e i finding sono ordinati (warn prima)', () => {
        const seen = [];
        useRulePack([
            {
                id: 'T.WPQR.INFO',
                family: FAMILY.CORRETTEZZA,
                run: (view) => {
                    seen.push(view);
                    return [verifiable({ code: 'T.WPQR.INFO', severity: SEVERITY.INFO, direction: 'under_claim' })];
                },
            },
            { id: 'T.WPQR.WARN', family: FAMILY.COMPLETEZZA, run: () => [verifiable({ code: 'T.WPQR.WARN', family: FAMILY.COMPLETEZZA })] },
        ]);
        const r = verifyWpqr(wpqr(), { runs: [{ run_label: '1', current_a: 200 }] });
        expect(r.findings.map((f) => f.code)).toEqual(['T.WPQR.WARN', 'T.WPQR.INFO']);
        expect(r.summary).toEqual({
            warn: 1, info: 1, verificabili: 2, non_verificabili: 0,
        });
        expect(seen[0].profile).toBe('15614-1:BW');
        expect(seen[0].runs[0].current_a).toBe(200);
        r.findings.forEach((f) => expect(validateFinding(f)).toEqual({ ok: true, errors: [] }));
    });

    test('regola che lancia → RULE_ERROR, le altre regole proseguono', () => {
        useRulePack([
            { id: 'T.WPQR.BOOM', family: FAMILY.CORRETTEZZA, run: () => { throw new Error('boom'); } },
            { id: 'T.WPQR.OK', family: FAMILY.CORRETTEZZA, run: () => [verifiable({ code: 'T.WPQR.OK' })] },
        ]);
        const r = verifyWpqr(wpqr());
        expect(r.findings.map((f) => f.code).sort()).toEqual([ENGINE_CODES.RULE_ERROR, 'T.WPQR.OK'].sort());
        const err = r.findings.find((f) => f.code === ENGINE_CODES.RULE_ERROR);
        expect(err).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.NON_VERIFICABILE_DATO_MANCANTE });
        expect(err.message_it).toContain('boom');
    });

    test('finding non valido o con codice non dichiarato → RULE_ERROR, mai un warn senza clausola', () => {
        useRulePack([
            { id: 'T.WPQR.BAD', family: FAMILY.CORRETTEZZA, run: () => [{ code: 'T.WPQR.BAD', family: FAMILY.CORRETTEZZA, severity: SEVERITY.WARN, status: STATUS.VERIFICABILE, field: 'x', message_it: 'm' }] },
            { id: 'T.WPQR.UNDECLARED', family: FAMILY.CORRETTEZZA, run: () => [verifiable({ code: 'ALTRO.CODICE' })] },
            { id: 'T.WPQR.NOARRAY', family: FAMILY.CORRETTEZZA, run: () => ({}) },
        ]);
        const r = verifyWpqr(wpqr());
        expect(r.findings).toHaveLength(3);
        expect(r.findings.every((f) => f.code === ENGINE_CODES.RULE_ERROR)).toBe(true);
        expect(r.summary.warn).toBe(0);
    });

    test('codice duplicato → errore di registrazione; codice riservato rifiutato', () => {
        const rule = (id) => ({ id, family: FAMILY.CORRETTEZZA, run: () => [] });
        registry.clearRulePacks();
        registry.registerRulePack({
            id: 'p1', standardFamily: '15614-1', editions: ['2017'], profiles: ['15614-1:BW'], rules: [rule('WPQR15614_1.CORR.DUP')],
        });
        expect(() => registry.registerRulePack({
            id: 'p2', standardFamily: '14555', editions: ['2025'], profiles: ['14555:SW'], rules: [rule('WPQR15614_1.CORR.DUP')],
        })).toThrow(/duplicato/);
        expect(() => registry.registerRulePack({
            id: 'p3', standardFamily: '14555', editions: ['2025'], profiles: ['14555:SW'], rules: [rule(ENGINE_CODES.RULE_ERROR)],
        })).toThrow(/riservato/);
    });

    test('pack WPQR e pack 9606 coesistono senza interferire (profili distinti)', () => {
        ensureDefaultPacks();
        const q = verifyQualification({
            qualification_type: 'Saldatore ISO 9606-1', standard_reference: 'EN ISO 9606-1:2017', joint_type: 'BW',
        });
        expect(q.domain).toBe('qualification');
        expect(q.profile).toBe('9606-1:BW');
        const w = verifyWpqr(wpqr());
        expect(w.domain).toBe('wpqr');
        expect(w.profile).toBe('15614-1:BW');
        expect(w.findings).toEqual([]);
    });
});

describe('registry di default — stub WPQR', () => {
    test('quattro stub WPQR registrati, vuoti, con famiglia, edizioni e profili dichiarati', () => {
        ensureDefaultPacks();
        const ids = ['wpqr.completeness', 'wpqr.15614_1.correctness', 'wpqr.15614_2.correctness', 'wpqr.14555.correctness'];
        for (const id of ids) {
            const pack = registry.getRulePack(id);
            expect(pack).toBeTruthy();
            expect(pack.rules).toEqual([]);
            expect(pack.editions.length).toBeGreaterThan(0);
            expect(pack.profiles.length).toBeGreaterThan(0);
        }
        expect(DEFAULT_PACKS.map((p) => p.id)).toEqual(expect.arrayContaining(ids));
        const profiles = new Set(ids.flatMap((id) => registry.getRulePack(id).profiles));
        expect([...profiles].sort()).toEqual(
            ['14555:SW', '15614-1:BW', '15614-1:FW', '15614-1:UNKNOWN', '15614-2:BW', '15614-2:FW'],
        );
    });
});
