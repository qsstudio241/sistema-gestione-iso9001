'use strict';

/**
 * Regressione di taratura (VQ-TUNE, 06/10/2026): le 22 fixture SINTETICHE proposte da
 * docs/reference/VERIFICA_QUALIFICHE_CAMPIONE_DB_2026-10-06.md § 10, eseguite sul motore completo
 * (pack di completezza + correttezza 9606-1, modalità `db`). Nessun dato reale o identificativo:
 * sono pattern inventati. `warn` = elenco ESATTO dei warn attesi dopo la taratura.
 */

const { verifyQualification, validateFinding } = require('./index');
const registry = require('./verifyRegistry');
const { ensureDefaultPacks } = require('./registerDefaultPacks');
const { SEVERITY, STATUS } = require('./findingTypes');

const C = 'WQ9606_1.COMP.';
const R = 'WQ9606_1.CORR.';

const BW = {
    qualification_type: 'Saldatore ISO 9606-1',
    standard_ref: 'EN ISO 9606-1:2017',
    certificate_number: 'SYN-0001',
    issuing_body: 'Ente sintetico',
    joint_type: 'BW',
    product_type: 'P',
    welding_process: '135',
    welding_process_test: '135',
    filler_material: 'FM1',
    shielding_gas: 'M21',
    transfer_mode: 'short_arc',
    material_group: '1.1',
    weld_details: 'ss nb',
    position_range: 'PA',
    welding_position_test: 'PA',
    thickness_s_test_mm: 6,
    thickness_min_mm: 3,
    thickness_max_mm: 12,
    thickness_max_unlimited: false,
    exam_date: '2025-03-10',
    last_confirmation_date: '2025-09-10',
    next_confirmation_due: '2026-03-10',
    expiry_date: '2028-03-10',
};

const FW = {
    ...BW,
    joint_type: 'FW',
    position_range: 'PA PB',
    welding_position_test: 'PB',
    thickness_s_test_mm: null,
    thickness_t_test_mm: 3,
    thickness_min_mm: 3,
    thickness_max_mm: null,
    thickness_max_unlimited: true,
};

const TUBE = { product_type: 'T', pipe_diameter_test_mm: 60.3 };

/**
 * [id, riga (override su BW), warn attesi (codici esatti), finding attesi per codice → severità/stato]
 */
const FIXTURES = [
    ['S01 BW min 3 + «senza limite», s=12', { thickness_s_test_mm: 12, thickness_max_mm: null, thickness_max_unlimited: true }, [], {
        [`${R}THK_BW_LAYERS`]: [SEVERITY.INFO, STATUS.NON_VERIFICABILE_DATO_MANCANTE],
    }],
    ['S02 BW min 3, max vuoto, flag falso, nessun testo legacy («t≥3»)', { thickness_max_mm: null }, [], {
        [`${C}THK_VALIDITY`]: [SEVERITY.INFO, STATUS.VERIFICABILE],
    }],
    ['S02b BW min 3, max vuoto, testo legacy «3-18 mm»', { thickness_max_mm: null, thickness_range: '3-18 mm' }, [], {
        [`${C}THK_VALIDITY`]: [SEVERITY.INFO, STATUS.VERIFICABILE],
    }],
    ['S02c BW min 3, max vuoto, testo legacy «≥ 3 mm»', { thickness_max_mm: null, thickness_range: '≥ 3 mm' }, [], {
        [`${C}THK_VALIDITY`]: [SEVERITY.INFO, STATUS.VERIFICABILE],
    }],
    ['S03 BW min e max vuoti, nessun testo legacy', { thickness_min_mm: null, thickness_max_mm: null }, [`${C}THK_VALIDITY`], {}],
    ['S03b BW min e max vuoti, testo legacy «3-12.6 mm»', { thickness_min_mm: null, thickness_max_mm: null, thickness_range: '3-12.6 mm' }, [], {
        [`${C}THK_VALIDITY`]: [SEVERITY.INFO, STATUS.VERIFICABILE],
    }],
    ['S04 prossima conferma a 18 mesi dall\'ultima', { last_confirmation_date: '2025-06-11', next_confirmation_due: '2026-12-11' }, [`${R}CONFIRMATION_INTERVAL`], {}],
    ['S05 FW min 1 + «senza limite», t=1', { ...FW, thickness_t_test_mm: 1, thickness_min_mm: 1 }, [`${R}THK_FW`], {}],
    ['S06 BW s=6, 3–13', { thickness_max_mm: 13 }, [`${R}THK_BW`], {}],
    ['S07 BW s=6, 3–12', {}, [], {}],
    ['S08 BW s=6, 6–24', { thickness_min_mm: 6, thickness_max_mm: 24 }, [`${R}THK_BW`], {}],
    ['S09 BW solo t di prova=6, 3–12', { thickness_s_test_mm: null, thickness_t_test_mm: 6 }, [], {
        [`${R}THK_BW`]: [SEVERITY.INFO, STATUS.NON_VERIFICABILE_DATO_MANCANTE],
    }],
    ['S10 tubo D=60,3, min 25', { ...TUBE, pipe_diameter_min_mm: 25 }, [`${R}PIPE_DIAMETER`], {}],
    ['S11 tubo D=60,3, min 60,3', { ...TUBE, pipe_diameter_min_mm: 60.3 }, [], {
        [`${R}PIPE_DIAMETER`]: [SEVERITY.INFO, STATUS.VERIFICABILE],
    }],
    ['S12 FW tubo D=60,3, min 60,3 (ambiguità Tab. 7/FW)', { ...FW, ...TUBE, pipe_diameter_min_mm: 60.3 }, [], {
        [`${R}PIPE_DIAMETER`]: [SEVERITY.INFO, STATUS.VERIFICABILE],
    }],
    ['S12b FW tubo D=60,3, min 25 (più largo di Tab. 7): solo info', { ...FW, ...TUBE, pipe_diameter_min_mm: 25 }, [], {
        [`${R}PIPE_DIAMETER`]: [SEVERITY.INFO, STATUS.VERIFICABILE],
    }],
    ['S13 prova PC, dichiarate PA PC PE', { welding_position_test: 'PC', position_range: 'PA PC PE' }, [`${R}POSITIONS`], {}],
    ['S14 BW dichiarate PA PB (prova PA)', { position_range: 'PA PB' }, [], {
        [`${R}POSITIONS`]: [SEVERITY.INFO, STATUS.NON_VERIFICABILE_DATO_MANCANTE],
    }],
    ['S15 processo 141 con short_arc', { welding_process: '141', welding_process_test: '141' }, [], {
        [`${R}TRANSFER_MODE`]: [SEVERITY.INFO, STATUS.VERIFICABILE],
    }],
    ['S16 apporto FM7', { filler_material: 'FM7' }, [`${R}FILLER_GROUP`], {}],
    ['S17 apporto assente', { filler_material: null }, [`${C}FILLER_GROUP`], {}],
    ['S18 BW diramazione, s letto 3 invece di 6, 3–12 (FP da ambiguità, non tarato)', { weld_details: 'BRANCH ≥60° ss nb', thickness_s_test_mm: 3 }, [`${R}THK_BW`], {}],
    ['S19 prova 141, validità «141, 135»', {
        welding_process: '141', welding_process_test: '141', transfer_mode: null, welding_processes_validity: '141, 135',
    }, [], {
        [`${R}PROCESS`]: [SEVERITY.INFO, STATUS.VERIFICABILE],
    }],
    ['S20 operatore 14732', { qualification_type: 'Operatore ISO 14732', standard_ref: 'ISO 14732:2013' }, [], {}],
    ['S21 NDT, norma assente', { qualification_type: 'NDT UT', standard_ref: null }, [], {
        'QV.ENGINE.SOURCE_MISSING': [SEVERITY.INFO, STATUS.NON_VERIFICABILE_FONTE_MANCANTE],
    }],
    ['S22 FW pulito t=3 + «senza limite», prova PB, dichiarate PA PB', { ...FW }, [], {}],
];

beforeEach(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

afterAll(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

describe('verifyRealPatterns — fixture sintetiche del documento di misura (06/10/2026)', () => {
    test('le fixture sono 22 più le varianti di taratura', () => {
        expect(FIXTURES.filter(([id]) => /^S\d{2} /.test(id))).toHaveLength(22);
    });

    test.each(FIXTURES)('%s', (_id, over, expectedWarn, expectedFindings) => {
        const base = over.joint_type === 'FW' ? FW : BW;
        const { findings } = verifyQualification({ ...base, ...over }, { mode: 'db' });

        findings.forEach((f) => expect(validateFinding(f)).toEqual({ ok: true, errors: [] }));

        const warns = findings.filter((f) => f.severity === SEVERITY.WARN).map((f) => f.code).sort();
        expect(warns).toEqual([...expectedWarn].sort());

        Object.entries(expectedFindings).forEach(([code, [severity, status]]) => {
            const found = findings.filter((f) => f.code === code);
            expect(found).toHaveLength(1);
            expect(found[0]).toMatchObject({ severity, status });
        });
    });

    test('nessuna fixture «t≥3» produce più warn su THK_VALIDITY; i warn veri restano', () => {
        const thkWarn = (over) => verifyQualification({ ...BW, ...over }, { mode: 'db' }).findings
            .filter((f) => f.code === `${C}THK_VALIDITY` && f.severity === SEVERITY.WARN);
        [{ thickness_max_mm: null }, { thickness_max_mm: null, thickness_range: 't≥3' }, { thickness_max_mm: null, thickness_range: '≥3mm' }]
            .forEach((over) => expect(thkWarn(over)).toEqual([]));
        expect(thkWarn({ thickness_min_mm: null, thickness_max_mm: null })).toHaveLength(1);
    });
});
