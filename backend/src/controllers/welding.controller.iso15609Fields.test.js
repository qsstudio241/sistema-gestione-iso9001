/**
 * @jest-environment node
 *
 * L1 — 181: create/update WPS dichiarano i campi ISO 15609-1 (bozza, no apply).
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'welding.controller.js'), 'utf8');

describe('createWPS / updateWPS — campi ISO 15609-1 (migrazione 181)', () => {
    it('INSERT elenca wpqr_ref, parent_material, heat_input, current/voltage, metal_transfer', () => {
        expect(src).toMatch(/INSERT INTO welding_procedures[\s\S]*wpqr_ref[\s\S]*parent_material_a[\s\S]*heat_input[\s\S]*metal_transfer/);
    });

    it('updateWPS allowed include gli stessi campi', () => {
        expect(src).toMatch(/'wpqr_ref', 'parent_material_a', 'parent_material_b'/);
        expect(src).toMatch(/'heat_input', 'current_range', 'voltage_range', 'metal_transfer'/);
    });
});
