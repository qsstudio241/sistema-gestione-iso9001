/**
 * Correggi dopo l'ingest: il record è già salvato col valore nuovo.
 * L'azione deve comunque lasciare chi, quando, precedente e nuovo.
 */

'use strict';

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const { query } = require('../config/database');
const { actOnWpqrNotice } = require('./discrepancyNotice.service');
const { evaluateWpqrNotices, CODES } = require('./discrepancyNotices/wpqrRules');
const { applyResolution, pickResolution, STATUS, countsAsVerifiedConformity } = require('./discrepancyNotices/status');

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

const KEY_FILLED = {
    id: 51,
    approval_status: 'bozza',
    wpqr_code: 'ZZ-AVVISO-VUOTO',
    reference_number: 'ZZ-AVVISO-VUOTO',
    certificate_number: 'ZZ-AVVISO-VUOTO',
    examiner_body: 'RINA',
    testing_body: '',
    issuing_body: '',
    welding_process: '135',
    standard_reference: 'UNI EN ISO 15614-1:2017',
    joint_type: 'BW',
    base_material_group: '1.2',
    filler_material: 'ISO 14341-A',
};

describe('Correggi di un campo chiave che era vuoto', () => {
    test('scrive chi, quando, precedente vuoto e nuovo; una conferma con motivazione resta chiusa', async () => {
        const cases = [
            {
                field: 'testing_body',
                previousValue: null,
                newValue: 'RINA',
                record: { ...KEY_FILLED, examiner_body: '', testing_body: 'RINA', issuing_body: null },
            },
            {
                field: 'wpqr_code',
                previousValue: '',
                newValue: 'ZZ-AVVISO-VUOTO',
                record: { ...KEY_FILLED, reference_number: '', wpqr_number: '' },
            },
            {
                field: 'certificate_number',
                previousValue: '',
                newValue: 'ZZ-AVVISO-VUOTO',
                record: { ...KEY_FILLED },
            },
        ];

        for (const item of cases) {
            query.mockClear();
            query.mockImplementation(async (sql) => {
                if (/FROM wpqr_test_runs/i.test(sql)) return { recordset: [] };
                if (/FROM wpqr_records/i.test(sql)) return { recordset: [item.record] };
                return { recordset: [] };
            });

            await actOnWpqrNotice({
                organizationId: 1005,
                wpqrId: 51,
                userId: 7,
                action: 'correggi',
                ruleCode: 'WPQR.KEY_FIELDS_EMPTY',
                field: item.field,
                newValue: item.newValue,
                previousValue: item.previousValue,
            });

            const noticeInsert = query.mock.calls.find(([sql]) => /INSERT INTO discrepancy_notices/i.test(sql));
            expect(noticeInsert).toBeTruthy();
            expect(noticeInsert[0]).toMatch(/SYSUTCDATETIME\(\)/);
            expect(noticeInsert[1].status).toBe('corretto');
            expect(noticeInsert[1].previous_value).toBe('');
            expect(noticeInsert[1].new_value).toBe(item.newValue);
            expect(noticeInsert[1].field_name).toBe(item.field);
            expect(noticeInsert[1].acted_by).toBe(7);
            expect(noticeInsert[1].rule_code).toBe('WPQR.KEY_FIELDS_EMPTY');

            const change = query.mock.calls.find(([sql]) => /INSERT INTO entity_change_log/i.test(sql));
            expect(change).toBeTruthy();
            expect(change[1].old_value).toBe('');
            expect(change[1].new_value).toBe(item.newValue);
            expect(change[1].field_name).toBe(item.field);
            expect(change[1].actor_user_id).toBe(7);
            expect(query.mock.calls.some(([sql]) => /UPDATE wpqr_records/i.test(sql))).toBe(false);
        }

        const emptyEnte = { ...KEY_FILLED, examiner_body: '', testing_body: '', issuing_body: '' };
        const open = evaluateWpqrNotices(emptyEnte).find((notice) => notice.code === CODES.KEYS);
        const conferma = {
            rule_code: open.code,
            fingerprint: open.fingerprint,
            status: STATUS.CONFERMATO,
            note: 'Sul PDF l\'ente non c\'è: il dato è giusto così.',
        };
        const closed = applyResolution(open, pickResolution(open, [conferma]));
        expect(closed.status).toBe(STATUS.CONFERMATO);
        expect(closed.blocks_conformity).toBe(false);
        expect(closed.note).toBe(conferma.note);
        expect(countsAsVerifiedConformity('approvata', [closed])).toBe(true);
    });

    test('ente o numero vuoti, record già salvato coi campi specchio: lo storico c\'è, senza un secondo update', async () => {
        const cases = [
            {
                field: 'testing_body',
                previousValue: null,
                newValue: 'RINA',
                record: {
                    ...KEY_FILLED,
                    examiner_body: 'RINA',
                    testing_body: 'RINA',
                    issuing_body: 'RINA',
                },
            },
            {
                field: 'wpqr_code',
                previousValue: '',
                newValue: 'ZZ-AVVISO-VUOTO',
                record: {
                    ...KEY_FILLED,
                    wpqr_code: 'ZZ-AVVISO-VUOTO',
                    reference_number: 'ZZ-AVVISO-VUOTO',
                    wpqr_number: 'ZZ-AVVISO-VUOTO',
                },
            },
        ];

        for (const item of cases) {
            query.mockClear();
            query.mockImplementation(async (sql) => {
                if (/FROM wpqr_test_runs/i.test(sql)) return { recordset: [] };
                if (/FROM wpqr_records/i.test(sql)) return { recordset: [item.record] };
                return { recordset: [] };
            });

            await actOnWpqrNotice({
                organizationId: 1005,
                wpqrId: 51,
                userId: 7,
                action: 'correggi',
                ruleCode: 'WPQR.KEY_FIELDS_EMPTY',
                field: item.field,
                newValue: item.newValue,
                previousValue: item.previousValue,
            });

            const noticeInsert = query.mock.calls.find(([sql]) => /INSERT INTO discrepancy_notices/i.test(sql));
            expect(noticeInsert).toBeTruthy();
            expect(noticeInsert[0]).toMatch(/SYSUTCDATETIME\(\)/);
            expect(noticeInsert[1].status).toBe('corretto');
            expect(noticeInsert[1].previous_value).toBe('');
            expect(noticeInsert[1].new_value).toBe(item.newValue);
            expect(noticeInsert[1].field_name).toBe(item.field);
            expect(noticeInsert[1].acted_by).toBe(7);

            const change = query.mock.calls.find(([sql]) => /INSERT INTO entity_change_log/i.test(sql));
            expect(change).toBeTruthy();
            expect(change[1].old_value).toBe('');
            expect(change[1].new_value).toBe(item.newValue);
            expect(change[1].actor_user_id).toBe(7);
            expect(query.mock.calls.some(([sql]) => /UPDATE wpqr_records/i.test(sql))).toBe(false);
        }
    });

    test('dopo una conferma, Correggi sulla stessa impronta scrive lo storico e non riapre da sola', async () => {
        const emptyEnte = { ...KEY_FILLED, examiner_body: '', testing_body: '', issuing_body: '' };
        const open = evaluateWpqrNotices(emptyEnte).find((notice) => notice.code === CODES.KEYS);
        const conferma = {
            rule_code: open.code,
            fingerprint: open.fingerprint,
            status: STATUS.CONFERMATO,
            note: 'Sul PDF l\'ente non c\'è: il dato è giusto così.',
        };
        const closed = applyResolution(open, pickResolution(open, [conferma]));
        expect(closed.status).toBe(STATUS.CONFERMATO);
        expect(closed.blocks_conformity).toBe(false);

        const saved = {
            ...KEY_FILLED,
            examiner_body: 'RINA',
            testing_body: 'RINA',
            issuing_body: 'RINA',
        };
        query.mockImplementation(async (sql) => {
            if (/FROM wpqr_test_runs/i.test(sql)) return { recordset: [] };
            if (/FROM wpqr_records/i.test(sql)) return { recordset: [saved] };
            if (/FROM discrepancy_notices/i.test(sql) && /SELECT id, status/i.test(sql)) {
                return {
                    recordset: [{
                        id: 9,
                        status: 'confermato',
                        reason: null,
                        request_draft: null,
                        previous_value: null,
                        new_value: null,
                        field_name: 'testing_body',
                    }],
                };
            }
            return { recordset: [] };
        });

        await actOnWpqrNotice({
            organizationId: 1005,
            wpqrId: 51,
            userId: 7,
            action: 'correggi',
            ruleCode: 'WPQR.KEY_FIELDS_EMPTY',
            field: 'testing_body',
            newValue: 'RINA',
            previousValue: '',
            fingerprint: open.fingerprint,
        });

        const noticeUpdate = query.mock.calls.find(([sql]) => /UPDATE discrepancy_notices/i.test(sql));
        expect(noticeUpdate).toBeTruthy();
        expect(noticeUpdate[0]).toMatch(/SYSUTCDATETIME\(\)/);
        expect(noticeUpdate[1].status).toBe('corretto');
        expect(noticeUpdate[1].previous_value).toBe('');
        expect(noticeUpdate[1].new_value).toBe('RINA');
        expect(noticeUpdate[1].field_name).toBe('testing_body');
        expect(noticeUpdate[1].acted_by).toBe(7);
        expect(noticeUpdate[1].fingerprint).toBe(open.fingerprint);
        expect(query.mock.calls.some(([sql]) => /UPDATE wpqr_records/i.test(sql))).toBe(false);
    });
});
