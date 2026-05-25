/**
 * @jest-environment node
 */

const {
  parseItalianActReference,
  isItalianPublicLaw,
  buildVigenteUrl,
  parseNormattivaHtml,
} = require('./normativaConnector');

describe('normativaConnector', () => {
  describe('parseItalianActReference', () => {
    it('parses D.Lgs. 81/2008', () => {
      const p = parseItalianActReference('D.Lgs. 81/2008');
      expect(p).toEqual({
        urnType: 'decreto.legislativo',
        number: '81',
        year: '2008',
      });
    });

    it('parses Legge 152/2006', () => {
      const p = parseItalianActReference('Legge 152/2006');
      expect(p?.urnType).toBe('legge');
      expect(p?.number).toBe('152');
    });
  });

  describe('isItalianPublicLaw', () => {
    it('detects decreto legislativo in code', () => {
      expect(isItalianPublicLaw('Decreto Legislativo 81/2008', '')).toBe(true);
    });

    it('returns false for ISO code', () => {
      expect(isItalianPublicLaw('ISO 9001:2015', 'ISO')).toBe(false);
    });
  });

  describe('buildVigenteUrl', () => {
    it('builds Normattiva URN with !vig=', () => {
      const url = buildVigenteUrl({
        urnType: 'decreto.legislativo',
        number: '81',
        year: '2008',
      });
      expect(url).toContain('normattiva.it');
      expect(url).toContain('decreto.legislativo');
      expect(url).toContain('!vig=');
    });
  });

  describe('parseNormattivaHtml', () => {
    it('detects superseded act', () => {
      const html = '<div>Atto sostituito dal seguente: Legge 123/2020</div>';
      const r = parseNormattivaHtml(html);
      expect(r?.status).toBe('superseded');
    });

    it('detects active act from title', () => {
      const html = '<title>DECRETO LEGISLATIVO 9 aprile 2008, n. 81 - Normattiva</title>';
      const r = parseNormattivaHtml(html);
      expect(r?.status).toBe('active');
    });

    it('detects abrogated act', () => {
      const html = '<p>Testo abrogato dal presente decreto</p>';
      const r = parseNormattivaHtml(html);
      expect(r?.status).toBe('withdrawn');
    });
  });
});
