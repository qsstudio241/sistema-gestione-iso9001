/**
 * @jest-environment node
 */

const {
    CANDIDATE_SQL,
    REGENERATE_SQL,
    classifyStored,
    wpqrLabel,
    backfillWpqrSketches,
    composeContactSheet,
} = require('./wpqrSketchBackfill.service');
const { encodePng, decodePng } = require('./weldSketchPng');

function tinyPng(color = [20, 20, 20]) {
    const w = 8;
    const h = 8;
    const rgba = Buffer.alloc(w * h * 4, 255);
    for (let i = 0; i < w * h; i += 1) {
        rgba[i * 4] = color[0];
        rgba[i * 4 + 1] = color[1];
        rgba[i * 4 + 2] = color[2];
    }
    return encodePng(w, h, rgba);
}

describe('wpqrSketchBackfill', () => {
    it('SQL candidati: PDF persistito, niente schizzi, no cestino, spessori per caption', () => {
        expect(CANDIDATE_SQL).toMatch(/certificate_file_url IS NOT NULL/);
        expect(CANDIDATE_SQL).toMatch(/NOT EXISTS/);
        expect(CANDIDATE_SQL).toMatch(/weld_sketches/);
        expect(CANDIDATE_SQL).toMatch(/deleted_at IS NULL/);
        expect(CANDIDATE_SQL).toMatch(/thickness_tested/);
        expect(CANDIDATE_SQL).toMatch(/thickness_t2_test_mm/);
        expect(CANDIDATE_SQL).not.toMatch(/\bUPDATE\b/i);
        expect(CANDIDATE_SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
        expect(CANDIDATE_SQL).not.toMatch(/\bINSERT\b/i);
        expect(REGENERATE_SQL).toMatch(/thickness_tested/);
        expect(REGENERATE_SQL).toMatch(/thickness_t2_test_mm/);
        expect(REGENERATE_SQL).toMatch(/status = N'confermato'/);
        expect(REGENERATE_SQL).not.toMatch(/\bUPDATE\b/i);
        expect(REGENERATE_SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
    });

    it('classifyStored: auto_split vs da dividere vs empty', () => {
        expect(classifyStored([])).toBe('empty');
        expect(classifyStored([
            { slot: 'joint_design', status: 'bozza' },
            { slot: 'welding_sequence', status: 'bozza' },
        ])).toBe('auto_split');
        expect(classifyStored([
            { slot: 'combined', status: 'da dividere' },
        ])).toBe('da_dividere');
        expect(wpqrLabel({ reference_number: 'VB0377' })).toBe('VB0377');
        expect(wpqrLabel({ id: 9 })).toBe('#9');
    });

    it('dry-run elenca e non chiama extract', async () => {
        const rows = [
            {
                id: 38, organization_id: 1, company_id: 51,
                reference_number: 'VB0377', certificate_file_url: '/uploads/wpqr/a.pdf',
            },
            {
                id: 39, organization_id: 1, company_id: 51,
                reference_number: 'VB0387', certificate_file_url: '/uploads/wpqr/b.pdf',
            },
        ];
        const extractFn = jest.fn();
        const logs = [];
        const out = await backfillWpqrSketches({
            dryRun: true,
            queryFn: async () => ({ recordset: rows }),
            extractFn,
            log: { info: (m) => logs.push(m), warn: (m) => logs.push(m) },
        });
        expect(extractFn).not.toHaveBeenCalled();
        expect(out.summary.candidates).toBe(2);
        expect(out.summary.dryRun).toBe(true);
        expect(out.results.map((r) => r.code)).toEqual(['VB0377', 'VB0387']);
        expect(logs.some((l) => /DRY_RUN/.test(l) && /VB0387/.test(l))).toBe(true);
    });

    it('APPLY: split automatico e da dividere, skip se riga già nata, fail isolato', async () => {
        const rows = [
            {
                id: 1, organization_id: 1, company_id: 51,
                reference_number: 'A', certificate_file_url: '/uploads/wpqr/a.pdf',
            },
            {
                id: 2, organization_id: 1, company_id: 51,
                reference_number: 'B', certificate_file_url: '/uploads/wpqr/b.pdf',
            },
            {
                id: 3, organization_id: 1, company_id: 51,
                reference_number: 'C', certificate_file_url: '/uploads/wpqr/c.pdf',
            },
            {
                id: 4, organization_id: 1, company_id: 51,
                reference_number: 'D', certificate_file_url: '/uploads/wpqr/d.pdf',
            },
        ];
        const extractFn = jest.fn(async ({ wpqrId }) => {
            if (wpqrId === 1) {
                return [
                    { slot: 'joint_design', status: 'bozza', file_url: '/uploads/sketches/1.png' },
                    { slot: 'welding_sequence', status: 'bozza', file_url: '/uploads/sketches/2.png' },
                ];
            }
            if (wpqrId === 2) {
                return [{ slot: 'combined', status: 'da dividere', file_url: '/uploads/sketches/3.png' }];
            }
            if (wpqrId === 4) throw new Error('pdf rotto');
            return [];
        });
        const queryFn = jest.fn(async (sql, params) => {
            if (/SELECT TOP 1 id/.test(sql)) {
                if (params.wpqr_id === 3) return { recordset: [{ id: 99 }] };
                return { recordset: [] };
            }
            return { recordset: rows };
        });
        const out = await backfillWpqrSketches({
            dryRun: false,
            queryFn,
            extractFn,
            log: { info: () => {}, warn: () => {} },
        });
        expect(out.summary.auto_split).toBe(1);
        expect(out.summary.da_dividere).toBe(1);
        expect(out.summary.skip).toBe(1);
        expect(out.summary.empty).toBe(0);
        expect(out.summary.fail).toBe(1);
        expect(extractFn).toHaveBeenCalledTimes(3);
        const kinds = Object.fromEntries(out.results.map((r) => [r.code, r.kind]));
        expect(kinds.A).toBe('auto_split');
        expect(kinds.B).toBe('da_dividere');
        expect(kinds.C).toBe('skip');
        expect(kinds.D).toBe('fail');
        expect(extractFn.mock.calls.every((c) => c[0].throwOnError === true)).toBe(true);
    });

    it('APPLY: extract riceve thickness_tested / thickness_t2_test_mm dalla riga WPQR', async () => {
        const rows = [{
            id: 7, organization_id: 1, company_id: 51,
            reference_number: 'T-THICK',
            certificate_file_url: '/uploads/wpqr/t.pdf',
            thickness_tested: 12.5,
            thickness_t2_test_mm: 8,
        }];
        const extractFn = jest.fn(async ({ wpqr }) => {
            expect(wpqr.thickness_tested).toBe(12.5);
            expect(wpqr.thickness_t2_test_mm).toBe(8);
            return [{ slot: 'combined', status: 'da dividere', file_url: '/uploads/sketches/t.png' }];
        });
        const out = await backfillWpqrSketches({
            dryRun: false,
            queryFn: async (sql) => {
                if (/SELECT TOP 1 id/.test(sql)) return { recordset: [] };
                if (/COUNT\(\*\)/.test(sql)) return { recordset: [{ n: 0 }] };
                return { recordset: rows };
            },
            extractFn,
            log: { info: () => {}, warn: () => {} },
        });
        expect(out.summary.da_dividere).toBe(1);
        expect(extractFn).toHaveBeenCalledTimes(1);
    });

    it('regenerate dry-run elenca bozze, non i confermati, non chiama extract', async () => {
        const rows = [
            {
                id: 10, organization_id: 1, company_id: 51,
                reference_number: 'DRAFT-A', certificate_file_url: '/uploads/wpqr/a.pdf',
                thickness_tested: 10,
            },
            {
                id: 38, organization_id: 1, company_id: 51,
                reference_number: 'VB0377/23 rev.0', certificate_file_url: '/uploads/wpqr/b.pdf',
            },
        ];
        const extractFn = jest.fn();
        const deleted = [];
        const queryFn = jest.fn(async (sql) => {
            if (/DELETE FROM dbo\.weld_sketches/.test(sql)) deleted.push('delete');
            return { recordset: rows };
        });
        const out = await backfillWpqrSketches({
            dryRun: true,
            regenerateDrafts: true,
            skipCodes: ['VB0377', 'VB0387'],
            queryFn,
            extractFn,
            log: { info: () => {}, warn: () => {} },
        });
        expect(extractFn).not.toHaveBeenCalled();
        expect(deleted).toEqual([]);
        expect(out.summary.dryRun).toBe(true);
        expect(out.summary.regenerateDrafts).toBe(true);
        expect(out.summary.skip_confirmed).toBe(1);
        expect(out.results.find((r) => r.code === 'DRAFT-A').kind).toBe('dry_run');
        expect(out.results.find((r) => /VB0377/.test(r.code)).kind).toBe('skip_confirmed');
    });

    it('APPLY regenerate: cancella solo bozze, extract con thickness; confermato intatto', async () => {
        const rows = [
            {
                id: 10, organization_id: 1, company_id: 51,
                reference_number: 'DRAFT-A', certificate_file_url: '/uploads/wpqr/a.pdf',
                thickness_tested: 20, thickness_t2_test_mm: 20,
            },
            {
                id: 38, organization_id: 1, company_id: 51,
                reference_number: 'VB0377/23 rev.0', certificate_file_url: '/uploads/wpqr/c.pdf',
                thickness_tested: 30,
            },
            {
                id: 39, organization_id: 1, company_id: 51,
                reference_number: 'VB0387/23 rev.0', certificate_file_url: '/uploads/wpqr/d.pdf',
            },
        ];
        const sqlLog = [];
        const extractFn = jest.fn(async ({ wpqrId, wpqr }) => {
            expect(wpqr.thickness_tested).toBe(20);
            expect(wpqr.thickness_t2_test_mm).toBe(20);
            expect(wpqrId).toBe(10);
            return [
                { slot: 'joint_design', status: 'bozza', file_url: '/uploads/sketches/j.png' },
                { slot: 'welding_sequence', status: 'bozza', file_url: '/uploads/sketches/s.png' },
            ];
        });
        const queryFn = jest.fn(async (sql, params) => {
            sqlLog.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
            if (/status = N'confermato'/.test(sql) && /COUNT/.test(sql)) {
                return { recordset: [{ n: 0 }] };
            }
            if (/status <> N'confermato'/.test(sql) && /SELECT id, file_url/.test(sql)) {
                return { recordset: [{ id: 101, file_url: '/uploads/sketches/old.png', status: 'da dividere' }] };
            }
            if (/UPDATE dbo\.welding_procedures/.test(sql) || /DELETE FROM dbo\.weld_sketches/.test(sql)) {
                return { recordset: [], rowsAffected: [1] };
            }
            return { recordset: rows };
        });
        const out = await backfillWpqrSketches({
            dryRun: false,
            regenerateDrafts: true,
            skipCodes: ['VB0377', 'VB0387'],
            queryFn,
            extractFn,
            log: { info: () => {}, warn: () => {} },
        });
        expect(out.summary.auto_split).toBe(1);
        expect(out.summary.skip_confirmed).toBe(2);
        expect(out.summary.fail).toBe(0);
        expect(extractFn).toHaveBeenCalledTimes(1);
        expect(sqlLog.some((e) => /DELETE FROM dbo\.weld_sketches/.test(e.sql)
            && e.params.wpqr_id === 10
            && /status <> N'confermato'/.test(e.sql))).toBe(true);
        expect(sqlLog.every((e) => !(/DELETE/.test(e.sql) && e.params && (e.params.wpqr_id === 38 || e.params.wpqr_id === 39)))).toBe(true);
        const kinds = Object.fromEntries(out.results.map((r) => [r.wpqr_id, r.kind]));
        expect(kinds[10]).toBe('auto_split');
        expect(kinds[38]).toBe('skip_confirmed');
        expect(kinds[39]).toBe('skip_confirmed');
    });

    it('APPLY regenerate: WPQR con confermato in DB non viene cancellato né estratto', async () => {
        const rows = [{
            id: 38, organization_id: 1, company_id: 51,
            reference_number: 'OTHER', certificate_file_url: '/uploads/wpqr/x.pdf',
        }];
        const extractFn = jest.fn();
        const sqlLog = [];
        const queryFn = jest.fn(async (sql) => {
            sqlLog.push(String(sql));
            if (/COUNT\(\*\)/.test(sql)) return { recordset: [{ n: 2 }] };
            return { recordset: rows };
        });
        const out = await backfillWpqrSketches({
            dryRun: false,
            regenerateDrafts: true,
            queryFn,
            extractFn,
            log: { info: () => {}, warn: () => {} },
        });
        expect(extractFn).not.toHaveBeenCalled();
        expect(out.results[0].kind).toBe('skip_confirmed');
        expect(sqlLog.some((s) => /DELETE FROM dbo\.weld_sketches/.test(s))).toBe(false);
    });

    it('APPLY: extractAfterWpqrCommit con throwOnError classifica fail, non empty', async () => {
        const { extractAfterWpqrCommit } = require('./weldSketches.service');
        const rows = [{
            id: 11, organization_id: 1, company_id: 51,
            reference_number: 'FAILPDF', certificate_file_url: '/uploads/wpqr/missing.pdf',
        }];
        const extractFn = (args) => extractAfterWpqrCommit({
            ...args,
            deps: {
                tableAvailable: async () => true,
                resolvePath: () => null,
                extractAndStoreFromPdf: async () => {
                    throw new Error('non deve arrivare qui');
                },
            },
        });
        const out = await backfillWpqrSketches({
            dryRun: false,
            queryFn: async (sql) => {
                if (/SELECT TOP 1 id/.test(sql)) return { recordset: [] };
                return { recordset: rows };
            },
            extractFn,
            log: { info: () => {}, warn: () => {} },
        });
        expect(out.summary.fail).toBe(1);
        expect(out.summary.empty).toBe(0);
        expect(out.results[0].kind).toBe('fail');
        expect(out.results[0].error).toMatch(/PDF sorgente assente/);
    });

    it('composeContactSheet produce un PNG valido dalla griglia sintetica', () => {
        const sheet = composeContactSheet([
            { png: tinyPng([10, 20, 30]), kind: 'auto_split' },
            { png: tinyPng([200, 10, 10]), kind: 'da_dividere' },
        ]);
        expect(Buffer.isBuffer(sheet)).toBe(true);
        const decoded = decodePng(sheet);
        expect(decoded).toBeTruthy();
        expect(decoded.width).toBeGreaterThan(8);
        expect(decoded.height).toBeGreaterThan(8);
    });
});
