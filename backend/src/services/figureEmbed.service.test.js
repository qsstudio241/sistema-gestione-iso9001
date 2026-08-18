/**
 * @jest-environment node
 */

describe('figureEmbed.service', () => {
  const ORIGINAL = process.env.FIGURE_EMBED_MODEL;

  afterEach(() => {
    if (ORIGINAL == null) delete process.env.FIGURE_EMBED_MODEL;
    else process.env.FIGURE_EMBED_MODEL = ORIGINAL;
    jest.resetModules();
  });

  it('default embedding_space jina-clip-v2, override env, fallback dichiarato', () => {
    delete process.env.FIGURE_EMBED_MODEL;
    jest.resetModules();
    const embed = require('./figureEmbed.service');
    expect(embed.embeddingSpace()).toBe('jinaai/jina-clip-v2');
    expect(embed.fallbackEmbeddingSpace()).toBe('clip-ViT-B-32');

    process.env.FIGURE_EMBED_MODEL = 'clip-ViT-B-32';
    expect(embed.embeddingSpace()).toBe('clip-ViT-B-32');
  });
});
