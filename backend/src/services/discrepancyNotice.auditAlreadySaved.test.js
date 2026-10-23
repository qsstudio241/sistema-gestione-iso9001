/**
 * Correggi dopo l'ingest: il record è già salvato col valore nuovo.
 * L'azione deve comunque lasciare chi, quando, precedente e nuovo.
 */

'use strict';

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const { query } = require('../config/database');
const { actOnWpqrNotice } = require('./discrepancyNotice.service');

const SAVED = {
    id: 50,
    approval_status: 'bozza',
    wpqr_code: '16VE01735P02/A',
    reference_number: '16VE01735P02/A',
    certificate_number: '16VE01735P02/A',
    examiner_body: 'RINA',
    welding_process: '135',
    standard_reference: 'UNI EN ISO 15614-1:2017',
    joint_type: 'BW',
    base_material_group: '1.2',
    filler_material: 'ISO 14341-A',
};

describe('Correggi su record già allineato', () => {
    beforeEach(() => {
        query.mockImplementation(async (sql) => {
            if (/FROM wpqr_test_runs/i.test(sql)) return { recordset: [] };
            if (/FROM wpqr_records/i.test(sql)) return { recordset: [SAVED] };
            return { recordset: [] };
        });
    });

    test('scrive lo storico con chi, quando, precedente e nuovo, senza riscrivere la colonna', async () => {
        await actOnWpqrNotice({
            organizationId: 1005,
            wpqrId: 50,
            userId: 7,
            action: 'correggi',
            ruleCode: 'WPQR.CODE_CERT_MISMATCH',
            field: 'certificate_number',
            newValue: '16VE01735P02/A',
            previousValue: '16VE01735PO2/A',
        });

        const noticeInsert = query.mock.calls.find(([sql]) => /INSERT INTO discrepancy_notices/i.test(sql));
        expect(noticeInsert).toBeTruthy();
        expect(noticeInsert[1].status).toBe('corretto');
        expect(noticeInsert[1].previous_value).toBe('16VE01735PO2/A');
        expect(noticeInsert[1].new_value).toBe('16VE01735P02/A');
        expect(noticeInsert[1].field_name).toBe('certificate_number');
        expect(noticeInsert[1].acted_by).toBe(7);

        const change = query.mock.calls.find(([sql]) => /INSERT INTO entity_change_log/i.test(sql));
        expect(change).toBeTruthy();
        expect(change[1].old_value).toBe('16VE01735PO2/A');
        expect(change[1].new_value).toBe('16VE01735P02/A');
        expect(change[1].actor_user_id).toBe(7);

        expect(query.mock.calls.some(([sql]) => /UPDATE wpqr_records/i.test(sql))).toBe(false);
    });
});
