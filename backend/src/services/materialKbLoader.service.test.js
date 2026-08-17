'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  loadMaterialKbSnapshot,
  lookupEn10025Limits,
  parseDesignation,
  defaultKbRoot,
} = require('./materialKbLoader.service');

describe('materialKbLoader (MC-2)', () => {
  let snap;

  beforeAll(() => {
    snap = loadMaterialKbSnapshot();
  });

  it('legge la KB dal repo senza rete', () => {
    expect(defaultKbRoot()).toMatch(/knowledge[/\\]material-compliance$/);
    expect(snap.files.length).toBeGreaterThanOrEqual(6);
    expect(snap.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(snap.inspectionDocumentTypes).toEqual(['2.1', '2.2', '3.1', '3.2']);
  });

  it('copia backend/data ha lo stesso hash della KB in knowledge/', () => {
    const dataRoot = path.resolve(__dirname, '../../data/material-compliance');
    const dataSnap = loadMaterialKbSnapshot({ kbRoot: dataRoot });
    expect(dataSnap.hash).toBe(snap.hash);
  });

  it('hash stabile a parità di file', () => {
    const again = loadMaterialKbSnapshot();
    expect(again.hash).toBe(snap.hash);
    expect(again.files).toEqual(snap.files);
  });

  it('hash cambia se un file Markdown cambia', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-kb-'));
    const src = snap.kbRoot;
    const copyDir = (from, to) => {
      fs.mkdirSync(to, { recursive: true });
      for (const name of fs.readdirSync(from)) {
        const a = path.join(from, name);
        const b = path.join(to, name);
        if (fs.statSync(a).isDirectory()) copyDir(a, b);
        else fs.copyFileSync(a, b);
      }
    };
    copyDir(src, tmp);
    const before = loadMaterialKbSnapshot({ kbRoot: tmp }).hash;
    fs.appendFileSync(path.join(tmp, 'COVERAGE.md'), '\n# touch\n');
    const after = loadMaterialKbSnapshot({ kbRoot: tmp }).hash;
    expect(after).not.toBe(before);
  });

  it('dichiara fonti coperte e mancanti (niente soglie inventate)', () => {
    expect(snap.coverage.covered).toEqual(expect.arrayContaining(['EN 10025-2', 'EN 10210-1', 'EN 10204', 'ISO 14341']));
    expect(snap.coverage.missing).toEqual(expect.arrayContaining(['EN 10219-1', 'ISO 2560']));
    expect(snap.coverage.missing).not.toEqual(expect.arrayContaining(['EN 10210-1']));
    expect(snap.skip.tubes).toMatch(/10219/);
    expect(snap.skip.tubeStandardAmbiguous).toMatch(/10210/);
    expect(snap.skip.fillerProduct).toMatch(/2560/);
  });

  it('dizionario contiene chiavi canoniche EN 10168 + material_role', () => {
    expect(snap.dictionary.material_role).toBeTruthy();
    expect(snap.dictionary.ReH.en10168).toMatch(/C11/);
    expect(snap.dictionary.inspection_document_type.synonyms.join(' ')).toMatch(/3\.1/);
  });

  it('parseDesignation S355J2+N', () => {
    expect(parseDesignation('EN 10025-2 - S355J2+N')).toEqual({
      family: 'S355',
      quality: 'J2',
      grade: 'S355J2',
      hollow: false,
    });
    expect(parseDesignation('EN 10210-S355J2H')).toEqual({
      family: 'S355',
      quality: 'J2',
      grade: 'S355J2H',
      hollow: true,
    });
    expect(parseDesignation('S355NLH').grade).toBe('S355NLH');
  });

  it('limiti S355J2 lamiera 10 mm: ReH 355, C heat 0.20, KV 27 J a -20', () => {
    const hit = lookupEn10025Limits(snap, {
      materialRole: 'base',
      productForm: 'plate',
      designation: 'S355J2',
      thicknessMm: 10,
    });
    expect(hit.skip).toBe(false);
    expect(hit.rehMin).toBe(355);
    expect(hit.cHeatMax).toBe(0.2);
    expect(hit.cevMax).toBe(0.45);
    expect(hit.rm).toEqual({ min: 470, max: 630 });
    expect(hit.kv).toEqual({ tempC: -20, minJ: 27 });
  });

  it('limiti S355J2 20 mm: ReH scende a 345', () => {
    const hit = lookupEn10025Limits(snap, {
      materialRole: 'base',
      productForm: 'plate',
      designation: 'S355J2',
      thicknessMm: 20,
    });
    expect(hit.rehMin).toBe(345);
  });

  it('tubo senza norma 10210 vs 10219 → skip (non inventare 10219)', () => {
    const hit = lookupEn10025Limits(snap, {
      materialRole: 'base',
      productForm: 'tube',
      designation: 'S355J2H',
      thicknessMm: 10,
    });
    expect(hit.skip).toBe(true);
    expect(hit.source).toBe('en10210');
    expect(hit.reason).toMatch(/10219/);
  });

  it('tubo EN 10219-1 → skip (Markdown assente)', () => {
    const hit = lookupEn10025Limits(snap, {
      materialRole: 'base',
      productForm: 'hollow_section',
      designation: 'S355J2H',
      materialStandard: 'EN 10219-1',
      thicknessMm: 10,
    });
    expect(hit.skip).toBe(true);
    expect(hit.source).toBe('en10219');
  });

  it('tubo EN 10210-1 S355J2H 3 mm: Rm fascia ≤3 (510–680), non 3–100', () => {
    const hit = lookupEn10025Limits(snap, {
      productForm: 'tube',
      designation: 'S355J2H',
      materialStandard: 'EN 10210-1',
      thicknessMm: 3,
    });
    expect(hit.skip).toBe(false);
    expect(hit.rm).toEqual({ min: 510, max: 680 });
  });

  it('tubo EN 10210-1 S355J2H 10 mm: ReH 355, C 0.22, CEV 0.45', () => {
    const hit = lookupEn10025Limits(snap, {
      materialRole: 'base',
      productForm: 'tube',
      designation: 'S355J2H',
      materialStandard: 'EN 10210-1',
      thicknessMm: 10,
    });
    expect(hit.skip).toBe(false);
    expect(hit.source).toBe('en10210-1');
    expect(hit.rehMin).toBe(355);
    expect(hit.cHeatMax).toBe(0.22);
    expect(hit.cevMax).toBe(0.45);
    expect(hit.rm).toEqual({ min: 470, max: 630 });
    expect(hit.kv).toEqual({ tempC: -20, minJ: 27 });
  });

  it('hollow EN 10210-1 S355NLH 20 mm: ReH 345, C 0.18, KV 27 J a -50', () => {
    const hit = lookupEn10025Limits(snap, {
      productForm: 'hollow_section',
      designation: 'S355NLH',
      materialStandard: 'UNI EN 10210',
      thicknessMm: 20,
    });
    expect(hit.skip).toBe(false);
    expect(hit.rehMin).toBe(345);
    expect(hit.cHeatMax).toBe(0.18);
    expect(hit.kv).toEqual({ tempC: -50, minJ: 27 });
  });

  it('EN 10210-2 da sola non applica le soglie della Part 1', () => {
    const hit = lookupEn10025Limits(snap, {
      productForm: 'tube',
      designation: 'S355J2H',
      materialStandard: 'EN 10210-2',
      thicknessMm: 10,
    });
    expect(hit.skip).toBe(true);
    expect(hit.source).toBe('en10210-2');
  });

  it('S275JRH non è in Annex A → skip', () => {
    const hit = lookupEn10025Limits(snap, {
      productForm: 'tube',
      designation: 'S275JRH',
      materialStandard: 'EN 10210-1',
      thicknessMm: 10,
    });
    expect(hit.skip).toBe(true);
    expect(hit.reason).toMatch(/non seedato/);
  });

  it('apporto: skip soglie prodotto', () => {
    const hit = lookupEn10025Limits(snap, {
      materialRole: 'filler',
      designation: 'G 42 4 M21 3Si1',
    });
    expect(hit.skip).toBe(true);
    expect(hit.source).toBe('filler_product');
  });

  it('virgola italiana 0,17 → 0.17 su S235JR', () => {
    const hit = lookupEn10025Limits(snap, {
      designation: 'S235JR',
      productForm: 'plate',
      thicknessMm: 8,
    });
    expect(hit.cHeatMax).toBe(0.17);
    expect(hit.rehMin).toBe(235);
  });

  it('spessore assente → skip (non skip:false con limiti nulli)', () => {
    const hit = lookupEn10025Limits(snap, {
      designation: 'S355J2',
      productForm: 'plate',
    });
    expect(hit.skip).toBe(true);
    expect(hit.reason).toMatch(/spessore/);
  });

  it('S185 fuori seed → skip', () => {
    const hit = lookupEn10025Limits(snap, {
      designation: 'S185',
      productForm: 'plate',
      thicknessMm: 10,
    });
    expect(hit.skip).toBe(true);
    expect(hit.reason).toMatch(/non seedato/);
  });

  it('nota i: S355J2 C heat 0.22 oltre 30 mm', () => {
    const thin = lookupEn10025Limits(snap, {
      designation: 'S355J2',
      productForm: 'plate',
      thicknessMm: 25,
    });
    const thick = lookupEn10025Limits(snap, {
      designation: 'S355J2',
      productForm: 'plate',
      thicknessMm: 35,
    });
    expect(thin.skip).toBe(false);
    expect(thin.cHeatMax).toBe(0.2);
    expect(thick.cHeatMax).toBe(0.22);
  });

  it('nota h: S275J0 C heat 0.20 oltre 150 mm', () => {
    const mid = lookupEn10025Limits(snap, {
      designation: 'S275J0',
      productForm: 'plate',
      thicknessMm: 100,
    });
    const thick = lookupEn10025Limits(snap, {
      designation: 'S275J0',
      productForm: 'plate',
      thicknessMm: 160,
    });
    expect(mid.cHeatMax).toBe(0.18);
    expect(thick.cHeatMax).toBe(0.2);
  });

  it('oltre 400 mm: ReH/Rm/CEV assenti, C heat >150 ancora applicabile', () => {
    const hit = lookupEn10025Limits(snap, {
      designation: 'S355J2',
      productForm: 'plate',
      thicknessMm: 500,
    });
    expect(hit.skip).toBe(false);
    expect(hit.rehMin).toBeNull();
    expect(hit.rm).toBeNull();
    expect(hit.cevMax).toBeNull();
    expect(hit.cHeatMax).toBe(0.22);
  });

  it('S460 senza forma o su lamiera → skip; barra 10 mm ReH 460', () => {
    const none = lookupEn10025Limits(snap, {
      designation: 'S460J2',
      thicknessMm: 10,
    });
    const plate = lookupEn10025Limits(snap, {
      designation: 'S460J2',
      productForm: 'plate',
      thicknessMm: 10,
    });
    const bar = lookupEn10025Limits(snap, {
      designation: 'S460J2',
      productForm: 'bar',
      thicknessMm: 10,
    });
    expect(none.skip).toBe(true);
    expect(plate.skip).toBe(true);
    expect(bar.skip).toBe(false);
    expect(bar.rehMin).toBe(460);
  });

  it('nota b: S355J2 prodotti lunghi 150–250 mm CEV 0.54, lamiera 0.49', () => {
    const plate = lookupEn10025Limits(snap, {
      designation: 'S355J2',
      productForm: 'plate',
      thicknessMm: 200,
    });
    const bar = lookupEn10025Limits(snap, {
      designation: 'S355J2',
      productForm: 'bar',
      thicknessMm: 200,
    });
    expect(plate.skip).toBe(false);
    expect(plate.cevMax).toBe(0.49);
    expect(bar.cevMax).toBe(0.54);
  });
});
