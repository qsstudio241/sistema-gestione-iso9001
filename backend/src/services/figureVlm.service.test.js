/**
 * @jest-environment node
 *
 * Test L1 — VLM locale sui ritagli (MR-5). Mock fetch: niente Ollama in CI.
 */

const {
  describeCropAgainstFigures,
  withDisclaimer,
  DISCLAIMER,
} = require('./figureVlm.service');

describe('figureVlm.service (MR-5)', () => {
  it('cita le tavole, aggiunge disclaimer, non chiama Gemini', async () => {
    const fetchImpl = jest.fn(async (url, init) => {
      expect(String(url)).toMatch(/11434\/api\/chat/);
      expect(String(url)).not.toMatch(/generativelanguage|googleapis|openai/i);
      const body = JSON.parse(init.body);
      expect(body.model).toMatch(/qwen2\.5vl/i);
      expect(body.messages[0].content).toMatch(/pagina 2/);
      expect(body.messages[0].content).toMatch(/non certific/i);
      expect(body.messages[0].images.length).toBeGreaterThan(0);
      return {
        ok: true,
        json: async () => ({
          message: { content: 'Il ritaglio ricorda il simbolo a pagina 2 (didascalia angolo).' },
        }),
      };
    });

    const out = await describeCropAgainstFigures({
      queryImage: { buffer: Buffer.from('fake-png'), originalname: 'crop.png' },
      figures: [{ page: 2, caption: 'Simbolo d angolo' }],
      fetchImpl,
    });

    expect(out.unavailable).toBe(false);
    expect(out.reply).toMatch(/pagina 2/);
    expect(out.reply).toContain(DISCLAIMER);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('Ollama assente → reply null senza throw', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    });
    const out = await describeCropAgainstFigures({
      queryImage: { buffer: Buffer.from('x') },
      figures: [{ page: 1, caption: 'x' }],
      fetchImpl,
    });
    expect(out.reply).toBeNull();
    expect(out.unavailable).toBe(true);
  });

  it('senza ritaglio → non chiama Ollama', async () => {
    const fetchImpl = jest.fn();
    const out = await describeCropAgainstFigures({
      queryImage: null,
      figures: [],
      fetchImpl,
    });
    expect(out.reply).toBeNull();
    expect(out.unavailable).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('withDisclaimer', () => {
  it('non duplica se il testo lo contiene gia', () => {
    const t = `Ok. ${DISCLAIMER}`;
    expect(withDisclaimer(t)).toBe(t);
  });
});
