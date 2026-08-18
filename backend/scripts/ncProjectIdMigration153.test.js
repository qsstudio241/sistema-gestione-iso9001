/**
 * L1 — migrazione 153 non_conformities.project_id (ISO-6).
 * Verifica statica: idempotenza, niente USE/GO, SET NULL e non CASCADE.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SQL_PATH = path.join(ROOT, 'database/migrations/153_nc_project_id.sql');
const VPS_PATH = path.join(ROOT, 'backend/scripts/run-migration-153-vps.js');

function splitIdempotentSteps(sqlText) {
    const withoutBom = String(sqlText).replace(/^\uFEFF/, '');
    return withoutBom
        .split(/\n(?=IF (?:NOT )?EXISTS)/i)
        .map((chunk) => chunk.trim())
        .filter((chunk) => /^IF (?:NOT )?EXISTS/i.test(chunk));
}

describe('migration 153 nc project_id', () => {
    const sql = fs.readFileSync(SQL_PATH, 'utf8');
    const vps = fs.readFileSync(VPS_PATH, 'utf8');

    it('ha 3 step idempotenti e niente USE/GO', () => {
        expect(splitIdempotentSteps(sql)).toHaveLength(3);
        expect(sql).not.toMatch(/^\s*USE\s+/im);
        expect(sql).not.toMatch(/^\s*GO\s*$/im);
        expect(sql).toContain('project_id');
        expect(sql).toContain('FK_nc_project');
        expect(sql).toContain('IX_nc_project_id');
    });

    it('scollega la NC se la commessa viene cancellata (SET NULL, non CASCADE)', () => {
        expect(sql).toMatch(/ON DELETE SET NULL/i);
        expect(sql).not.toMatch(/ON DELETE CASCADE/i);
    });

    it('il runner VPS spezza gli step e accetta TARGET=test', () => {
        expect(vps).toContain('splitIdempotentSteps');
        expect(vps).toContain('SGQ_MIGRATION_TARGET');
        expect(vps).toContain('153_nc_project_id.sql');
    });
});
