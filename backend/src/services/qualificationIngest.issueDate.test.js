/**
 * @jest-environment node
 *
 * Test L1 — issue_date distinta da exam_date e nuovi campi schema ingest qualifiche
 * (smoke ingest 08/10/2026). Fixture sintetiche, nessun dato reale.
 */

jest.mock('../config/database', () => ({ getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('./documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));
jest.mock('./personnelQualificationLink.service', () => ({
    resolvePersonnelForQualification: jest.fn().mockResolvedValue({
        ok: true, personnelId: 55, personName: 'ROSSI MARIO',
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
    commitQualificationFromFields,
    applyFieldReprocessUpdate,
    REPROCESSABLE_FIELDS,
} = require('./qualificationIngest.service');

describe('issue_date distinta da exam_date + nuovi campi schema (examiner_body, standard_reference 14732)', () => {
    const { DOCUMENT_TYPE_SCHEMAS } = require('../data/documentTypeSchemas');
    const { REPROCESSABLE_FIELD_REGISTRY } = require('../data/reprocessableFields');

    const BASE = { welder_name: 'ROSSI MARIO', certificate_number: 'SINT-0002', welding_process: '141' };

    beforeEach(() => {
        getPool.mockReset();
    });

    it('lo schema AI di patentino_saldatore e qualifica_14732 espone issue_date e examiner_body; 14732 anche standard_reference', () => {
        for (const type of ['patentino_saldatore', 'qualifica_14732']) {
            const { aiExpectedSchema, aiPrompt } = DOCUMENT_TYPE_SCHEMAS[type];
            expect(aiExpectedSchema.issue_date).toBe('YYYY-MM-DD|null');
            expect(aiExpectedSchema.examiner_body).toBe('string|null');
            expect(aiPrompt).toMatch(/issue_date/);
            expect(aiPrompt).toMatch(/examiner_body/);
            expect(aiPrompt).toMatch(/NON copiare exam_date/);
        }
        expect(DOCUMENT_TYPE_SCHEMAS.qualifica_14732.aiExpectedSchema.standard_reference).toBe('string|null');
        expect(DOCUMENT_TYPE_SCHEMAS.qualifica_14732.aiPrompt).toMatch(/standard_reference/);
    });

    it('review: issue_date reale resta distinta da exam_date quando entrambe presenti', () => {
        const out = mapPipelineFieldsToReview(
            { ...BASE, exam_date: '2025-06-13', issue_date: '2025-06-25' }, 'ISO 9606-1', 'a.pdf',
        );
        expect(out.exam_date).toBe('2025-06-13');
        expect(out.issue_date).toBe('2025-06-25');
        expect(out.issue_date).not.toBe(out.exam_date);
    });

    it('review: senza emissione estratta issue_date resta null (non copiata da exam_date)', () => {
        const out = mapPipelineFieldsToReview({ ...BASE, exam_date: '2025-06-13' }, 'ISO 9606-1', 'a.pdf');
        expect(out.exam_date).toBe('2025-06-13');
        expect(out.issue_date).toBeNull();
    });

    it('review: examiner_body e standard_reference passano alla revisione', () => {
        const out = mapPipelineFieldsToReview(
            { ...BASE, examiner_body: 'Ente Prova Sintetico', standard_reference: 'ISO 14732:2013' }, 'ISO 14732', 'a.pdf',
        );
        expect(out.examiner_body).toBe('Ente Prova Sintetico');
        expect(out.standard_reference).toBe('ISO 14732:2013');
    });

    it('commit: INSERT scrive issue_date e exam_date separate, examiner_body e standard_ref sulle colonne esistenti', async () => {
        const dupReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] }) };
        const insertReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 901 }] }) };
        let n = 0;
        getPool.mockResolvedValue({ request: jest.fn(() => { n += 1; return n === 1 ? dupReq : insertReq; }) });

        await commitQualificationFromFields({
            ...BASE,
            exam_date: '2025-06-13',
            issue_date: '2025-06-25',
            examiner_body: 'Ente Prova Sintetico',
            standard_reference: 'ISO 14732:2013',
        }, 10, 20, { qualificationType: 'Operatore ISO 14732' });

        const inputs = Object.fromEntries(insertReq.input.mock.calls.map(([k, v]) => [k, v]));
        expect(inputs.issueDate).toBe('2025-06-25');
        expect(inputs.examDate).toBe('2025-06-13');
        expect(inputs.examBody).toBe('Ente Prova Sintetico');
        expect(inputs.stdRef).toBe('ISO 14732:2013');
        const sql = insertReq.query.mock.calls[0][0];
        expect(sql).toMatch(/\bissue_date\b/);
        expect(sql).toMatch(/\bexaminer_body\b/);
        expect(sql).toMatch(/\bstandard_ref\b/);
    });

    it('commit: senza issue_date nei campi la colonna riceve NULL (non exam_date)', async () => {
        const dupReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] }) };
        const insertReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 902 }] }) };
        let n = 0;
        getPool.mockResolvedValue({ request: jest.fn(() => { n += 1; return n === 1 ? dupReq : insertReq; }) });

        await commitQualificationFromFields({ ...BASE, exam_date: '2025-06-13' }, 10, 20, { qualificationType: 'Saldatore ISO 9606-1' });

        const inputs = Object.fromEntries(insertReq.input.mock.calls.map(([k, v]) => [k, v]));
        expect(inputs.examDate).toBe('2025-06-13');
        expect(inputs.issueDate).toBeNull();
    });

    it('registro Rielaborazioni: voci issue_date / examiner_body / standard_ref con whitelist di scrittura sincronizzata', () => {
        for (const key of ['issue_date', 'examiner_body', 'standard_ref']) {
            expect(REPROCESSABLE_FIELD_REGISTRY[key]).toMatchObject({ key, table: 'qualifications', module: 'qualifiche' });
            expect(REPROCESSABLE_FIELDS[key]).toEqual(expect.objectContaining({ column: key }));
        }
        expect(REPROCESSABLE_FIELDS.issue_date.writeGuard).toBe('(issue_date IS NULL OR issue_date = exam_date)');
    });

    it('rielaborazione issue_date: UPDATE con guardia tra parentesi (solo se assente o uguale a exam_date)', async () => {
        const checkReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 5 }] }) };
        const updReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ rowsAffected: [1] }) };
        let n = 0;
        getPool.mockResolvedValue({ request: jest.fn(() => { n += 1; return n === 1 ? checkReq : updReq; }) });

        const res = await applyFieldReprocessUpdate(5, 10, 'issue_date', { issue_date: '2025-06-25' });

        expect(res.updated_fields).toEqual(['issue_date']);
        const sql = updReq.query.mock.calls[0][0];
        expect(sql).toMatch(/AND \(\(issue_date IS NULL OR issue_date = exam_date\)\)/);
    });
});
