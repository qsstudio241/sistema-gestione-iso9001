/**
 * L1 — migrazione 155 rdp/ndt project_id (ISO-7).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SQL_PATH = path.join(ROOT, 'database/migrations/155_rdp_ndt_project_id.sql');
const VPS_PATH = path.join(ROOT, 'backend/scripts/run-migration-155-vps.js');

function splitIdempotentSteps(sqlText) {
    const withoutBom = String(sqlText).replace(/^\uFEFF/, '');
    return withoutBom
        .split(/\n(?=IF (?:NOT )?EXISTS)/i)
        .map((chunk) => chunk.trim())
        .filter((chunk) => /^IF (?:NOT )?EXISTS/i.test(chunk));
}

describe('migration 155 rdp/ndt project_id', () => {
    const sql = fs.readFileSync(SQL_PATH, 'utf8');
    const vps = fs.readFileSync(VPS_PATH, 'utf8');

    it('ha 6 step idempotenti e niente USE/GO', () => {
        expect(splitIdempotentSteps(sql)).toHaveLength(6);
        expect(sql).not.toMatch(/^\s*USE\s+/im);
        expect(sql).not.toMatch(/^\s*GO\s*$/im);
        expect(sql).toContain('rdp_reports');
        expect(sql).toContain('ndt_reports');
        expect(sql).toContain('FK_rdp_project');
        expect(sql).toContain('FK_ndt_project');
    });

    it('SET NULL e non CASCADE', () => {
        expect(sql).toMatch(/ON DELETE SET NULL/i);
        expect(sql).not.toMatch(/ON DELETE CASCADE/i);
    });

    it('il runner VPS spezza gli step e accetta TARGET=test', () => {
        expect(vps).toContain('splitIdempotentSteps');
        expect(vps).toContain('SGQ_MIGRATION_TARGET');
        expect(vps).toContain('155_rdp_ndt_project_id.sql');
    });
});
