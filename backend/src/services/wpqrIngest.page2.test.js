/**
 * @jest-environment node
 */
/**
 * WV-4b: mapping pagina 2 (passate, data saldatura, esiti) su fixture sintetiche.
 */
const fs = require('fs');
const path = require('path');

jest.mock('./documentIngestPipeline.service', () => ({
    runDocumentIngest: jest.fn(),
}));
jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const { query } = require('../config/database');
const { runDocumentIngest } = require('./documentIngestPipeline.service');
const {
    mapPipelineFieldsToReview,
    mapReviewFieldsToDb,
    extractWPQRFromPdf,
    commitWPQRFromFields,
    applyFieldReprocessUpdate,
    findWpqrPage2Header,
    mapWpqrTestResult,
    mapTestRuns,
    emptyTokenToNull,
} = require('./wpqrIngest.service');

const FIX = (name) => fs.readFileSync(
    path.join(__dirname, '__fixtures__/wpqr', name),
    'utf8',
);

describe('fixture headers (riconoscimento pagina 2 per intestazione)', () => {
    it('digitale: Record of weld test', () => {
        expect(findWpqrPage2Header(FIX('wpqr_layout_digitale.txt'))).toMatch(/record of weld test/i);
    });
    it('scansione OCR: stessa intestazione nonostante rumore', () => {
        expect(findWpqrPage2Header(FIX('wpqr_layout_scansione_ocr.txt'))).toMatch(/record of weld test/i);
    });
    it('15613 misto: Joint details and welding sequences', () => {
        expect(findWpqrPage2Header(FIX('wpqr_layout_misto_15613.txt'))).toMatch(/joint details and welding sequences/i);
    });
});

describe('normalizzazione token', () => {
    it('N.A. → null; esiti Accettabile/Satisfactory/Acceptable → OK; Not required/-- → NA; mai KO dedotto', () => {
        expect(emptyTokenToNull('N.A.')).toBeNull();
        expect(emptyTokenToNull('n.a.')).toBeNull();
        expect(mapWpqrTestResult('Accettabile / Satisfactory')).toBe('OK');
        expect(mapWpqrTestResult('Acceptable')).toBe('OK');
        expect(mapWpqrTestResult('Not required')).toBe('NA');
        expect(mapWpqrTestResult('--')).toBe('NA');
        expect(mapWpqrTestResult('failed')).toBeNull();
        expect(mapWpqrTestResult('KO')).toBeNull();
        expect(mapWpqrTestResult('not acceptable')).toBeNull();
        expect(mapWpqrTestResult('Unacceptable')).toBeNull();
        expect(mapWpqrTestResult('non accettabile')).toBeNull();
        expect(mapWpqrTestResult('unsatisfactory')).toBeNull();
        expect(mapWpqrTestResult('inaccettabile')).toBeNull();
        expect(mapWpqrTestResult('Not acceptable / unsatisfactory')).toBeNull();
        expect(mapWpqrTestResult('SENTINEL_vt_result_1')).toBe('SENTINEL_vt_result_1');
        expect(mapWpqrTestResult('esito troppo lungo per la colonna')).toBeNull();
    });
});

describe('layout digitale (a)', () => {
    const fields = {
        wpqr_number: 'SYN-DIG-001',
        standard_reference: 'ISO 15614-1:2017',
        qualification_level: '2',
        welding_process: '135',
        current_type: 'DC-EP',
        test_date: '2024-03-12',
        approval_date: '2024-03-20',
        pwht: false,
        backing_gas: 'none',
        heat_input_tol_minus_pct: 25,
        wire_feed_speed: 'N.A.',
        nozzle_diameter_mm: 16,
        shielding_gas_flow_l_min_min: 12,
        shielding_gas_flow_l_min_max: 15,
        contact_tube_distance_mm_min: 15,
        contact_tube_distance_mm_max: 20,
        joint_preparation: 'single V',
        cleaning_method: 'grinding',
        bead_technique: 'stringer',
        electrode_count: 'single',
        vt_result: 'Accettabile / Satisfactory',
        pt_result: 'Accettabile',
        mt_result: '--',
        rt_result: '--',
        ut_result: 'Not required',
        tensile_result: 'Satisfactory',
        bend_result: 'Accettabile',
        impact_result: 'Not required',
        hardness_result: '--',
        macro_result: 'Accettabile',
        test_runs: [
            {
                run_label: '1', welding_process: '135', filler_diameter_mm: 1.2,
                current_a: 220, voltage_v: 24.5, current_polarity: 'DC-EP',
                wire_feed_speed: 'N.A.', travel_speed: 4.5, travel_speed_unit: 'mm/s',
                heat_input_value: 0.9, heat_input_unit: 'kJ/mm',
            },
            {
                run_label: '2 +n', welding_process: '135', filler_diameter_mm: 1.2,
                current_a: 210, voltage_v: 23, current_polarity: 'DC-EP',
                wire_feed_speed: 'N.A.', travel_speed: 5, travel_speed_unit: 'mm/s',
                heat_input_value: 0.8, heat_input_unit: 'kJ/mm',
            },
        ],
    };

    it('mappa etichetta testo, N.A. → null, unità kJ/mm, tolleranza −25 %, esiti OK/NA', () => {
        const review = mapPipelineFieldsToReview(fields);
        expect(review.test_date).toBe('2024-03-12');
        expect(review.approval_date).toBe('2024-03-20');
        expect(review.backing_gas).toBe('none');
        expect(review.heat_input_tol_minus_pct).toBe(25);
        expect(review.test_runs).toHaveLength(2);
        expect(review.test_runs[1]).toEqual(expect.objectContaining({
            run_label: '2 +n', run_no: 2, heat_input_unit: 'kJ/mm', wire_feed_speed: null,
        }));
        expect(review.vt_result).toBe('OK');
        expect(review.rt_result).toBe('NA');
        expect(review.ut_result).toBe('NA');
        expect(review.macro_result).toBe('OK');
        const db = mapReviewFieldsToDb(review);
        expect(db.test_runs[0].heat_input_unit).toBe('kJ/mm');
        expect(db.backing_gas).toBe('none');
    });
});

describe('layout scansione OCR (b)', () => {
    it('test_date non dedotta dall\'emissione; Not required → NA; unità kJ/cm; needs_review se OCR', async () => {
        runDocumentIngest.mockResolvedValue({
            text: FIX('wpqr_layout_scansione_ocr.txt'),
            ocrUsed: true,
            fields: {
                wpqr_number: 'SYN-OCR-002',
                approval_date: '2018-06-15',
                welding_process: '135',
                current_type: 'DC/EP',
                heat_input_unit: 'kJ/cm',
                vt_result: 'Acceptable',
                ut_result: 'Not required',
                test_runs: [
                    { run_label: '1', travel_speed: 18, travel_speed_unit: 'cm/min', heat_input_value: 12, heat_input_unit: 'kJ/cm' },
                ],
            },
            fieldConfidence: {},
            extractionConfidence: 55,
            aiModel: 'test',
            warnings: ['Estrazione via OCR — verificare accuratezza dati'],
        });
        query.mockResolvedValue({ recordset: [] });

        const out = await extractWPQRFromPdf(Buffer.from('%PDF'), 'syn-ocr.pdf', 1001, 2001);
        expect(out.fields.test_date).toBeNull();
        expect(out.fields.approval_date).toBe('2018-06-15');
        expect(out.fields.ut_result).toBe('NA');
        expect(out.fields.vt_result).toBe('OK');
        expect(out.fields.test_runs[0].heat_input_unit).toBe('kJ/cm');
        expect(out.fields.test_runs[0].travel_speed_unit).toBe('cm/min');
        expect(out.fields.needs_review).toBe(true);
        expect(out.fields.page2_header).toMatch(/record of weld test/i);
        expect(out.warnings.some((w) => /scansionato/i.test(w))).toBe(true);
    });
});

describe('layout misto 15613 (c)', () => {
    it('conserva J/mm, SAW senza portata gas, trasferimento da Other, due spessori in other_test_info', () => {
        const review = mapPipelineFieldsToReview({
            wpqr_number: 'SYN-15613-003',
            standard_reference: 'ISO 15613:2004',
            range_standard_reference: 'ISO 15614-1:2019',
            qualification_level: '2',
            welding_process: '121',
            shielding_gas_flow_l_min_min: 'N.A.',
            other_test_info: 'deposited thickness 8 mm and 12 mm',
            test_runs: [
                {
                    run_label: '1', welding_process: '121', filler_diameter_mm: 4,
                    current_a: 480, voltage_v: 30, travel_speed: 8, travel_speed_unit: 'mm/s',
                    heat_input_value: 1800, heat_input_unit: 'J/mm', metal_transfer: 'spray',
                },
            ],
        });
        expect(review.range_standard_reference).toBe('ISO 15614-1:2019');
        expect(review.standard_reference).toBe('ISO 15613:2004');
        expect(review.shielding_gas_flow_l_min_min).toBeNull();
        expect(review.other_test_info).toMatch(/8 mm and 12 mm/);
        expect(review.test_runs[0]).toEqual(expect.objectContaining({
            heat_input_unit: 'J/mm', metal_transfer: 'spray', welding_process: '121',
        }));
    });
});

describe('commitWPQRFromFields — passate solo se vuote', () => {
    afterEach(() => jest.clearAllMocks());

    it('inserisce le passate AI se non ce ne sono già', async () => {
        query.mockImplementation(async (sql) => {
            if (sql.includes('INSERT INTO wpqr_records')) return { recordset: [{ id: 91 }] };
            if (sql.includes('OBJECT_ID')) return { recordset: [{ object_id: 1 }] };
            if (sql.includes('SELECT TOP 1 id FROM wpqr_test_runs')) return { recordset: [] };
            return { recordset: [] };
        });
        await commitWPQRFromFields({
            wpqr_number: 'SYN-DIG-001',
            welding_process: '135',
            test_runs: [{ run_label: '1', current_a: 220, travel_speed: 4.5, travel_speed_unit: 'mm/s' }],
        }, 1001, 2001, {});
        const runInsert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO wpqr_test_runs'));
        expect(runInsert).toBeTruthy();
        expect(runInsert[1].run_label).toBe('1');
        expect(runInsert[1].source).toBe('ai');
        expect(runInsert[1].current_a).toBe(220);
    });

    it('non sovrascrive passate già presenti', async () => {
        query.mockImplementation(async (sql) => {
            if (sql.includes('INSERT INTO wpqr_records')) return { recordset: [{ id: 92 }] };
            if (sql.includes('OBJECT_ID')) return { recordset: [{ object_id: 1 }] };
            if (sql.includes('SELECT TOP 1 id FROM wpqr_test_runs')) return { recordset: [{ id: 5 }] };
            return { recordset: [] };
        });
        await commitWPQRFromFields({
            wpqr_number: 'SYN-DIG-001',
            test_runs: [{ run_label: '9', current_a: 1 }],
        }, 1001, 2001, {});
        expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO wpqr_test_runs'))).toBe(false);
    });
});

describe('applyFieldReprocessUpdate — insert-if-empty passate', () => {
    afterEach(() => jest.clearAllMocks());

    it('scrive le passate se lo scope è wpqr_test_runs e la tabella è vuota', async () => {
        query.mockImplementation(async (sql) => {
            if (sql.includes('FROM wpqr_records') && sql.includes('SELECT')) {
                return { recordset: [{ id: 7, company_id: 2001 }] };
            }
            if (sql.includes('OBJECT_ID')) return { recordset: [{ object_id: 1 }] };
            if (sql.includes('SELECT TOP 1 id FROM wpqr_test_runs')) return { recordset: [] };
            return { recordset: [], rowsAffected: [1] };
        });
        const out = await applyFieldReprocessUpdate(7, 1001, 'wpqr_test_runs', {
            test_runs: [{ run_label: '1', current_a: 100, travel_speed: 3, travel_speed_unit: 'mm/s' }],
        });
        expect(out.updated_fields).toContain('wpqr_test_runs');
        expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO wpqr_test_runs'))).toBe(true);
    });

    it('legge test_runs nidificati sotto wpqr_test_runs e company_id dalla WPQR, non da fields', async () => {
        query.mockImplementation(async (sql) => {
            if (sql.includes('FROM wpqr_records') && sql.includes('SELECT')) {
                return { recordset: [{ id: 7, company_id: 2001 }] };
            }
            if (sql.includes('OBJECT_ID')) return { recordset: [{ object_id: 1 }] };
            if (sql.includes('SELECT TOP 1 id FROM wpqr_test_runs')) return { recordset: [] };
            return { recordset: [], rowsAffected: [1] };
        });
        const out = await applyFieldReprocessUpdate(7, 1001, 'wpqr_test_runs', {
            wpqr_test_runs: { test_runs: [{ run_label: '2', current_a: 90 }] },
            company_id: 9999,
        });
        expect(out.updated_fields).toContain('wpqr_test_runs');
        const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO wpqr_test_runs'));
        expect(insert[1].company_id).toBe(2001);
        expect(insert[1].run_label).toBe('2');
    });
});

describe('mapTestRuns', () => {
    it('scarta token non oggetto (sentinella array di stringhe)', () => {
        expect(mapTestRuns(['SENTINEL_test_runs_1'])).toEqual([]);
    });
});
