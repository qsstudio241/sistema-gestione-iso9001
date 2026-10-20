/**
 * @jest-environment node
 *
 * A4 — scope azienda sugli endpoint che filtravano solo organization_id.
 * companyAccess è quello reale; il DB è finto e rispetta il parametro organization_id.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { PassThrough } = require('stream');

const TEMP = path.join(os.tmpdir(), 'sgq-a4-scope.bin');
const TEMP2 = path.join(os.tmpdir(), 'sgq-a4-scope-2.bin');

const ROW_ORG = 1001;
const OTHER_ORG = 1002;
const ALLOWED = 11;
const OTHER_CO = 99;

const MISSING = path.join(os.tmpdir(), 'sgq-a4-missing.bin');
const ctx = {
    rowCompany: ALLOWED,
    storagePath: TEMP,
    forceWpqrCompany: false,
    wpqrCompanyId: null,
    wpsCompanyId: null,
    historyById: null,
    nextWpsCompany: null,
    nextWpsMissing: false,
};

jest.mock('../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

jest.mock('../services/wpsGenerator.service', () => ({
    generateWpsFromWpqr: jest.fn(async () => ({
        status: 'need_input',
        wpqr_used: null,
        candidates: [],
        wps_draft: null,
        extensions_needed: [],
        questions: [],
        warnings: [],
    })),
}));

jest.mock('../services/capabilityCoverage', () => ({
    verifyCoverage: jest.fn(async () => ({ domain: 'welder_9606', matches: [] })),
    listCoverageDomains: jest.fn(() => []),
}));

jest.mock('../services/qualificationIngest.service', () => ({
    extractQualificationFromPdf: jest.fn(async () => ({
        status: 'ok',
        fields: {},
        warnings: [],
        field_confidence: {},
        classification: null,
        qualification_type: 'ISO 9606-1',
    })),
}));

jest.mock('../services/wpqrIngest.service', () => ({
    extractWPQRFromPdf: jest.fn(async () => ({
        status: 'ok', fields: {}, warnings: [], field_confidence: {},
    })),
}));

jest.mock('../services/wpsIngest.service', () => ({
    extractWPSFromPdf: jest.fn(async () => ({
        status: 'ok', fields: {}, warnings: [], field_confidence: {},
    })),
}));

jest.mock('../services/ingestStaging.service', () => ({
    createStagingRecord: jest.fn(async () => 42),
}));

const { query, getPool } = require('../config/database');
const { verifyCoverage } = require('../services/capabilityCoverage');
const { generateWpsFromWpqr } = require('../services/wpsGenerator.service');
const { createStagingRecord } = require('../services/ingestStaging.service');
const qual = require('./qualifications.controller');
const welding = require('./welding.controller');
const projects = require('./projects.controller');
const attachments = require('./attachment.controller');

function businessRow() {
    return {
        id: 7,
        company_id: ctx.forceWpqrCompany ? ctx.wpqrCompanyId : ctx.rowCompany,
        wps_company_id: ctx.wpsCompanyId,
        organization_id: ROW_ORG,
        status: 'valida',
        approval_status: 'approvata',
        qualification_type: 'ISO 9606-1',
        expiry_date: '2028-01-01',
        project_code: 'P1',
        applicable_wps_ids: '[]',
        wps_code: 'WPS-1',
        previous_qualification_id: null,
        issue_date: '2024-01-01',
        certificate_number: 'CERT',
        next_confirmation_due: null,
        confirmed_at: '2026-01-15',
        notes: null,
        attachment_id: 7,
        attachment_uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        storage_path: ctx.storagePath,
        file_name: 'a.pdf',
        file_size: 4,
        mime_type: 'application/pdf',
        file_type: '.pdf',
        audit_id: 5,
        custom_checklist_id: null,
    };
}

function orgOf(params) {
    if (!params) return null;
    const org = params.organization_id ?? params.orgId ?? params.organizationId;
    return org == null ? null : Number(org);
}

function companyHidden(params) {
    const keys = Object.keys(params || {}).filter((k) => /^(att_co_|wpsco_|wpqrco_|wpqrcow_|wpqrstat_|wpqrstatw_|visionCo_|uca_|skco_)/.test(k));
    if (!keys.length) return false;
    const rowCompany = ctx.forceWpqrCompany ? ctx.wpqrCompanyId : ctx.rowCompany;
    const direct = keys.filter((k) => !/^wpqrcow_|^wpqrstatw_/.test(k));
    const viaWps = keys.filter((k) => /^wpqrcow_|^wpqrstatw_/.test(k));
    if (rowCompany != null && rowCompany !== '' && direct.some((k) => Number(params[k]) === Number(rowCompany))) {
        return false;
    }
    if ((rowCompany == null || rowCompany === '') && viaWps.some((k) => Number(params[k]) === Number(ctx.wpsCompanyId))) {
        return false;
    }
    if (!viaWps.length && direct.some((k) => Number(params[k]) === Number(ctx.rowCompany))) return false;
    return true;
}

function emptySet() {
    return { recordset: [] };
}

function route(sql, params = {}) {
    const compact = String(sql || '').replace(/\s+/g, ' ').trim();
    if (/user_company_access/i.test(compact)) {
        return { recordset: [] };
    }
    if (/COL_LENGTH|OBJECT_ID/i.test(compact)) {
        return { recordset: [{ len: 1, object_id: 1, present: 1 }] };
    }
    if (/^SELECT id FROM wpqr_records WHERE wps_id/i.test(compact)) return emptySet();
    if (/^SELECT id FROM wps_welders/i.test(compact)) return emptySet();
    if (/^SELECT id FROM project_welders/i.test(compact)) return emptySet();
    const org = orgOf(params);
    const hiddenOrg = org != null && org !== ROW_ORG;
    if (/^SELECT COUNT\(/i.test(compact)) {
        if (hiddenOrg || companyHidden(params)) {
            return { recordset: [{ total: 0, totale: 0, da_approvare: 0, rifiutate: 0, approvate: 0 }] };
        }
        return { recordset: [{ total: 1, totale: 1, da_approvare: 0, rifiutate: 0, approvate: 1 }] };
    }
    if (/INSERT\s+INTO/i.test(compact)) {
        return { recordset: [{ id: 77, attachment_id: 77, attachment_uuid: 'u' }] };
    }
    if (/^(UPDATE|DELETE)\b/i.test(compact)) return emptySet();
    if (/^SELECT/i.test(compact)) {
        if (hiddenOrg || companyHidden(params)) return emptySet();
        if (/FROM welding_procedures/i.test(compact) && (/@wps_id/.test(compact) || /@wps\d+\b/.test(compact))) {
            if (ctx.nextWpsMissing) return emptySet();
            if (ctx.nextWpsCompany != null) {
                const ids = [];
                if (params.wps_id != null && params.wps_id !== '') ids.push(Number(params.wps_id));
                Object.keys(params)
                    .filter((key) => /^wps\d+$/.test(key))
                    .sort()
                    .forEach((key) => ids.push(Number(params[key])));
                return { recordset: ids.map((id) => ({ id, company_id: ctx.nextWpsCompany })) };
            }
        }
        if (ctx.historyById && /FROM qualifications/i.test(compact)) {
            const row = ctx.historyById[params.id];
            return { recordset: row ? [row] : [] };
        }
        if (/full_name FROM users/i.test(compact)) return { recordset: [{ full_name: 'Utente' }] };
        if (/coordinator_title/i.test(compact)) return emptySet();
        if (/SELECT TOP 1 confirmed_at/i.test(compact)) {
            return { recordset: [{ confirmed_at: '2026-01-15' }] };
        }
        return { recordset: [businessRow()] };
    }
    return emptySet();
}

function makeRequest() {
    const params = {};
    const req = {
        input(name, value) {
            params[name] = arguments.length > 2 ? arguments[2] : value;
            return req;
        },
        async query(sql) {
            return route(sql, params);
        },
    };
    return req;
}

function makePool() {
    return {
        request: () => makeRequest(),
        transaction: () => ({
            begin: async () => {},
            commit: async () => {},
            rollback: async () => {},
            request: () => makeRequest(),
        }),
    };
}

function mockRes() {
    const res = new PassThrough();
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn();
    res.resume();
    return res;
}

function http(res) {
    const calls = res.status.mock.calls;
    return calls.length ? calls[calls.length - 1][0] : 200;
}

function bodyOf(res) {
    const calls = res.json.mock.calls;
    return calls.length ? calls[calls.length - 1][0] : null;
}

function userFor(mode) {
    if (mode === 'cross-org') {
        return {
            user_id: 50,
            organization_id: OTHER_ORG,
            role: 'admin',
            company_access: [],
        };
    }
    return {
        user_id: 50,
        organization_id: ROW_ORG,
        role: 'admin',
        company_access: [{ company_id: ALLOWED, permission: 'write' }],
    };
}

function companyOf(mode) {
    return mode === 'cross-co' ? OTHER_CO : ALLOWED;
}

const pdfFile = () => ({
    originalname: 'a.pdf',
    path: TEMP,
    buffer: Buffer.from('%PDF'),
    mimetype: 'application/pdf',
    size: 4,
});

const endpoints = [
    {
        id: 'GET /qualifications/:id/history',
        kind: 'byId',
        call: (req, res) => qual.getHistory(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'GET /qualifications/coverage',
        kind: 'byId',
        call: (req, res) => qual.getCoverage(req, res),
        req: () => ({ query: { project_id: '5' } }),
    },
    {
        id: 'POST /qualifications/coverage/verify',
        kind: 'scoped',
        call: (req, res) => qual.verifyCoverageRequirement(req, res),
        req: (mode) => ({
            body: { domain: 'welder_9606', company_id: companyOf(mode), criteria: {} },
        }),
        scopedSpy: () => verifyCoverage,
        scopedOrg: (call) => call[1].organizationId,
    },
    {
        id: 'GET /qualifications/vision-fitness-gaps',
        kind: 'list',
        call: (req, res) => qual.getVisionFitnessGaps(req, res),
        req: (mode) => ({ query: { company_id: String(companyOf(mode)) } }),
        empty: (res) => expect(bodyOf(res).gaps).toEqual([]),
    },
    {
        id: 'GET /qualifications/confirmations/export',
        kind: 'export',
        call: (req, res) => qual.exportConfirmations(req, res),
        req: (mode) => ({
            query: {
                company_id: String(companyOf(mode)),
                ...(mode === 'cross-org' ? { qualification_id: '7' } : {}),
            },
        }),
    },
    {
        id: 'POST /qualifications/upload-batch',
        kind: 'upload',
        call: (req, res) => qual.uploadBatch(req, res),
        req: (mode) => ({
            body: { company_id: companyOf(mode) },
            files: [pdfFile()],
        }),
    },
    {
        id: 'POST /qualifications/:id/confirm-semiannual',
        kind: 'byId',
        call: (req, res) => qual.confirmSemiannual(req, res),
        req: () => ({ params: { id: '7' }, body: { confirmed_at: '2026-06-01', notes: 'ok' } }),
    },
    {
        id: 'PUT /qualifications/:id/confirmations/:confirmationId',
        kind: 'byId',
        call: (req, res) => qual.updateConfirmation(req, res),
        req: () => ({
            params: { id: '7', confirmationId: '3' },
            body: { confirmed_at: '2026-06-01' },
        }),
    },
    {
        id: 'GET /welding/wps',
        kind: 'list',
        call: (req, res) => welding.listWPS(req, res),
        req: (mode) => ({ query: { company_id: String(companyOf(mode)), page: '1', limit: '10' } }),
        empty: (res) => expect(bodyOf(res).data).toEqual([]),
    },
    {
        id: 'GET /welding/sketches',
        kind: 'list',
        call: (req, res) => welding.listWeldSketches(req, res),
        req: (mode) => ({ query: { company_id: String(companyOf(mode)) } }),
        empty: (res) => expect(bodyOf(res).sketches).toEqual([]),
    },
    {
        id: 'GET /welding/wps/:id',
        kind: 'byId',
        call: (req, res) => welding.getWPS(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'POST /welding/wps/generate',
        kind: 'scoped',
        call: (req, res) => welding.generateWPS(req, res),
        req: (mode) => ({
            body: { company_id: companyOf(mode), joint_type: 'BW', parent_material_a: 'S355' },
        }),
        scopedSpy: () => generateWpsFromWpqr,
        scopedOrg: (call) => call[0].organizationId,
    },
    {
        id: 'POST /welding/wps',
        kind: 'upload',
        call: (req, res) => welding.createWPS(req, res),
        req: (mode) => ({ body: { company_id: companyOf(mode), wps_code: 'WPS-NEW' } }),
    },
    {
        id: 'PUT /welding/wps/:id',
        kind: 'byId',
        call: (req, res) => welding.updateWPS(req, res),
        req: () => ({ params: { id: '7' }, body: { notes: 'n' } }),
    },
    {
        id: 'DELETE /welding/wps/:id',
        kind: 'byId',
        call: (req, res) => welding.deleteWPS(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'GET /welding/wpqr',
        kind: 'list',
        call: (req, res) => welding.listWPQR(req, res),
        req: (mode) => ({ query: { company_id: String(companyOf(mode)), page: '1', limit: '10' } }),
        empty: (res) => expect(bodyOf(res).data).toEqual([]),
    },
    {
        id: 'GET /welding/wpqr/:id',
        kind: 'byId',
        call: (req, res) => welding.getWPQR(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'POST /welding/wpqr',
        kind: 'byId',
        call: (req, res) => welding.createWPQR(req, res),
        req: () => ({ body: { wps_id: 7, wpqr_code: 'WPQR-1' }, params: {} }),
    },
    {
        id: 'PUT /welding/wpqr/:id',
        kind: 'byId',
        call: (req, res) => welding.updateWPQR(req, res),
        req: () => ({ params: { id: '7' }, body: { notes: 'n' } }),
    },
    {
        id: 'DELETE /welding/wpqr/:id',
        kind: 'byId',
        call: (req, res) => welding.deleteWPQR(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'GET /welding/wpqr/:id/test-runs',
        kind: 'byId',
        call: (req, res) => welding.listWpqrTestRuns(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'PUT /welding/wpqr/:id/test-runs',
        kind: 'byId',
        call: (req, res) => welding.saveWpqrTestRuns(req, res),
        req: () => ({ params: { id: '7' }, body: { runs: [] } }),
    },
    {
        id: 'GET /welding/wps/:id/welders',
        kind: 'byId',
        call: (req, res) => welding.listWpsWelders(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'POST /welding/wps/:id/welders',
        kind: 'byId',
        call: (req, res) => welding.assignWpsWelder(req, res),
        req: () => ({ params: { id: '7' }, body: { qualification_id: 8 } }),
    },
    {
        id: 'DELETE /welding/wps/:id/welders/:welderId',
        kind: 'byId',
        call: (req, res) => welding.removeWpsWelder(req, res),
        req: () => ({ params: { id: '7', welderId: '4' } }),
    },
    {
        id: 'GET /welding/wpqr/stats',
        kind: 'list',
        call: (req, res) => welding.getWPQRStats(req, res),
        req: (mode) => ({ query: { company_id: String(companyOf(mode)) } }),
        empty: (res) => expect(bodyOf(res).data.totale).toBe(0),
    },
    {
        id: 'POST /welding/wpqr/:id/approve',
        kind: 'byId',
        call: (req, res) => welding.approveWPQR(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'POST /welding/wpqr/:id/reject',
        kind: 'byId',
        call: (req, res) => welding.rejectWPQR(req, res),
        req: () => ({ params: { id: '7' }, body: { reason: 'x' } }),
    },
    {
        id: 'POST /welding/wpqr/upload-batch',
        kind: 'upload',
        call: (req, res) => welding.uploadWPQRBatch(req, res),
        req: (mode) => ({ body: { company_id: companyOf(mode) }, files: [pdfFile()] }),
    },
    {
        id: 'POST /welding/wps/upload-batch',
        kind: 'upload',
        call: (req, res) => welding.uploadWPSBatch(req, res),
        req: (mode) => ({ body: { company_id: companyOf(mode) }, files: [pdfFile()] }),
    },
    {
        id: 'GET /welding/wps/coverage',
        kind: 'byId',
        call: (req, res) => welding.getWpsCoverage(req, res),
        req: () => ({ query: { project_id: '5' } }),
    },
    {
        id: 'GET /projects/:id',
        kind: 'byId',
        call: (req, res) => projects.getProject(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'POST /projects',
        kind: 'upload',
        call: (req, res) => projects.createProject(req, res),
        req: (mode) => ({ body: { project_code: 'P-1', company_id: companyOf(mode) } }),
    },
    {
        id: 'PUT /projects/:id',
        kind: 'byId',
        call: (req, res) => projects.updateProject(req, res),
        req: () => ({ params: { id: '7' }, body: { notes: 'n' } }),
    },
    {
        id: 'DELETE /projects/:id',
        kind: 'byId',
        call: (req, res) => projects.deleteProject(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'POST /projects/:id/welders',
        kind: 'byId',
        call: (req, res) => projects.addProjectWelder(req, res),
        req: () => ({ params: { id: '7' }, body: { qualification_id: 8 } }),
    },
    {
        id: 'DELETE /projects/:id/welders/:qualificationId',
        kind: 'byId',
        call: (req, res) => projects.removeProjectWelder(req, res),
        req: () => ({ params: { id: '7', qualificationId: '8' } }),
    },
    {
        id: 'GET /attachments',
        kind: 'attachList',
        call: (req, res) => attachments.listAttachments(req, res),
        req: () => ({ query: { page: '1', limit: '10' } }),
    },
    {
        id: 'GET /attachments/:id',
        kind: 'attachGet',
        call: (req, res) => attachments.getAttachmentById(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'GET /attachments/:id/download',
        kind: 'attachFile',
        call: (req, res) => attachments.downloadAttachment(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'GET /attachments/:id/view',
        kind: 'attachFile',
        call: (req, res) => attachments.viewAttachment(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'DELETE /attachments/:id',
        kind: 'attachGet',
        call: (req, res) => attachments.deleteAttachment(req, res),
        req: () => ({ params: { id: '7' } }),
    },
    {
        id: 'PUT /attachments/:id/replace',
        kind: 'attachGet',
        call: (req, res) => attachments.replaceAttachment(req, res),
        req: () => ({
            params: { id: '7' },
            file: { ...pdfFile(), path: TEMP2 },
        }),
    },
    {
        id: 'POST /attachments/upload',
        kind: 'byId',
        call: (req, res) => attachments.uploadAttachment(req, res),
        req: () => ({
            body: { audit_id: '5', category: 'document' },
            file: pdfFile(),
        }),
    },
];

async function invoke(spec, mode) {
    ctx.rowCompany = mode === 'cross-co' ? OTHER_CO : ALLOWED;
    ctx.storagePath = spec.id === 'DELETE /attachments/:id' && mode === 'ok' ? MISSING : TEMP;
    const built = spec.req(mode) || {};
    const req = {
        user: userFor(mode),
        params: built.params || { id: '7' },
        query: built.query || {},
        body: built.body || {},
        file: built.file,
        files: built.files,
    };
    const res = mockRes();
    await spec.call(req, res);
    if (spec.kind === 'attachFile') {
        await new Promise((resolve) => {
            if (res.readableEnded) return resolve();
            res.on('end', resolve);
            res.on('error', resolve);
            setTimeout(resolve, 30);
        });
    }
    return { req, res };
}

function expectFailClosed(res, codes) {
    const status = http(res);
    expect(codes).toContain(status);
    if (status >= 400) {
        const body = bodyOf(res);
        expect(body == null || body.success !== true).toBe(true);
    }
}

describe('A4 company scope', () => {
    beforeAll(() => {
        fs.writeFileSync(TEMP, '%PDF');
        fs.writeFileSync(TEMP2, '%PDF');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        ctx.rowCompany = ALLOWED;
        ctx.forceWpqrCompany = false;
        ctx.wpqrCompanyId = null;
        ctx.wpsCompanyId = null;
        ctx.historyById = null;
        ctx.nextWpsCompany = null;
        ctx.nextWpsMissing = false;
        query.mockImplementation((sql, params) => Promise.resolve(route(sql, params || {})));
        getPool.mockImplementation(async () => makePool());
        if (!fs.existsSync(TEMP)) fs.writeFileSync(TEMP, '%PDF');
        if (!fs.existsSync(TEMP2)) fs.writeFileSync(TEMP2, '%PDF');
    });

    test.each(endpoints)('$id — org diversa non legge i dati dell\'altra org', async (spec) => {
        const { req, res } = await invoke(spec, 'cross-org');
        if (spec.kind === 'list' || spec.kind === 'attachList') {
            expect(http(res)).toBe(200);
            spec.empty ? spec.empty(res) : expect(bodyOf(res).data).toEqual([]);
            return;
        }
        if (spec.kind === 'scoped') {
            expect(http(res)).toBe(200);
            const spy = spec.scopedSpy();
            expect(spy).toHaveBeenCalled();
            expect(spec.scopedOrg(spy.mock.calls[0])).toBe(req.user.organization_id);
            expect(spec.scopedOrg(spy.mock.calls[0])).not.toBe(ROW_ORG);
            return;
        }
        if (spec.kind === 'upload') {
            expect([200, 201]).toContain(http(res));
            const stagingOrg = createStagingRecord.mock.calls.map((c) => c[0].organizationId).filter((v) => v != null);
            const insertOrgs = query.mock.calls
                .filter((c) => /INSERT\s+INTO/i.test(String(c[0])))
                .map((c) => c[1] && c[1].organization_id)
                .filter((v) => v != null);
            const orgs = [...stagingOrg, ...insertOrgs];
            if (orgs.length) {
                expect(orgs.every((o) => o === OTHER_ORG)).toBe(true);
            }
            return;
        }
        if (spec.kind === 'export') {
            expect(http(res)).toBe(404);
            return;
        }
        expectFailClosed(res, [404]);
    });

    test.each(endpoints)('$id — accesso per-azienda: altra azienda della stessa org rifiutata', async (spec) => {
        const { res } = await invoke(spec, 'cross-co');
        if (spec.kind === 'attachList') {
            expect(http(res)).toBe(200);
            expect(bodyOf(res).data).toEqual([]);
            const sql = query.mock.calls.map((c) => String(c[0])).join('\n');
            expect(sql).toContain('att_co_0');
            return;
        }
        if (spec.kind === 'attachGet' || spec.kind === 'attachFile') {
            expect(http(res)).toBe(404);
            return;
        }
        expect(http(res)).toBe(403);
        expect(bodyOf(res).code).toBe('FORBIDDEN');
    });

    test.each(endpoints)('$id — stessa org e azienda consentita resta consentito', async (spec) => {
        const { res } = await invoke(spec, 'ok');
        const status = http(res);
        expect([200, 201]).toContain(status);
        if (spec.kind === 'attachFile') {
            expect(res.setHeader).toHaveBeenCalled();
            return;
        }
        if (spec.kind === 'export') {
            expect(res.send).toHaveBeenCalled();
            return;
        }
        if (spec.kind === 'list' || spec.kind === 'attachList') {
            const payload = bodyOf(res);
            expect(payload.success === true || Array.isArray(payload.gaps) || payload.data).toBeTruthy();
        }
    });

    test('GET history — utente studio senza righe company_access legge qualsiasi azienda della propria org', async () => {
        ctx.rowCompany = OTHER_CO;
        const res = mockRes();
        await qual.getHistory({
            user: { user_id: 1, organization_id: ROW_ORG, role: 'superadmin', company_access: [] },
            params: { id: '7' },
            query: {},
            body: {},
        }, res);
        expect(http(res)).toBe(200);
        expect(bodyOf(res).history.length).toBeGreaterThan(0);
    });

    test('POST coverage/verify — utente per-azienda senza company_id non scandisce tutta l\'org', async () => {
        const res = mockRes();
        await qual.verifyCoverageRequirement({
            user: userFor('ok'),
            params: {},
            query: {},
            body: { domain: 'welder_9606', criteria: {} },
        }, res);
        expect(http(res)).toBe(403);
        expect(verifyCoverage).not.toHaveBeenCalled();
    });

    test('GET history — un antenato di altra azienda non risponde 403 sull\'intera catena', async () => {
        const base = {
            status: 'valida',
            expiry_date: '2028-01-01',
            qualification_type: 'ISO 9606-1',
            issue_date: '2024-01-01',
            certificate_number: 'CERT',
        };
        ctx.historyById = {
            7: { ...base, id: 7, company_id: ALLOWED, previous_qualification_id: 8 },
            8: { ...base, id: 8, company_id: OTHER_CO, previous_qualification_id: null },
        };
        const res = mockRes();
        await qual.getHistory({
            user: userFor('ok'), params: { id: '7' }, query: {}, body: {},
        }, res);
        expect(http(res)).toBe(200);
        expect(bodyOf(res).history.map((row) => row.id)).toEqual([7]);
    });

    test('GET history — un antenato della stessa azienda resta nella catena', async () => {
        const base = {
            status: 'valida',
            expiry_date: '2028-01-01',
            qualification_type: 'ISO 9606-1',
            issue_date: '2024-01-01',
            certificate_number: 'CERT',
        };
        ctx.historyById = {
            7: { ...base, id: 7, company_id: ALLOWED, previous_qualification_id: 8 },
            8: { ...base, id: 8, company_id: ALLOWED, previous_qualification_id: null },
        };
        const res = mockRes();
        await qual.getHistory({
            user: userFor('ok'), params: { id: '7' }, query: {}, body: {},
        }, res);
        expect(http(res)).toBe(200);
        expect(bodyOf(res).history.map((row) => row.id)).toEqual([7, 8]);
    });

    test('GET WPQR — company_id nullo segue l\'azienda della WPS consentita', async () => {
        ctx.forceWpqrCompany = true;
        ctx.wpqrCompanyId = null;
        ctx.wpsCompanyId = ALLOWED;
        const res = mockRes();
        await welding.getWPQR({
            user: userFor('ok'), params: { id: '7' }, query: {}, body: {},
        }, res);
        expect(http(res)).toBe(200);
    });

    test('GET WPQR — company_id nullo e WPS di altra azienda è 403', async () => {
        ctx.forceWpqrCompany = true;
        ctx.wpqrCompanyId = null;
        ctx.wpsCompanyId = OTHER_CO;
        const res = mockRes();
        await welding.getWPQR({
            user: userFor('ok'), params: { id: '7' }, query: {}, body: {},
        }, res);
        expect(http(res)).toBe(403);
        expect(bodyOf(res).code).toBe('FORBIDDEN');
    });

    test('GET test-runs — company_id nullo e WPS consentita resta leggibile', async () => {
        ctx.forceWpqrCompany = true;
        ctx.wpqrCompanyId = null;
        ctx.wpsCompanyId = ALLOWED;
        const res = mockRes();
        await welding.listWpqrTestRuns({
            user: userFor('ok'), params: { id: '7' }, query: {}, body: {},
        }, res);
        expect(http(res)).toBe(200);
    });

    test('PUT WPQR — non sposta la scheda su una WPS di un\'altra azienda', async () => {
        ctx.forceWpqrCompany = true;
        ctx.wpqrCompanyId = null;
        ctx.wpsCompanyId = ALLOWED;
        ctx.nextWpsCompany = OTHER_CO;
        const res = mockRes();
        await welding.updateWPQR({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { wps_id: 99 },
        }, res);
        expect(http(res)).toBe(403);
        expect(bodyOf(res).code).toBe('FORBIDDEN');
        const wrote = query.mock.calls.some((call) => /^UPDATE/i.test(String(call[0]).trim()));
        expect(wrote).toBe(false);
    });

    test('PUT WPQR — "1e2" non aggira il controllo: 400 e nessun UPDATE sulla WPS 100', async () => {
        ctx.forceWpqrCompany = true;
        ctx.wpqrCompanyId = null;
        ctx.wpsCompanyId = ALLOWED;
        ctx.nextWpsCompany = ALLOWED;
        const res = mockRes();
        await welding.updateWPQR({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { wps_id: '1e2' },
        }, res);
        expect(http(res)).toBe(400);
        expect(bodyOf(res).code).toBe('VALIDATION_ERROR');
        const wrote = query.mock.calls.some((call) => /^UPDATE/i.test(String(call[0]).trim()));
        expect(wrote).toBe(false);
        const lookedUp = query.mock.calls
            .filter((call) => /FROM welding_procedures/i.test(String(call[0])) && /@wps_id/.test(String(call[0])))
            .map((call) => call[1].wps_id);
        expect(lookedUp).toEqual([]);
    });

    test('PUT WPQR — "12.5" non è un id e non aggiorna', async () => {
        ctx.forceWpqrCompany = true;
        ctx.wpqrCompanyId = null;
        ctx.wpsCompanyId = ALLOWED;
        const res = mockRes();
        await welding.updateWPQR({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { wps_id: '12.5' },
        }, res);
        expect(http(res)).toBe(400);
        expect(bodyOf(res).code).toBe('VALIDATION_ERROR');
        const wrote = query.mock.calls.some((call) => /^UPDATE/i.test(String(call[0]).trim()));
        expect(wrote).toBe(false);
    });

    test('PUT WPQR — la stringa "12" controlla e scrive la stessa WPS', async () => {
        ctx.forceWpqrCompany = true;
        ctx.wpqrCompanyId = null;
        ctx.wpsCompanyId = ALLOWED;
        ctx.nextWpsCompany = ALLOWED;
        const res = mockRes();
        await welding.updateWPQR({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { wps_id: '12' },
        }, res);
        expect(http(res)).toBe(200);
        const lookedUp = query.mock.calls
            .filter((call) => /FROM welding_procedures/i.test(String(call[0])) && /@wps_id/.test(String(call[0])))
            .map((call) => call[1].wps_id);
        expect(lookedUp).toEqual([12]);
        const update = query.mock.calls.find((call) => /^UPDATE/i.test(String(call[0]).trim()));
        expect(update[1].wps_id).toBe(12);
    });

    test('PUT WPQR — sposta la scheda su una WPS della stessa azienda consentita', async () => {
        ctx.forceWpqrCompany = true;
        ctx.wpqrCompanyId = null;
        ctx.wpsCompanyId = ALLOWED;
        ctx.nextWpsCompany = ALLOWED;
        const res = mockRes();
        await welding.updateWPQR({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { wps_id: 12 },
        }, res);
        expect(http(res)).toBe(200);
        const wrote = query.mock.calls.some((call) => /^UPDATE/i.test(String(call[0]).trim()));
        expect(wrote).toBe(true);
    });

    test('PUT commessa — non collega una WPS di un\'altra azienda', async () => {
        ctx.nextWpsCompany = OTHER_CO;
        const res = mockRes();
        await projects.updateProject({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { applicable_wps_ids: [99] },
        }, res);
        expect(http(res)).toBe(403);
        expect(bodyOf(res).code).toBe('FORBIDDEN');
        const wrote = query.mock.calls.some((call) => /^UPDATE/i.test(String(call[0]).trim()));
        expect(wrote).toBe(false);
    });

    test('PUT commessa — WPS assente nell\'org è 404 e non aggiorna', async () => {
        ctx.nextWpsMissing = true;
        const res = mockRes();
        await projects.updateProject({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { applicable_wps_ids: [99] },
        }, res);
        expect(http(res)).toBe(404);
        expect(bodyOf(res).code).toBe('WPS_NOT_FOUND');
        const wrote = query.mock.calls.some((call) => /^UPDATE/i.test(String(call[0]).trim()));
        expect(wrote).toBe(false);
    });

    test('PUT commessa — "1e2" nella lista WPS è 400 e non aggiorna', async () => {
        const res = mockRes();
        await projects.updateProject({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { applicable_wps_ids: ['1e2'] },
        }, res);
        expect(http(res)).toBe(400);
        expect(bodyOf(res).code).toBe('VALIDATION_ERROR');
        const wrote = query.mock.calls.some((call) => /^UPDATE/i.test(String(call[0]).trim()));
        expect(wrote).toBe(false);
        const lookedUp = query.mock.calls.filter((call) => /FROM welding_procedures/i.test(String(call[0])));
        expect(lookedUp).toHaveLength(0);
    });

    test('PUT commessa — collega una WPS della stessa azienda consentita', async () => {
        ctx.nextWpsCompany = ALLOWED;
        const res = mockRes();
        await projects.updateProject({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { applicable_wps_ids: [12] },
        }, res);
        expect(http(res)).toBe(200);
        const update = query.mock.calls.find((call) => /^UPDATE/i.test(String(call[0]).trim()));
        expect(update[1].applicable_wps_ids).toBe('[12]');
    });

    test('POST commessa — non nasce già collegata a una WPS di un\'altra azienda', async () => {
        ctx.nextWpsCompany = OTHER_CO;
        const res = mockRes();
        await projects.createProject({
            user: userFor('ok'),
            params: {},
            query: {},
            body: { project_code: 'P-9', company_id: ALLOWED, applicable_wps_ids: [99] },
        }, res);
        expect(http(res)).toBe(403);
        expect(bodyOf(res).code).toBe('FORBIDDEN');
        const wrote = query.mock.calls.some((call) => /INSERT\s+INTO\s+projects/i.test(String(call[0])));
        expect(wrote).toBe(false);
    });

    test('POST commessa — WPS assente nell\'org è 404 e non inserisce', async () => {
        ctx.nextWpsMissing = true;
        const res = mockRes();
        await projects.createProject({
            user: userFor('ok'),
            params: {},
            query: {},
            body: { project_code: 'P-9', company_id: ALLOWED, applicable_wps_ids: [99] },
        }, res);
        expect(http(res)).toBe(404);
        expect(bodyOf(res).code).toBe('WPS_NOT_FOUND');
        const wrote = query.mock.calls.some((call) => /INSERT\s+INTO\s+projects/i.test(String(call[0])));
        expect(wrote).toBe(false);
    });

    test('POST saldatore commessa — non assegna una WPS di un\'altra azienda', async () => {
        ctx.nextWpsCompany = OTHER_CO;
        const res = mockRes();
        await projects.addProjectWelder({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { qualification_id: 8, wps_id: 99 },
        }, res);
        expect(http(res)).toBe(403);
        expect(bodyOf(res).code).toBe('FORBIDDEN');
        const wrote = query.mock.calls.some((call) => /INSERT\s+INTO\s+project_welders/i.test(String(call[0])));
        expect(wrote).toBe(false);
    });

    test('POST saldatore commessa — WPS assente nell\'org è 404 e non inserisce', async () => {
        ctx.nextWpsMissing = true;
        const res = mockRes();
        await projects.addProjectWelder({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { qualification_id: 8, wps_id: 99 },
        }, res);
        expect(http(res)).toBe(404);
        expect(bodyOf(res).code).toBe('WPS_NOT_FOUND');
        const wrote = query.mock.calls.some((call) => /INSERT\s+INTO\s+project_welders/i.test(String(call[0])));
        expect(wrote).toBe(false);
    });

    test('POST saldatore commessa — "1e2" non è un id e non inserisce', async () => {
        const res = mockRes();
        await projects.addProjectWelder({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { qualification_id: 8, wps_id: '1e2' },
        }, res);
        expect(http(res)).toBe(400);
        expect(bodyOf(res).code).toBe('VALIDATION_ERROR');
        const wrote = query.mock.calls.some((call) => /INSERT\s+INTO\s+project_welders/i.test(String(call[0])));
        expect(wrote).toBe(false);
    });

    test('POST saldatore commessa — assegna una WPS della stessa azienda consentita', async () => {
        ctx.nextWpsCompany = ALLOWED;
        const res = mockRes();
        await projects.addProjectWelder({
            user: userFor('ok'),
            params: { id: '7' },
            query: {},
            body: { qualification_id: 8, wps_id: 12 },
        }, res);
        expect(http(res)).toBe(201);
        const insert = query.mock.calls.find((call) => /INSERT\s+INTO\s+project_welders/i.test(String(call[0])));
        expect(insert[1].wid).toBe(12);
    });

    test('GET /welding/sketches senza company_id limita alle aziende consentite + libreria studio', async () => {
        const res = mockRes();
        await welding.listWeldSketches({
            user: userFor('ok'), params: {}, query: {}, body: {},
        }, res);
        expect(http(res)).toBe(200);
        const sql = query.mock.calls.map((call) => String(call[0])).join('\n');
        expect(sql).toMatch(/company_id IS NULL OR company_id IN/);
        expect(sql).toMatch(/@skco_0/);
    });

    test('GET content schizzo studio (company_id NULL) non è 403 per utente azienda', async () => {
        query.mockImplementation(async (sql, params) => {
            const compact = String(sql || '').replace(/\s+/g, ' ');
            if (/OBJECT_ID/i.test(compact)) return { recordset: [{ present: 1 }] };
            if (/FROM weld_sketches/i.test(compact)) {
                return {
                    recordset: [{
                        id: 7,
                        organization_id: ROW_ORG,
                        company_id: null,
                        file_url: '/uploads/sketches/1/shared/x.png',
                    }],
                };
            }
            return route(sql, params || {});
        });
        const res = mockRes();
        await welding.getWeldSketchContent({
            user: userFor('ok'), params: { id: '7' }, query: {}, body: {},
        }, res);
        expect(http(res)).not.toBe(403);
    });

    test('POST confirm schizzo studio: write azienda ok, sola lettura 403', async () => {
        query.mockImplementation(async (sql, params) => {
            const compact = String(sql || '').replace(/\s+/g, ' ');
            if (/OBJECT_ID/i.test(compact)) return { recordset: [{ present: 1 }] };
            if (/FROM weld_sketches/i.test(compact)) {
                return {
                    recordset: [{
                        id: 7,
                        organization_id: ROW_ORG,
                        company_id: null,
                        file_url: '/uploads/sketches/1/shared/x.png',
                    }],
                };
            }
            return route(sql, params || {});
        });
        const okRes = mockRes();
        await welding.confirmWeldSketch({
            user: userFor('ok'), params: { id: '7' }, query: {}, body: {},
        }, okRes);
        expect(http(okRes)).not.toBe(403);

        const readRes = mockRes();
        await welding.confirmWeldSketch({
            user: {
                user_id: 51,
                organization_id: ROW_ORG,
                role: 'client',
                company_access: [{ company_id: ALLOWED, permission: 'read' }],
            },
            params: { id: '7' }, query: {}, body: {},
        }, readRes);
        expect(http(readRes)).toBe(403);
        expect(bodyOf(readRes).code).toBe('AUTH_FORBIDDEN');

        const viewerRes = mockRes();
        await welding.confirmWeldSketch({
            user: {
                user_id: 52,
                organization_id: ROW_ORG,
                role: 'viewer',
                company_access: [],
            },
            params: { id: '7' }, query: {}, body: {},
        }, viewerRes);
        expect(http(viewerRes)).toBe(403);
        expect(bodyOf(viewerRes).code).toBe('AUTH_FORBIDDEN');
    });

    test('POST split schizzo studio: write azienda ok, sola lettura 403', async () => {
        query.mockImplementation(async (sql, params) => {
            const compact = String(sql || '').replace(/\s+/g, ' ');
            if (/OBJECT_ID/i.test(compact)) return { recordset: [{ present: 1 }] };
            if (/FROM weld_sketches/i.test(compact)) {
                return {
                    recordset: [{
                        id: 7,
                        organization_id: ROW_ORG,
                        company_id: null,
                        slot: 'combined',
                        status: 'da dividere',
                        file_url: '/uploads/sketches/1/shared/x.png',
                    }],
                };
            }
            return route(sql, params || {});
        });
        const okRes = mockRes();
        await welding.splitWeldSketch({
            user: userFor('ok'), params: { id: '7' }, query: {}, body: { y_ratio: 0.5 },
        }, okRes);
        expect(http(okRes)).not.toBe(403);

        const readRes = mockRes();
        await welding.splitWeldSketch({
            user: {
                user_id: 51,
                organization_id: ROW_ORG,
                role: 'client',
                company_access: [{ company_id: ALLOWED, permission: 'read' }],
            },
            params: { id: '7' }, query: {}, body: { y_ratio: 0.5 },
        }, readRes);
        expect(http(readRes)).toBe(403);
        expect(bodyOf(readRes).code).toBe('AUTH_FORBIDDEN');
    });

    test('GET lista WPQR — include le schede senza company_id se la WPS è consentita', async () => {
        ctx.forceWpqrCompany = true;
        ctx.wpqrCompanyId = null;
        ctx.wpsCompanyId = ALLOWED;
        const res = mockRes();
        await welding.listWPQR({
            user: userFor('ok'), params: {}, query: { page: '1', limit: '10' }, body: {},
        }, res);
        expect(http(res)).toBe(200);
        expect(bodyOf(res).data).toHaveLength(1);
        const sql = query.mock.calls.map((call) => String(call[0])).join('\n');
        expect(sql).toContain('wq.company_id IS NULL');
    });

    test('GET vision-fitness-gaps — utente per-azienda senza company_id limita alle aziende consentite', async () => {
        const res = mockRes();
        await qual.getVisionFitnessGaps({
            user: userFor('ok'),
            params: {},
            query: {},
            body: {},
        }, res);
        expect(http(res)).toBe(200);
        expect(bodyOf(res).summary.persons_requiring).toBe(0);
    });
});
