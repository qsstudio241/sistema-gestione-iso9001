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
});

describe('findMaterialGroup', () => {
  it('restituisce metadati gruppo', () => {
    const g = findMaterialGroup('1.2');
    expect(g?.family).toBe('steel');
    expect(g?.labelIt).toContain('360');
  });
});
