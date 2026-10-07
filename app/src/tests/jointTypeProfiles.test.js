import { describe, it, expect } from 'vitest';
import {
  getJointTypeProfile,
  listJointTypeProfileKeys,
  uses9606DimensionalBlock,
  getVisibleFieldKeys,
  resolveProfileStandard,
  JOINT_TYPE_PROFILES,
  JOINT_TYPE_PROFILES_BY_STANDARD,
} from '../data/jointTypeProfiles.js';

describe('jointTypeProfiles (FE)', () => {
  it('BW vs FW: spessore di prova diverso', () => {
    expect(listJointTypeProfileKeys()).toEqual(['BW', 'FW']);
    expect(getJointTypeProfile('BW').testThicknessKey).toBe('thickness_s_test_mm');
    expect(getJointTypeProfile('FW').testThicknessKey).toBe('thickness_t_test_mm');
  });

  it('date sempre elencate in coda, indipendenti dal profilo', () => {
    const fw = getVisibleFieldKeys({ jointType: 'FW', qualificationType: 'Saldatore ISO 9606-1' });
    const bw = getVisibleFieldKeys({ jointType: 'BW', qualificationType: 'Saldatore ISO 9606-1' });
    expect(fw.datesLast[0]).toBe('exam_date');
    expect(fw.datesLast).toEqual(bw.datesLast);
    expect(uses9606DimensionalBlock('Operatore ISO 14732')).toBe(false);
  });
});

describe('jointTypeProfiles (FE) — non regressione ISO 9606-1 (BW = s depositato, FW = t)', () => {
  it('il default senza norma è 9606-1 e non cambia', () => {
    const bw = getJointTypeProfile('BW');
    expect(bw.standard).toBe('ISO 9606-1');
    expect(bw.testThicknessKey).toBe('thickness_s_test_mm');
    expect(bw.thicknessKind).toBe('deposited_s');
    expect(bw.validityTable).toBe('6');
    expect(bw.testThicknessLabel).toBe('Spessore depositato s — prova (mm)');
    const fw = getJointTypeProfile('FW');
    expect(fw.testThicknessKey).toBe('thickness_t_test_mm');
    expect(fw.validityTable).toBe('8');
    expect(getJointTypeProfile('BW', { standard: '9606-1' })).toBe(bw);
    expect(getJointTypeProfile('BW', { standard: 'ISO 9606-1:2017' })).toBe(bw);
    Object.values(JOINT_TYPE_PROFILES).forEach((p) => expect(p.hiddenCommonKeys).toBeUndefined());
  });

  it.each(['Saldatore ISO 9606-1', 'ISO 9606-1:2017', '9606'])(
    'getVisibleFieldKeys (%s): BW usa s e nasconde t, trasferimento visibile',
    (qualificationType) => {
      const bw = getVisibleFieldKeys({ jointType: 'BW', productType: 'T', qualificationType });
      expect(bw.profile.testThicknessKey).toBe('thickness_s_test_mm');
      expect(bw.keys).toContain('thickness_s_test_mm');
      expect(bw.keys).not.toContain('thickness_t_test_mm');
      expect(bw.keys).toContain('transfer_mode');
      const fw = getVisibleFieldKeys({ jointType: 'FW', productType: 'T', qualificationType });
      expect(fw.keys).toContain('thickness_t_test_mm');
      expect(fw.keys).not.toContain('thickness_s_test_mm');
    },
  );
});

describe('jointTypeProfiles (FE) — variante ISO 9606-2 (spessore t del materiale)', () => {
  it('resolveProfileStandard riconosce 9606-2', () => {
    ['Saldatore ISO 9606-2', 'EN ISO 9606-2:2004', '9606-2'].forEach((t) => expect(resolveProfileStandard(t)).toBe('9606-2'));
    ['Saldatore ISO 9606-1', 'ISO 9606-3', null, ''].forEach((t) => expect(resolveProfileStandard(t)).toBe('9606-1'));
  });

  it('BW 9606-2 usa t (Tab. 3), FW 9606-2 usa t (Tab. 5)', () => {
    const bw = getJointTypeProfile('BW', { standard: '9606-2' });
    expect(bw.testThicknessKey).toBe('thickness_t_test_mm');
    expect(bw.thicknessKind).toBe('material_t');
    expect(bw.validityTable).toBe('3');
    expect(bw.standard).toBe('ISO 9606-2');
    const fw = getJointTypeProfile('FW', { standard: 'ISO 9606-2' });
    expect(fw.testThicknessKey).toBe('thickness_t_test_mm');
    expect(fw.validityTable).toBe('5');
    expect(Object.keys(JOINT_TYPE_PROFILES_BY_STANDARD['9606-2'])).toEqual(listJointTypeProfileKeys());
  });

  it('getVisibleFieldKeys con qualificationType 9606-2: BW mostra t, nasconde s e il trasferimento', () => {
    const bw = getVisibleFieldKeys({ jointType: 'BW', productType: 'T', qualificationType: 'Saldatore ISO 9606-2' });
    expect(bw.dimensionalEnabled).toBe(true);
    expect(bw.profile.testThicknessKey).toBe('thickness_t_test_mm');
    expect(bw.keys).toContain('thickness_t_test_mm');
    expect(bw.keys).not.toContain('thickness_s_test_mm');
    expect(bw.keys).not.toContain('transfer_mode');
  });
});

