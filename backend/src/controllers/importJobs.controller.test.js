jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../services/personnelQualificationLink.service', () => ({
    resolvePersonnelForQualification: jest.fn().mockResolvedValue({ ok: true, personnelId: 77, personName: 'Mario Rossi', personCode: null }),
}));

const { query } = require('../config/database');
const { createJob, commitToRegistry, commitToQualification, listJobs, getJob } = require('./importJobs.controller');

function makeRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
    };
}

function makeReq(body = {}) {
    return {
        user: { organization_id: 1002, user_id: 12 },
        params: { id: '55', fileId: '9' },
        body,
    };
}

const AI_QUALIFICATION = JSON.stringify({
    document_type_guess: 'patentino_saldatore',
    type_specific_data: {
        person_name: 'Mario Rossi',
        certificate_number: 'CERT-001',
        standard_reference: 'ISO 9606-1',
    },
});

describe('importJobs.controller listJobs / getJob (regressione SQL company_name)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('listJobs joina companies senza referenziare colonne inesistenti (no organization_id su companies)', async () => {
        query.mockResolvedValueOnce({ recordset: [{ id: 1, company_name: 'ACME' }] });
        const res = makeRes();

        await listJobs(makeReq(), res);

        expect(query).toHaveBeenCalledTimes(1);
        const sql = query.mock.calls[0][0];
        // La tabella companies usa auditor_org_id, NON organization_id: il join non deve referenziare c.organization_id.
        expect(sql).not.toMatch(/c\.organization_id/);
        expect(sql).toMatch(/LEFT JOIN companies c ON c\.id = j\.company_id/);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 1, company_name: 'ACME' }] });
    });

    it('getJob joina companies senza referenziare colonne inesistenti (no organization_id su companies)', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ id: 55, company_id: 44, company_name: 'ACME' }] })
            .mockResolvedValueOnce({ recordset: [] });
        const res = makeRes();

        await getJob(makeReq(), res);

        const sql = query.mock.calls[0][0];
        expect(sql).not.toMatch(/c\.organization_id/);
        expect(sql).toMatch(/LEFT JOIN companies c ON c\.id = j\.company_id/);
        expect(res.status).not.toHaveBeenCalledWith(500);
    });
});

describe('importJobs.controller createJob', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('richiede company_id per job di qualifica', async () => {
        const req = {
            user: { organization_id: 1002, user_id: 12 },
            body: { document_type_hint: 'patentino_saldatore' },
        };
        const res = makeRes();

        await createJob(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: 'company_id obbligatorio per i job di qualifica.',
            code: 'COMPANY_REQUIRED_FOR_QUALIFICATION_IMPORT',
        });
        expect(query).not.toHaveBeenCalled();
    });

    it('rifiuta company_id non appartenente alla organizzazione', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const req = {
            user: { organization_id: 1002, user_id: 12 },
            body: { document_type_hint: 'norma', company_id: 999 },
        };
        const res = makeRes();

        await createJob(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "L'azienda selezionata non appartiene all'organizzazione.",
            code: 'COMPANY_NOT_IN_ORG',
        });
        expect(query).toHaveBeenCalledTimes(1);
    });
});

describe('importJobs.controller commitToQualification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('usa company_id del job quando il body non lo passa', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ id: 55, company_id: 44 }] })
            .mockResolvedValueOnce({
                recordset: [{
                    id: 9,
                    status: 'reviewed',
                    ai_extraction_json: AI_QUALIFICATION,
                    original_name: 'patentino.pdf',
                    confidence_score: 91,
                }],
            })
            .mockResolvedValueOnce({ recordset: [{ id: 44 }] })
            .mockImplementationOnce(async (_sql, params) => {
                expect(params.company_id).toBe(44);
                expect(params.person_name).toBe('Mario Rossi');
                expect(params.approval_status).toBe('bozza');
                return { recordset: [{ id: 123 }] };
            })
            .mockResolvedValueOnce({ recordset: [] });

        const res = makeRes();
        await commitToQualification(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            data: { qualification_id: 123, approval_status: 'bozza' },
        });
    });

    it('blocca la bozza qualifica se manca company_id anche sul job', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ id: 55, company_id: null }] })
            .mockResolvedValueOnce({
                recordset: [{
                    id: 9,
                    status: 'reviewed',
                    ai_extraction_json: AI_QUALIFICATION,
                    original_name: 'patentino.pdf',
                    confidence_score: 91,
                }],
            });

        const res = makeRes();
        await commitToQualification(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "company_id obbligatorio: seleziona l'azienda del job prima di creare la bozza qualifica.",
            code: 'MISSING_COMPANY_ID',
        });
        expect(query).toHaveBeenCalledTimes(2);
    });

    it('blocca override company_id diverso da quello del job', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ id: 55, company_id: 44 }] })
            .mockResolvedValueOnce({
                recordset: [{
                    id: 9,
                    status: 'reviewed',
                    ai_extraction_json: AI_QUALIFICATION,
                    original_name: 'patentino.pdf',
                    confidence_score: 91,
                }],
            })
            .mockResolvedValueOnce({ recordset: [{ id: 44 }] });

        const res = makeRes();
        await commitToQualification(makeReq({ company_id: 45 }), res);

        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith({
            error: "company_id non coerente con l'azienda del job.",
            code: 'COMPANY_ID_MISMATCH',
        });
        expect(query).toHaveBeenCalledTimes(3);
    });
});

describe('importJobs.controller commitToRegistry', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('rifiuta company_id fuori organizzazione prima del commit registry', async () => {
        query
            .mockResolvedValueOnce({ recordset: [{ id: 55, company_id: null }] })
            .mockResolvedValueOnce({
                recordset: [{
                    id: 9,
                    status: 'reviewed',
                    original_name: 'documento.pdf',
                    storage_path: null,
                    mime_type: 'application/pdf',
                    file_size: 1000,
                    ai_extraction_json: null,
                    registry_document_id: null,
                    extracted_text: 'testo',
                    confidence_score: 80,
                }],
            })
            .mockResolvedValueOnce({ recordset: [] });

        const res = makeRes();
        await commitToRegistry(makeReq({ company_id: 999, doc_type: 'manuale', title: 'Documento' }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "L'azienda selezionata non appartiene all'organizzazione.",
            code: 'COMPANY_NOT_IN_ORG',
        });
        expect(query).toHaveBeenCalledTimes(3);
    });
});
