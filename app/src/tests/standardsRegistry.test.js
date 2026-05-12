/**
 * Test L1 — STANDARDS_REGISTRY (ADR-009 Fase 1)
 *
 * Garantisce che il Source of Truth degli standard fornisca:
 * - mappe coerenti (key↔codes↔subsId)
 * - lookup per key e per code (incluse varianti anno)
 * - filtraggio ordinato di selectedStandards in entry registry
 * - test di scalabilità: aggiungere uno standard al registry deve renderlo
 *   automaticamente disponibile a tutte le mappe derivate
 */

import { describe, it, expect } from 'vitest';
import {
  STANDARDS_REGISTRY,
  STANDARDS_LIST,
  STANDARD_INIT_MAP,
  CODE_TO_KEY,
  STANDARD_TO_SUBSID,
  getStandardByKey,
  getStandardByCode,
  getSelectedStandardEntries,
  isAllHls,
} from '../data/standardsRegistry';

describe('STANDARDS_REGISTRY — struttura base', () => {
  it('contiene gli standard attualmente attivi a DB (verificati 08/05/2026)', () => {
    expect(STANDARDS_REGISTRY.ISO_9001).toBeDefined();
    expect(STANDARDS_REGISTRY.ISO_14001).toBeDefined();
    expect(STANDARDS_REGISTRY.ISO_45001).toBeDefined();
    expect(STANDARDS_REGISTRY.ISO_3834_2).toBeDefined();
    expect(STANDARDS_REGISTRY.RDP_MSN).toBeDefined();
  });

  it('ogni entry espone i campi richiesti da ADR-009 Fase 1', () => {
    for (const entry of STANDARDS_LIST) {
      expect(entry.key).toBeTypeOf('string');
      expect(entry.standardId).toBeTypeOf('number');
      expect(Array.isArray(entry.codes)).toBe(true);
      expect(entry.codes.length).toBeGreaterThan(0);
      expect(entry.label).toBeTypeOf('string');
      expect(entry.shortLabel).toBeTypeOf('string');
      expect(entry.subsId).toMatch(/^[a-z0-9-]+$/);
      expect(['iso_hls', 'iso_process', 'rdp', 'custom']).toContain(entry.kind);
    }
  });

  it('subsId è univoco fra tutte le entry (no collisioni accordion)', () => {
    const ids = STANDARDS_LIST.map((e) => e.subsId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('standardId numerico è univoco', () => {
    const ids = STANDARDS_LIST.map((e) => e.standardId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('STANDARD_INIT_MAP', () => {
  it('mappa key → codes coerente con il registry', () => {
    expect(STANDARD_INIT_MAP.ISO_9001).toEqual(['ISO_9001', 'ISO_9001_2015']);
    expect(STANDARD_INIT_MAP.ISO_14001).toEqual(['ISO_14001', 'ISO_14001_2015']);
    expect(STANDARD_INIT_MAP.ISO_3834_2).toEqual([
      'ISO_3834',
      'ISO_3834_2',
      'ISO_3834_2_2021',
    ]);
  });
});

describe('CODE_TO_KEY', () => {
  it('normalizza codici verso la key canonica', () => {
    expect(CODE_TO_KEY.ISO_9001_2015).toBe('ISO_9001');
    expect(CODE_TO_KEY.ISO_9001).toBe('ISO_9001');
    expect(CODE_TO_KEY.ISO_14001_2015).toBe('ISO_14001');
    expect(CODE_TO_KEY.ISO_14001).toBe('ISO_14001');
    expect(CODE_TO_KEY.ISO_3834_2_2021).toBe('ISO_3834_2');
    expect(CODE_TO_KEY.RDP_MSN).toBe('RDP_MSN');
  });
});

describe('STANDARD_TO_SUBSID', () => {
  it('mappa code (qualsiasi variante) e key → subsId accordion', () => {
    expect(STANDARD_TO_SUBSID.ISO_9001).toBe('iso-9001');
    expect(STANDARD_TO_SUBSID.ISO_9001_2015).toBe('iso-9001');
    expect(STANDARD_TO_SUBSID.ISO_14001_2015).toBe('iso-14001');
    expect(STANDARD_TO_SUBSID.ISO_45001_2018).toBe('iso-45001');
    expect(STANDARD_TO_SUBSID.ISO_3834_2_2021).toBe('iso-3834');
    expect(STANDARD_TO_SUBSID.RDP_MSN).toBe('rdp-msn');
  });
});

describe('getStandardByKey / getStandardByCode', () => {
  it('getStandardByKey trova entry esistente, null per chiavi inesistenti', () => {
    expect(getStandardByKey('ISO_9001')?.label).toContain('9001');
    expect(getStandardByKey('NON_ESISTE')).toBeNull();
    expect(getStandardByKey(undefined)).toBeNull();
  });

  it('getStandardByCode trova entry per varianti anno', () => {
    expect(getStandardByCode('ISO_9001_2015')?.key).toBe('ISO_9001');
    expect(getStandardByCode('ISO_9001')?.key).toBe('ISO_9001');
    expect(getStandardByCode('ISO_14001_2015')?.key).toBe('ISO_14001');
    expect(getStandardByCode('non_esiste')).toBeNull();
    expect(getStandardByCode(null)).toBeNull();
  });
});

describe('getSelectedStandardEntries', () => {
  it('mantiene ordine canonico STANDARDS_LIST (non ordine selezione)', () => {
    const entries = getSelectedStandardEntries(['ISO_14001_2015', 'ISO_9001_2015']);
    expect(entries.map((e) => e.key)).toEqual(['ISO_9001', 'ISO_14001']);
  });

  it('deduplica codici diversi che mappano alla stessa key', () => {
    const entries = getSelectedStandardEntries(['ISO_9001', 'ISO_9001_2015']);
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe('ISO_9001');
  });

  it('ignora codici non riconosciuti senza esplodere', () => {
    const entries = getSelectedStandardEntries(['ISO_9001', 'FOO_BAR']);
    expect(entries.map((e) => e.key)).toEqual(['ISO_9001']);
  });

  it('input vuoto / non array → array vuoto', () => {
    expect(getSelectedStandardEntries([])).toEqual([]);
    expect(getSelectedStandardEntries(null)).toEqual([]);
    expect(getSelectedStandardEntries(undefined)).toEqual([]);
  });
});

describe('isAllHls — flag pronto per Fase 2 (isIntegratedSystem)', () => {
  it('true se tutte le norme selezionate sono iso_hls', () => {
    expect(isAllHls(['ISO_9001_2015', 'ISO_14001_2015'])).toBe(true);
    expect(isAllHls(['ISO_9001_2015', 'ISO_14001_2015', 'ISO_45001_2018'])).toBe(true);
  });

  it('false se almeno una è non-HLS (es. 3834-2 o RDP)', () => {
    expect(isAllHls(['ISO_9001_2015', 'ISO_3834_2'])).toBe(false);
    expect(isAllHls(['RDP_MSN'])).toBe(false);
    expect(isAllHls(['ISO_9001_2015', 'RDP_MSN'])).toBe(false);
  });

  it('false su selezione vuota (no SGI possibile)', () => {
    expect(isAllHls([])).toBe(false);
  });
});

describe('Test di scalabilità ADR-009 — coerenza interna', () => {
  // Criterio di accettazione ADR-009: aggiungere un nuovo standard al registry
  // popola in automatico STANDARDS_LIST, STANDARD_INIT_MAP, CODE_TO_KEY,
  // STANDARD_TO_SUBSID. Questo test garantisce che le mappe derivate non
  // divergano mai dalla SoT.

  it('STANDARDS_LIST.length === Object.keys(STANDARDS_REGISTRY).length', () => {
    expect(STANDARDS_LIST.length).toBe(Object.keys(STANDARDS_REGISTRY).length);
  });

  it('ogni key del registry è presente in STANDARD_INIT_MAP', () => {
    for (const key of Object.keys(STANDARDS_REGISTRY)) {
      expect(STANDARD_INIT_MAP[key]).toBeDefined();
    }
  });

  it('ogni codice in CODE_TO_KEY punta a una entry esistente', () => {
    for (const [code, key] of Object.entries(CODE_TO_KEY)) {
      expect(STANDARDS_REGISTRY[key]).toBeDefined();
      expect(STANDARDS_REGISTRY[key].codes).toContain(code);
    }
  });
});
