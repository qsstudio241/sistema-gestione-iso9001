/**
 * @jest-environment node
 *
 * Test L1 — figureKnowledge persist + retrieve testo→figura (MR-1).
 * Mock DB e mock CLIP: niente rete, niente download modelli.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { query } = require('../config/database');
const {
  persistFigures,
  searchFiguresByText,
  searchFiguresByImage,
  cosineSimilarity,
} = require('./figureKnowledge.service');

const SPACE = 'mock-clip';

function mockEmbedder() {
  return {
    embeddingSpace: () => SPACE,
    embedText: jest.fn(async (texts) => texts.map((t) => {
      const s = String(t).toLowerCase();
      if (s.includes('simbolo')) return [1, 0, 0, 0];
      if (s.includes('raster') || s.includes('ritaglio')) return [0, 1, 0, 0];
      return [0, 0, 1, 0];
    })),
    embedImage: jest.fn(async (pngPath) => {
      const s = String(
        (pngPath && pngPath.originalname) || pngPath || ''
      ).toLowerCase();
      if (s.includes('vector')) return [1, 0, 0, 0];
      if (s.includes('raster')) return [0, 1, 0, 0];
      return [0, 0, 1, 0];
    }),
  };
}

describe('cosineSimilarity', () => {
  it('da 1 su vettori identici e 0 su ortogonali', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe('persistFigures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockImplementation(async (sql) => {
      if (sql.includes('DELETE')) return { rowsAffected: [0] };
      if (sql.includes('INSERT')) return { recordset: [{ id: 42 }] };
      return { recordset: [] };
    });
  });

  it('scrive embedding_space e non tocca knowledge_chunks', async () => {
    const embedder = mockEmbedder();
    const inserted = await persistFigures({
      organizationId: 1001,
      companyId: 10,
      sourcePdf: 'simboli.pdf',
      figuresDir: '/tmp/out',
      figures: [{
        page: 1,
        bbox: [120, 220, 300, 320],
        kind: 'vector',
        path: 'figures/p1_vector_001.png',
        caption: 'Figura 1 - Simbolo di prova',
      }],
      embedder,
    });

    expect(inserted).toHaveLength(1);
    expect(inserted[0].embedding_space).toBe(SPACE);
    const insertCall = query.mock.calls.find((c) => String(c[0]).includes('INSERT INTO knowledge_figures'));
    expect(insertCall).toBeTruthy();
    expect(insertCall[1].space).toBe(SPACE);
    expect(insertCall[1].orgId).toBe(1001);
    expect(insertCall[1].embedding).toContain('1');
    expect(query.mock.calls.some((c) => String(c[0]).includes('knowledge_chunks'))).toBe(false);
    expect(embedder.embedImage).toHaveBeenCalled();
  });
});

describe('searchFiguresByText', () => {
  const vectorFig = {
    id: 1,
    page: 1,
    bbox: '[120,220,300,320]',
    kind: 'vector',
    caption: 'Figura 1 - Simbolo di prova',
    png_path: 'figures/p1_vector_001.png',
    embedding: JSON.stringify([1, 0, 0, 0]),
    embedding_space: SPACE,
    organization_id: 1001,
  };
  const rasterFig = {
    id: 2,
    page: 1,
    bbox: '[360,140,440,220]',
    kind: 'raster',
    caption: 'Figura 2 - Ritaglio raster',
    png_path: 'figures/p1_raster_001.png',
    embedding: JSON.stringify([0, 1, 0, 0]),
    embedding_space: SPACE,
    organization_id: 1001,
  };
  const otherOrg = {
    ...vectorFig,
    id: 99,
    organization_id: 1004,
    caption: 'non deve uscire',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('trova la figura giusta (score maggiore) per query testo', async () => {
    query.mockResolvedValue({ recordset: [vectorFig, rasterFig] });
    const hits = await searchFiguresByText('simbolo di prova', 1001, { embedder: mockEmbedder() });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].id).toBe(1);
    expect(hits[0].kind).toBe('vector');
    expect(hits[0].score).toBeGreaterThan(hits[1] ? hits[1].score : 0);
    expect(hits[0].bbox).toEqual([120, 220, 300, 320]);
    expect(String(query.mock.calls[0][0])).toMatch(/organization_id = @orgId/);
    expect(query.mock.calls[0][1].orgId).toBe(1001);
    expect(query.mock.calls[0][1].space).toBe(SPACE);
  });

  it('isolamento cross-org: scarta righe di un altro organization_id', async () => {
    query.mockResolvedValue({ recordset: [otherOrg] });
    const hits = await searchFiguresByText('simbolo', 1001, { embedder: mockEmbedder() });
    expect(hits).toEqual([]);
  });

  it('query senza match → lista vuota', async () => {
    query.mockResolvedValue({ recordset: [] });
    const hits = await searchFiguresByText('simbolo', 1001, { embedder: mockEmbedder() });
    expect(hits).toEqual([]);
  });

  it('ambito azienda include tavole condivise (company_id NULL)', async () => {
    query.mockResolvedValue({ recordset: [vectorFig] });
    await searchFiguresByText('simbolo', 1001, {
      embedder: mockEmbedder(),
      companyId: 10,
    });
    expect(String(query.mock.calls[0][0])).toMatch(
      /company_id = @companyId OR company_id IS NULL/
    );
    expect(query.mock.calls[0][1].companyId).toBe(10);
  });
});

describe('searchFiguresByImage (MR-4)', () => {
  const vectorFig = {
    id: 1,
    page: 1,
    bbox: '[120,220,300,320]',
    kind: 'vector',
    caption: 'Figura 1 - Simbolo di prova',
    png_path: 'figures/p1_vector_001.png',
    embedding: JSON.stringify([1, 0, 0, 0]),
    embedding_space: SPACE,
    organization_id: 1001,
  };
  const rasterFig = {
    id: 2,
    page: 1,
    bbox: '[360,140,440,220]',
    kind: 'raster',
    caption: 'Figura 2 - Ritaglio raster',
    png_path: 'figures/p1_raster_001.png',
    embedding: JSON.stringify([0, 1, 0, 0]),
    embedding_space: SPACE,
    organization_id: 1001,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ recordset: [vectorFig, rasterFig] });
  });

  it('crop vettoriale trova la tavola vector (score maggiore)', async () => {
    const hits = await searchFiguresByImage('crop_vector.png', 1001, { embedder: mockEmbedder() });
    expect(hits[0].id).toBe(1);
    expect(hits[0].kind).toBe('vector');
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it('crop raster trova la tavola raster (due crop della fixture)', async () => {
    const hits = await searchFiguresByImage({ originalname: 'p1_raster_crop.png' }, 1001, {
      embedder: mockEmbedder(),
    });
    expect(hits[0].id).toBe(2);
    expect(hits[0].kind).toBe('raster');
  });

  it('isolamento org: ritaglio org A non vede figure org B', async () => {
    query.mockResolvedValue({
      recordset: [{ ...vectorFig, id: 99, organization_id: 1004 }],
    });
    const hits = await searchFiguresByImage('crop_vector.png', 1001, { embedder: mockEmbedder() });
    expect(hits).toEqual([]);
  });
});
