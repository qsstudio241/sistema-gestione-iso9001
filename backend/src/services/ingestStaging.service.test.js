/**
 * @jest-environment node
 */

jest.mock('./wpqrIngest.service', () => ({
    commitWPQRFromFields: jest.fn(),
    applyFieldReprocessUpdate: jest.fn(),
}));

jest.mock('./qualificationIngest.service', () => ({
    commitQualificationFromFields: jest.fn(),
    applyFieldReprocessUpdate: jest.fn(),
}));

jest.mock('./ingestFeedback.service', () => ({
    recordFeedback: jest.fn().mockResolvedValue({ action: 'accepted', field_diffs: {} }),
}));

jest.mock('./normIngest.service', () => ({
    commitNormFromFields: jest.fn(),
    applyNormToExistingDocument: jest.fn(),
}));

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const fs = require('fs');
const { query } = require('../config/database');
const { commitWPQRFromFields, applyFieldReprocessUpdate: applyWpqrFieldReprocessUpdate } = require('./wpqrIngest.service');
const { commitQualificationFromFields, applyFieldReprocessUpdate } = require('./qualificationIngest.service');
const { commitNormFromFields, applyNormToExistingDocument } = require('./normIngest.service');
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

describe('ingestStaging.service — modalità rielaborazione (migrazione 137)', () => {
    let unlinkSpy;

    beforeEach(() => {
        unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.clearAllMocks();
        unlinkSpy.mockRestore();
    });

    it('confirmStaging con target_qualification_id esegue UPDATE mirato (mai commitQualificationFromFields)', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                id: 50,
                organization_id: 1001,
                company_id: 2,
                doc_type: 'patentino_saldatore',
                storage_path: '/uploads/qualifications/qual_123.pdf',
                original_name: 'qual_123.pdf',
                staged_fields_json: '{"transfer_mode":"spray_arc","person_name":"Mario Rossi"}',
                warnings_json: '[]',
                review_status: 'pending',
                target_qualification_id: 8,
                field_scope: 'transfer_mode',
            }],
        });
        applyFieldReprocessUpdate.mockResolvedValueOnce({ qualification_id: 8, updated_fields: ['transfer_mode'] });
        query.mockResolvedValueOnce({ recordset: [] }); // UPDATE ingest_staging

        const out = await confirmStaging(50, 1001, 9);

        expect(applyFieldReprocessUpdate).toHaveBeenCalledWith(8, 1001, 'transfer_mode', expect.objectContaining({ transfer_mode: 'spray_arc' }));
        expect(commitQualificationFromFields).not.toHaveBeenCalled();
        expect(out.status).toBe('confirmed');
        expect(out.qualification_id).toBe(8);
    });

    it('rejectStaging NON cancella mai il file quando target_qualification_id è valorizzato (è il certificato della qualifica esistente)', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                id: 51,
                review_status: 'pending',
                storage_path: '/uploads/qualifications/qual_123.pdf',
                target_qualification_id: 8,
            }],
        });
        query.mockResolvedValueOnce({ recordset: [] }); // UPDATE review_status=rejected

        const out = await rejectStaging(51, 1001, 9, true); // deleteFile=true richiesto dal chiamante

        expect(out.status).toBe('rejected');
        expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('rejectStaging cancella il file per un upload normale (nessun target_qualification_id)', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                id: 52,
                review_status: 'pending',
                storage_path: '/uploads/qualifications/qual_new.pdf',
                target_qualification_id: null,
            }],
        });
        query.mockResolvedValueOnce({ recordset: [] });

        await rejectStaging(52, 1001, 9, true);

        expect(fs.unlinkSync).toHaveBeenCalledWith('/uploads/qualifications/qual_new.pdf');
    });

    // Generalizzazione 08/08/2026 (migrazione 143): stesso pattern esatto di
    // target_qualification_id, ma per la WPQR (colonna target_wpqr_id).
    it('confirmStaging con target_wpqr_id esegue UPDATE mirato su wpqr_records (mai commitWPQRFromFields)', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                id: 60,
                organization_id: 1001,
                company_id: 2,
                doc_type: 'wpqr',
                storage_path: '/uploads/wpqr/wpqr_123.pdf',
                original_name: 'wpqr_123.pdf',
                staged_fields_json: '{"preheat_temp":"min 100 C","wpqr_code":"WPQR-01"}',
                warnings_json: '[]',
                review_status: 'pending',
                target_qualification_id: null,
                target_wpqr_id: 7,
                field_scope: 'preheat_temp',
            }],
        });
        applyWpqrFieldReprocessUpdate.mockResolvedValueOnce({ wpqr_id: 7, updated_fields: ['preheat_temp'] });
        query.mockResolvedValueOnce({ recordset: [] }); // UPDATE ingest_staging

        const out = await confirmStaging(60, 1001, 9);

        expect(applyWpqrFieldReprocessUpdate).toHaveBeenCalledWith(7, 1001, 'preheat_temp', expect.objectContaining({ preheat_temp: 'min 100 C' }));
        expect(commitWPQRFromFields).not.toHaveBeenCalled();
        expect(out.status).toBe('confirmed');
        expect(out.wpqr_id).toBe(7);
    });

    it('rejectStaging NON cancella mai il file quando target_wpqr_id è valorizzato (è il certificato della WPQR esistente)', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                id: 61,
                review_status: 'pending',
                storage_path: '/uploads/wpqr/wpqr_123.pdf',
                target_qualification_id: null,
                target_wpqr_id: 7,
            }],
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await rejectStaging(61, 1001, 9, true);

        expect(out.status).toBe('rejected');
        expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('confirmStaging con _target_document_id aggiorna il documento esistente (mai commitNormFromFields)', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                id: 70,
                organization_id: 1001,
                company_id: 2,
                doc_type: 'norma',
                storage_path: '/uploads/import/iso9001.pdf',
                original_name: 'iso9001.pdf',
                mime_type: 'application/pdf',
                file_size: 1200,
                staged_fields_json: JSON.stringify({
                    standard_code: 'ISO 9001:2015',
                    _target_document_id: 88,
                    _parent_folder_id: 23,
                }),
                warnings_json: '[]',
                review_status: 'pending',
                target_qualification_id: null,
                target_wpqr_id: null,
            }],
        });
        query.mockResolvedValueOnce({ recordset: [] });
        applyNormToExistingDocument.mockResolvedValue({
            document_id: 88,
            standard_code: 'ISO 9001:2015',
        });

        const out = await confirmStaging(70, 1001, 9, { standard_code: 'ISO 9001:2015' });

        expect(applyNormToExistingDocument).toHaveBeenCalledWith(
            88,
            expect.objectContaining({ standard_code: 'ISO 9001:2015' }),
            1001,
            expect.objectContaining({ filePath: '/uploads/import/iso9001.pdf' }),
        );
        expect(commitNormFromFields).not.toHaveBeenCalled();
        expect(out.status).toBe('confirmed');
        expect(out.document_id).toBe(88);
    });

    it('rejectStaging NON cancella l\'allegato se _target_document_id (file già in registry)', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                id: 71,
                review_status: 'pending',
                storage_path: '/uploads/import/iso9001.pdf',
                staged_fields_json: '{"_target_document_id":88}',
                target_qualification_id: null,
                target_wpqr_id: null,
            }],
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await rejectStaging(71, 1001, 9, true);

        expect(out.status).toBe('rejected');
        expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
});
