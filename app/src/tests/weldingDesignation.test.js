/**
 * Test L1 — anteprima FE designazione qualifica saldatore (mirror di
 * backend/src/utils/weldingDesignation.test.js).
 */
import { describe, it, expect } from 'vitest';
import { buildWelderDesignation, parseWelderQualificationDesignation, resolvePrintedDesignation } from '../utils/weldingDesignation.js';

describe('buildWelderDesignation', () => {
  it('compone la designazione completa con spessore singolo e tubo', () => {
    const out = buildWelderDesignation({
      welding_process: '141',
      product_type: 'P',
      joint_type: 'BW',
      filler_material_group: 'FM1',
      thickness_max_mm: 10,
      pipe_diameter_max_mm: 60,
      welding_positions: 'PA',
      weld_details: 'ss nb',
    });
    expect(out).toBe('141 P BW FM1 t10 D60 PA ss nb');
  });

  it('usa range t e D quando min e max differiscono e unisce piu\u2019 posizioni', () => {
    const out = buildWelderDesignation({
      welding_process: '135',
      joint_type: 'FW',
      thickness_min_mm: 3,
      thickness_max_mm: 20,
      pipe_diameter_min_mm: 60,
      pipe_diameter_max_mm: 120,
      welding_positions: ['PA', 'PF'],
    });
    expect(out).toBe('135 FW t3-20 D60-120 PA/PF');
  });

  it('include solo i token disponibili e ritorna stringa vuota se non c\u2019e\u2019 nulla', () => {
    expect(buildWelderDesignation({ welding_process: '111' })).toBe('111');
    expect(buildWelderDesignation({})).toBe('');
  });

  it('usa il simbolo >= quando \u00e8 noto solo lo spessore minimo (nessun limite superiore)', () => {
    const out = buildWelderDesignation({
      welding_process: '111',
      thickness_min_mm: 3,
    });
    expect(out).toBe('111 t\u22653');
  });

  it('usa il simbolo >= anche per il diametro tubo quando \u00e8 noto solo il minimo', () => {
    const out = buildWelderDesignation({
      welding_process: '141',
      pipe_diameter_min_mm: 60,
    });
    expect(out).toBe('141 D\u226560');
  });

  it('accetta filler_material (colonna form/DB) oltre a filler_material_group', () => {
    const out = buildWelderDesignation({
      welding_process: '135',
      product_type: 'T',
      joint_type: 'BW',
      filler_material: 'FM1',
      thickness_min_mm: 3,
      thickness_max_mm: 14.22,
      position_range: 'PA, PC',
      weld_details: 'ss nb',
    });
    expect(out).toBe('135 T BW FM1 t3-14.22 PA/PC ss nb');
  });
});

describe('parseWelderQualificationDesignation (FE)', () => {
  it('distingue FW t-prova da BW s-prova', () => {
    const fw = parseWelderQualificationDesignation('ISO 9606-1: 135 P FW FM1 t8 PB ss mb');
    expect(fw.joint_type).toBe('FW');
    expect(fw.thickness_t_test_mm).toBe(8);
    const bw = parseWelderQualificationDesignation('ISO 9606-1: 141 P BW FM1 s10 PA ss nb');
    expect(bw.joint_type).toBe('BW');
    expect(bw.thickness_s_test_mm).toBe(10);
  });

  it('resolvePrintedDesignation conserva la riga certificato', () => {
    expect(resolvePrintedDesignation('ISO 9606-1: 135 P FW FM1 t8 PB', { welding_process: '138' }))
      .toBe('ISO 9606-1: 135 P FW FM1 t8 PB');
  });
});
