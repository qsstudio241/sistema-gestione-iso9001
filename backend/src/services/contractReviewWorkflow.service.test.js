/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const { query } = require('../config/database');
const workflow = require('./contractReviewWorkflow.service');

afterEach(() => jest.clearAllMocks());

describe('contractReviewWorkflow', () => {
    it('isTransitionAllowed — avanti e terminali', () => {
        expect(workflow.isTransitionAllowed('DRAFT', 'INTAKE_REVIEW')).toBe(true);
        expect(workflow.isTransitionAllowed('DRAFT', 'QUOTE_PREP')).toBe(false);
        expect(workflow.isTransitionAllowed('QUOTE_SENT', 'CANCELLED')).toBe(true);
        expect(workflow.isTransitionAllowed('APPROVED', 'DRAFT')).toBe(false);
    });

    it('requiresTransitionReason — indietro e annullamento', () => {
        expect(workflow.requiresTransitionReason('INTAKE_REVIEW', 'DRAFT')).toBe(true);
        expect(workflow.requiresTransitionReason('INTAKE_REVIEW', 'QUOTE_PREP')).toBe(false);
        expect(workflow.requiresTransitionReason('QUOTE_PREP', 'CANCELLED')).toBe(true);
    });

    it('evaluateTransitionBlockers — checklist preliminare incompleta', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ cnt: 2 }] })
            .mockResolvedValueOnce({ recordset: [{ cnt: 1 }] })
            .mockResolvedValueOnce({ recordset: [] });
        const gate = await workflow.evaluateTransitionBlockers(1, 'INTAKE_REVIEW', 'QUOTE_PREP');
        expect(gate.blocked).toBe(true);
        expect(gate.missing[0]).toMatch(/preliminare/i);
    });

    it('evaluateTransitionBlockers — allegato obbligatorio mancante', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ cnt: 2 }] })
            .mockResolvedValueOnce({ recordset: [{ cnt: 0 }] })
            .mockResolvedValueOnce({ recordset: [{ item_ref: 'P3' }] });
        const gate = await workflow.evaluateTransitionBlockers(1, 'INTAKE_REVIEW', 'QUOTE_PREP');
        expect(gate.blocked).toBe(true);
        expect(gate.missing.some((m) => /allegati obbligatori/i.test(m) && /P3/.test(m))).toBe(true);
    });

    it('evaluateTransitionBlockers — ordine mancante', async () => {
        query.mockResolvedValueOnce({ recordset: [{ doc_cnt: 0, att_cnt: 0 }] });
        const gate = await workflow.evaluateTransitionBlockers(1, 'ORDER_RECEIVED', 'FINAL_REVIEW');
        expect(gate.blocked).toBe(true);
        expect(gate.missing[0]).toMatch(/ordine/i);
    });
});
