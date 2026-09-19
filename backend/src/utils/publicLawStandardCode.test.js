/**
 * Codice atto pubblico allineato al seed norm_requirements (legislation_seed).
 */

const {
  generateStandardCode,
  codeAliases,
  expandLookupCodes,
  isPublicLawChunkCode,
} = require('./publicLawStandardCode');

describe('publicLawStandardCode', () => {
  it('URN con data usa il codice già nel seed, non urn_nir né D_Lgs_81_08', () => {
    const code = generateStandardCode('urn:nir:stato:decreto.legislativo:2008-04-09;81');
    expect(code).toBe('DLgs_81_2008');
    expect(code).not.toMatch(/^urn_nir/);
    expect(code).not.toBe('D_Lgs_81_08');
  });

  it('URN senza data dello stesso atto resta sul codice seed', () => {
    expect(generateStandardCode('urn:nir:stato:decreto.legislativo:2008;81'))
      .toBe('DLgs_81_2008');
    expect(generateStandardCode('urn:nir:stato:decreto.legislativo:2006-04-03;152'))
      .toBe('DLgs_152_2006');
  });

  it('atto assente dal seed non inventa una forma corta a due cifre', () => {
    expect(generateStandardCode('urn:nir:stato:legge:2000;300')).toBe('Legge_300_2000');
    expect(generateStandardCode('urn:nir:stato:decreto.legge:2018-10-23;119'))
      .toBe('D_L_119_2018');
  });

  it('gli alias collegano il codice seed alle forme che il lookup storico non trovava', () => {
    const aliases = codeAliases('DLgs_81_2008');
    expect(aliases).toEqual(expect.arrayContaining([
      'DLgs_81_2008',
      'D_Lgs_81_08',
      'D_Lgs_81_2008',
      'urn_nir_stato_decreto_legislativo_2008_04_09_81',
    ]));
    expect(expandLookupCodes('D_Lgs_81_08')).toContain('DLgs_81_2008');
  });

  it('non tratta una ISO o una UNI come decreto', () => {
    expect(isPublicLawChunkCode('DLgs_81_2008')).toBe(true);
    expect(isPublicLawChunkCode('urn_nir_stato_decreto_legislativo_2008_81')).toBe(true);
    expect(isPublicLawChunkCode('ISO_9001_2015')).toBe(false);
    expect(isPublicLawChunkCode('UNI_EN_ISO_15614_1')).toBe(false);
    expect(expandLookupCodes('ISO_9001_2015')).toEqual(
      expect.arrayContaining(['ISO_9001_2015', 'ISO_9001'])
    );
    expect(expandLookupCodes('ISO_9001_2015').some((code) => code.startsWith('DLgs_'))).toBe(false);
  });
});
