/**
 * normattiva.service.test.js
 * Test L1 per servizi Normattiva (con mock).
 */

global.fetch = jest.fn();

const normattivaApi = require('../src/services/normattivaApi.service');
const normattivaToMarkdown = require('../src/services/normattivaToMarkdown.service');

describe('NormattivaApi Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    normattivaApi.clearCache();
  });

  describe('searchNorm', () => {
    it('dovrebbe parsare D.Lgs. 81/2008 in URN', async () => {
      // Mock checkUrnExists
      global.fetch.mockResolvedValueOnce({ ok: true });

      const results = await normattivaApi.searchNorm('D.Lgs. 81/2008');

      expect(results).toHaveLength(1);
      expect(results[0].urn).toContain('decreto.legislativo');
      expect(results[0].urn).toContain('2008');
      expect(results[0].urn).toContain('81');
      expect(results[0].title).toBe('D.Lgs. 81/2008');
    });

    it('dovrebbe parsare D.L. 119/2018 in URN', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      const results = await normattivaApi.searchNorm('D.L. 119/2018');

      expect(results).toHaveLength(1);
      expect(results[0].urn).toContain('decreto.legge');
      expect(results[0].urn).toContain('2018');
      expect(results[0].urn).toContain('119');
    });

    it('dovrebbe parsare Legge 300/2000 in URN', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      const results = await normattivaApi.searchNorm('Legge 300/2000');

      expect(results).toHaveLength(1);
      expect(results[0].urn).toContain('legge');
      expect(results[0].urn).toContain('2000');
      expect(results[0].urn).toContain('300');
    });

    it('dovrebbe restituire array vuoto per query senza match', async () => {
      const results = await normattivaApi.searchNorm('XYZ 123/456');

      expect(results).toEqual([]);
    });

    it('dovrebbe usare la cache per query ripetute', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });

      const results1 = await normattivaApi.searchNorm('D.Lgs. 81/2008');
      const results2 = await normattivaApi.searchNorm('D.Lgs. 81/2008');

      expect(global.fetch).toHaveBeenCalledTimes(1); // Una sola chiamata reale
      expect(results1).toEqual(results2);
    });
  });

  describe('downloadNormXml', () => {
    const pageHtml = '<html><a href="/do/atto/caricaAKN?dataGU=20080430&amp;codiceRedaz=008G0104&amp;dataVigenza=20260919">XML</a></html>';
    const pageHeaders = {
      getSetCookie: () => ['JSESSIONID=abc; Path=/; HttpOnly'],
      get: () => null,
    };

    it('dovrebbe scaricare XML ufficiale Akoma, non la pagina !vig=', async () => {
      const mockXml = '<?xml version="1.0"?><akomaNtoso><article eId="art_1"><num>Art. 1.</num><heading>Ambito</heading><paragraph><num>1.</num><content><p>Testo articolo ufficiale abbastanza lungo per superare la soglia.</p></content></paragraph></article></akomaNtoso>';

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: pageHeaders,
          text: async () => pageHtml,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => [], get: () => 'text/xml' },
          text: async () => mockXml,
        });

      const xml = await normattivaApi.downloadNormXml('urn:nir:stato:decreto.legislativo:2008-04-09;81');

      expect(xml).toBe(mockXml);
      expect(xml.length).toBeGreaterThan(50);
      const firstUrl = global.fetch.mock.calls[0][0];
      const secondUrl = global.fetch.mock.calls[1][0];
      expect(firstUrl).not.toContain('!vig=');
      expect(secondUrl).toContain('/do/atto/caricaAKN');
      expect(secondUrl).toContain('codiceRedaz=008G0104');
      expect(global.fetch.mock.calls[1][1].headers.Cookie).toContain('JSESSIONID=abc');
      expect(global.fetch.mock.calls[1][1].headers.Referer).toContain('uri-res/N2Ls');
    });

    it('dovrebbe rifiutare HTML al posto dell XML', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: pageHeaders,
          text: async () => pageHtml,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { getSetCookie: () => [], get: () => 'text/html' },
          text: async () => '<!DOCTYPE html><html><body>menu portale</body></html>',
        });

      await expect(
        normattivaApi.downloadNormXml('urn:nir:stato:decreto.legislativo:2008-04-09;81')
      ).rejects.toThrow('non ha restituito XML');
    });

    it('dovrebbe lanciare errore per HTTP error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: { getSetCookie: () => [], get: () => null },
      });

      await expect(
        normattivaApi.downloadNormXml('urn:nir:stato:decreto.legislativo:9999;999')
      ).rejects.toThrow('HTTP 404');
    });

    it('dovrebbe lanciare errore per timeout', async () => {
      global.fetch.mockImplementationOnce(() =>
        Promise.reject({ name: 'AbortError' })
      );

      await expect(
        normattivaApi.downloadNormXml('urn:nir:stato:decreto.legislativo:2008;81')
      ).rejects.toThrow('Timeout');
    });
  });
});

describe('NormattivaToMarkdown Service', () => {
  describe('convertXmlToMarkdown', () => {
    it('dovrebbe convertire XML con articoli in Markdown', () => {
      const xml = `
        <nir>
          <articolo>
            <num>1</num>
            <rubrica>Ambito di applicazione</rubrica>
            <comma>Il presente decreto si applica...</comma>
          </articolo>
          <articolo>
            <num>2</num>
            <rubrica>Definizioni</rubrica>
            <comma>Ai fini del presente decreto si intende per...</comma>
          </articolo>
        </nir>
      `;

      const metadata = {
        urn: 'urn:nir:stato:decreto.legislativo:2008;81',
        title: 'D.Lgs. 81/2008 — Sicurezza sul lavoro',
        vigenza: 'Vigente',
      };

      const markdown = normattivaToMarkdown.convertXmlToMarkdown(xml, metadata);

      expect(markdown).toContain('# D.Lgs. 81/2008 — Sicurezza sul lavoro');
      expect(markdown).toContain('**Fonte**: Normattiva');
      expect(markdown).toContain('**URN**: urn:nir:stato:decreto.legislativo:2008;81');
      expect(markdown).toContain('### Art. 1 — Ambito di applicazione');
      expect(markdown).toContain('### Art. 2 — Definizioni');
      expect(markdown).toContain('Il presente decreto si applica');
    });

    it('dovrebbe convertire XML Akoma Ntoso (article/paragraph)', () => {
      const xml = `<?xml version="1.0"?><akomaNtoso>
        <article eId="art_28">
          <num>Art. 28.</num>
          <heading> Oggetto della valutazione dei rischi</heading>
          <paragraph eId="art_28__para_1">
            <num>1.</num>
            <content><p>La valutazione di cui all'articolo 17 deve riguardare tutti i rischi.</p></content>
          </paragraph>
        </article>
      </akomaNtoso>`;

      const markdown = normattivaToMarkdown.convertXmlToMarkdown(xml, {
        urn: 'urn:nir:stato:decreto.legislativo:2008-04-09;81',
        title: 'D.Lgs. 81/2008',
        vigenza: 'Vigente',
      });

      expect(markdown).toContain('### Art. 28 — Oggetto della valutazione dei rischi');
      expect(markdown).toContain('tutti i rischi');
      expect(markdown).not.toContain('## Testo completo');
      expect(markdown).not.toContain('<article');
    });

    it('dovrebbe gestire XML senza articoli strutturati (fallback testo grezzo)', () => {
      const xml = '<nir>Testo non strutturato del decreto</nir>';
      const metadata = {
        urn: 'urn:nir:stato:legge:2000;300',
        title: 'Legge 300/2000',
        vigenza: 'Vigente',
      };

      const markdown = normattivaToMarkdown.convertXmlToMarkdown(xml, metadata);

      expect(markdown).toContain('# Legge 300/2000');
      expect(markdown).toContain('## Testo completo');
      expect(markdown).toContain('Testo non strutturato del decreto');
    });
  });

  describe('generateMarkdownFilename', () => {
    it('dovrebbe generare filename per D.Lgs.', () => {
      const filename = normattivaToMarkdown.generateMarkdownFilename(
        'urn:nir:stato:decreto.legislativo:2008;81',
        'D.Lgs. 81/2008 — Sicurezza sul lavoro'
      );

      expect(filename).toBe('D_Lgs_81_2008_Sicurezza_sul_lavoro.md');
    });

    it('dovrebbe generare filename per D.L.', () => {
      const filename = normattivaToMarkdown.generateMarkdownFilename(
        'urn:nir:stato:decreto.legge:2018;119',
        'D.L. 119/2018 — Disposizioni urgenti'
      );

      expect(filename).toBe('D_L_119_2018_Disposizioni_urgenti.md');
    });

    it('dovrebbe generare filename per Legge', () => {
      const filename = normattivaToMarkdown.generateMarkdownFilename(
        'urn:nir:stato:legge:2000;300',
        'Legge 300/2000 — Statuto dei lavoratori'
      );

      expect(filename).toBe('Legge_300_2000_Statuto_dei_lavoratori.md');
    });

    it('dovrebbe limitare la lunghezza della descrizione', () => {
      const longTitle = 'D.Lgs. 152/2006 — Norme in materia ambientale con un titolo molto molto molto lungo che deve essere troncato';
      const filename = normattivaToMarkdown.generateMarkdownFilename(
        'urn:nir:stato:decreto.legislativo:2006;152',
        longTitle
      );

      expect(filename.length).toBeLessThan(60);
      expect(filename).toContain('D_Lgs_152_2006');
    });
  });

  describe('cleanXmlTags', () => {
    it('dovrebbe rimuovere tutti i tag XML', () => {
      const text = '<p>Testo <strong>con</strong> <em>markup</em></p>';
      const clean = normattivaToMarkdown.cleanXmlTags(text);

      expect(clean).toBe('Testo con markup');
      expect(clean).not.toContain('<');
      expect(clean).not.toContain('>');
    });

    it('dovrebbe decodificare entità HTML', () => {
      const text = 'L&apos;art. 5 &lt;comma 2&gt; &quot;prevede&quot; che...';
      const clean = normattivaToMarkdown.cleanXmlTags(text);

      expect(clean).toContain("L'art. 5");
      expect(clean).toContain('<comma 2>');
      expect(clean).toContain('"prevede"');
    });

    it('dovrebbe collassare spazi multipli', () => {
      const text = 'Testo    con     spazi      multipli';
      const clean = normattivaToMarkdown.cleanXmlTags(text);

      expect(clean).toBe('Testo con spazi multipli');
    });
  });
});

describe('Integration mock', () => {
  it('pipeline completa search → download → convert', async () => {
    const mockXml = `
      <nir>
        <articolo>
          <num>1</num>
          <rubrica>Ambito</rubrica>
          <comma>Il presente decreto...</comma>
        </articolo>
      </nir>
    `;
    const pageHtml = '<html><a href="/do/atto/caricaAKN?dataGU=20080430&amp;codiceRedaz=008G0104&amp;dataVigenza=20260919">XML</a></html>';

    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, headers: { getSetCookie: () => [], get: () => null } });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { getSetCookie: () => [], get: () => null },
      text: async () => pageHtml,
    });
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { getSetCookie: () => [], get: () => 'text/xml' },
      text: async () => mockXml,
    });

    // Search
    const results = await normattivaApi.searchNorm('D.Lgs. 81/2008');
    expect(results).toHaveLength(1);

    const { urn, title } = results[0];

    // Download
    const xml = await normattivaApi.downloadNormXml(urn);
    expect(xml).toBe(mockXml);

    // Convert
    const markdown = normattivaToMarkdown.convertXmlToMarkdown(xml, { urn, title, vigenza: 'Vigente' });
    expect(markdown).toContain('# D.Lgs. 81/2008');
    expect(markdown).toContain('### Art. 1 — Ambito');
  });
});
