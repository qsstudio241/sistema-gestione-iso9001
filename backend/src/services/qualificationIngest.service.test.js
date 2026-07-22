/**
 * @jest-environment node
 *
 * Test L1 — qualificationIngest.service
 * Copre: mapPipelineFieldsToReview (date conferma semestrale ISO 9606-1 §9.2 +
 * operator_name/campi ISO 14732), classifyQualificationType e
 * commitQualificationFromFields (INSERT con nuove colonne welding_type/single_multi_run/
 * qualification_method e campi 092 già esistenti).
 */

// Mock database e servizi esterni per testare solo la logica pura
jest.mock('../config/database', () => ({ getPool: jest.fn() }));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

jest.mock('./documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));

jest.mock('./personnelQualificationLink.service', () => ({
    resolvePersonnelForQualification: jest.fn().mockResolvedValue({
        ok: true, personnelId: 55, personName: 'Luigi Verdi',
    }),
}));

jest.mock('../utils/documentClassifier', () => ({
    classifyDocument: jest.fn(() => ({ detected_type: 'patentino_saldatore', confidence: 'low' })),
    WRONG_MODULE_FOR_QUALIFICATIONS: new Set(),
    WRONG_MODULE_MESSAGES: {},
    SUGGESTED_MODULE: {},
}));

const { getPool } = require('../config/database');
const {
    mapPipelineFieldsToReview,
    classifyQualificationType,
    commitQualificationFromFields,
} = require('./qualificationIngest.service');

describe('mapPipelineFieldsToReview — date conferma semestrale', () => {
    const BASE = {
        welder_name: 'MARIO ROSSI',
        certificate_number: 'TUV-9606-2024-001',
        welding_process: '135',
        exam_date: '2024-04-17',
        expiry_date: '2027-04-16',
    };

    it('calcola next_confirmation_due = exam_date + 6 mesi quando tabella 9.2 è vuota', () => {
        const fields = mapPipelineFieldsToReview(
            { ...BASE, last_confirmation_date: null, next_confirmation_due: null },
            'ISO 9606-1', 'patentino.pdf'
        );
        expect(fields.next_confirmation_due).toBe('2024-10-17');
        expect(fields.last_confirmation_date).toBeNull();
        expect(fields.cpd_valid_until).toBe('2024-10-17');
    });

    it('usa last_confirmation_date dal PDF quando presente + calcola prossima', () => {
        const fields = mapPipelineFieldsToReview(
            { ...BASE, last_confirmation_date: '2024-10-17', next_confirmation_due: null },
            'ISO 9606-1', 'patentino.pdf'
        );
        expect(fields.last_confirmation_date).toBe('2024-10-17');
        expect(fields.next_confirmation_due).toBe('2025-04-17');
    });

    it('usa next_confirmation_due dal PDF quando esplicitamente presente', () => {
        const fields = mapPipelineFieldsToReview(
            { ...BASE, last_confirmation_date: '2025-04-17', next_confirmation_due: '2025-10-17' },
            'ISO 9606-1', 'patentino.pdf'
        );
        expect(fields.next_confirmation_due).toBe('2025-10-17');
    });

    it('gestisce exam_date null senza crash (non calcola next_confirmation_due)', () => {
        const fields = mapPipelineFieldsToReview(
            { ...BASE, exam_date: null, last_confirmation_date: null, next_confirmation_due: null },
            'ISO 9606-1', 'patentino.pdf'
        );
        expect(fields.next_confirmation_due).toBeNull();
        expect(fields.exam_date).toBeNull();
    });

    it('addMonths gestisce correttamente il cambio anno (ottobre + 6 = aprile anno+1)', () => {
        const fields = mapPipelineFieldsToReview(
            { ...BASE, exam_date: '2023-10-15', last_confirmation_date: null, next_confirmation_due: null },
            'ISO 9606-1', 'patentino.pdf'
        );
        expect(fields.next_confirmation_due).toBe('2024-04-15');
    });
});

describe('classifyQualificationType', () => {
    it('classifica ISO 9606-1', () => {
        expect(classifyQualificationType('certificato ISO 9606-1')).toBe('Saldatore ISO 9606-1');
    });
    it('classifica ISO 9606-2', () => {
        expect(classifyQualificationType('qualifica 9606-2')).toBe('Saldatore ISO 9606-2');
    });
    it('fallback ad Altra qualifica', () => {
        expect(classifyQualificationType('documento generico')).toBe('Altra qualifica');
    });
});

describe('qualificationIngest.service — mapPipelineFieldsToReview (ISO 14732)', () => {
    it('legge operator_name (schema qualifica_14732) come nome titolare', () => {
        const out = mapPipelineFieldsToReview({
            operator_name: 'Luigi Verdi',
            equipment_type: 'Robot MIG/MAG',
            welding_type: 'automatic',
            single_multi_run: 'multi',
            qualification_method: 'iso_15614',
        }, 'qualifica operatore ISO 14732 saldatura automatica', 'file.pdf');

        expect(out.person_name).toBe('Luigi Verdi');
        expect(out.operator_name).toBe('Luigi Verdi');
        expect(out.equipment_type).toBe('Robot MIG/MAG');
        expect(out.welding_type).toBe('automatic');
        expect(out.single_multi_run).toBe('multi');
        expect(out.qualification_method).toBe('iso_15614');
        expect(out.qualification_type).toBe('Operatore ISO 14732');
    });

    it('welder_name (patentino_saldatore) resta prioritario se presente', () => {
        const out = mapPipelineFieldsToReview({
            welder_name: 'Mario Rossi',
            operator_name: 'Altro Nome',
        }, 'patentino saldatore 9606-1', 'file.pdf');
        expect(out.person_name).toBe('Mario Rossi');
    });
});

describe('qualificationIngest.service — commitQualificationFromFields (14732)', () => {
    function makeRequestMock() {
        const req = { input: jest.fn().mockReturnThis() };
        req.query = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });
        return req;
    }

    it('inserisce welding_type/single_multi_run/qualification_method nella query INSERT', async () => {
        const dupCheckReq = makeRequestMock();
        dupCheckReq.query = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });

        const insertReq = { input: jest.fn().mockReturnThis() };
        insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 501 }] });

        let callCount = 0;
        const pool = {
            request: jest.fn(() => {
                callCount += 1;
                return callCount === 1 ? dupCheckReq : insertReq;
            }),
        };
        getPool.mockResolvedValue(pool);

        const result = await commitQualificationFromFields({
            operator_name: 'Luigi Verdi',
            certificate_number: 'CERT-14732-01',
            equipment_type: 'Testa SAW',
            welding_type: 'mechanized',
            single_multi_run: 'single',
            qualification_method: 'production_test',
            exam_date: '2026-01-10',
            expiry_date: '2032-01-10',
        }, 10, 20, { qualificationType: 'Operatore ISO 14732' });

        expect(result.qualification_id).toBe(501);
        expect(insertReq.input).toHaveBeenCalledWith('weldingType', 'mechanized');
        expect(insertReq.input).toHaveBeenCalledWith('singleMultiRun', 'single');
        expect(insertReq.input).toHaveBeenCalledWith('qualMethod', 'production_test');
        expect(insertReq.input).toHaveBeenCalledWith('equipType', 'Testa SAW');
        expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('welding_type'));
        expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('single_multi_run'));
        expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('qualification_method'));
    });
});
