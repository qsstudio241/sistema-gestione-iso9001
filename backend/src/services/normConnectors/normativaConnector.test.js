/**
 * @jest-environment node
 */

jest.mock('./publicLawHttp', () => ({
  fetchPage: jest.fn(),
  BROWSER_HEADERS: {},
  FETCH_TIMEOUT_MS: 8000,
}));

const { fetchPage } = require('./publicLawHttp');
const {
  parseItalianActReference,
  isItalianPublicLaw,
  buildVigenteUrl,
  buildArticleUrl,
  parseNormattivaHtml,
  parseArticleText,
  getClauseText,
  getFullNorm,
} = require('./normativaConnector');

const ARTICLE_FRAGMENT = `
  <div id="containerTesto">
    <div class="wrapper_pdf bodyTesto">
      <span>Art. 28</span><br>
      Oggetto della valutazione dei rischi<br>
      1. La valutazione di cui all'articolo 17, comma 1, lettera a), deve riguardare
      tutti i rischi per la sicurezza e la salute dei lavoratori.
    </div>
  </div>`;

const SHELL_HTML = '<!DOCTYPE html><html><head><title>Normattiva</title></head><body><div id="quickLinks"></div></body></html>';

describe('normativaConnector', () => {
  afterEach(() => {
    fetchPage.mockReset();
  });

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

    it('parses DB code format DLgs_81_2008 (underscore)', () => {
      const p = parseItalianActReference('DLgs_81_2008');
      expect(p).toEqual({
        urnType: 'decreto.legislativo',
        number: '81',
        year: '2008',
      });
    });

    it('parses DB code format DLgs_152_2006 (underscore)', () => {
      const p = parseItalianActReference('DLgs_152_2006');
      expect(p?.number).toBe('152');
      expect(p?.year).toBe('2006');
    });
  });

  describe('isItalianPublicLaw', () => {
    it('detects decreto legislativo in code', () => {
      expect(isItalianPublicLaw('Decreto Legislativo 81/2008', '')).toBe(true);
    });

    it('detects DB code format', () => {
      expect(isItalianPublicLaw('DLgs_81_2008', '')).toBe(true);
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

  describe('buildArticleUrl', () => {
    it('builds article permalink with ~artNN', () => {
      const url = buildArticleUrl(
        { urnType: 'decreto.legislativo', number: '81', year: '2008' },
        'art.28'
      );
      expect(url).toContain('normattiva.it');
      expect(url).toContain('art28');
      expect(url).toContain('2008');
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

  describe('parseArticleText', () => {
    it('extracts text from bodyTesto fragment', () => {
      const text = parseArticleText(ARTICLE_FRAGMENT);
      expect(text).toContain('Art. 28');
      expect(text).toContain('valutazione');
    });

    it('returns null for JS shell page (no bodyTesto)', () => {
      expect(parseArticleText(SHELL_HTML)).toBeNull();
    });

    it('returns null for empty/invalid input', () => {
      expect(parseArticleText('')).toBeNull();
      expect(parseArticleText(null)).toBeNull();
    });
  });

  describe('getClauseText', () => {
    it('returns article text when fragment is available', async () => {
      fetchPage.mockResolvedValue({ statusCode: 200, body: ARTICLE_FRAGMENT });
      const res = await getClauseText('DLgs_81_2008', 'art.28');
      expect(res).not.toBeNull();
      expect(res.source).toBe('normattiva');
      expect(res.sourceUrl).toContain('art28');
      expect(res.text).toContain('valutazione');
      expect(res.fullRef).toBe('DLgs_81_2008 art.28');
    });

    it('returns null (no fabrication) when page is JS shell', async () => {
      fetchPage.mockResolvedValue({ statusCode: 200, body: SHELL_HTML });
      const res = await getClauseText('DLgs_81_2008', 'art.28');
      expect(res).toBeNull();
    });

    it('returns null on HTTP error', async () => {
      fetchPage.mockResolvedValue({ statusCode: 500, body: '' });
      const res = await getClauseText('DLgs_81_2008', 'art.28');
      expect(res).toBeNull();
    });

    it('returns null for non-italian standard code without fetching', async () => {
      const res = await getClauseText('ISO_9001_2015', '8.4.2');
      expect(res).toBeNull();
      expect(fetchPage).not.toHaveBeenCalled();
    });

    it('returns null when clauseRef has no article number', async () => {
      const res = await getClauseText('DLgs_81_2008', 'premessa');
      expect(res).toBeNull();
      expect(fetchPage).not.toHaveBeenCalled();
    });

    it('degrades gracefully on network error', async () => {
      fetchPage.mockRejectedValue(new Error('fetch timeout'));
      const res = await getClauseText('DLgs_81_2008', 'art.28');
      expect(res).toBeNull();
    });
  });

  describe('getFullNorm', () => {
    it('returns empty array (live extraction requires seed)', async () => {
      const res = await getFullNorm('DLgs_81_2008');
      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(0);
    });
  });
});
