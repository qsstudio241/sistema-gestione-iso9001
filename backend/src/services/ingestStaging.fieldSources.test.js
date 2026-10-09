/**
 * @jest-environment node
 *
 * Fonte per campo (`_field_sources`) dentro staged_fields_json: persistenza, conferma, compatibilita'.
 * Fixture sintetiche: nessun dato reale.
 */

jest.mock('./wpqrIngest.service', () => ({ commitWPQRFromFields: jest.fn(), applyFieldReprocessUpdate: jest.fn() }));
jest.mock('./qualificationIngest.service', () => ({ commitQualificationFromFields: jest.fn(), applyFieldReprocessUpdate: jest.fn() }));
jest.mock('./ingestFeedback.service', () => ({
    recordFeedback: jest.fn().mockResolvedValue({ action: 'accepted', field_diffs: {} }),
}));
jest.mock('./normIngest.service', () => ({ commitNormFromFields: jest.fn(), applyNormToExistingDocument: jest.fn() }));
jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const { commitQualificationFromFields } = require('./qualificationIngest.service');
const { commitWPQRFromFields } = require('./wpqrIngest.service');
const { recordFeedback } = require('./ingestFeedback.service');
const {
    FIELD_SOURCES_KEY,
    splitFieldSources,
    createStagingRecord,
    confirmStaging,
    rejectStaging,
} = require('./ingestStaging.service');

const SOURCES = { qualification_method: 'ai_corrected_by_rules', issuing_body: 'ocr_header', certificate_number: 'rules' };
const FIELDS = { person_name: 'ZZ SINTETICO', certificate_number: '99-ZZ-1', qualification_method: 'iso_9606', issuing_body: 'tec_eurolab' };

function stagingRow(stagedFields, overrides = {}) {
    return {
        id: 11,
        organization_id: 1,
        company_id: 2,
        doc_type: 'qualifica_14732',
        storage_path: '/tmp/a.pdf',
        original_name: 'a.pdf',
        qualification_type: 'iso_14732',
        staged_fields_json: JSON.stringify(stagedFields),
        field_confidence_json: '{}',
        warnings_json: '[]',
        review_status: 'pending',
        target_qualification_id: null,
        target_wpqr_id: null,
        ...overrides,
    };
}

describe('ingestStaging: _field_sources', () => {
    afterEach(() => jest.clearAllMocks());

    it('createStagingRecord salva le fonti in staged_fields_json senza toccare i campi', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 5 }] });
        await createStagingRecord({
            organizationId: 1, companyId: 2, docType: 'qualifica_14732', originalName: 'a.pdf', storagePath: '/tmp/a.pdf',
            fields: FIELDS, fieldConfidence: { issuing_body: 'medium' }, warnings: [], userId: 9,
            fieldSources: SOURCES,
        });
        const params = query.mock.calls[0][1];
        expect(JSON.parse(params.stagedFieldsJson)).toEqual({ ...FIELDS, [FIELD_SOURCES_KEY]: SOURCES });
        expect(JSON.parse(params.fieldConfidenceJson)).toEqual({ issuing_body: 'medium' });
    });

    it('createStagingRecord senza fonti (o vuote): JSON identico a prima', async () => {
        query.mockResolvedValue({ recordset: [{ id: 5 }] });
        const base = { organizationId: 1, docType: 'wpqr', originalName: 'a.pdf', storagePath: '/tmp/a.pdf', fields: { wpqr_number: 'A1' }, warnings: [], userId: 9 };
        await createStagingRecord(base);
        await createStagingRecord({ ...base, fieldSources: {} });
        await createStagingRecord({ ...base, fieldSources: 'non-un-oggetto' });
        for (const call of query.mock.calls) {
            expect(JSON.parse(call[1].stagedFieldsJson)).toEqual({ wpqr_number: 'A1' });
        }
    });

    it('confirmStaging: il commit riceve solo i campi di dominio, le fonti restano nel JSON, nessun duplicato', async () => {
        query.mockResolvedValueOnce({ recordset: [stagingRow({ ...FIELDS, [FIELD_SOURCES_KEY]: SOURCES })] });
        commitQualificationFromFields.mockResolvedValueOnce({ qualification_id: 77 });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await confirmStaging(11, 1, 9, { certificate_number: '99-ZZ-2' });

        expect(out.status).toBe('confirmed');
        const committed = commitQualificationFromFields.mock.calls[0][0];
        expect(committed).toEqual({ ...FIELDS, certificate_number: '99-ZZ-2' });
        expect(Object.keys(committed)).not.toContain(FIELD_SOURCES_KEY);

        const saved = JSON.parse(query.mock.calls[1][1].stagedFieldsJson);
        expect(saved).toEqual({ ...FIELDS, certificate_number: '99-ZZ-2', [FIELD_SOURCES_KEY]: SOURCES });
        expect(Object.keys(saved).filter((k) => k === FIELD_SOURCES_KEY)).toHaveLength(1);
    });

    it('confirmStaging: un override con _field_sources (es. form della UI) non altera la fonte salvata', async () => {
        query.mockResolvedValueOnce({ recordset: [stagingRow({ ...FIELDS, [FIELD_SOURCES_KEY]: SOURCES })] });
        commitQualificationFromFields.mockResolvedValueOnce({ qualification_id: 77 });
        query.mockResolvedValueOnce({ recordset: [] });

        await confirmStaging(11, 1, 9, { ...FIELDS, [FIELD_SOURCES_KEY]: { issuing_body: 'manuale-falsa' } });

        const saved = JSON.parse(query.mock.calls[1][1].stagedFieldsJson);
        expect(saved[FIELD_SOURCES_KEY]).toEqual(SOURCES);
        expect(commitQualificationFromFields.mock.calls[0][0]).not.toHaveProperty(FIELD_SOURCES_KEY);
    });

    it('feedback (conferma e scarto): payload senza _field_sources, come prima', async () => {
        query.mockResolvedValueOnce({ recordset: [stagingRow({ ...FIELDS, [FIELD_SOURCES_KEY]: SOURCES })] });
        commitQualificationFromFields.mockResolvedValueOnce({ qualification_id: 77 });
        query.mockResolvedValueOnce({ recordset: [] });
        await confirmStaging(11, 1, 9, {});
        const confirmed = recordFeedback.mock.calls[0][0];
        expect(confirmed.aiPayload).toEqual(FIELDS);
        expect(confirmed.humanPayload).toEqual(FIELDS);

        query.mockResolvedValueOnce({ recordset: [stagingRow({ ...FIELDS, [FIELD_SOURCES_KEY]: SOURCES }, { storage_path: null })] });
        query.mockResolvedValueOnce({ recordset: [] });
        await rejectStaging(11, 1, 9, false);
        expect(recordFeedback.mock.calls[1][0].aiPayload).toEqual(FIELDS);
    });

    it('retrocompatibilita: staging senza _field_sources si conferma e non ne acquisisce una', async () => {
        query.mockResolvedValueOnce({ recordset: [stagingRow(FIELDS)] });
        commitQualificationFromFields.mockResolvedValueOnce({ qualification_id: 78 });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await confirmStaging(11, 1, 9, {});

        expect(out.qualification_id).toBe(78);
        expect(JSON.parse(query.mock.calls[1][1].stagedFieldsJson)).toEqual(FIELDS);
    });

    it('non regressione WPQR: conferma invariata', async () => {
        query.mockResolvedValueOnce({ recordset: [stagingRow({ wpqr_number: 'X1' }, { doc_type: 'wpqr' })] });
        commitWPQRFromFields.mockResolvedValueOnce({ wpqr_id: 99 });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await confirmStaging(11, 1, 9, { welding_process: '135' });

        expect(out.wpqr_id).toBe(99);
        expect(commitWPQRFromFields.mock.calls[0][0]).toEqual({ wpqr_number: 'X1', welding_process: '135' });
        expect(JSON.parse(query.mock.calls[1][1].stagedFieldsJson)).toEqual({ wpqr_number: 'X1', welding_process: '135' });
    });

    it('splitFieldSources: separa, ignora forme non valide, tiene le altre chiavi underscore', () => {
        expect(splitFieldSources({ a: 1, _target_document_id: 3, [FIELD_SOURCES_KEY]: { a: 'ai', b: 5, c: '' } }))
            .toEqual({ fields: { a: 1, _target_document_id: 3 }, fieldSources: { a: 'ai' } });
        expect(splitFieldSources({ a: 1, [FIELD_SOURCES_KEY]: ['ai'] })).toEqual({ fields: { a: 1 }, fieldSources: null });
        expect(splitFieldSources(null)).toEqual({ fields: {}, fieldSources: null });
    });
});
