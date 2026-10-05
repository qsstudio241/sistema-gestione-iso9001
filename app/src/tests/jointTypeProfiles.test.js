import { describe, it, expect } from 'vitest';
import {
  getJointTypeProfile,
  listJointTypeProfileKeys,
  uses9606DimensionalBlock,
  getVisibleFieldKeys,
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
