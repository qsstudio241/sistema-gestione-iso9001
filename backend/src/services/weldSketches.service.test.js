/**
 * @jest-environment node
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    scoreSketch,
    preparationEquivalent,
    processFamily,
    classifyPageText,
    findSketchPages,
    suggestSketches,
    dimensionTextFromWpqr,
    metadataFromWpqr,
    normalizeJointType,
    detectSketchImageKind,
    listSketches,
    resetTableCache,
    bboxFromItems,
    parsePdfimagesList,
    pickSketchEmbeddedImage,
    pageLocalImageIndex,
    tryExtractEmbeddedSketch,
    resolveExtractPdfPath,
    extractAfterWpqrCommit,
    planStoredPieces,
    STATUS_NEEDS_SPLIT,
    splitSketchAtY,
} = require('./weldSketches.service');
const IIS_BOXES = require('./fixtures/wpqrIisSketchBboxes.json');

describe('weldSketches — scoring ISO 15609 library', () => {
    const fwFillet = {
        id: 2,
        slot: 'combined',
        joint_type: 'FW',
        preparation: 'fillet, close square T',
        product_form: 'plate',
        thickness_min_mm: 5,
        thickness_max_mm: 30,
        process_iso4063: '138',
        run_mode: 'multi',
        position_iso6947: 'PB',
        status: 'confermato',
    };

    it('esclude se il tipo giunto non coincide', () => {
        expect(scoreSketch(fwFillet, { joint_type: 'BW' })).toBeNull();
        expect(normalizeJointType('FW')).toBe('FW');
    });

    it('fillet ⇄ close square T sono equivalenti (+40)', () => {
        expect(preparationEquivalent('fillet', 'close square T (gap 0 mm)')).toBe(true);
        const score = scoreSketch(fwFillet, {
            joint_type: 'FW',
            preparation: 'fillet',
            product_form: 'plate',
            thickness_a_mm: 10,
            welding_process: '138',
            run_mode: 'multi',
            position: 'PB',
        });
        expect(score).toBe(40 + 20 + 15 + 10 + 10 + 5);
    });

    it('135/136/138 stessa famiglia (+5 se processo diverso)', () => {
        expect(processFamily('136')).toBe('13x');
        const score = scoreSketch(fwFillet, {
            joint_type: 'FW',
            welding_process: '135',
        });
        expect(score).toBe(5);
    });

    it('suggest: schizzo della WPQR prima (100), poi max 3 libreria', () => {
        const own = [{
            id: 1, slot: 'combined', joint_type: 'FW', status: 'bozza',
            preparation: 'fillet',
        }];
        const library = [
            { ...fwFillet, id: 10 },
            { ...fwFillet, id: 11, process_iso4063: '135' },
            { ...fwFillet, id: 12, position_iso6947: 'PA' },
            { ...fwFillet, id: 13, joint_type: 'BW' },
        ];
        const out = suggestSketches({
            own,
            library,
            request: { joint_type: 'FW', preparation: 'fillet', welding_process: '138' },
        });
        expect(out.combined[0].id).toBe(1);
        expect(out.combined[0].score).toBe(100);
        expect(out.combined.slice(1).every((s) => s.id !== 13)).toBe(true);
        expect(out.combined.length).toBeLessThanOrEqual(3);
        expect(out.joint_design).toEqual([]);
        expect(out.welding_sequence).toEqual([]);
    });
});

describe('weldSketches — pagine PDF', () => {
    it('riconosce Joint design / Welding sequence / Schizzo e salta la mappa durezza', () => {
        expect(classifyPageText('Joint design / Welding sequences')).toBe('combined');
        expect(classifyPageText('Joint Design')).toBe('joint_design');
        expect(classifyPageText('Welding Sequences')).toBe('welding_sequence');
        expect(classifyPageText('Schizzo del giunto')).toBe('joint_design');
        expect(classifyPageText('Location of measurements (Sketch) HV10 hardness')).toBe('hardness_map');
        const hits = findSketchPages([
            { page: 2, text: 'Joint design Welding sequence' },
            { page: 10, text: 'HV10 hardness map' },
        ]);
        expect(hits.map((h) => ({ page: h.page, slot: h.slot }))).toEqual([
            { page: 2, slot: 'combined' },
            { page: 10, slot: 'hardness_map' },
        ]);
    });

    it('dimension_text e metadati dal record WPQR, non dall\'immagine', () => {
        const wpqr = {
            joint_type: 'FW',
            joint_preparation: 'fillet close square T',
            product_type: 'plate',
            thickness_tested: 30,
            throat_test_mm: 7.5,
            diameter_test_mm: 108,
            welding_process: '138',
            welding_positions: 'PB',
            single_multi_run: 'multi',
            test_runs: [{}, {}, {}],
        };
        expect(dimensionTextFromWpqr(wpqr)).toMatch(/t=30/);
        expect(dimensionTextFromWpqr(wpqr)).toMatch(/a: 7,5/);
        expect(dimensionTextFromWpqr({
            ...wpqr,
            thickness_t2_test_mm: 30,
        })).toBe('t1=t2: 30 mm - a: 7,5 mm - d: 108 mm');
        const meta = metadataFromWpqr(wpqr);
        expect(meta.joint_type).toBe('FW');
        expect(meta.preparation).toBe('fillet');
        expect(meta.n_passes).toBe(3);
        expect(meta.run_mode).toBe('multi');
    });
});

describe('weldSketches — JPEG e scope azienda', () => {
    beforeEach(() => {
        query.mockReset();
        resetTableCache();
    });

    it('riconosce PNG e JPEG dai magic bytes', () => {
        expect(detectSketchImageKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])).ext).toBe('png');
        expect(detectSketchImageKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).ext).toBe('jpg');
        expect(detectSketchImageKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).mime).toBe('image/jpeg');
    });

    it('lista: utente per-azienda vede libreria studio e la propria azienda', async () => {
        query.mockImplementation(async (sql, params) => {
            if (/OBJECT_ID/i.test(String(sql))) return { recordset: [{ present: 1 }] };
            expect(String(sql)).toMatch(/company_id IS NULL OR company_id IN/);
            expect(params.skco_0).toBe(51);
            expect(params.organizationId).toBe(1);
            return { recordset: [{ id: 1, organization_id: 1, company_id: null, slot: 'combined' }] };
        });
        const rows = await listSketches({
            organizationId: 1,
            allowedCompanyIds: [51],
        });
        expect(rows).toHaveLength(1);
        expect(rows[0].company_id).toBeNull();
    });
});

describe('weldSketches — crop IIS solo disegno (fixture bbox, no PDF cliente)', () => {
    const p5 = IIS_BOXES.page5;
    const p2 = IIS_BOXES.page2;

    it('pagina 5: il bbox si ferma prima della tabella Runs e sopra PARENT MATERIAL', () => {
        const box = bboxFromItems(p5.items_pdfjs, 'combined');
        expect(box.x1).toBeLessThanOrEqual(p5.expect.x1_max);
        expect(box.x0).toBeLessThanOrEqual(p5.expect.x0_max);
        expect(box.x1).toBeLessThan(p5.expect.exclude_runs_x);
        expect(box.y0).toBeGreaterThan(p5.expect.exclude_parent_y_max);
        expect(box.y0).toBeLessThan(p5.expect.include_caption_y);
        expect(box.y1).toBeGreaterThan(p5.expect.include_caption_y);
        expect(box.x1 - box.x0).toBeLessThan(250);
    });

    it('pagina 2: schizzo nella colonna destra, non tutta la pagina', () => {
        const box = bboxFromItems(p2.items_pdfjs, 'combined');
        expect(box.x0).toBeGreaterThanOrEqual(p2.expect.x0_min);
        expect(box.x1).toBeGreaterThanOrEqual(p2.expect.x1_min);
        expect(box.x0).toBeGreaterThan(200);
    });

    it('non allarga più x1 a 555 pt in assenza di titoli', () => {
        const box = bboxFromItems([], 'combined');
        expect(box.x1).toBeLessThan(400);
    });

    it('pdfimages: sceglie il raster dello schizzo, non logo/QR', () => {
        const pick = pickSketchEmbeddedImage(p5.pdfimages_list, 5);
        expect(pick).toBeTruthy();
        expect(pick.num).toBe(p5.expect.sketch_raster_num);
        expect(pick.width).toBe(174);
        expect(pick.height).toBe(231);
        expect(pickSketchEmbeddedImage(p5.pdfimages_list, 1)).toBeNull();
    });

    it('parsePdfimagesList legge la tabella -list', () => {
        const stdout = [
            'page   num  type   width height color comp bpc  enc interp  object ID x-ppi y-ppi size ratio',
            '   5     2 image     174   231  rgb     3   8  image  no        44  0   122   122 1610B 1.3%',
        ].join('\n');
        const rows = parsePdfimagesList(stdout);
        expect(rows).toEqual([{ page: 5, num: 2, width: 174, height: 231, xppi: 122, yppi: 122 }]);
    });

    it('pageLocalImageIndex converte num document-wide in indice 0-based della pagina', () => {
        const rows = [
            { page: 1, num: 0, width: 40, height: 40, xppi: 72, yppi: 72 },
            { page: 1, num: 1, width: 50, height: 50, xppi: 72, yppi: 72 },
            { page: 5, num: 2, width: 174, height: 231, xppi: 122, yppi: 122 },
        ];
        expect(pageLocalImageIndex(rows, 5, 2)).toBe(0);
        expect(pageLocalImageIndex([
            { page: 5, num: 0 }, { page: 5, num: 1 }, { page: 5, num: 2 },
        ], 5, 2)).toBe(2);
    });

    it('tryExtractEmbeddedSketch legge prefix-000, non il num document-wide', async () => {
        const { encodePng } = require('./weldSketchPng');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skimg-'));
        const png = encodePng(8, 8, Buffer.alloc(8 * 8 * 4, 30));
        try {
            const out = await tryExtractEmbeddedSketch(Buffer.from('%PDF-1.4'), 5, {
                tmpDir: dir,
                pdfimagesList: async () => [
                    { page: 1, num: 0, width: 40, height: 40, xppi: 72, yppi: 72 },
                    { page: 1, num: 1, width: 50, height: 50, xppi: 72, yppi: 72 },
                    { page: 5, num: 2, width: 174, height: 231, xppi: 122, yppi: 122 },
                ],
                pdfimagesExtract: async (_pdf, page, prefix) => {
                    expect(page).toBe(5);
                    expect(fs.existsSync(`${prefix}-002.png`)).toBe(false);
                    fs.writeFileSync(`${prefix}-000.png`, png);
                },
            });
            expect(out).toBeTruthy();
            expect(Buffer.isBuffer(out.png)).toBe(true);
            expect(out.png.equals(png)).toBe(true);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('weldSketches — PDF persistito se il temp non c\'è', () => {
    const origUploads = process.env.UPLOAD_DIR;
    let root;

    beforeEach(() => {
        query.mockReset();
        resetTableCache();
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'skpersist-'));
        process.env.UPLOAD_DIR = root;
        fs.mkdirSync(path.join(root, 'wpqr'), { recursive: true });
    });

    afterEach(() => {
        if (origUploads === undefined) delete process.env.UPLOAD_DIR;
        else process.env.UPLOAD_DIR = origUploads;
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('resolveExtractPdfPath usa /uploads/wpqr quando lo staging è già stato cancellato', () => {
        const persisted = path.join(root, 'wpqr', 'wpqr_123_VB0377-23.pdf');
        fs.writeFileSync(persisted, Buffer.from('%PDF-1.4 persistito'));
        const abs = resolveExtractPdfPath(
            '/tmp/staging-gone-xyz.pdf',
            '/uploads/wpqr/wpqr_123_VB0377-23.pdf',
        );
        expect(abs).toBe(persisted);
    });

    it('extractAfterWpqrCommit legge il buffer dal PDF persistito, non dal temp mancante', async () => {
        const persisted = path.join(root, 'wpqr', 'wpqr_999_VB0377-23.pdf');
        const bytes = Buffer.from('%PDF-1.4 persisted-bytes');
        fs.writeFileSync(persisted, bytes);
        query.mockResolvedValue({ recordset: [{ present: 1 }] });
        const extractAndStoreFromPdf = jest.fn().mockResolvedValue([{ id: 7, slot: 'combined' }]);
        const out = await extractAfterWpqrCommit({
            organizationId: 1,
            companyId: 51,
            wpqrId: 38,
            wpqr: { certificate_file_url: '/uploads/wpqr/wpqr_999_VB0377-23.pdf' },
            filePath: '/tmp/does-not-exist-staging.pdf',
            certificateFileUrl: '/uploads/wpqr/wpqr_999_VB0377-23.pdf',
            deps: { extractAndStoreFromPdf },
        });
        expect(extractAndStoreFromPdf).toHaveBeenCalledTimes(1);
        const arg = extractAndStoreFromPdf.mock.calls[0][0];
        expect(Buffer.isBuffer(arg.pdfBuffer)).toBe(true);
        expect(arg.pdfBuffer.equals(bytes)).toBe(true);
        expect(arg.deps.pdfPath).toBe(persisted);
        expect(out).toEqual([{ id: 7, slot: 'combined' }]);
    });
});

describe('weldSketches — split combined IIS', () => {
    it('con gap: due pezzi joint_design + welding_sequence, caption solo sul giunto', () => {
        const pieces = planStoredPieces('combined', Buffer.from('png'), {
            width: 174,
            height: 231,
            bboxStr: 'embedded',
            meta: { dimension_text: 't1=t2: 30 mm - a: 7,5 mm' },
            splitFn: () => ({
                ok: true,
                y: 146,
                top: Buffer.from('top'),
                bottom: Buffer.from('bot'),
                topSize: { width: 174, height: 146 },
                bottomSize: { width: 174, height: 85 },
            }),
        });
        expect(pieces).toHaveLength(2);
        expect(pieces[0].slot).toBe('joint_design');
        expect(pieces[0].dimension_text).toBe('t1=t2: 30 mm - a: 7,5 mm');
        expect(pieces[1].slot).toBe('welding_sequence');
        expect(pieces[1].dimension_text).toBeNull();
        expect(pieces[0].bboxStr).toMatch(/split:146/);
    });

    it('senza gap: combined con status da dividere', () => {
        const pieces = planStoredPieces('combined', Buffer.from('png'), {
            width: 174,
            height: 231,
            bboxStr: 'embedded',
            meta: { dimension_text: 't1=t2: 30 mm - a: 7,5 mm' },
            splitFn: () => ({ ok: false, reason: 'no_gap' }),
        });
        expect(pieces).toHaveLength(1);
        expect(pieces[0].slot).toBe('combined');
        expect(pieces[0].status).toBe(STATUS_NEEDS_SPLIT);
        expect(pieces[0].dimension_text).toBe('t1=t2: 30 mm - a: 7,5 mm');
    });

    it('slot non combined resta un pezzo', () => {
        const pieces = planStoredPieces('joint_design', Buffer.from('png'), {
            width: 10, height: 10, meta: { dimension_text: 't=8 mm' },
        });
        expect(pieces).toHaveLength(1);
        expect(pieces[0].slot).toBe('joint_design');
        expect(pieces[0].status).toBe('bozza');
    });
});

describe('weldSketches — splitSketchAtY', () => {
    const origUploads = process.env.UPLOAD_DIR;
    let root;

    beforeEach(() => {
        query.mockReset();
        resetTableCache();
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'sksplit-'));
        process.env.UPLOAD_DIR = root;
    });

    afterEach(() => {
        if (origUploads === undefined) delete process.env.UPLOAD_DIR;
        else process.env.UPLOAD_DIR = origUploads;
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('taglia il PNG e salva joint + sequence', async () => {
        const { encodePng } = require('./weldSketchPng');
        const w = 40;
        const h = 80;
        const rgba = Buffer.alloc(w * h * 4, 255);
        const png = encodePng(w, h, rgba);
        const dir = path.join(root, 'sketches', '1', '51');
        fs.mkdirSync(dir, { recursive: true });
        const abs = path.join(dir, 'combined.png');
        fs.writeFileSync(abs, png);
        const fileUrl = '/uploads/sketches/1/51/combined.png';
        const row = {
            id: 9,
            organization_id: 1,
            company_id: 51,
            slot: 'combined',
            status: 'da dividere',
            file_url: fileUrl,
            source_kind: 'wpqr_crop',
            wpqr_id: 38,
            dimension_text: 't1=t2: 30 mm - a: 7,5 mm',
        };
        let updated = false;
        query.mockImplementation(async (sql, params) => {
            if (/OBJECT_ID/i.test(String(sql))) return { recordset: [{ present: 1 }] };
            if (/SELECT TOP 1 \* FROM weld_sketches/i.test(String(sql))) {
                if (params.id === 9) {
                    return {
                        recordset: [{
                            ...row,
                            slot: updated ? 'joint_design' : 'combined',
                            status: updated ? 'bozza' : 'da dividere',
                        }],
                    };
                }
                if (params.id === 99) {
                    return {
                        recordset: [{
                            id: 99,
                            organization_id: 1,
                            company_id: 51,
                            slot: 'welding_sequence',
                            status: 'bozza',
                            file_url: '/uploads/sketches/1/51/seq.png',
                        }],
                    };
                }
            }
            if (/INSERT INTO weld_sketches/i.test(String(sql))) {
                expect(params.slot).toBe('welding_sequence');
                expect(params.dimension_text).toBeNull();
                return { recordset: [{ id: 99 }] };
            }
            if (/UPDATE weld_sketches/i.test(String(sql))) {
                expect(params.slot).toBe('joint_design');
                updated = true;
                return { recordset: [] };
            }
            return { recordset: [] };
        });

        const out = await splitSketchAtY({
            id: 9, organizationId: 1, userId: 2, yPx: 40,
        });
        expect(out.joint.slot).toBe('joint_design');
        expect(out.sequence.slot).toBe('welding_sequence');
    });
});

