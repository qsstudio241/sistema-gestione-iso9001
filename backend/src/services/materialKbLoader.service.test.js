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
    expect(snap.coverage.covered).toEqual(expect.arrayContaining(['EN 10025-2', 'EN 10204', 'ISO 14341']));
    expect(snap.coverage.missing).toEqual(expect.arrayContaining(['EN 10210-1', 'EN 10219-1', 'ISO 2560']));
    expect(snap.skip.tubes).toMatch(/10210/);
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
    });
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

  it('tubo / hollow: skip (Markdown EN 10210/10219 assente)', () => {
    const hit = lookupEn10025Limits(snap, {
      materialRole: 'base',
      productForm: 'tube',
      designation: 'S355J2H',
      thicknessMm: 10,
    });
    expect(hit.skip).toBe(true);
    expect(hit.source).toBe('en10210');
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
});
