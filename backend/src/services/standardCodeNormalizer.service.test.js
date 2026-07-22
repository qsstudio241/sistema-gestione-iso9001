/**
 * @jest-environment node
 */

const {
  parseStandardCode,
  normalizeStandardCodeForStorage,
  buildCatalogSearchVariants,
} = require('./standardCodeNormalizer.service');

describe('parseStandardCode', () => {
  it('ISO/TR con underscore AI', () => {
    const p = parseStandardCode('ISO_TR_15608_2013');
    expect(p).toMatchObject({
      docType: 'TR',
      number: '15608',
      year: 2013,
      canonical: 'ISO/TR 15608:2013',
    });
  });

  it('UNI EN ISO con parte', () => {
    const p = parseStandardCode('UNI_EN_ISO_15614_1_2019');
    expect(p.canonical).toBe('UNI EN ISO 15614-1:2019');
    expect(p.year).toBe(2019);
  });

  it('ISO con parte e anno', () => {
    const p = parseStandardCode('ISO_9606_1_2017');
    expect(p.canonical).toBe('ISO 9606-1:2017');
  });

  it('formato già canonico', () => {
    const p = parseStandardCode('BS EN ISO 9606-1:2017');
    expect(p.canonical).toBe('BS EN ISO 9606-1:2017');
  });

  it('usa edition_year se assente nel codice', () => {
    const p = parseStandardCode('ISO_TR_15608', 2013);
    expect(p.canonical).toBe('ISO/TR 15608:2013');
  });
});

describe('normalizeStandardCodeForStorage', () => {
  it('converte underscore in formato catalogo', () => {
    expect(normalizeStandardCodeForStorage('ISO_TR_15608_2013')).toBe('ISO/TR 15608:2013');
    expect(normalizeStandardCodeForStorage('UNI_EN_ISO_9001_2015')).toBe('UNI EN ISO 9001:2015');
  });
});

describe('buildCatalogSearchVariants', () => {
  it('include varianti progressive per ISO/TR', () => {
    const v = buildCatalogSearchVariants('ISO_TR_15608_2013', 2013, 'ISO');
    expect(v[0]).toBe('ISO/TR 15608:2013');
    expect(v).toContain('ISO TR 15608:2013');
    expect(v).toContain('ISO/TR 15608');
    expect(v).toContain('ISO 15608:2013');
    expect(v).toContain('15608');
  });

  it('non include underscore', () => {
    const v = buildCatalogSearchVariants('ISO_TR_15608_2013');
    expect(v.some((x) => x.includes('_'))).toBe(false);
  });
});
