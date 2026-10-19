/**
 * @jest-environment node
 *
 * Rinnovo del certificato oculistico: i colori lasciati vuoti non ricopiano
 * la data vecchia. Quella data non deve far risultare scaduto il certificato nuovo.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/companyAccess.service', () => ({
    ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
    companyAccessSqlFilter: jest.fn().mockReturnValue({ clause: '', params: {} }),
    assertMutatingAllowed: jest.fn().mockResolvedValue(null),
    assertCompanyRead: jest.fn().mockResolvedValue(null),
    hasCompanyAccessRows: jest.fn().mockReturnValue(false),
    sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));

const { getPool, query } = require('../config/database');
const { renewQualification } = require('./qualifications.controller');
const { visionRowStatus } = require('../services/weldingCoordinatorAuth.service');

const ORG = 10;
const VISION = 'Certificato idoneit\u00e0 visiva (acuit\u00e0 + Ishihara)';
const TODAY = '2026-10-19';

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function savedRow(inputs) {
    return {
        qualification_type: VISION,
        expiry_date: inputs.expiryDate,
        near_vision_expiry_date: inputs.nearVision,
        colour_vision_expiry_date: inputs.colourVision,
    };
}

function makePool(previous) {
    const checkReq = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockResolvedValue({ recordset: [previous] }),
    };
    const insReq = {
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockResolvedValue({ recordset: [{ id: 31 }] }),
    };
    let n = 0;
    return {
        pool: { request: jest.fn(() => { n += 1; return n === 1 ? checkReq : insReq; }) },
        insReq,
    };
}

function inputsOf(insReq) {
    return Object.fromEntries(insReq.input.mock.calls.map(([key, value]) => [key, value]));
}

beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
});

describe('renewQualification — visita oculistica, colori vuoti', () => {
    const previous = {
        id: 30,
        company_id: 20,
        person_name: 'ZZ Visita',
        qualification_type: VISION,
        certificate_file_url: null,
        certificate_number: 'VIS-1',
        expiry_date: '2024-01-15',
        near_vision_expiry_date: '2024-01-15',
        colour_vision_expiry_date: '2024-01-15',
        notes: null,
    };

    it('i colori vuoti non ricopiano il giorno vecchio e il certificato non resta scaduto', async () => {
        const { pool, insReq } = makePool(previous);
        getPool.mockResolvedValue(pool);
        const res = makeRes();
        await renewQualification({
            params: { id: '30' },
            body: {
                expiry_date: '2028-06-01',
                near_vision_expiry_date: '2028-06-01',
                colour_vision_expiry_date: '',
            },
            user: { organization_id: ORG, user_id: 1 },
        }, res);

        const inputs = inputsOf(insReq);
        expect(inputs.nearVision).toBe('2028-06-01');
        expect(inputs.expiryDate).toBe('2028-06-01');
        expect(inputs.colourVision).toBeNull();
        expect(inputs.colourVision).not.toBe('2024-01-15');
        const status = visionRowStatus(savedRow(inputs), TODAY);
        expect(status.state).toBe('ok');
        expect(status.expiry_date).toBe('2028-06-01');
        expect(res.status).toHaveBeenCalledWith(201);
    });

    it('una data colori diversa resta e, se è più vicina, resta vincolante', async () => {
        const { pool, insReq } = makePool(previous);
        getPool.mockResolvedValue(pool);
        const res = makeRes();
        await renewQualification({
            params: { id: '30' },
            body: {
                expiry_date: '2028-06-01',
                near_vision_expiry_date: '2028-06-01',
                colour_vision_expiry_date: '2027-03-01',
            },
            user: { organization_id: ORG, user_id: 1 },
        }, res);

        const inputs = inputsOf(insReq);
        expect(inputs.colourVision).toBe('2027-03-01');
        expect(inputs.nearVision).toBe('2028-06-01');
        const status = visionRowStatus(savedRow(inputs), TODAY);
        expect(status.expiry_date).toBe('2027-03-01');
        expect(status.state).toBe('ok');
    });

    it('senza il campo colori nel body resta la data già salvata', async () => {
        const { pool, insReq } = makePool(previous);
        getPool.mockResolvedValue(pool);
        await renewQualification({
            params: { id: '30' },
            body: {
                expiry_date: '2028-06-01',
                near_vision_expiry_date: '2028-06-01',
            },
            user: { organization_id: ORG, user_id: 1 },
        }, makeRes());

        expect(inputsOf(insReq).colourVision).toBe('2024-01-15');
    });
});
