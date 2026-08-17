'use strict';

const fs = require('fs');
const path = require('path');
const {
  evaluateMaterialCertificate,
  matchesIso14341Designation,
  pickCertJson,
} = require('./materialComplianceRuleEngine.service');
const { loadMaterialKbSnapshot } = require('./materialKbLoader.service');

function check(result, key) {
  return result.checks.find((c) => c.requirement_key === key);
}

describe('materialComplianceRuleEngine (MC-3)', () => {
  let snapshot;

  beforeAll(() => {
    snapshot = loadMaterialKbSnapshot();
  });

  it('zero LLM: il sorgente non chiama provider AI', () => {
    const src = fs.readFileSync(path.join(__dirname, 'materialComplianceRuleEngine.service.js'), 'utf8');
    expect(src).not.toMatch(/openai|anthropic|aiProvider|chat\.completions|generateContent/i);
    expect(src).toMatch(/Zero rete, zero LLM/);
  });

  it('corrected_json vince su extracted_json', () => {
    expect(pickCertJson({ ReH: 300 }, { ReH: 360 }).ReH).toBe(360);
  });

  it('capitolato 3.1 vs PDF 2.2 → fail su inspection_document_type', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'plate',
        steel_designation: 'S355J2',
        thickness_mm: 10,
        inspection_document_type: '2.2',
        ReH: 360,
        Rm: 520,
        CEV: 0.40,
        chemistry: { C: 0.18 },
        KV: 40,
      },
      scope: { po: { inspection_document_type: '3.1', source_ref: 'PO-1' } },
    });
    expect(check(hit, 'inspection_document_type').result).toBe('fail');
    expect(check(hit, 'inspection_document_type').source_level).toBe('po');
    expect(hit.status).toBe('fail');
  });

  it('lamiera S355J2 10 mm entro EN 10025-2 → pass', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'plate',
        steel_designation: 'S355J2',
        material_standard: 'EN 10025-2',
        thickness_mm: 10,
        inspection_document_type: '3.1',
        ReH: 360,
        Rm: 520,
        CEV: 0.40,
        chemistry: { C: 0.18 },
        KV: 40,
      },
    });
    expect(hit.status).toBe('pass');
    expect(check(hit, 'ReH').result).toBe('pass');
    expect(check(hit, 'Rm').result).toBe('pass');
    expect(check(hit, 'CEV').result).toBe('pass');
    expect(check(hit, 'C').result).toBe('pass');
    expect(check(hit, 'KV').result).toBe('pass');
    expect(check(hit, 'inspection_document_type').result).toBe('skip');
  });

  it('lamiera S355J2 ReH 340 → fail ReH', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'plate',
        steel_designation: 'S355J2',
        thickness_mm: 10,
        ReH: 340,
        Rm: 520,
        CEV: 0.40,
        chemistry: { C: 0.18 },
        KV: 40,
      },
    });
    expect(check(hit, 'ReH').result).toBe('fail');
    expect(hit.status).toBe('fail');
  });

  it('ReH assente sul certificato → skip, non fail', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'plate',
        steel_designation: 'S355J2',
        thickness_mm: 10,
        Rm: 520,
        CEV: 0.40,
        chemistry: { C: 0.18 },
        KV: 40,
      },
    });
    expect(check(hit, 'ReH').result).toBe('skip');
    expect(check(hit, 'ReH').explanation).toMatch(/assente/i);
    expect(hit.status).toBe('pass');
  });

  it('tubo senza citazione 10210 vs 10219 → skip soglie', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'tube',
        steel_designation: 'S355J2H',
        thickness_mm: 10,
        ReH: 360,
      },
    });
    expect(check(hit, 'ReH').result).toBe('skip');
    expect(check(hit, 'ReH').explanation).toMatch(/10219|10210/);
    expect(hit.status).toBe('skip');
  });

  it('hollow EN 10210-1 S355J2H 10 mm entro soglie → pass', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'tube',
        steel_designation: 'S355J2H',
        material_standard: 'EN 10210-1',
        thickness_mm: 10,
        ReH: 360,
        Rm: 520,
        CEV: 0.44,
        chemistry: { C: 0.20 },
        KV: 30,
      },
    });
    expect(check(hit, 'ReH').result).toBe('pass');
    expect(check(hit, 'C').result).toBe('pass');
    expect(hit.status).toBe('pass');
  });

  it('hollow EN 10219-1 S235JRH CEV 0.36 > 0.35 → fail CEV', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'hollow_section',
        steel_designation: 'S235JRH',
        material_standard: 'EN 10219-1',
        thickness_mm: 10,
        ReH: 240,
        Rm: 400,
        CEV: 0.36,
        chemistry: { C: 0.16 },
        KV: 30,
      },
    });
    expect(check(hit, 'CEV').result).toBe('fail');
    expect(check(hit, 'CEV').required_value).toMatch(/0\.35/);
    expect(hit.status).toBe('fail');
  });

  it('EN 10219-2 da sola → skip soglie', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'tube',
        steel_designation: 'S355J2H',
        material_standard: 'EN 10219-2',
        thickness_mm: 10,
        ReH: 360,
      },
    });
    expect(check(hit, 'ReH').result).toBe('skip');
    expect(check(hit, 'ReH').explanation).toMatch(/10219-2/);
  });

  it('apporto: skip soglie, non skip tipo EN 10204 se richiesto', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'filler',
        product_form: 'wire',
        filler_designation: 'E 42 5 B 32 H5',
        filler_standard: 'ISO 2560',
        inspection_document_type: '3.1',
        ReH: 420,
      },
      scope: { po: { inspection_document_type: '3.1', source_ref: 'PO-F' } },
    });
    expect(check(hit, 'inspection_document_type').result).toBe('pass');
    expect(check(hit, 'ReH').result).toBe('skip');
    expect(check(hit, 'ReH').explanation).toMatch(/2560/);
    expect(hit.status).toBe('pass');
  });

  it('ISO 14341: forma G 42 4 M21 3Si1 → pass classificazione, skip chimica lotto', () => {
    expect(matchesIso14341Designation('G 42 4 M21 3Si1')).toBe(true);
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'filler',
        filler_standard: 'ISO 14341',
        filler_designation: 'G 42 4 M21 3Si1',
        chemistry: { C: 0.08 },
      },
    });
    expect(check(hit, 'filler_designation').result).toBe('pass');
    expect(check(hit, 'ReH').result).toBe('skip');
  });

  it('ISO 14341: ER70S-6 non è forma classificazione → fail forma', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'filler',
        filler_standard: 'ISO 14341',
        filler_designation: 'ER70S-6',
      },
    });
    expect(check(hit, 'filler_designation').result).toBe('fail');
    expect(hit.status).toBe('fail');
  });

  it('ADR-021: più restrittivo vince (ReH 355/390/400, actual 395 → fail azienda)', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'plate',
        steel_designation: 'S355J2',
        thickness_mm: 10,
        ReH: 395,
        Rm: 520,
        CEV: 0.40,
        chemistry: { C: 0.18 },
        KV: 40,
      },
      scope: {
        customer: { ReH: 390, source_ref: 'customers/pilota' },
        company: { ReH: 400, source_ref: 'companies/pilota' },
      },
    });
    const reh = check(hit, 'ReH');
    expect(reh.result).toBe('fail');
    expect(reh.source_level).toBe('company');
    expect(reh.required_value).toMatch(/400/);
    expect(hit.status).toBe('fail');
  });

  it('livello azienda assente: vince il cliente (395 ≥ 390 → pass)', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'plate',
        steel_designation: 'S355J2',
        thickness_mm: 10,
        ReH: 395,
        Rm: 520,
        CEV: 0.40,
        chemistry: { C: 0.18 },
        KV: 40,
      },
      scope: { customer: { ReH: 390, source_ref: 'customers/pilota' } },
    });
    const reh = check(hit, 'ReH');
    expect(reh.result).toBe('pass');
    expect(reh.source_level).toBe('customer');
  });

  it('non espone workflow_status compliant', () => {
    const hit = evaluateMaterialCertificate({
      snapshot,
      extractedJson: {
        material_role: 'base',
        product_form: 'plate',
        steel_designation: 'S355J2',
        thickness_mm: 10,
        ReH: 360,
        Rm: 520,
        CEV: 0.40,
        chemistry: { C: 0.18 },
        KV: 40,
      },
    });
    expect(hit.workflow_status).toBeUndefined();
    expect(hit.status).not.toBe('compliant');
    expect(hit.kb_snapshot_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
