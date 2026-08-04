/**
 * @jest-environment node
 */
/* eslint-env jest */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
}));

jest.mock('../services/wpsGenerator.service', () => ({
    generateWpsFromWpqr: jest.fn(),
}));

const { generateWpsFromWpqr } = require('../services/wpsGenerator.service');
const { generateWPS } = require('./welding.controller');

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) {
        this.statusCode = code;
        return this;
    });
    res.json = jest.fn(function json(payload) {
        this.body = payload;
        return this;
    });
    return res;
}

const masonBody = {
    joint_type: 'FW',
    parent_material_a: 'S355',
    parent_material_b: 'S235',
    thickness_a_mm: 10,
    thickness_b_mm: 5,
};

describe('generateWPS controller (P1-A)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('200 need_input se mancano joint_type / materiali / spessori', async () => {
        generateWpsFromWpqr.mockResolvedValue({
            status: 'need_input',
            wpqr_used: null,
            candidates: [],
            wps_draft: null,
            extensions_needed: [],
            questions: [
                { field: 'parent_material_a', question: 'Qual è il materiale A?' },
                { field: 'parent_material_b', question: 'Qual è il materiale B?' },
            ],
            warnings: [],
        });
        const res = createRes();
        await generateWPS(
            { user: { organization_id: 1001 }, body: { joint_type: 'FW', thickness_a_mm: 10, thickness_b_mm: 5 } },
            res
        );
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('need_input');
        expect(res.body.questions.length).toBeGreaterThan(0);
        expect(generateWpsFromWpqr).toHaveBeenCalled();
    });

    test('200 con spessori non numerici → service riceve null e può rispondere need_input', async () => {
        generateWpsFromWpqr.mockResolvedValue({
            status: 'need_input',
            wpqr_used: null,
            candidates: [],
            wps_draft: null,
            extensions_needed: [],
            questions: [{ field: 'thickness_a_mm', question: 'Qual è lo spessore A?' }],
            warnings: [],
        });
        const res = createRes();
        await generateWPS(
            {
                user: { organization_id: 1001 },
                body: { ...masonBody, thickness_a_mm: 'x', thickness_b_mm: 5 },
            },
            res
        );
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('need_input');
        expect(generateWpsFromWpqr).toHaveBeenCalled();
    });

    test('200 ok — passa organization_id e company_id al service', async () => {
        generateWpsFromWpqr.mockResolvedValue({
            status: 'ok',
            wpqr_used: { id: 7, wpqr_code: 'WPQR-1' },
            candidates: [{ id: 7 }],
            wps_draft: { joint_type: 'FW', status: 'bozza' },
            extensions_needed: [],
            warnings: [],
        });
        const res = createRes();
        await generateWPS(
            {
                user: { organization_id: 1001 },
                body: { ...masonBody, company_id: 42, welding_process: '135' },
            },
            res
        );
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe('ok');
        expect(res.body.wps_draft.joint_type).toBe('FW');
        expect(generateWpsFromWpqr).toHaveBeenCalledWith({
            organizationId: 1001,
            companyId: 42,
            request: {
                joint_type: 'FW',
                welding_process: '135',
                parent_material_a: 'S355',
                parent_material_b: 'S235',
                thickness_a_mm: 10,
                thickness_b_mm: 5,
            },
        });
    });

    test('200 not_possible — extensions_needed senza scrittura', async () => {
        generateWpsFromWpqr.mockResolvedValue({
            status: 'not_possible',
            wpqr_used: null,
            candidates: [],
            wps_draft: null,
            extensions_needed: ['Nessuna WPQR copre il gruppo materiale 1.2–1.1'],
            warnings: [],
        });
        const res = createRes();
        await generateWPS(
            { user: { organization_id: 1001 }, body: masonBody },
            res
        );
        expect(res.body.status).toBe('not_possible');
        expect(res.body.extensions_needed.length).toBeGreaterThan(0);
        expect(res.body.wps_draft).toBeNull();
    });
});
