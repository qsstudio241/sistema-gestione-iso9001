/**
 * Test L1 — catalogo ISO/TR 15608
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeMaterialGroupCode,
  inferMaterialGroupFromText,
  getMaterialGroupSelectOptions,
  findMaterialGroup,
} from '../data/materialGroups15608.js';

describe('normalizeMaterialGroupCode', () => {
  it('normalizza codici sottogruppo', () => {
    expect(normalizeMaterialGroupCode('1.2')).toBe('1.2');
    expect(normalizeMaterialGroupCode('Gruppo 8.1')).toBe('8.1');
    expect(normalizeMaterialGroupCode('ISO/TR 15608: 10.1')).toBe('10.1');
  });

  it('non confonde 1.1 con 11', () => {
    expect(normalizeMaterialGroupCode('11.1')).toBe('11.1');
    expect(normalizeMaterialGroupCode('1.1')).toBe('1.1');
  });
});

describe('inferMaterialGroupFromText', () => {
  it('mappa designazioni acciaio comuni', () => {
    expect(inferMaterialGroupFromText('Piastra S355J2')).toBe('1.2');
    expect(inferMaterialGroupFromText('P265GH')).toBe('1.1');
    expect(inferMaterialGroupFromText('X5CrNi18-10 / 1.4301')).toBe('8.1');
  });
});

describe('getMaterialGroupSelectOptions', () => {
  it('include sottogruppi acciaio e altro', () => {
    const opts = getMaterialGroupSelectOptions({ families: ['steel'] });
    expect(opts.some((o) => o.value === '1.4')).toBe(true);
    expect(opts.some((o) => o.value === 'altro')).toBe(true);
  });

  it('include anche i gruppi padre (feedback cliente: patentini riportano il gruppo, non il sottogruppo)', () => {
    const opts = getMaterialGroupSelectOptions({ families: ['steel'] });
    const parentValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
    for (const v of parentValues) {
      expect(opts.some((o) => o.value === v)).toBe(true);
    }
    // Il sottogruppo resta disponibile: nessuna sostituzione, solo aggiunta.
    expect(opts.some((o) => o.value === '8.1')).toBe(true);
    expect(opts.some((o) => o.value === '8.2')).toBe(true);
  });

  it('non aggiunge gruppo padre per codici senza sottogruppi (es. 21, 41)', () => {
    const opts = getMaterialGroupSelectOptions({ families: ['aluminium', 'nickel'] });
    expect(opts.filter((o) => o.value === '21')).toHaveLength(1);
    expect(opts.filter((o) => o.value === '41')).toHaveLength(1);
  });

  it('può escludere i gruppi padre con includeParentGroups:false', () => {
    const opts = getMaterialGroupSelectOptions({ families: ['steel'], includeParentGroups: false });
    expect(opts.some((o) => o.value === '1')).toBe(false);
    expect(opts.some((o) => o.value === '1.1')).toBe(true);
  });
});

describe('findMaterialGroup', () => {
  it('restituisce metadati gruppo (sottogruppo)', () => {
    const g = findMaterialGroup('1.2');
    expect(g?.family).toBe('steel');
    expect(g?.labelIt).toContain('360');
  });

  it('risolve anche il gruppo padre (es. "1", "8")', () => {
    const g1 = findMaterialGroup('1');
    expect(g1?.family).toBe('steel');
    expect(g1?.isParentGroup).toBe(true);
    expect(g1?.childCodes).toEqual(['1.1', '1.2', '1.3', '1.4']);

    const g8 = findMaterialGroup('8');
    expect(g8?.isParentGroup).toBe(true);
    expect(g8?.childCodes).toContain('8.1');
  });

  it('non confonde "1" con "11" nel testo libero', () => {
    expect(normalizeMaterialGroupCode('Gruppo 11')).toBe('11');
    expect(normalizeMaterialGroupCode('Gruppo 1')).toBe('1');
  });
});
