/**
 * @jest-environment node
 *
 * Test L1 — qualificationIngest.service
 * Copre: mapPipelineFieldsToReview (date conferma semestrale ISO 9606-1 §9.2 +
 * operator_name/campi ISO 14732), classifyQualificationType e
 * commitQualificationFromFields (INSERT con nuove colonne welding_type/single_multi_run/
 * qualification_method e campi 092 già esistenti).
 */

// Mock database e servizi esterni per testare solo la logica pura
jest.mock('../config/database', () => ({ getPool: jest.fn() }));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

jest.mock('./documentIngestPipeline.service', () => ({ runDocumentIngest: jest.fn() }));

jest.mock('./personnelQualificationLink.service', () => ({
    resolvePersonnelForQualification: jest.fn().mockResolvedValue({
        ok: true, personnelId: 55, personName: 'Luigi Verdi',
    }),
}));

jest.mock('../utils/documentClassifier', () => ({
    classifyDocument: jest.fn(() => ({ detected_type: 'patentino_saldatore', confidence: 'low' })),
    WRONG_MODULE_FOR_QUALIFICATIONS: new Set(),
    WRONG_MODULE_MESSAGES: {},
    SUGGESTED_MODULE: {},
}));

const { getPool } = require('../config/database');
const {
    mapPipelineFieldsToReview,
    classifyQualificationType,
    commitQualificationFromFields,
    checkQualificationPlausibility,
    applyFieldReprocessUpdate,
    REPROCESSABLE_FIELDS,
} = require('./qualificationIngest.service');

describe('mapPipelineFieldsToReview — date conferma semestrale', () => {
    const BASE = {
        welder_name: 'MARIO ROSSI',
        certificate_number: 'TUV-9606-2024-001',
        welding_process: '135',
        exam_date: '2024-04-17',
        expiry_date: '2027-04-16',
    };

    it('calcola next_confirmation_due = exam_date + 6 mesi quando tabella 9.2 è vuota', () => {
        const fields = mapPipelineFieldsToReview(
            { ...BASE, last_confirmation_date: null, next_confirmation_due: null },
            'ISO 9606-1', 'patentino.pdf'
        );
        expect(fields.next_confirmation_due).toBe('2024-10-17');
        expect(fields.last_confirmation_date).toBeNull();
        expect(fields.cpd_valid_until).toBe('2024-10-17');
    });

    it('usa last_confirmation_date dal PDF quando presente + calcola prossima', () => {
        const fields = mapPipelineFieldsToReview(
            { ...BASE, last_confirmation_date: '2024-10-17', next_confirmation_due: null },
            'ISO 9606-1', 'patentino.pdf'
        );
        expect(fields.last_confirmation_date).toBe('2024-10-17');
        expect(fields.next_confirmation_due).toBe('2025-04-17');
    });

    it('usa next_confirmation_due dal PDF quando esplicitamente presente', () => {
        const fields = mapPipelineFieldsToReview(
            { ...BASE, last_confirmation_date: '2025-04-17', next_confirmation_due: '2025-10-17' },
            'ISO 9606-1', 'patentino.pdf'
        );
        expect(fields.next_confirmation_due).toBe('2025-10-17');
    });

    it('gestisce exam_date null senza crash (non calcola next_confirmation_due)', () => {
        const fields = mapPipelineFieldsToReview(
            { ...BASE, exam_date: null, last_confirmation_date: null, next_confirmation_due: null },
            'ISO 9606-1', 'patentino.pdf'
        );
        expect(fields.next_confirmation_due).toBeNull();
        expect(fields.exam_date).toBeNull();
    });

    it('addMonths gestisce correttamente il cambio anno (ottobre + 6 = aprile anno+1)', () => {
        const fields = mapPipelineFieldsToReview(
            { ...BASE, exam_date: '2023-10-15', last_confirmation_date: null, next_confirmation_due: null },
            'ISO 9606-1', 'patentino.pdf'
        );
        expect(fields.next_confirmation_due).toBe('2024-04-15');
    });
});

describe('classifyQualificationType', () => {
    it('classifica ISO 9606-1', () => {
        expect(classifyQualificationType('certificato ISO 9606-1')).toBe('Saldatore ISO 9606-1');
    });
    it('classifica ISO 9606-2', () => {
        expect(classifyQualificationType('qualifica 9606-2')).toBe('Saldatore ISO 9606-2');
    });
    it('fallback ad Altra qualifica', () => {
        expect(classifyQualificationType('documento generico')).toBe('Altra qualifica');
    });
});

describe('qualificationIngest.service — mapPipelineFieldsToReview (ISO 14732)', () => {
    it('legge operator_name (schema qualifica_14732) come nome titolare', () => {
        const out = mapPipelineFieldsToReview({
            operator_name: 'Luigi Verdi',
            equipment_type: 'Robot MIG/MAG',
            welding_type: 'automatic',
            single_multi_run: 'multi',
            qualification_method: 'iso_15614',
        }, 'qualifica operatore ISO 14732 saldatura automatica', 'file.pdf');

        expect(out.person_name).toBe('Luigi Verdi');
        expect(out.operator_name).toBe('Luigi Verdi');
        expect(out.equipment_type).toBe('Robot MIG/MAG');
        expect(out.welding_type).toBe('automatic');
        expect(out.single_multi_run).toBe('multi');
        expect(out.qualification_method).toBe('iso_15614');
        expect(out.qualification_type).toBe('Operatore ISO 14732');
    });

    it('welder_name (patentino_saldatore) resta prioritario se presente', () => {
        const out = mapPipelineFieldsToReview({
            welder_name: 'Mario Rossi',
            operator_name: 'Altro Nome',
        }, 'patentino saldatore 9606-1', 'file.pdf');
        expect(out.person_name).toBe('Mario Rossi');
    });

    it('mappa shielding_gas (campo previsto dallo schema AI ma fino al 26/07/2026 mai propagato)', () => {
        const out = mapPipelineFieldsToReview({
            welder_name: 'Mario Rossi',
            shielding_gas: 'M21',
        }, 'patentino saldatore 9606-1', 'file.pdf');
        expect(out.shielding_gas).toBe('M21');
    });

    it('mappa product_type e weld_details (variabile essenziale ISO 9606-1 §11 — gap 26/07/2026)', () => {
        const out = mapPipelineFieldsToReview({
            welder_name: 'Mario Rossi',
            product_type: 'T',
            weld_details: 'backing ceramico',
        }, 'patentino saldatore 9606-1', 'file.pdf');
        expect(out.product_type).toBe('T');
        expect(out.weld_details).toBe('backing ceramico');
    });

    it('mappa transfer_mode (variabile essenziale ISO 9606-1 §5.2/§9.3 — richiesta committente 28/07/2026)', () => {
        const out = mapPipelineFieldsToReview({
            welder_name: 'Mario Rossi',
            welding_process: '135',
            transfer_mode: 'spray_arc',
        }, 'patentino saldatore 9606-1', 'file.pdf');
        expect(out.transfer_mode).toBe('spray_arc');
    });

    it('transfer_mode assente sul certificato resta null (non inventare un valore)', () => {
        const out = mapPipelineFieldsToReview({
            welder_name: 'Mario Rossi',
            welding_process: '141',
        }, 'patentino saldatore 9606-1', 'file.pdf');
        expect(out.transfer_mode).toBeNull();
    });
});

describe('checkQualificationPlausibility (gap analysis 26/07/2026 — warning-only)', () => {
    it('nessun warning per campi coerenti', () => {
        const warnings = checkQualificationPlausibility({
            exam_date: '2024-04-17',
            expiry_date: '2027-04-16',
            last_confirmation_date: '2024-10-17',
            next_confirmation_due: '2025-04-17',
            thickness_min_mm: 3, thickness_max_mm: 12,
            shielding_gas: 'M21',
        });
        expect(warnings).toEqual([]);
    });

    it('segnala scadenza anteriore alla data di esame', () => {
        const warnings = checkQualificationPlausibility({
            exam_date: '2024-04-17', expiry_date: '2020-01-01',
        });
        expect(warnings.some((w) => w.includes('scadenza'))).toBe(true);
    });

    it('segnala prossima conferma anteriore o uguale all\'ultima conferma', () => {
        const warnings = checkQualificationPlausibility({
            last_confirmation_date: '2024-10-17', next_confirmation_due: '2024-10-17',
        });
        expect(warnings.some((w) => w.includes('conferma'))).toBe(true);
    });

    it('segnala range spessore invertito', () => {
        const warnings = checkQualificationPlausibility({ thickness_min_mm: 30, thickness_max_mm: 10 });
        expect(warnings.some((w) => w.includes('invertito'))).toBe(true);
    });

    it('segnala gas fuori catalogo ISO 14175', () => {
        const warnings = checkQualificationPlausibility({ shielding_gas: 'NON-ESISTE' });
        expect(warnings.some((w) => w.includes('ISO 14175'))).toBe(true);
    });
});

describe('qualificationIngest.service — commitQualificationFromFields (14732)', () => {
    function makeRequestMock() {
        const req = { input: jest.fn().mockReturnThis() };
        req.query = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });
        return req;
    }

    it('inserisce welding_type/single_multi_run/qualification_method nella query INSERT', async () => {
        const dupCheckReq = makeRequestMock();
        dupCheckReq.query = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });

        const insertReq = { input: jest.fn().mockReturnThis() };
        insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 501 }] });

        let callCount = 0;
        const pool = {
            request: jest.fn(() => {
                callCount += 1;
                return callCount === 1 ? dupCheckReq : insertReq;
            }),
        };
        getPool.mockResolvedValue(pool);

        const result = await commitQualificationFromFields({
            operator_name: 'Luigi Verdi',
            certificate_number: 'CERT-14732-01',
            equipment_type: 'Testa SAW',
            welding_type: 'mechanized',
            single_multi_run: 'single',
            qualification_method: 'production_test',
            exam_date: '2026-01-10',
            expiry_date: '2032-01-10',
        }, 10, 20, { qualificationType: 'Operatore ISO 14732' });

        expect(result.qualification_id).toBe(501);
        expect(insertReq.input).toHaveBeenCalledWith('weldingType', 'mechanized');
        expect(insertReq.input).toHaveBeenCalledWith('singleMultiRun', 'single');
        expect(insertReq.input).toHaveBeenCalledWith('qualMethod', 'production_test');
        expect(insertReq.input).toHaveBeenCalledWith('equipType', 'Testa SAW');
        expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('welding_type'));
        expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('single_multi_run'));
        expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('qualification_method'));
    });

    it('persiste shielding_gas nella query INSERT (gap analysis 26/07/2026)', async () => {
        const dupCheckReq = makeRequestMock();
        dupCheckReq.query = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });

        const insertReq = { input: jest.fn().mockReturnThis() };
        insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 502 }] });

        let callCount = 0;
        const pool = {
            request: jest.fn(() => {
                callCount += 1;
                return callCount === 1 ? dupCheckReq : insertReq;
            }),
        };
        getPool.mockResolvedValue(pool);

        await commitQualificationFromFields({
            welder_name: 'Mario Rossi',
            certificate_number: 'CERT-9606-01',
            welding_process: '135',
            shielding_gas: 'M21',
        }, 10, 20, { qualificationType: 'Saldatore ISO 9606-1' });

        expect(insertReq.input).toHaveBeenCalledWith('shieldGas', 'M21');
        expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('shielding_gas'));
    });

    it('persiste product_type/weld_details e calcola qualification_designation (gap analysis 26/07/2026)', async () => {
        const dupCheckReq = makeRequestMock();
        dupCheckReq.query = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });

        const insertReq = { input: jest.fn().mockReturnThis() };
        insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 503 }] });

        let callCount = 0;
        const pool = {
            request: jest.fn(() => {
                callCount += 1;
                return callCount === 1 ? dupCheckReq : insertReq;
            }),
        };
        getPool.mockResolvedValue(pool);

        await commitQualificationFromFields({
            welder_name: 'Mario Rossi',
            certificate_number: 'CERT-9606-02',
            welding_process: '141',
            joint_type: 'BW',
            product_type: 'T',
            weld_details: 'backing ceramico',
            thickness_min_mm: 3,
            thickness_max_mm: 12,
            pipe_diameter_min_mm: 60,
            pipe_diameter_max_mm: 120,
            welding_positions: ['PA', 'PC'],
        }, 10, 20, { qualificationType: 'Saldatore ISO 9606-1' });

        expect(insertReq.input).toHaveBeenCalledWith('jointType', 'BW');
        expect(insertReq.input).toHaveBeenCalledWith('productType', 'T');
        expect(insertReq.input).toHaveBeenCalledWith('weldDetails', 'backing ceramico');
        expect(insertReq.input).toHaveBeenCalledWith('designation', expect.stringContaining('141 T BW'));
        expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('qualification_designation'));
    });

    it('persiste transfer_mode nella query INSERT (richiesta committente 28/07/2026)', async () => {
        const dupCheckReq = makeRequestMock();
        dupCheckReq.query = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });

        const insertReq = { input: jest.fn().mockReturnThis() };
        insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 507 }] });

        let callCount = 0;
        const pool = {
            request: jest.fn(() => {
                callCount += 1;
                return callCount === 1 ? dupCheckReq : insertReq;
            }),
        };
        getPool.mockResolvedValue(pool);

        await commitQualificationFromFields({
            welder_name: 'Mario Rossi',
            certificate_number: 'CERT-9606-04',
            welding_process: '135',
            transfer_mode: 'short_arc',
        }, 10, 20, { qualificationType: 'Saldatore ISO 9606-1' });

        expect(insertReq.input).toHaveBeenCalledWith('transferMode', 'short_arc');
        expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('transfer_mode'));
    });
});

describe('qualificationIngest.service — sanitizzazione numerica (bug produzione 27/07/2026, cliente Mason)', () => {
    function makeRequestMock() {
        const req = { input: jest.fn().mockReturnThis() };
        req.query = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });
        return req;
    }

    /**
     * Riproduce esattamente lo scenario segnalato: certificato ISO 9606-1 (giunto
     * FW su tubo) con "N.A." sui campi spessore/diametro non applicabili al tipo
     * di giunto/prodotto — come nel PDF "24-00824-01-003_LUKIC BLAGO..." — e/o
     * campo lasciato vuoto in revisione (stringa ""). Prima del fix, mssql
     * bind-ava questi valori come NVarChar su colonne DECIMAL causando
     * "Error converting data type nvarchar to numeric" e il salvataggio falliva.
     */
    it('salva null (non crasha) quando thickness/pipe_diameter arrivano come "N.A." o stringa vuota', async () => {
        const dupCheckReq = makeRequestMock();
        const insertReq = { input: jest.fn().mockReturnThis() };
        insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 504 }] });

        let callCount = 0;
        const pool = {
            request: jest.fn(() => {
                callCount += 1;
                return callCount === 1 ? dupCheckReq : insertReq;
            }),
        };
        getPool.mockResolvedValue(pool);

        const result = await commitQualificationFromFields({
            welder_name: 'Blago Lukic',
            certificate_number: '24-00824-01-003',
            welding_process: '111',
            joint_type: 'FW',
            product_type: 'T',
            material_group: '1',
            filler_material_group: 'FM1',
            welding_positions: ['PA', 'PB', 'PC', 'PD', 'PE', 'PF', 'PH'],
            thickness_min_mm: 'N.A.',
            thickness_max_mm: '',
            pipe_diameter_min_mm: 'N.A.',
            pipe_diameter_max_mm: '3-6',
        }, 10, 20, { qualificationType: 'Saldatore ISO 9606-1' });

        expect(result.qualification_id).toBe(504);
        expect(insertReq.input).toHaveBeenCalledWith('thickMin', null);
        expect(insertReq.input).toHaveBeenCalledWith('thickMax', null);
        expect(insertReq.input).toHaveBeenCalledWith('pipeMin', null);
        // Range ambiguo su campo singolo "3-6" -> policy: primo numero (documentata in numericSanitizer.js)
        expect(insertReq.input).toHaveBeenCalledWith('pipeMax', 3);
    });

    it('preserva valori numerici validi (nessuna regressione)', async () => {
        const dupCheckReq = makeRequestMock();
        const insertReq = { input: jest.fn().mockReturnThis() };
        insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 505 }] });

        let callCount = 0;
        const pool = {
            request: jest.fn(() => {
                callCount += 1;
                return callCount === 1 ? dupCheckReq : insertReq;
            }),
        };
        getPool.mockResolvedValue(pool);

        await commitQualificationFromFields({
            welder_name: 'Mario Rossi',
            certificate_number: 'CERT-9606-03',
            welding_process: '111',
            thickness_min_mm: 4,
            thickness_max_mm: '12,5',
            pipe_diameter_min_mm: 60,
            pipe_diameter_max_mm: '≥120',
        }, 10, 20, { qualificationType: 'Saldatore ISO 9606-1' });

        expect(insertReq.input).toHaveBeenCalledWith('thickMin', 4);
        expect(insertReq.input).toHaveBeenCalledWith('thickMax', 12.5);
        expect(insertReq.input).toHaveBeenCalledWith('pipeMin', 60);
        expect(insertReq.input).toHaveBeenCalledWith('pipeMax', 120);
    });

    it('sanitizza anche ndt_level testuale non numerico senza crashare', async () => {
        const dupCheckReq = makeRequestMock();
        const insertReq = { input: jest.fn().mockReturnThis() };
        insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 506 }] });

        let callCount = 0;
        const pool = {
            request: jest.fn(() => {
                callCount += 1;
                return callCount === 1 ? dupCheckReq : insertReq;
            }),
        };
        getPool.mockResolvedValue(pool);

        await commitQualificationFromFields({
            operator_name: 'Anna Bianchi',
            certificate_number: 'NDT-01',
            ndt_method: 'UT',
            ndt_level: 'N/D',
        }, 10, 20, { qualificationType: 'Operatore NDT' });

        expect(insertReq.input).toHaveBeenCalledWith('ndtLevel', null);
    });
});

describe('mapPipelineFieldsToReview — sanitizzazione numerica in revisione', () => {
    it('mostra null in revisione per thickness/pipe_diameter non numerici (mai la stringa grezza)', () => {
        const out = mapPipelineFieldsToReview({
            welder_name: 'Mario Rossi',
            thickness_min_mm: 'N.A.',
            thickness_max_mm: '',
            pipe_diameter_min_mm: 'n.a.',
            pipe_diameter_max_mm: undefined,
        }, 'patentino saldatore 9606-1', 'file.pdf');

        expect(out.thickness_min_mm).toBeNull();
        expect(out.thickness_max_mm).toBeNull();
        expect(out.pipe_diameter_min_mm).toBeNull();
        expect(out.pipe_diameter_max_mm).toBeNull();
        expect(out.thickness_range).toBeNull();
    });
});

describe('applyFieldReprocessUpdate — backfill campo su qualifica esistente (migrazione 137)', () => {
    afterEach(() => jest.clearAllMocks());

    it('espone transfer_mode nella whitelist REPROCESSABLE_FIELDS', () => {
        expect(REPROCESSABLE_FIELDS.transfer_mode).toEqual({ column: 'transfer_mode' });
    });

    it('esegue un UPDATE mirato (mai una INSERT) solo sul campo in field_scope', async () => {
        const checkReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 8 }] }) };
        const updateReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [] }) };
        let callCount = 0;
        const pool = { request: jest.fn(() => (++callCount === 1 ? checkReq : updateReq)) };
        getPool.mockResolvedValue(pool);

        const result = await applyFieldReprocessUpdate(8, 1001, 'transfer_mode', { transfer_mode: 'spray_arc' });

        expect(result).toEqual({ qualification_id: 8, updated_fields: ['transfer_mode'] });
        expect(updateReq.input).toHaveBeenCalledWith('val_transfer_mode', 'spray_arc');
        const sql = updateReq.query.mock.calls[0][0];
        expect(sql).toMatch(/UPDATE qualifications/);
        expect(sql).toMatch(/transfer_mode = @val_transfer_mode/);
        expect(sql).toMatch(/transfer_mode IS NULL/); // guardia anti-sovrascrittura
        expect(sql).not.toMatch(/INSERT INTO/);
    });

    it('non scrive nulla se il valore proposto è vuoto/null', async () => {
        const checkReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 9 }] }) };
        const pool = { request: jest.fn(() => checkReq) };
        getPool.mockResolvedValue(pool);

        const result = await applyFieldReprocessUpdate(9, 1001, 'transfer_mode', { transfer_mode: null });

        expect(result).toEqual({ qualification_id: 9, updated_fields: [] });
        // Nessuna seconda request (UPDATE) è stata aperta: solo la verifica di esistenza.
        expect(pool.request).toHaveBeenCalledTimes(1);
    });

    it('rifiuta un field_scope fuori whitelist ignorandolo silenziosamente (nessuna colonna arbitraria scrivibile)', async () => {
        const checkReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 10 }] }) };
        const pool = { request: jest.fn(() => checkReq) };
        getPool.mockResolvedValue(pool);

        const result = await applyFieldReprocessUpdate(10, 1001, 'password_hash', { password_hash: 'hacked' });

        expect(result.updated_fields).toEqual([]);
    });

    it('lancia NOT_FOUND se la qualifica destinataria non esiste nell\'organizzazione', async () => {
        const checkReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [] }) };
        getPool.mockResolvedValue({ request: jest.fn(() => checkReq) });

        await expect(applyFieldReprocessUpdate(999, 1001, 'transfer_mode', { transfer_mode: 'spray_arc' }))
            .rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
});
