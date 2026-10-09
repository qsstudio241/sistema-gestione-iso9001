'use strict';

/**
 * VQ-BW-S — integrazione leggera: designazione stampata -> parser -> mapping ingest ->
 * verifyQualification. Un BW ISO 9606-1 con spessore in token `t` (convenzione della
 * designazione) deve finire in `thickness_s_test_mm` e la regola THK_BW (Tab. 6) deve
 * poterlo verificare (nessun warn, nessun dato mancante per lo spessore).
 */

jest.mock('../../config/database', () => ({ getPool: jest.fn() }));
jest.mock('../../utils/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
jest.mock('../documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('../personnelQualificationLink.service', () => ({
    resolvePersonnelForQualification: jest.fn(),
}));

const { verifyQualification } = require('./index');
const { mapPipelineFieldsToReview } = require('../qualificationIngest.service');
const {
    parseWelderQualificationDesignation,
    designationFieldsToIngest,
} = require('../../utils/weldingDesignation');
const { extractPatentinoFields } = require('../../utils/ruleFieldExtractors');
const { STATUS, SEVERITY } = require('./findingTypes');

const THK_BW = 'WQ9606_1.CORR.THK_BW';

function reviewFromDesignation(line, validity) {
    const fromDesignation = designationFieldsToIngest(parseWelderQualificationDesignation(line));
    return mapPipelineFieldsToReview({
        welder_name: 'MARIO ROSSI',
        certificate_number: 'CERT-BWS-INT',
        issuing_body: 'Ente Test',
        standard_reference: 'ISO 9606-1:2017',
        exam_date: '2026-01-10',
        expiry_date: '2029-01-09',
        ...fromDesignation,
        // I dettagli di saldatura arrivano dalla colonna di validità, non dalla riga designazione.
        weld_details: 'ss, nb',
        ...validity,
    }, 'Certificato ISO 9606-1 saldatore', 'c.pdf');
}

const thkFindings = (review) => verifyQualification(review, { mode: 'review' }).findings
    .filter((f) => f.code === THK_BW || f.field === 'thickness_s_test_mm');

describe('VQ-BW-S — BW ISO 9606-1: designazione/ingest -> verifyQualification', () => {
    const LINE = 'ISO 9606-1: 141 P BW FM1 t10 PA ss nb';

    test('token t su BW -> thickness_s_test_mm; validità coerente (Tab. 6: s=10 -> 3..20) senza warn né dato mancante', () => {
        const review = reviewFromDesignation(LINE, {
            thickness_min_mm: 3, thickness_max_mm: 20, welding_positions: ['PA'], material_group: '1.1',
        });
        expect(review.joint_type).toBe('BW');
        expect(review.thickness_s_test_mm).toBe(10);
        expect(review.thickness_t_test_mm).toBeNull();

        const findings = verifyQualification(review, { mode: 'review' }).findings;
        const thk = findings.filter((f) => f.code === THK_BW);
        expect(thk.filter((f) => f.severity === SEVERITY.WARN)).toEqual([]);
        expect(thk.filter((f) => f.status === STATUS.NON_VERIFICABILE_DATO_MANCANTE)).toEqual([]);
        expect(findings.filter((f) => f.severity === SEVERITY.WARN).map((f) => f.code)).toEqual([]);
        expect(findings.filter((f) => f.field === 'thickness_max_mm'
            && f.status === STATUS.NON_VERIFICABILE_DATO_MANCANTE)).toEqual([]);
    });

    test('estrattore deterministico (fallback senza AI): stessa assegnazione s/t del parser', () => {
        const bw = extractPatentinoFields(`Saldatore\n${LINE}`, 'c.pdf');
        expect(bw.thickness_s_test_mm).toBe(10);
        expect(bw.thickness_t_test_mm).toBeNull();
        const fw = extractPatentinoFields('Saldatore\nISO 9606-1: 135 P FW FM1 t8 PB ss mb', 'c.pdf');
        expect(fw.thickness_t_test_mm).toBe(8);
        expect(fw.thickness_s_test_mm).toBeNull();
    });

    test('validità oltre Tab. 6 (max 30 con s=10): la regola ora e\' eseguibile e segnala warn', () => {
        const review = reviewFromDesignation(LINE, { thickness_min_mm: 3, thickness_max_mm: 30 });
        const thk = thkFindings(review).filter((f) => f.code === THK_BW);
        expect(thk).toHaveLength(1);
        expect(thk[0].severity).toBe(SEVERITY.WARN);
        expect(thk[0].status).toBe(STATUS.VERIFICABILE);
    });

    test('regressione: con lo spessore solo in t (stato pre-fix) la regola era non_verificabile_dato_mancante', () => {
        const review = {
            ...reviewFromDesignation(LINE, { thickness_min_mm: 3, thickness_max_mm: 20 }),
            thickness_s_test_mm: null,
            thickness_t_test_mm: 10,
        };
        const thk = thkFindings(review).filter((f) => f.code === THK_BW);
        expect(thk).toHaveLength(1);
        expect(thk[0].status).toBe(STATUS.NON_VERIFICABILE_DATO_MANCANTE);
    });
});
