/**
 * @jest-environment node
 */

// Mock database e servizi esterni per testare solo la logica pura
jest.mock('../config/database', () => ({ getPool: jest.fn() }));
jest.mock('./documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('./personnelQualificationLink.service', () => ({ resolvePersonnelForQualification: jest.fn() }));
jest.mock('../utils/documentClassifier', () => ({
    classifyDocument: jest.fn(() => ({ detected_type: 'patentino_saldatore', confidence: 'low' })),
    WRONG_MODULE_FOR_QUALIFICATIONS: new Set(),
    WRONG_MODULE_MESSAGES: {},
    SUGGESTED_MODULE: {},
}));

const { mapPipelineFieldsToReview, classifyQualificationType } = require('./qualificationIngest.service');

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
