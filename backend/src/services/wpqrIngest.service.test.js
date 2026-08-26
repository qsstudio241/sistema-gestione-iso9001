/**
 * @jest-environment node
 */

jest.mock('./documentIngestPipeline.service', () => ({
    runDocumentIngest: jest.fn(),
}));

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const { runDocumentIngest } = require('./documentIngestPipeline.service');
const { query } = require('../config/database');
const {
    ingestWPQRFromPdf,
    extractWPQRFromPdf,
    checkWpqrPlausibility,
    commitWPQRFromFields,
    resolveThicknessRange,
} = require('./wpqrIngest.service');

describe('ingestWPQRFromPdf (IG-2)', () => {
    afterEach(() => jest.clearAllMocks());

    it('usa campi pipeline e inserisce WPQR', async () => {
        runDocumentIngest.mockResolvedValue({
            text: 'WPQR 21-02906 processo 135 ISO 15614',
            fields: {
                wpqr_number: '21-02906',
                welding_process: '135',
                material_group: '1.1',
                thickness_test_mm: 12,
            },
            fieldConfidence: { welding_process: 'high' },
            extractionConfidence: 80,
            aiModel: 'gemini-1.5-flash',
            warnings: [],
        });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [{ id: 42 }] });

        const out = await ingestWPQRFromPdf(
            Buffer.from('%PDF'),
            '21-02906.pdf',
            1001,
            2001,
            { userId: 1 }
        );

        expect(runDocumentIngest).toHaveBeenCalledWith(expect.objectContaining({ docType: 'wpqr' }));
        expect(out.status).toBe('ok');
        expect(out.wpqr_id).toBe(42);
        expect(out.reference_number).toBe('21-02906');
        expect(out.welding_process).toBe('135');
        expect(out.confidence).toBe('alta');
    });

    it('non crasha se AI fallisce ma regole riempiono campi', async () => {
        runDocumentIngest.mockResolvedValue({
            text: 'WPQR 21-02906 processo 135',
            fields: { reference_number: '21-02906', welding_process: '135' },
            fieldConfidence: { welding_process: 'medium' },
            extractionConfidence: 45,
            aiModel: null,
            warnings: ['AI retry fallito: x'],
        });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [] });
        query.mockResolvedValueOnce({ recordset: [{ id: 9 }] });

        const out = await ingestWPQRFromPdf(Buffer.from('%PDF'), '21-02906.pdf', 1001, 2001, {});

        expect(out.status).toBe('ok');
        expect(out.wpqr_id).toBe(9);
        expect(out.warnings.some((w) => w.includes('AI'))).toBe(true);
        expect(out.confidence).toBe('bassa');
    });
});

describe('checkWpqrPlausibility (gap analysis 26/07/2026 — warning-only)', () => {
    it('nessun warning per campi plausibili e coerenti', () => {
        const warnings = checkWpqrPlausibility({
            approval_date: '2024-04-17',
            expiry_date: '2027-04-16',
            thickness_min: 3, thickness_max: 12,
            diameter_min: 100, diameter_max: 500,
            filler_material: 'G 42 4 M21 3Si1',
            shielding_gas: 'M21',
        });
        expect(warnings).toEqual([]);
    });

    it('segnala scadenza anteriore alla data di emissione', () => {
        const warnings = checkWpqrPlausibility({
            approval_date: '2024-04-17',
            expiry_date: '2020-01-01',
        });
        expect(warnings.some((w) => w.includes('scadenza'))).toBe(true);
    });

    it('segnala range spessore invertito', () => {
        const warnings = checkWpqrPlausibility({ thickness_min: 20, thickness_max: 5 });
        expect(warnings.some((w) => w.includes('invertito'))).toBe(true);
    });

    it('segnala designazione filler non riconosciuta come ISO 14341', () => {
        const warnings = checkWpqrPlausibility({ filler_material: '###???' });
        expect(warnings.some((w) => w.includes('ISO 14341'))).toBe(true);
    });

    it('segnala gas di protezione fuori catalogo ISO 14175', () => {
        const warnings = checkWpqrPlausibility({ shielding_gas: 'GAS-INESISTENTE' });
        expect(warnings.some((w) => w.includes('ISO 14175'))).toBe(true);
    });
});

/**
 * Test L1 — resolveThicknessRange / gap analysis 07/08/2026 (WPQR reale
 * VB0377/23 "ADA", cliente Mason): giunto FW (angolo) con range aperto
 * dichiarato "Fillet Weld: t1 = >=5 ; t2 => 5" (nessun limite superiore),
 * spessore provino testato 30mm. Prima del fix, thickness_max=null veniva
 * sempre sostituito da calcThicknessRange (formula Tabella 7 BW), dando
 * [15, 60] invece del range reale [5, illimitato].
 */
describe('resolveThicknessRange — gap FW range aperto (WPQR VB0377/23)', () => {
    it('preserva "illimitato" quando thickness_max_unlimited=true (non lo sovrascrive con un calcolo)', () => {
        const out = resolveThicknessRange({
            joint_type: 'FW',
            thickness_test_mm: 30,
            thickness_min: 5,
            thickness_max: null,
            thickness_max_unlimited: true,
        });
        expect(out.thickness_min).toBe(5);
        expect(out.thickness_max).toBeNull();
        expect(out.thickness_max_unlimited).toBe(true);
        // Non deve MAI comparire il valore errato calcolato dalla formula BW (60 per t=30).
        expect(out.thickness_max).not.toBe(60);
    });

    it('non applica il fallback calcolato Tabella 7 (BW) per giunti FW anche senza flag illimitato', () => {
        const out = resolveThicknessRange({
            joint_type: 'FW',
            thickness_test_mm: 30,
            thickness_min: null,
            thickness_max: null,
            thickness_max_unlimited: false,
        });
        expect(out.thickness_min).toBeNull();
        expect(out.thickness_max).toBeNull();
        expect(out.thickness_max).not.toBe(60);
    });

    it('applica ancora il fallback calcolato Tabella 7 per giunti BW (comportamento invariato)', () => {
        const out = resolveThicknessRange({
            joint_type: 'BW',
            thickness_test_mm: 30,
            thickness_min: null,
            thickness_max: null,
        });
        expect(out.thickness_min).toBe(15);
        expect(out.thickness_max).toBe(60);
        expect(out.thickness_max_unlimited).toBe(false);
    });

    it('accetta thickness_max_unlimited come stringa "true"/"1" (compatibilità form di revisione)', () => {
        const out1 = resolveThicknessRange({ joint_type: 'FW', thickness_min: 5, thickness_max_unlimited: 'true' });
        const out2 = resolveThicknessRange({ joint_type: 'FW', thickness_min: 5, thickness_max_unlimited: '1' });
        expect(out1.thickness_max_unlimited).toBe(true);
        expect(out2.thickness_max_unlimited).toBe(true);
    });

    it('joint_type SW non applica fallback Tabella 7 BW (STUD-1)', () => {
        const out = resolveThicknessRange({
            joint_type: 'SW',
            thickness_test_mm: 10,
            thickness_min: null,
            thickness_max: null,
        });
        expect(out.thickness_min).toBeNull();
        expect(out.thickness_max).toBeNull();
        expect(out.thickness_max_unlimited).toBe(false);
    });
});

describe('mapReviewFieldsToDb — STUD-1 campi stud / P+T / doppio materiale', () => {
    const { mapReviewFieldsToDb } = require('./wpqrIngest.service');

    it('persiste SW, P+T, qualifying_element, Parent Metal 2', () => {
        const mapped = mapReviewFieldsToDb({
            wpqr_number: '001P-21',
            joint_type: 'SW',
            product_type: 'P+T',
            qualifying_element: 'both',
            material_group: '1.2',
            material_group_2: '1.2',
            base_material_spec: 'S355J2',
            base_material_spec_2: 'S235J2H',
            diameter_min: 51,
            diameter_max: 51,
        }, '001P-21.pdf');
        expect(mapped.joint_type).toBe('SW');
        expect(mapped.product_type).toBe('P+T');
        expect(mapped.qualifying_element).toBe('both');
        expect(mapped.base_material_group).toBe('1.2');
        expect(mapped.base_material_group_2).toBe('1.2');
        expect(mapped.base_material_spec_2).toBe('S235J2H');
        expect(mapped.diameter_min).toBe(51);
    });

    it('normalizza qualifying_element prigioniero → stud', () => {
        const mapped = mapReviewFieldsToDb({
            wpqr_number: 'X',
            qualifying_element: 'prigioniero',
        }, 'x.pdf');
        expect(mapped.qualifying_element).toBe('stud');
    });
});

/**
 * STUD-2 — ingest: sinonimi stud/P+T, non forzare FW, non calcolare range 14555.
 */
describe('STUD-2 ingest — normalizzazione SW / P+T / PM2', () => {
    const {
        mapPipelineFieldsToReview,
        mapReviewFieldsToDb,
        normalizeWpqrJointType,
        normalizeWpqrProductType,
        extractStudDiameterFromText,
    } = require('./wpqrIngest.service');

    it('sinonimi stud/prigioniero → SW, non FW', () => {
        expect(normalizeWpqrJointType('stud welding')).toBe('SW');
        expect(normalizeWpqrJointType('Saldatura prigionieri')).toBe('SW');
        expect(normalizeWpqrJointType('arc stud')).toBe('SW');
        expect(normalizeWpqrJointType('FW', 'FILLET WELD su prigioniero D1=51 ISO 14555')).toBe('SW');
        expect(normalizeWpqrJointType('fillet weld on stud welding')).toBe('SW');
    });

    it('regressione BW/FW senza hint stud restano BW/FW', () => {
        expect(normalizeWpqrJointType('BW')).toBe('BW');
        expect(normalizeWpqrJointType('butt weld')).toBe('BW');
        expect(normalizeWpqrJointType('FW')).toBe('FW');
        expect(normalizeWpqrJointType('FW - angolare')).toBe('FW');
        expect(normalizeWpqrJointType('BW+FW')).toBe('BW+FW');
        // BW non viene sovrascritto da una citazione 14555 nel testo
        expect(normalizeWpqrJointType('BW', 'related ISO 14555')).toBe('BW');
    });

    it('product_type: entrambi / plate+pipe → P+T; P e T restano P e T', () => {
        expect(normalizeWpqrProductType('entrambi')).toBe('P+T');
        expect(normalizeWpqrProductType('P and T')).toBe('P+T');
        expect(normalizeWpqrProductType('piastra e tubo')).toBe('P+T');
        expect(normalizeWpqrProductType('P+T')).toBe('P+T');
        expect(normalizeWpqrProductType('P')).toBe('P');
        expect(normalizeWpqrProductType('piastra')).toBe('P');
        expect(normalizeWpqrProductType('T')).toBe('T');
        expect(normalizeWpqrProductType('tubo')).toBe('T');
        expect(normalizeWpqrProductType('pipe')).toBe('T');
    });

    it('caso SW + PM2 (Mason-like): review e DB senza range 14555 inventato', () => {
        const fields = {
            wpqr_number: '001P-21',
            joint_type: 'stud welding',
            product_type: 'P',
            qualifying_element: 'prigioniero',
            material_group: '1.2',
            material_group_2: '1.2',
            base_material_spec: 'S355J2',
            base_material_spec_2: 'S235J2H',
            diameter_min: 51,
            diameter_max: 51,
            thickness_test_mm: 8,
        };
        const review = mapPipelineFieldsToReview(fields, '001P-21.pdf');
        expect(review.joint_type).toBe('SW');
        expect(review.product_type).toBe('P');
        expect(review.qualifying_element).toBe('stud');
        expect(review.material_group_2).toBe('1.2');
        expect(review.base_material_spec_2).toBe('S235J2H');
        expect(review.diameter_min).toBe(51);
        // Nessun fallback Tabella 7 / 14555: SW senza range dichiarato resta null
        expect(review.thickness_min).toBeNull();
        expect(review.thickness_max).toBeNull();

        const db = mapReviewFieldsToDb(fields, '001P-21.pdf');
        expect(db.joint_type).toBe('SW');
        expect(db.base_material_group_2).toBe('1.2');
        expect(db.qualifying_element).toBe('stud');
        expect(db.thickness_min).toBeNull();
        expect(db.thickness_max).toBeNull();
    });

    it('caso P+T dichiarato «entrambi» sopravvive fino al mapping DB', () => {
        const mapped = mapReviewFieldsToDb({
            wpqr_number: 'WPQR-PT',
            joint_type: 'BW',
            product_type: 'entrambi',
        }, 'pt.pdf');
        expect(mapped.joint_type).toBe('BW');
        expect(mapped.product_type).toBe('P+T');
    });

    it('estrae D1 dichiarato come diametro prigioniero (non calcola 14555)', () => {
        expect(extractStudDiameterFromText('Parent Metal 1\nD1 = 51\nt1 = 8')).toBe(51);
        expect(extractStudDiameterFromText('diametro prigioniero 12,5')).toBe(12.5);
        expect(extractStudDiameterFromText('Fillet weld t=10 no diameter')).toBeNull();
    });
});

describe('extractWPQRFromPdf — STUD-2 testo fillet+prigioniero → SW + D1', () => {
    afterEach(() => jest.clearAllMocks());
    it('non lascia FW se il verbale parla di prigioniero; prende D1', async () => {
        runDocumentIngest.mockResolvedValue({
            text: 'WPQR 001P-21 FILLET WELD processo 135 su prigioniero D1 = 51 Parent Metal 2 S235J2H',
            fields: {
                wpqr_number: '001P-21',
                welding_process: '135',
                joint_type: 'FW',
                product_type: 'P',
                material_group: '1.2',
                material_group_2: '1.2',
                base_material_spec: 'S355J2',
                base_material_spec_2: 'S235J2H',
                qualifying_element: 'stud',
            },
            fieldConfidence: {},
            extractionConfidence: 75,
            aiModel: 'gemini-1.5-flash',
            warnings: [],
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await extractWPQRFromPdf(Buffer.from('%PDF'), '001P-21.pdf', 1001, 2001);

        expect(out.status).toBe('pending_review');
        expect(out.fields.joint_type).toBe('SW');
        expect(out.fields.product_type).toBe('P');
        expect(out.fields.qualifying_element).toBe('stud');
        expect(out.fields.material_group_2).toBe('1.2');
        expect(out.fields.base_material_spec_2).toBe('S235J2H');
        expect(out.fields.diameter_min).toBe(51);
        expect(out.fields.diameter_max).toBe(51);
        expect(out.fields.thickness_min).toBeNull();
        expect(out.fields.thickness_max).toBeNull();
    });

    it('regressione fillet FW senza stud resta FW', async () => {
        runDocumentIngest.mockResolvedValue({
            text: 'WPQR VB0377/23 Fillet Weld t1 = >=5 processo 138 ISO 15614-1',
            fields: {
                wpqr_number: 'VB0377/23',
                joint_type: 'FW',
                product_type: 'P',
                thickness_min: 5,
                thickness_max_unlimited: true,
            },
            fieldConfidence: {},
            extractionConfidence: 80,
            aiModel: 'test',
            warnings: [],
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await extractWPQRFromPdf(Buffer.from('%PDF'), 'VB0377.pdf', 1001, 2001);
        expect(out.fields.joint_type).toBe('FW');
        expect(out.fields.product_type).toBe('P');
    });
});

describe('checkWpqrPlausibility — warning FW range non calcolabile (gap 07/08/2026)', () => {
    it('segnala verifica manuale per giunto FW senza range dichiarato e senza flag illimitato', () => {
        const warnings = checkWpqrPlausibility({
            joint_type: 'FW',
            thickness_min: null,
            thickness_max: null,
            thickness_max_unlimited: false,
        });
        expect(warnings.some((w) => w.includes('FW') && w.includes('verificare manualmente'))).toBe(true);
    });

    it('nessun warning FW quando il range è correttamente marcato come illimitato', () => {
        const warnings = checkWpqrPlausibility({
            joint_type: 'FW',
            thickness_min: 5,
            thickness_max: null,
            thickness_max_unlimited: true,
        });
        expect(warnings.some((w) => w.includes('non calcolabile automaticamente'))).toBe(false);
    });

    it('nessun warning FW per giunti BW (non pertinente)', () => {
        const warnings = checkWpqrPlausibility({
            joint_type: 'BW',
            thickness_min: null,
            thickness_max: null,
        });
        expect(warnings.some((w) => w.includes('FW'))).toBe(false);
    });
});

/**
 * Test L1 — commitWPQRFromFields, sanitizzazione numerica (gap hardening
 * 27/07/2026, stesso pattern del bug produzione su qualificationIngest.service.js
 * e wpsIngest.service.js): thickness_tested/thickness_min/thickness_max/
 * diameter_min/diameter_max su `wpqr_records` sono colonne DECIMAL —
 * "N.A."/stringa vuota/range testuale non deve mai rompere l'INSERT.
 */
describe('commitWPQRFromFields — sanitizzazione numerica', () => {
    afterEach(() => jest.clearAllMocks());

    it('salva null invece di crashare quando i campi spessore/diametro sono "N.A." o vuoti', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // checkDuplicate
        query.mockResolvedValueOnce({ recordset: [{ id: 88 }] }); // INSERT

        const result = await commitWPQRFromFields({
            wpqr_number: 'WPQR-99',
            welding_process: '111',
            thickness_test_mm: 'N.A.',
            thickness_min: '',
            thickness_max: 'N.A.',
            diameter_min: '',
            diameter_max: 'N.A.',
        }, 1001, 2001, { fileName: 'wpqr99.pdf' });

        expect(result.wpqr_id).toBe(88);
        const insertCall = query.mock.calls[1];
        expect(insertCall[1].thickness_tested).toBeNull();
        expect(insertCall[1].thickness_min).toBeNull();
        expect(insertCall[1].thickness_max).toBeNull();
        expect(insertCall[1].diameter_min).toBeNull();
        expect(insertCall[1].diameter_max).toBeNull();
    });

    it('GIUNTO FW range aperto (WPQR reale VB0377/23): salva thickness_max=null + thickness_max_unlimited=1, NON 60', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // checkDuplicate
        query.mockResolvedValueOnce({ recordset: [{ id: 200 }] }); // INSERT

        const result = await commitWPQRFromFields({
            wpqr_number: 'VB0377/23',
            welding_process: '138',
            joint_type: 'FW',
            thickness_test_mm: 30,
            // Come dichiarato sul verbale reale: "Fillet Weld: t1 = >=5 ; t2 => 5"
            thickness_min: 5,
            thickness_max: null,
            thickness_max_unlimited: true,
        }, 1001, 2001, { fileName: 'VB0377-23.pdf' });

        expect(result.wpqr_id).toBe(200);
        const insertCall = query.mock.calls[1];
        expect(insertCall[1].thickness_min).toBe(5);
        expect(insertCall[1].thickness_max).toBeNull();
        expect(insertCall[1].thickness_max).not.toBe(60);
        expect(insertCall[1].thickness_max_unlimited).toBe(1);
    });

    it('converte la virgola decimale italiana su thickness_test_mm senza crashare', async () => {
        query.mockResolvedValueOnce({ recordset: [] }); // checkDuplicate
        query.mockResolvedValueOnce({ recordset: [{ id: 89 }] }); // INSERT

        const result = await commitWPQRFromFields({
            wpqr_number: 'WPQR-100',
            welding_process: '111',
            thickness_test_mm: '12,5',
        }, 1001, 2001, { fileName: 'wpqr100.pdf' });

        expect(result.wpqr_id).toBe(89);
        const insertCall = query.mock.calls[1];
        expect(insertCall[1].thickness_tested).toBe(12.5);
        // Range non dichiarato → calcolato dal fallback esistente (calcThicknessRange).
        expect(insertCall[1].thickness_min).not.toBeNull();
        expect(insertCall[1].thickness_max).not.toBeNull();
    });
});

describe('extractWPQRFromPdf — warning di plausibilità propagati', () => {
    it('include il warning di scadenza incoerente nell\'esito pending_review', async () => {
        runDocumentIngest.mockResolvedValue({
            text: 'WPQR 21-02906 processo 135',
            fields: {
                wpqr_number: '21-02906',
                welding_process: '135',
                approval_date: '2024-04-17',
                expiry_date: '2020-01-01',
            },
            fieldConfidence: {},
            extractionConfidence: 70,
            aiModel: 'gemini-1.5-flash',
            warnings: [],
        });
        query.mockResolvedValueOnce({ recordset: [] });

        const out = await extractWPQRFromPdf(Buffer.from('%PDF'), '21-02906.pdf', 1001, 2001);

        expect(out.status).toBe('pending_review');
        expect(out.warnings.some((w) => w.includes('scadenza'))).toBe(true);
    });
});

/**
 * Round-trip a sentinella (rete di sicurezza strutturale — audit ingest
 * saldatura/3834 07/08/2026, docs/gap-reports/GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md §4).
 * Per ogni chiave di `aiExpectedSchema` (lo schema realmente usato dal prompt AI in
 * produzione, backend/src/data/documentTypeSchemas.js) genera un valore-sentinella
 * univoco e verifica che sopravviva fino ai parametri della INSERT su wpqr_records.
 * Avrebbe intercettato preheat_temp/interpass_temp (persi tra pipeline e DB) e,
 * prima del fix 07/08/2026, anche thickness_max_unlimited.
 */
describe('round-trip a sentinella — ogni campo aiExpectedSchema sopravvive fino a wpqr_records', () => {
    afterEach(() => jest.clearAllMocks());

    it('nessun campo dello schema AI WPQR viene perso tra pipeline e INSERT', async () => {
        const { DOCUMENT_TYPE_SCHEMAS } = require('../data/documentTypeSchemas');
        const wpqrSchema = DOCUMENT_TYPE_SCHEMAS.wpqr;
        const { buildSentinelFields, findMissingSentinels } = require('../utils/ingestRoundTripSentinel');

        // thickness_max_unlimited=true azzererebbe thickness_max per design (vedi
        // resolveThicknessRange) — non è un bug, va escluso da QUESTA generazione
        // per non produrre un falso positivo (c'è già copertura dedicata sopra).
        const { fields, tokens } = buildSentinelFields(wpqrSchema.aiExpectedSchema, {
            thickness_max_unlimited: false,
            // Stesso pattern: flag unlimited=true azzera il max del lato t1/t2
            // in resolveDualThicknessSides (design, non perdita).
            thickness_t1_max_unlimited: false,
            thickness_t2_max_unlimited: false,
        });

        runDocumentIngest.mockResolvedValue({
            text: 'WPQR round-trip sentinel test',
            fields,
            fieldConfidence: {},
            extractionConfidence: 80,
            aiModel: 'test',
            warnings: [],
        });
        query.mockResolvedValueOnce({ recordset: [] }); // checkDuplicate (extract)
        query.mockResolvedValueOnce({ recordset: [] }); // checkDuplicate (commit)
        query.mockResolvedValueOnce({ recordset: [{ id: 777 }] }); // INSERT

        await ingestWPQRFromPdf(Buffer.from('%PDF'), 'sentinel.pdf', 1001, 2001, {});

        const insertCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO wpqr_records'));
        expect(insertCall).toBeTruthy();
        const capturedValues = Object.values(insertCall[1]);

        // GAP noti e già documentati come non ancora chiusi (vedi gap report §1) —
        // svuotare via via che vengono corretti, mai aggiungere qui senza una riga
        // nel gap report che lo motivi.
        const knownGaps = [];
        const missing = findMissingSentinels(tokens, capturedValues, knownGaps);
        expect(missing).toEqual([]);
    });
});
