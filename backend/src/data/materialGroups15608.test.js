/**
 * @jest-environment node
 */
const {
  normalizeMaterialGroupCode,
  inferMaterialGroupFromText,
  findMaterialGroup,
  getMaterialGroupSelectOptions,
} = require('../data/materialGroups15608');

describe('materialGroups15608', () => {
  it('normalizza 10.3 senza troncare a 10', () => {
    expect(normalizeMaterialGroupCode('10.3')).toBe('10.3');
  });

  it('inferisce S355 come 1.2', () => {
    expect(inferMaterialGroupFromText('qualifica su S355')).toBe('1.2');
  });

  describe('gruppi padre (feedback cliente Studio Mason)', () => {
    it('getMaterialGroupSelectOptions include il gruppo padre oltre ai sottogruppi', () => {
      const opts = getMaterialGroupSelectOptions({ families: ['steel'] });
      expect(opts.some((o) => o.value === '8')).toBe(true);
      expect(opts.some((o) => o.value === '8.1')).toBe(true);
      expect(opts.some((o) => o.value === '8.2')).toBe(true);
    });

    it('findMaterialGroup risolve il gruppo padre come voce sintetica', () => {
      const g = findMaterialGroup('8');
      expect(g?.isParentGroup).toBe(true);
      expect(g?.childCodes).toEqual(expect.arrayContaining(['8.1', '8.2', '8.3']));
    });

    it('normalizeMaterialGroupCode distingue "1" da "11"', () => {
      expect(normalizeMaterialGroupCode('Gruppo 1')).toBe('1');
      expect(normalizeMaterialGroupCode('Gruppo 11')).toBe('11');
    });
  });
});
