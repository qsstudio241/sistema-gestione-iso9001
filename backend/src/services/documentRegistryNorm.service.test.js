/**
 * @jest-environment node
 *
 * Test L1  -  documentRegistryNorm.service (slice R3)
 * Contratto type_specific_data allineato tra upload bulk e form manuale.
 */

const {
  NORM_TSD_CANONICAL_KEYS,
  NORM_TITLE_MAX_LEN,
  buildNormTypeSpecificData,
  serializeNormTypeSpecificData,
  normalizeValidityStatus,
  mergeMissingNormTypeSpecificData,
  clampNormTitle,
  guessStandardCodeFromFilename,
} = require('./documentRegistryNorm.service');

describe('buildNormTypeSpecificData  -  metadati upload bulk (AI)', () => {
  it('mappa abstract ? scope_summary e campi canonici', () => {
    const result = buildNormTypeSpecificData({
      standard_code: 'ISO_9606_1_2017',
      norm_title: 'Qualification testing of welders',
      issuing_body: 'ISO',
      edition_year: 2017,
      language: 'en',
      abstract: 'Requisiti per qualificazione saldatori.',
    });

    expect(result).toMatchObject({
      standard_code: 'ISO 9606-1:2017',
      norm_title: 'Qualification testing of welders',
      issuing_body: 'ISO',
      edition_year: 2017,
      language: 'en',
      scope_summary: 'Requisiti per qualificazione saldatori.',
      validity_status: 'da_verificare',
    });
  });

  it('restituisce null senza standard_code', () => {
    expect(buildNormTypeSpecificData({ norm_title: 'Solo titolo' })).toBeNull();
    expect(serializeNormTypeSpecificData({ norm_title: 'Solo titolo' })).toBeNull();
  });

  it('serializza JSON valido per SQL', () => {
    const json = serializeNormTypeSpecificData({
      standard_code: 'UNI_EN_ISO_9001_2015',
      issuing_body: 'UNI',
      edition_year: '2015',
    });
    const parsed = JSON.parse(json);
    expect(parsed.standard_code).toBe('UNI EN ISO 9001:2015');
    expect(parsed.edition_year).toBe(2015);
    expect(parsed.validity_status).toBe('da_verificare');
  });
});

describe('buildNormTypeSpecificData  -  allineamento form manuale', () => {
  it('accetta tutti i campi dello schema norma', () => {
    const payload = {
      standard_code: 'BS EN ISO 9606-1:2017',
      norm_title: 'Qualification testing of welders',
      issuing_body: 'BSI',
      edition_year: 2017,
      supersedes: 'ISO 9606-1:2013',
      validity_status: 'vigente',
      language: 'en',
      scope_summary: 'Ambito saldatura',
      ics_code: '25.160.01',
      technical_committee: 'ISO/TC 44',
      is_harmonized: true,
    };

    const result = buildNormTypeSpecificData(payload);
    expect(result).toEqual(payload);
  });

  it('include campi vigore da lookup/job (R1/R2)', () => {
    const result = buildNormTypeSpecificData({
      standard_code: 'D.Lgs. 81/2008',
      issuing_body: 'IT',
      validity_status: 'vigente',
      last_validity_check: '2026-05-25T10:00:00.000Z',
      validity_check_url: 'https://www.normattiva.it/...',
      superseded_by: null,
    });

    expect(result.standard_code).toBe('D.Lgs. 81/2008');
    expect(result.last_validity_check).toBe('2026-05-25T10:00:00.000Z');
    expect(result.validity_check_url).toBe('https://www.normattiva.it/...');
    expect(result).not.toHaveProperty('superseded_by');
  });

  it('preserva D.Lgs. 81/2008 anche con edition_year esplicito (bug "81-2008:2008")', () => {
    const result = buildNormTypeSpecificData({
      standard_code: 'D.Lgs. 81/2008',
      issuing_body: 'IT',
      edition_year: 2008,
    });

    expect(result.standard_code).toBe('D.Lgs. 81/2008');
    expect(result.edition_year).toBe(2008);
  });

  it('tronca scope_summary oltre 500 caratteri', () => {
    const longText = 'x'.repeat(600);
    const result = buildNormTypeSpecificData({
      standard_code: 'ISO 1',
      scope_summary: longText,
    });
    expect(result.scope_summary).toHaveLength(500);
  });

  it('tronca norm_title oltre il limite DB (titoli UNI lunghi)', () => {
    const longTitle = `${'Qualificazione procedure di saldatura per materiali metallici - '.repeat(12)}fine`;
    const result = buildNormTypeSpecificData({
      standard_code: 'UNI_EN_ISO_15614_1_2019',
      norm_title: longTitle,
    });
    expect(result.norm_title).toHaveLength(NORM_TITLE_MAX_LEN);
    expect(clampNormTitle(longTitle)).toHaveLength(NORM_TITLE_MAX_LEN);
  });
});

describe('normalizeValidityStatus', () => {
  it('mappa rilasciato ? vigente', () => {
    expect(normalizeValidityStatus('rilasciato')).toBe('vigente');
  });

  it('conserva stati vigore validi', () => {
    expect(normalizeValidityStatus('superata')).toBe('superata');
    expect(normalizeValidityStatus('in_revisione')).toBe('in_revisione');
  });

  it('default da_verificare per valori sconosciuti', () => {
    expect(normalizeValidityStatus('unknown')).toBe('da_verificare');
    expect(normalizeValidityStatus(null)).toBe('da_verificare');
  });

  it('vigente se esplicitamente impostato', () => {
    expect(normalizeValidityStatus('vigente')).toBe('vigente');
  });
});

describe('mergeMissingNormTypeSpecificData — backfill R6', () => {
  it('copia campi mancanti da norm_document_sources senza sovrascrivere', () => {
    const existing = JSON.stringify({
      standard_code: 'ISO_9001_2015',
      norm_title: 'Titolo esistente',
    });
    const source = {
      standard_code: 'ISO_9001_2015',
      norm_title: 'Titolo da sources',
      issuing_body: 'ISO',
      validity_status: 'superata',
      last_validity_check: '2026-05-01T00:00:00.000Z',
    };

    const { merged, changed } = mergeMissingNormTypeSpecificData(existing, source);
    expect(changed).toBe(true);
    expect(merged.norm_title).toBe('Titolo esistente');
    expect(merged.issuing_body).toBe('ISO');
    expect(merged.validity_status).toBe('superata');
    expect(merged.last_validity_check).toBe('2026-05-01T00:00:00.000Z');
  });

  it('non modifica se tutti i campi già presenti', () => {
    const existing = serializeNormTypeSpecificData({
      standard_code: 'D.Lgs. 81/2008',
      issuing_body: 'IT',
      validity_status: 'vigente',
    });
    const { changed } = mergeMissingNormTypeSpecificData(existing, {
      standard_code: 'D.Lgs. 81/2008',
      issuing_body: 'UNI',
      validity_status: 'superata',
    });
    expect(changed).toBe(false);
  });

  it('riempie type_specific_data vuoto da source', () => {
    const { merged, changed } = mergeMissingNormTypeSpecificData(null, {
      standard_code: 'UNI_EN_ISO_9001_2015',
      edition_year: 2015,
    });
    expect(changed).toBe(true);
    expect(merged.standard_code).toBe('UNI EN ISO 9001:2015');
    expect(merged.edition_year).toBe(2015);
  });
});

describe('NORM_TSD_CANONICAL_KEYS', () => {
  it('include i campi attesi dal form manuale e dal job R1', () => {
    const required = [
      'standard_code',
      'edition_year',
      'issuing_body',
      'validity_status',
      'last_validity_check',
      'validity_check_url',
      'superseded_by',
    ];
    required.forEach((key) => {
      expect(NORM_TSD_CANONICAL_KEYS).toContain(key);
    });
  });
});

describe('guessStandardCodeFromFilename', () => {
  it('normalizza ISO-TR con trattini e suffisso Testo Inglese', () => {
    expect(
      guessStandardCodeFromFilename('ISO-TR-15608-2013-Testo Inglese.pdf'),
    ).toBe('ISO/TR 15608:2013');
  });

  it('normalizza UNI EN ISO con underscore anno', () => {
    expect(
      guessStandardCodeFromFilename('UNI EN ISO 15614-1_2019.pdf'),
    ).toBe('UNI EN ISO 15614-1:2019');
  });
});
