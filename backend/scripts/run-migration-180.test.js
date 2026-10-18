/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const {
    resolveTarget,
    splitGoBatches,
    batchesWithUse,
    countsEqual,
    SQL_FILE,
    TEST_DB,
    COUNT_TABLES,
} = require('./run-migration-180-vps');

describe('run-migration-180', () => {
    it('rifiuta prod e un target assente', () => {
        expect(() => resolveTarget({ SGQ_MIGRATION_TARGET: 'prod' })).toThrow(/test/);
        expect(() => resolveTarget({})).toThrow(/test/);
    });

    it('accetta solo il database TEST', () => {
        const cfg = resolveTarget({ SGQ_MIGRATION_TARGET: 'test', CHECK_ONLY: '1' });
        expect(cfg.target).toBe('test');
        expect(cfg.expectedDb).toBe(TEST_DB);
        expect(cfg.expectedDb).toBe('2026-06-18_SGQ_ISO9001');
        expect(cfg.checkOnly).toBe(true);
        expect(cfg.backendRoot).toContain('sgq-backend-test');
        expect(cfg.envFile).not.toMatch(/sgq-backend\/\.env$/);
    });

    it('lo SQL è additivo: tabella nuova, FK separate, niente CASCADE né USE', () => {
        const text = fs.readFileSync(
            path.join(__dirname, '../../database/migrations', SQL_FILE),
            'utf8'
        );
        const batches = splitGoBatches(text);
        expect(batches.length).toBeGreaterThanOrEqual(2);
        expect(batchesWithUse(batches)).toEqual([]);
        expect(text).toMatch(/project_inspection_items/);
        expect(text).toMatch(/inspection_phase/);
        expect(text).toMatch(/N'before', N'during', N'after'/);
        expect(text).toMatch(/acceptance_standard/);
        expect(text).toMatch(/deleted_at/);
        expect(text).toMatch(/deleted_by/);
        expect(text).toMatch(/FOREIGN KEY \(project_id\) REFERENCES dbo\.projects \(id\)/);
        expect(text).toMatch(/FOREIGN KEY \(organization_id\) REFERENCES dbo\.organizations \(organization_id\)/);
        expect(text).not.toMatch(/ON DELETE/i);
        expect(text).not.toMatch(/\bUPDATE\b/i);
        expect(text).not.toMatch(/\bDELETE\s+FROM\b/i);
        expect(text).toMatch(/TYPE: additive/);
        expect(text).toMatch(/apply-on-empty/);
    });

    it('i conteggi delle tabelle già presenti devono restare uguali', () => {
        const before = { projects: 4, ndt_reports: 2, qualifications: 9, commercial_cases: 1 };
        expect(countsEqual(before, { ...before })).toBe(true);
        expect(countsEqual(before, { ...before, projects: 3 })).toBe(false);
        expect(COUNT_TABLES).toEqual(['projects', 'ndt_reports', 'qualifications', 'commercial_cases']);
    });
});
