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

describe('parseStandardCode — riferimenti legge italiani (regressione bug "81-2008:2008")', () => {
  it('D.Lgs. 81/2008 resta invariato, anche passando edition_year (bug storico)', () => {
    const p = parseStandardCode('D.Lgs. 81/2008', 2008);
    expect(p.canonical).toBe('D.Lgs. 81/2008');
    expect(p.year).toBe(2008);
    expect(p.canonical).not.toContain('81-2008');
    expect(p.canonical).not.toContain(':2008');
  });

  it('D.Lgs. 81/2008 resta invariato senza edition_year esplicito', () => {
    const p = parseStandardCode('D.Lgs. 81/2008');
    expect(p.canonical).toBe('D.Lgs. 81/2008');
  });

  it('Legge, D.P.R., D.M., Circolare — pattern numero/anno riconosciuti', () => {
    expect(parseStandardCode('Legge 152/2006').canonical).toBe('Legge 152/2006');
    expect(parseStandardCode('D.P.R. 151/2011').canonical).toBe('D.P.R. 151/2011');
    expect(parseStandardCode('D.M. 37/2008').canonical).toBe('D.M. 37/2008');
    expect(parseStandardCode('Circolare 68/2023').canonical).toBe('Circolare 68/2023');
  });

  it('normalizza separatore da nome file (spazi/underscore invece di "/")', () => {
    const p = parseStandardCode('DLgs 81 2008');
    expect(p.canonical).toBe('DLgs 81/2008');
    expect(p.year).toBe(2008);
  });

  it('non interferisce con i codici tecnici ISO/UNI/EN esistenti', () => {
    expect(parseStandardCode('ISO 9001:2015').canonical).toBe('ISO 9001:2015');
    expect(parseStandardCode('UNI_EN_ISO_9001_2015').canonical).toBe('UNI EN ISO 9001:2015');
    expect(parseStandardCode('BS EN ISO 9606-1:2017').canonical).toBe('BS EN ISO 9606-1:2017');
  });
});

describe('normalizeStandardCodeForStorage', () => {
  it('converte underscore in formato catalogo', () => {
    expect(normalizeStandardCodeForStorage('ISO_TR_15608_2013')).toBe('ISO/TR 15608:2013');
    expect(normalizeStandardCodeForStorage('UNI_EN_ISO_9001_2015')).toBe('UNI EN ISO 9001:2015');
  });

  it('preserva D.Lgs. 81/2008 anche con edition_year (era "81-2008:2008")', () => {
    expect(normalizeStandardCodeForStorage('D.Lgs. 81/2008', 2008)).toBe('D.Lgs. 81/2008');
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

  it('D.Lgs. 81/2008 genera varianti coerenti (nessun "81-2008")', () => {
    const v = buildCatalogSearchVariants('D.Lgs. 81/2008', 2008, 'IT');
    expect(v[0]).toBe('D.Lgs. 81/2008');
    expect(v).toContain('81/2008');
    expect(v.some((x) => x.includes('81-2008'))).toBe(false);
  });
});
