/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

jest.mock('./alertMail.service', () => ({
    sendAlertEmail: jest.fn().mockResolvedValue(true),
}));

const { query } = require('../config/database');
const { sendAlertEmail } = require('./alertMail.service');
const svc = require('./contractReviewNotification.service');

afterEach(() => jest.clearAllMocks());

describe('contractReviewNotification.service', () => {
    const ORG = 1001;
    const caseRow = { id: 5, uuid: 'uuid-5', title: 'Ordine pilota', status: 'QUOTE_APPROVAL' };

    describe('shouldNotifyPendingApproval', () => {
        it('QUOTE_APPROVAL genera notifica', () => {
            expect(svc.shouldNotifyPendingApproval('DRAFT', 'QUOTE_APPROVAL')).toBe(true);
        });
        it('FINAL_REVIEW→APPROVED genera notifica', () => {
            expect(svc.shouldNotifyPendingApproval('FINAL_REVIEW', 'APPROVED')).toBe(true);
        });
        it('altre transizioni no', () => {
            expect(svc.shouldNotifyPendingApproval('DRAFT', 'IN_REVIEW')).toBe(false);
        });
    });

    describe('notifyAfterStatusTransition', () => {
        beforeEach(() => {
            query.mockImplementation((sql) => {
                if (String(sql).includes('INSERT INTO commercial_case_notifications')) {
                    return Promise.resolve({
                        recordset: [{ id: 1, event_type: 'pending_approval', organization_id: ORG, target_user_id: 7 }],
                    });
                }
                if (String(sql).includes('SELECT email FROM users')) {
                    return Promise.resolve({ recordset: [{ email: 'user@test.local' }] });
                }
                if (String(sql).includes('email_sent_at')) {
                    return Promise.resolve({ recordset: [] });
                }
                return Promise.resolve({ recordset: [] });
            });
        });

        it('inserisce record pending_approval', async () => {
            const n = await svc.notifyAfterStatusTransition({
                organizationId: ORG,
                caseRow: { ...caseRow, current_assignee_id: 7 },
                fromStatus: 'DRAFT',
                toStatus: 'QUOTE_APPROVAL',
                actorUserId: 1,
            });

            expect(n.event_type).toBe('pending_approval');
            expect(query).toHaveBeenCalledTimes(3);
            expect(sendAlertEmail).toHaveBeenCalled();
        });

        it('ignora transizione non rilevante', async () => {
            const n = await svc.notifyAfterStatusTransition({
                organizationId: ORG,
                caseRow,
                fromStatus: 'DRAFT',
                toStatus: 'IN_REVIEW',
                actorUserId: 1,
            });
            expect(n).toBeNull();
            expect(query).not.toHaveBeenCalled();
        });
    });

    describe('notifyAfterAssigneeChange', () => {
        beforeEach(() => {
            query.mockImplementation((sql) => {
                if (String(sql).includes('INSERT INTO commercial_case_notifications')) {
                    return Promise.resolve({
                        recordset: [{ id: 2, event_type: 'assigned', organization_id: ORG, target_user_id: 9 }],
                    });
                }
                if (String(sql).includes('SELECT email FROM users')) {
                    return Promise.resolve({ recordset: [{ email: 'assignee@test.local' }] });
                }
                if (String(sql).includes('email_sent_at')) {
                    return Promise.resolve({ recordset: [] });
                }
                return Promise.resolve({ recordset: [] });
            });
        });

        it('inserisce record assigned', async () => {
            const n = await svc.notifyAfterAssigneeChange({
                organizationId: ORG,
                caseRow,
                previousAssigneeId: null,
                newAssigneeId: 9,
                actorUserId: 1,
            });

            expect(n.event_type).toBe('assigned');
            expect(sendAlertEmail).toHaveBeenCalled();
        });
    });
});
