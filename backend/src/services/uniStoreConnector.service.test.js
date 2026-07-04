/**
 * @jest-environment node
 */

const {
  codeToUrlKey,
  mapUniStatusIt,
  scoreCandidate,
} = require('./uniStoreConnector.service');

describe('uniStoreConnector', () => {
  it('codeToUrlKey da codice catalogo', () => {
    expect(codeToUrlKey('UNI EN ISO 15614-1:2019')).toBe('uni-en-iso-15614-1-2019');
    expect(codeToUrlKey('ISO/TR 15608:2013')).toBe('iso-tr-15608-2013');
  });

  it('mapUniStatusIt', () => {
    expect(mapUniStatusIt('IN VIGORE')).toBe('active');
    expect(mapUniStatusIt('RITIRATA CON SOSTITUZIONE')).toBe('withdrawn');
  });

  it('scoreCandidate preferisce match esatto', () => {
    const high = scoreCandidate('UNI EN ISO 15614-1:2019', 2019, null, {
      code: 'UNI EN ISO 15614-1:2019',
      titleIt: 'Prove di qualificazione',
    });
    const low = scoreCandidate('UNI EN ISO 15614-1:2019', 2019, null, {
      code: 'ISO 15618-1:2016',
      titleIt: 'altro',
    });
    expect(high).toBeGreaterThan(low);
    expect(high).toBeGreaterThanOrEqual(50);
  });
});
