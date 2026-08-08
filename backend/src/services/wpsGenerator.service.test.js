'use strict';

const {
    generateWpsFromWpqr,
    assessJointCoverageInputs,
    checkThicknessCoverage,
    checkDiameterCoverage,
    checkThroatCoverage,
} = require('./wpsGenerator.service');

/** Fixture WPQR caso Mason (in-memory). */
const WPQR_MASON_DEMO = {
    id: 1,
    wpqr_code: 'WPQR-MASON-DEMO',
    welding_process: '135',
    base_material_group: '1.2',
    joint_type: 'FW',
    thickness_tested: 10,
    thickness_min: 3,
    thickness_max: 20,
    filler_material: 'G 42 4 M21 3Si1',
    shielding_gas: 'M21',
    welding_positions: 'PA',
    standard_reference: 'ISO 15614-1',
};

const MASON_REQUEST = {
    joint_type: 'FW',
    welding_process: '135',
    parent_material_a: 'S355',
    parent_material_b: 'S235',
    thickness_a_mm: 10,
    thickness_b_mm: 5,
};

describe('wpsGenerator.service (P0)', () => {
    test('1 — FW S355 10 + S235 5 con WPQR demo → ok', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: MASON_REQUEST,
            wpqrRecords: [WPQR_MASON_DEMO],
        });
        expect(['ok', 'partial']).toContain(result.status);
        expect(result.wpqr_used).toBeTruthy();
        expect(result.wpqr_used.wpqr_code).toBe('WPQR-MASON-DEMO');
        expect(result.wps_draft).toBeTruthy();
        expect(result.wps_draft.joint_type).toBe('FW');
        expect(result.wps_draft.wpqr_ref).toBe('WPQR-MASON-DEMO');
        expect(result.wps_draft.welding_process).toBe('135');
        expect(result.extensions_needed).toEqual([]);
    });

    test('2 — WPQR gruppo 8.1 → not_possible (materiale)', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: MASON_REQUEST,
            wpqrRecords: [{ ...WPQR_MASON_DEMO, base_material_group: '8.1' }],
        });
        expect(result.status).toBe('not_possible');
        expect(result.wps_draft).toBeNull();
        expect(result.extensions_needed.join(' ')).toMatch(/gruppo materiale|1\.2|1\.1/i);
    });

    test('3 — thickness_max 8 → not_possible (spessore)', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: MASON_REQUEST,
            wpqrRecords: [{ ...WPQR_MASON_DEMO, thickness_max: 8 }],
        });
        expect(result.status).toBe('not_possible');
        expect(result.extensions_needed.join(' ')).toMatch(/[Ss]pessor|fuori range|10/i);
    });

    test('4 — lista WPQR vuota → not_possible registro', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: MASON_REQUEST,
            wpqrRecords: [],
        });
        expect(result.status).toBe('not_possible');
        expect(result.extensions_needed.join(' ')).toMatch(/vuoto|nessuna/i);
    });

    test('checkThicknessCoverage: entrambi spessori nel range', () => {
        const r = checkThicknessCoverage(WPQR_MASON_DEMO, 10, 5);
        expect(r.ok).toBe(true);
        expect(r.partial).toBe(false);
    });

    test('grado passato come codice gruppo funziona', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: {
                ...MASON_REQUEST,
                parent_material_a: '1.2',
                parent_material_b: '1.1',
            },
            wpqrRecords: [WPQR_MASON_DEMO],
        });
        expect(['ok', 'partial']).toContain(result.status);
    });
});

/**
 * Gap analysis 07/08/2026 (WPQR reale VB0377/23 "ADA", cliente Mason): giunto
 * FW (angolo) con range spessore materiale base dichiarato aperto "t1 = >=5 ;
 * t2 => 5" (nessun limite superiore). Prima del fix, thickness_max=null veniva
 * sempre ricalcolato con la formula Tabella 7 (BW), rifiutando come "fuori
 * range" spessori di produzione realmente coperti (es. 80mm).
 */
const WPQR_FW_UNLIMITED = {
    id: 2,
    wpqr_code: 'VB0377/23',
    welding_process: '138',
    base_material_group: '1.2',
    joint_type: 'FW',
    thickness_tested: 30,
    thickness_min: 5,
    thickness_max: null,
    thickness_max_unlimited: true,
    filler_material: 'T42 6 MM 1 H5',
    welding_positions: 'PB',
    standard_reference: 'ISO 15614-1',
};

describe('checkThicknessCoverage — range aperto FW senza limite superiore (WPQR VB0377/23)', () => {
    test('spessori elevati (80mm) risultano coperti, non più rifiutati', () => {
        const r = checkThicknessCoverage(WPQR_FW_UNLIMITED, 80, 80);
        expect(r.ok).toBe(true);
        expect(r.partial).toBe(false);
        expect(r.range.max).toBeNull();
    });

    test('spessore sotto il minimo dichiarato (3mm < 5mm) resta correttamente fuori range', () => {
        const r = checkThicknessCoverage(WPQR_FW_UNLIMITED, 3, 80);
        expect(r.ok).toBe(false);
    });

    test('flag come numero 1 (compatibilità DB BIT) equivale a true', () => {
        const r = checkThicknessCoverage({ ...WPQR_FW_UNLIMITED, thickness_max_unlimited: 1 }, 80, 80);
        expect(r.ok).toBe(true);
        expect(r.range.max).toBeNull();
    });

    test('senza il flag (thickness_max realmente assente, non illimitato) il fallback calcolato resta attivo', () => {
        const r = checkThicknessCoverage({ ...WPQR_FW_UNLIMITED, thickness_max_unlimited: false }, 80, 80);
        // thickness_tested=30 → Tabella 7 Level 2 darebbe max 33mm: 80mm risulta fuori range.
        expect(r.ok).toBe(false);
    });

    test('generateWpsFromWpqr end-to-end: bozza WPS con thickness_range_max=null (illimitato)', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: {
                joint_type: 'FW',
                welding_process: '138',
                parent_material_a: 'S355',
                parent_material_b: 'S355',
                thickness_a_mm: 80,
                thickness_b_mm: 80,
            },
            wpqrRecords: [WPQR_FW_UNLIMITED],
        });
        expect(['ok', 'partial']).toContain(result.status);
        expect(result.wps_draft).toBeTruthy();
        expect(result.wps_draft.thickness_range_max).toBeNull();
        expect(result.candidates[0].thickness_max_unlimited).toBe(true);
    });
});

/**
 * Gap analysis 07/08/2026 (gap report GAP_WPQR_ESTENSIONI_ANNEX_B): diametro
 * tubo acquisito dall'ingest ma mai usato nel calcolo copertura. Fix: filtro
 * diametro Tabella 9 (ISO 15614-1 §8.3.3), applicato SOLO se il chiamante
 * richiede esplicitamente un diametro (giunto su tubo).
 */
describe('checkDiameterCoverage — Tabella 9 (Level 2 variabile essenziale)', () => {
    const WPQR_TUBE_LEVEL2 = {
        id: 3,
        wpqr_code: 'WPQR-TUBE-L2',
        qualification_level: '2',
        diameter_min: 50,
        diameter_max: 200,
    };

    test('nessun diametro richiesto (giunto su piastra) → non applicabile, sempre ok', () => {
        const r = checkDiameterCoverage(WPQR_TUBE_LEVEL2, null);
        expect(r.ok).toBe(true);
        expect(r.applicable).toBe(false);
    });

    test('diametro richiesto entro il range dichiarato → ok', () => {
        const r = checkDiameterCoverage(WPQR_TUBE_LEVEL2, 100);
        expect(r.ok).toBe(true);
        expect(r.applicable).toBe(true);
    });

    test('diametro richiesto fuori dal range dichiarato → non ok', () => {
        const r = checkDiameterCoverage(WPQR_TUBE_LEVEL2, 500);
        expect(r.ok).toBe(false);
    });

    test('Level 1 → diametro non variabile essenziale, sempre ok anche fuori range dichiarato', () => {
        const r = checkDiameterCoverage({ ...WPQR_TUBE_LEVEL2, qualification_level: '1', diameter_min: 50, diameter_max: 60 }, 500);
        expect(r.ok).toBe(true);
        expect(r.reason).toMatch(/Level 1/);
    });

    test('Level 2 senza diametro dichiarato → fail-closed (non fail-open), richiede verifica manuale', () => {
        const r = checkDiameterCoverage({ ...WPQR_TUBE_LEVEL2, diameter_min: null, diameter_max: null }, 100);
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/non dichiarato/);
    });

    test('qualification_level assente → default Level 2 (norma, requisiti più severi) — fail-closed senza dichiarazione', () => {
        const r = checkDiameterCoverage({ ...WPQR_TUBE_LEVEL2, qualification_level: null, diameter_min: null, diameter_max: null }, 100);
        expect(r.ok).toBe(false);
    });

    test('generateWpsFromWpqr end-to-end: candidato con diametro fuori range viene escluso', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: {
                ...MASON_REQUEST,
                pipe_diameter_mm: 500,
            },
            wpqrRecords: [{ ...WPQR_MASON_DEMO, qualification_level: '2', diameter_min: 50, diameter_max: 200 }],
        });
        expect(result.status).toBe('not_possible');
        expect(result.extensions_needed.join(' ')).toMatch(/[Dd]iametro/);
    });

    test('generateWpsFromWpqr end-to-end: candidato con diametro nel range viene accettato', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: {
                ...MASON_REQUEST,
                pipe_diameter_mm: 100,
            },
            wpqrRecords: [{ ...WPQR_MASON_DEMO, qualification_level: '2', diameter_min: 50, diameter_max: 200 }],
        });
        expect(['ok', 'partial']).toContain(result.status);
        expect(result.wpqr_used).toBeTruthy();
    });
});

/**
 * Gap analysis 07/08/2026 (GAP_WPQR_ESTENSIONI_ANNEX_B, item 1 — chiusura
 * completa): la gola richiesta per generare una WPS su giunto FW ora viene
 * verificata contro il range qualificato Tabella 8 (calcolato da
 * thickness_tested, come già usato in checkThicknessCoverage come hint).
 */
describe('checkThroatCoverage — Tabella 8 (giunti FW)', () => {
    const WPQR_FW_T10 = {
        id: 4,
        wpqr_code: 'WPQR-FW-T10',
        joint_type: 'FW',
        thickness_tested: 10,
    };

    test('nessuna gola richiesta (giunto BW o non specificata) → non applicabile, sempre ok', () => {
        const r = checkThroatCoverage(WPQR_FW_T10, null);
        expect(r.ok).toBe(true);
        expect(r.applicable).toBe(false);
    });

    test('WPQR non FW → non applicabile la verifica gola, esclusa', () => {
        const r = checkThroatCoverage({ ...WPQR_FW_T10, joint_type: 'BW' }, 5);
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/non è un giunto FW/);
    });

    test('gola entro il range Tabella 8 (t=10 → 3-20mm per 3<t<30) → ok', () => {
        const r = checkThroatCoverage(WPQR_FW_T10, 10);
        expect(r.ok).toBe(true);
        expect(r.range).toEqual({ min: 3, max: 20 });
    });

    test('gola sotto il minimo Tabella 8 → non ok', () => {
        const r = checkThroatCoverage(WPQR_FW_T10, 1);
        expect(r.ok).toBe(false);
    });

    test('gola sopra il massimo Tabella 8 → non ok', () => {
        const r = checkThroatCoverage(WPQR_FW_T10, 25);
        expect(r.ok).toBe(false);
    });

    test('t>=30mm → solo minimo 5mm, nessun massimo (range aperto)', () => {
        const r = checkThroatCoverage({ ...WPQR_FW_T10, thickness_tested: 30 }, 500);
        expect(r.ok).toBe(true);
        expect(r.range.max).toBeNull();
    });

    test('spessore provino non dichiarato → fail-closed (non verificabile)', () => {
        const r = checkThroatCoverage({ ...WPQR_FW_T10, thickness_tested: null }, 10);
        expect(r.ok).toBe(false);
        expect(r.reason).toMatch(/non dichiarato/);
    });

    test('generateWpsFromWpqr end-to-end: gola fuori range esclude il candidato', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: { ...MASON_REQUEST, throat_mm: 25 },
            wpqrRecords: [{ ...WPQR_MASON_DEMO, thickness_tested: 10 }],
        });
        expect(result.status).toBe('not_possible');
        expect(result.extensions_needed.join(' ')).toMatch(/[Gg]ola/);
    });

    test('generateWpsFromWpqr end-to-end: gola entro range accetta il candidato', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: { ...MASON_REQUEST, throat_mm: 10 },
            wpqrRecords: [{ ...WPQR_MASON_DEMO, thickness_tested: 10 }],
        });
        expect(['ok', 'partial']).toContain(result.status);
        expect(result.wps_draft.throat_mm).toBe(10);
    });
});

describe('assessJointCoverageInputs / need_input', () => {
    test('spessori sì ma materiali mancanti → need_input con domande gruppo', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: {
                joint_type: 'FW',
                thickness_a_mm: 10,
                thickness_b_mm: 5,
            },
            wpqrRecords: [WPQR_MASON_DEMO],
        });
        expect(result.status).toBe('need_input');
        expect(result.wps_draft).toBeNull();
        expect(result.extensions_needed).toEqual([]);
        const fields = result.questions.map((q) => q.field);
        expect(fields).toContain('parent_material_a');
        expect(fields).toContain('parent_material_b');
    });

    test('materiale non riconosciuto → need_input (chiarimento), non not_possible', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: {
                ...MASON_REQUEST,
                parent_material_a: 'LEGA-SCONOSCIUTA-XYZ',
            },
            wpqrRecords: [WPQR_MASON_DEMO],
        });
        expect(result.status).toBe('need_input');
        expect(result.questions.some((q) => q.field === 'parent_material_a')).toBe(true);
        expect(result.questions[0].question).toMatch(/Non riconosco|15608|gruppo/i);
    });

    test('assessJointCoverageInputs completo su caso Mason', () => {
        const a = assessJointCoverageInputs(MASON_REQUEST);
        expect(a.complete).toBe(true);
        expect(a.resolved.groupA).toBe('1.2');
        expect(a.resolved.groupB).toBe('1.1');
    });
});
