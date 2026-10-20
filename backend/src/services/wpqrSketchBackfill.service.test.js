/**
 * @jest-environment node
 */

const {
    CANDIDATE_SQL,
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
    it('SQL candidati: PDF persistito, niente schizzi, no cestino', () => {
        expect(CANDIDATE_SQL).toMatch(/certificate_file_url IS NOT NULL/);
        expect(CANDIDATE_SQL).toMatch(/NOT EXISTS/);
        expect(CANDIDATE_SQL).toMatch(/weld_sketches/);
        expect(CANDIDATE_SQL).toMatch(/deleted_at IS NULL/);
        expect(CANDIDATE_SQL).not.toMatch(/\bUPDATE\b/i);
        expect(CANDIDATE_SQL).not.toMatch(/\bDELETE\s+FROM\b/i);
        expect(CANDIDATE_SQL).not.toMatch(/\bINSERT\b/i);
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
