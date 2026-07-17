/**
 * @jest-environment node
 */
const {
  normalizeMaterialGroupCode,
  inferMaterialGroupFromText,
} = require('../data/materialGroups15608');

describe('materialGroups15608', () => {
  it('normalizza 10.3 senza troncare a 10', () => {
    expect(normalizeMaterialGroupCode('10.3')).toBe('10.3');
  });

  it('inferisce S355 come 1.2', () => {
    expect(inferMaterialGroupFromText('qualifica su S355')).toBe('1.2');
  });
});
