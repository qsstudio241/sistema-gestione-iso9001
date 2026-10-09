/**
 * Test L1 — anteprima FE designazione qualifica saldatore (mirror di
 * backend/src/utils/weldingDesignation.test.js).
 */
import { describe, it, expect } from 'vitest';
import {
  buildWelderDesignation,
  parseWelderQualificationDesignation,
  resolvePrintedDesignation,
  resolveTestThicknessByJoint,
} from '../utils/weldingDesignation.js';

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

  it('BW con token t: spessore depositato in s; FW con t resta in t', () => {
    const bw = parseWelderQualificationDesignation('ISO 9606-1: 141 P BW FM1 t10 D60 PA ss nb');
    expect(bw.thickness_s_test_mm).toBe(10);
    expect(bw.thickness_t_test_mm).toBeNull();
    const fw = parseWelderQualificationDesignation('ISO 9606-1: 135 P FW FM1 t8 PB ss mb');
    expect(fw.thickness_t_test_mm).toBe(8);
    expect(fw.thickness_s_test_mm).toBeNull();
  });

  it('certificato con ENTRAMBI s e t: salva entrambi', () => {
    const bw = parseWelderQualificationDesignation('ISO 9606-1: 141 P BW FM1 s10 t12 PA ss nb');
    expect(bw.thickness_s_test_mm).toBe(10);
    expect(bw.thickness_t_test_mm).toBe(12);
  });

  it('resolveTestThicknessByJoint: nessuna deduzione se il giunto e\' sconosciuto', () => {
    expect(resolveTestThicknessByJoint({ joint_type: 'BW', t: 10 })).toEqual({ s: 10, t: null });
    expect(resolveTestThicknessByJoint({ joint_type: 'FW', s: 8 })).toEqual({ s: null, t: 8 });
    expect(resolveTestThicknessByJoint({ joint_type: null, t: 10 })).toEqual({ s: null, t: 10 });
  });

  it('resolvePrintedDesignation conserva la riga certificato', () => {
    expect(resolvePrintedDesignation('ISO 9606-1: 135 P FW FM1 t8 PB', { welding_process: '138' }))
      .toBe('ISO 9606-1: 135 P FW FM1 t8 PB');
  });

  it('ignora la sola edizione in testata', () => {
    expect(parseWelderQualificationDesignation('ISO 9606-1:2017\nNome MARIO')).toBeNull();
  });

  it('con testata edizione + riga §11 prende la designazione stampata', () => {
    const parsed = parseWelderQualificationDesignation([
      'ISO 9606-1:2017',
      'ISO 9606-1: 135S P FW FM1 S t12-12 PB ml',
    ].join('\n'));
    expect(parsed.joint_type).toBe('FW');
    expect(parsed.welding_process_test).toBe('135');
    expect(parsed.qualification_designation).toMatch(/135S P FW/);
    expect(parsed.qualification_designation).not.toMatch(/2017/);
    expect(parsed.weld_details).toBe('ml');
    expect(parsed.transfer_mode).toBe('S');
  });

  it.each([
    'D48,25 PB sl',
    'D 48,25 PB sl',
    '\u00D848,25 PB sl',
    'D48.25 PB sl',
  ])('diametro con virgola decimale: legge 48.25 da "%s"', (tail) => {
    const parsed = parseWelderQualificationDesignation(`ISO 9606-1: 141 T FW FM5 S t3-10 ${tail}`);
    expect(parsed.pipe_diameter_test_mm).toBe(48.25);
    expect(parsed.welding_position_test).toBe('PB');
    expect(parsed.weld_details).toBe('sl');
  });

  it('mantiene ; e virgole tra campi veri come separatori', () => {
    const parsed = parseWelderQualificationDesignation('ISO 9606-1: 135 P FW FM1; t8, PB, ss mb');
    expect(parsed.thickness_t_test_mm).toBe(8);
    expect(parsed.weld_details).toBe('ss mb');
  });
});

describe('parseWelderQualificationDesignation (FE): "t3-10" sono due spessori di prova', () => {
  it('FW: t di prova 3, elenco informativo [3, 10], mai min/max di validità', () => {
    const parsed = parseWelderQualificationDesignation('ISO 9606-1: 141 T FW FM5 S t3-10 D48,25 PB sl');
    expect(parsed.thickness_t_test_mm).toBe(3);
    expect(parsed.thickness_s_test_mm).toBeNull();
    expect(parsed.thickness_test_values).toEqual([3, 10]);
    expect(parsed).not.toHaveProperty('thickness_min_mm');
    expect(parsed).not.toHaveProperty('thickness_max_mm');
  });

  it('BW: il 10 non finisce in s di prova', () => {
    const parsed = parseWelderQualificationDesignation('ISO 9606-1: 141 P BW FM1 t3-10 PA ss nb');
    expect(parsed.thickness_s_test_mm).toBe(3);
    expect(parsed.thickness_t_test_mm).toBeNull();
    expect(parsed.thickness_test_values).toEqual([3, 10]);
  });
});
