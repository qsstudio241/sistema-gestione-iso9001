/**
 * @jest-environment node
 */

jest.mock('./wpqrIngest.service', () => ({
    commitWPQRFromFields: jest.fn(),
}));

jest.mock('./qualificationIngest.service', () => ({
    commitQualificationFromFields: jest.fn(),
}));

jest.mock('./ingestFeedback.service', () => ({
    recordFeedback: jest.fn().mockResolvedValue({ action: 'accepted', field_diffs: {} }),
}));

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const { query } = require('../config/database');
const { commitWPQRFromFields } = require('./wpqrIngest.service');
const { commitQualificationFromFields } = require('./qualificationIngest.service');
const {
    createStagingRecord,
    confirmStaging,
    rejectStaging,
    resolveStagingFilePath,
    getModuleForDocType,
} = require('./ingestStaging.service');

describe('ingestStaging.service (IG-3)', () => {
    afterEach(() => jest.clearAllMocks());

    it('createStagingRecord inserisce riga pending', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 7 }] });

        const id = await createStagingRecord({
            organizationId: 1,
            companyId: 2,
            docType: 'wpqr',
            originalName: 'test.pdf',
            storagePath: '/tmp/test.pdf',
            fields: { wpqr_number: 'A1' },
            fieldConfidence: { wpqr_number: 'high' },
            warnings: [],
            userId: 9,
        });

        expect(id).toBe(7);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO ingest_staging'),
            expect.objectContaining({ docType: 'wpqr' }),
        );
    });

    it('confirmStaging committa WPQR e aggiorna stato', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                id: 5,
                organization_id: 1,
                company_id: 2,
                doc_type: 'wpqr',
                storage_path: '/tmp/a.pdf',
                original_name: 'a.pdf',
                staged_fields_json: '{"wpqr_number":"X1"}',
                warnings_json: '[]',
                review_status: 'pending',
            }],
        });
        commitWPQRFromFields.mockResolvedValueOnce({
            wpqr_id: 99,
            reference_number: 'X1',
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await confirmStaging(5, 1, 9, { welding_process: '135' });

        expect(commitWPQRFromFields).toHaveBeenCalled();
        expect(out.status).toBe('confirmed');
        expect(out.wpqr_id).toBe(99);
    });

    it('rejectStaging marca rejected', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                id: 3,
                review_status: 'pending',
                storage_path: '/tmp/missing.pdf',
            }],
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await rejectStaging(3, 1, 9, false);

        expect(out.status).toBe('rejected');
        expect(query).toHaveBeenCalledTimes(2);
    });

    it('resolveStagingFilePath rifiuta path fuori uploads', () => {
        expect(() => resolveStagingFilePath('/etc/passwd')).toThrow('Percorso file non valido');
    });

    it('confirmStaging committa qualifica_14732 con lo stesso percorso di patentino_saldatore', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                id: 12,
                organization_id: 1,
                company_id: 2,
                doc_type: 'qualifica_14732',
                storage_path: '/tmp/op.pdf',
                original_name: 'op.pdf',
                staged_fields_json: '{"operator_name":"Luigi Verdi"}',
                qualification_type: 'Operatore ISO 14732',
                warnings_json: '[]',
                review_status: 'pending',
            }],
        });
        commitQualificationFromFields.mockResolvedValueOnce({
            qualification_id: 321,
            person_name: 'Luigi Verdi',
            qualification_type: 'Operatore ISO 14732',
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await confirmStaging(12, 1, 9);

        expect(commitQualificationFromFields).toHaveBeenCalled();
        expect(out.status).toBe('confirmed');
        expect(out.qualification_id).toBe(321);
    });

    it('getModuleForDocType instrada qualifica_14732 al modulo qualifiche', () => {
        expect(getModuleForDocType('qualifica_14732')).toBe('qualifiche');
        expect(getModuleForDocType('patentino_saldatore')).toBe('qualifiche');
    });
});
