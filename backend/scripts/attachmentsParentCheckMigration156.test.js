/**
 * L1 — migrazione 156 CHK_attachments_parent (ndt_report_item_id + rdp_test_id).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SQL_PATH = path.join(ROOT, 'database/migrations/156_attachments_parent_check_ndt_rdp.sql');
const VPS_PATH = path.join(ROOT, 'backend/scripts/run-migration-156-vps.js');

function splitIdempotentSteps(sqlText) {
    const withoutBom = String(sqlText).replace(/^\uFEFF/, '');
    return withoutBom
        .split(/\n(?=IF (?:NOT )?EXISTS)/i)
        .map((chunk) => chunk.trim())
        .filter((chunk) => /^IF (?:NOT )?EXISTS/i.test(chunk));
}

describe('migration 156 attachments parent check ndt/rdp', () => {
    const sql = fs.readFileSync(SQL_PATH, 'utf8');
    const vps = fs.readFileSync(VPS_PATH, 'utf8');

    it('ha 2 step idempotenti e niente USE/GO', () => {
        expect(splitIdempotentSteps(sql)).toHaveLength(2);
        expect(sql).not.toMatch(/^\s*USE\s+/im);
        expect(sql).not.toMatch(/^\s*GO\s*$/im);
        expect(sql).toContain('CHK_attachments_parent');
        expect(sql).toContain('ndt_report_item_id');
        expect(sql).toContain('rdp_test_id');
    });

    it('conserva i parent esistenti e aggiunge CND/RDP', () => {
        expect(sql).toMatch(/audit_id IS NOT NULL/i);
        expect(sql).toMatch(/nc_id IS NOT NULL/i);
        expect(sql).toMatch(/document_id IS NOT NULL/i);
        expect(sql).toMatch(/custom_item_id IS NOT NULL/i);
        expect(sql).toMatch(/commercial_case_id IS NOT NULL/i);
        expect(sql).toMatch(/ndt_report_item_id IS NOT NULL/i);
        expect(sql).toMatch(/rdp_test_id IS NOT NULL/i);
        expect(sql).not.toMatch(/ON DELETE CASCADE/i);
    });

    it('droppa solo se la definition manca delle colonne nuove', () => {
        const [dropStep] = splitIdempotentSteps(sql);
        expect(dropStep).toMatch(/^IF EXISTS/i);
        expect(dropStep).toMatch(/CHARINDEX\('ndt_report_item_id'/i);
        expect(dropStep).toMatch(/CHARINDEX\('rdp_test_id'/i);
        expect(dropStep).toMatch(/DROP CONSTRAINT CHK_attachments_parent/i);
    });

    it('il runner VPS verifica regex su entrambi i campi e accetta TARGET=test', () => {
        expect(vps).toContain('splitIdempotentSteps');
        expect(vps).toContain('SGQ_MIGRATION_TARGET');
        expect(vps).toContain('156_attachments_parent_check_ndt_rdp.sql');
        expect(vps).toMatch(/ndt_report_item_id/i);
        expect(vps).toMatch(/rdp_test_id/i);
        expect(vps).toContain('/ndt_report_item_id/i.test');
        expect(vps).toContain('/rdp_test_id/i.test');
    });
});
