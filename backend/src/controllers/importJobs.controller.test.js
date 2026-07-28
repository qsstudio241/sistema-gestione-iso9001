jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../services/personnelQualificationLink.service', () => ({
    resolvePersonnelForQualification: jest.fn().mockResolvedValue({ ok: true, personnelId: 77, personName: 'Mario Rossi', personCode: null }),
}));

const fs = require('fs');
const path = require('path');

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
    let tempPdfPath;

    beforeEach(() => {
        jest.clearAllMocks();
        const uploadDir = path.join(__dirname, '../../uploads/test-commit');
        fs.mkdirSync(uploadDir, { recursive: true });
        tempPdfPath = path.join(uploadDir, 'patentino-test.pdf');
        fs.writeFileSync(tempPdfPath, '%PDF-1.4 test');
    });

    afterEach(() => {
        try {
            if (tempPdfPath && fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
        } catch { /* ignore */ }
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
                expect(params.approval_status).toBe('approvata');
                return { recordset: [{ id: 123 }] };
            })
            .mockResolvedValueOnce({ recordset: [] });

        const res = makeRes();
        await commitToQualification(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        const payload = res.json.mock.calls[0][0];
        expect(payload.success).toBe(true);
        expect(payload.data.qualification_id).toBe(123);
        expect(payload.data.approval_status).toBe('approvata');
        expect(Array.isArray(payload.data.warnings)).toBe(true);
    });

    it('mappa i nuovi campi saldatore 9606-1 (date conferma, exam_date, min/max numerici, designazione)', async () => {
        const aiFull = JSON.stringify({
            document_type_guess: 'patentino_saldatore',
            type_specific_data: {
                welder_name: 'Luigi Bianchi',
                certificate_number: 'CERT-777',
                issuing_body: 'TUV',
                examiner_body: 'IIS Cert',
                welding_process: '141',
                joint_type: 'BW',
                product_type: 'P',
                weld_details: 'ss nb',
                material_group: '1.1',
                filler_material_group: 'FM1',
                welding_positions: ['PA', 'PF'],
                thickness_min_mm: 3,
                thickness_max_mm: 20,
                pipe_diameter_min_mm: 60,
                pipe_diameter_max_mm: 120,
                shielding_gas: 'M21',
                exam_date: '2026-01-10',
                expiry_date: '2028-01-10',
                last_confirmation_date: '2026-06-10',
                next_confirmation_due: '2026-12-10',
                revalidation_date: '2029-01-10',
                standard_reference: 'ISO 9606-1:2017',
            },
        });

        let insertParams = null;
        query
            .mockResolvedValueOnce({ recordset: [{ id: 55, company_id: 44 }] })
            .mockResolvedValueOnce({
                recordset: [{
                    id: 9, status: 'reviewed', ai_extraction_json: aiFull,
                    original_name: 'patentino.pdf', confidence_score: 95,
                }],
            })
            .mockResolvedValueOnce({ recordset: [{ id: 44 }] })
            .mockImplementationOnce(async (_sql, params) => {
                insertParams = params;
                return { recordset: [{ id: 321 }] };
            })
            .mockResolvedValueOnce({ recordset: [] });

        const res = makeRes();
        await commitToQualification(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(insertParams).not.toBeNull();
        // Date dedicate
        expect(insertParams.exam_date).toBe('2026-01-10');
        expect(insertParams.last_confirmation_date).toBe('2026-06-10');
        expect(insertParams.next_confirmation_due).toBe('2026-12-10');
        expect(insertParams.revalidation_date).toBe('2029-01-10');
        // Min/max numerici + legacy derivata
        expect(insertParams.thickness_min_mm).toBe(3);
        expect(insertParams.thickness_max_mm).toBe(20);
        expect(insertParams.pipe_diameter_min_mm).toBe(60);
        expect(insertParams.pipe_diameter_max_mm).toBe(120);
        expect(insertParams.thickness_range).toBe('3-20mm');
        expect(insertParams.pipe_diameter).toBe('60-120mm');
        // Nuovi campi norma
        expect(insertParams.product_type).toBe('P');
        expect(insertParams.weld_details).toBe('ss nb');
        expect(insertParams.examiner_body).toBe('IIS Cert');
        expect(insertParams.position_range).toBe('PA,PF');
        // Designazione calcolata
        expect(insertParams.qualification_designation).toBe('141 P BW FM1 t3-20 D60-120 PA/PF ss nb');
        // Nessun warning: tutti gli obbligatori presenti
        const payload = res.json.mock.calls[0][0];
        expect(payload.data.warnings).toEqual([]);
    });

    it('usa il simbolo >= per spessore/diametro quando e\' noto solo il minimo (feedback cliente Studio Mason)', async () => {
        const aiMinOnly = JSON.stringify({
            document_type_guess: 'patentino_saldatore',
            type_specific_data: {
                welder_name: 'Luigi Bianchi',
                certificate_number: 'CERT-888',
                welding_process: '141',
                joint_type: 'BW',
                material_group: '8.1',
                welding_positions: ['PA'],
                thickness_min_mm: 3,
                pipe_diameter_min_mm: 60,
                exam_date: '2026-01-10',
                expiry_date: '2029-01-10',
                standard_reference: 'ISO 9606-1:2017',
            },
        });

        let insertParams = null;
        query
            .mockResolvedValueOnce({ recordset: [{ id: 55, company_id: 44 }] })
            .mockResolvedValueOnce({
                recordset: [{
                    id: 9, status: 'reviewed', ai_extraction_json: aiMinOnly,
                    original_name: 'patentino.pdf', confidence_score: 90,
                }],
            })
            .mockResolvedValueOnce({ recordset: [{ id: 44 }] })
            .mockImplementationOnce(async (_sql, params) => {
                insertParams = params;
                return { recordset: [{ id: 555 }] };
            })
            .mockResolvedValueOnce({ recordset: [] });

        const res = makeRes();
        await commitToQualification(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(insertParams.thickness_min_mm).toBe(3);
        expect(insertParams.thickness_max_mm).toBeNull();
        expect(insertParams.thickness_range).toBe('\u22653mm');
        expect(insertParams.pipe_diameter).toBe('\u226560mm');
        expect(insertParams.qualification_designation).toBe('141 BW t\u22653 D\u226560 PA');
    });

    it('non blocca la creazione se mancano campi obbligatori saldatore, ma li elenca nei warning', async () => {
        let insertParams = null;
        query
            .mockResolvedValueOnce({ recordset: [{ id: 55, company_id: 44 }] })
            .mockResolvedValueOnce({
                recordset: [{
                    id: 9, status: 'reviewed', ai_extraction_json: AI_QUALIFICATION,
                    original_name: 'patentino.pdf', confidence_score: 60,
                }],
            })
            .mockResolvedValueOnce({ recordset: [{ id: 44 }] })
            .mockImplementationOnce(async (_sql, params) => {
                insertParams = params;
                return { recordset: [{ id: 999 }] };
            })
            .mockResolvedValueOnce({ recordset: [] });

        const res = makeRes();
        await commitToQualification(makeReq(), res);

        // Crea comunque la qualifica, subito attiva (201), nonostante i campi obbligatori mancanti.
        expect(res.status).toHaveBeenCalledWith(201);
        expect(insertParams.approval_status).toBe('approvata');
        const payload = res.json.mock.calls[0][0];
        expect(payload.data.qualification_id).toBe(999);
        expect(payload.data.warnings.length).toBeGreaterThan(0);
        expect(payload.data.warnings.join(' ')).toMatch(/processo di saldatura/);
        expect(payload.data.warnings.join(' ')).toMatch(/data scadenza/);
    });

    it('collega certificate_file_url e qualification_id sul file import', async () => {
        let updateCertSql = null;
        let updateFileSql = null;
        let updateFileParams = null;

        query
            .mockResolvedValueOnce({ recordset: [{ id: 55, company_id: 44 }] })
            .mockResolvedValueOnce({
                recordset: [{
                    id: 9,
                    status: 'reviewed',
                    ai_extraction_json: AI_QUALIFICATION,
                    original_name: 'patentino.pdf',
                    confidence_score: 91,
                    storage_path: tempPdfPath,
                }],
            })
            .mockResolvedValueOnce({ recordset: [{ id: 44 }] })
            .mockResolvedValueOnce({ recordset: [{ id: 123 }] })
            .mockImplementationOnce(async (sql, params) => {
                updateCertSql = sql;
                expect(params.url).toMatch(/^\/uploads\//);
                return { recordset: [] };
            })
            .mockImplementationOnce(async (sql, params) => {
                updateFileSql = sql;
                updateFileParams = params;
                return { recordset: [] };
            });

        const res = makeRes();
        await commitToQualification(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(201);
        const payload = res.json.mock.calls[0][0];
        expect(payload.data.certificate_file_url).toMatch(/^\/uploads\//);
        expect(updateCertSql).toMatch(/certificate_file_url/);
        expect(updateFileSql).toMatch(/qualification_id/);
        expect(updateFileParams.qualId).toBe(123);
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
