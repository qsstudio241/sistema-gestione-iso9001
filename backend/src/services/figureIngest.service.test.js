/**
 * @jest-environment node
 *
 * Test L1 — ingest figure (MR-3). Mock extract + persist + CLIP.
 * Niente rete, niente download pesi, niente PDF copyright.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockPersistFigures = jest.fn();
jest.mock('./figureKnowledge.service', () => ({
  persistFigures: (...args) => mockPersistFigures(...args),
}));

const { ingestFiguresFromPdf } = require('./figureIngest.service');

const SPACE = 'mock-clip';

function mockEmbedder() {
  return {
    embeddingSpace: () => SPACE,
    embedText: jest.fn(async () => [[1, 0, 0, 0]]),
    embedImage: jest.fn(async () => [1, 0, 0, 0]),
  };
}

function tmpPdf(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgq-fig-ingest-'));
  const pdfPath = path.join(dir, name);
  fs.writeFileSync(pdfPath, '%PDF-1.4 fixture');
  return pdfPath;
}

describe('ingestFiguresFromPdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPersistFigures.mockResolvedValue([]);
  });

  it('rifiuta organizationId mancante', async () => {
    await expect(
      ingestFiguresFromPdf({ pdfPath: tmpPdf('a.pdf') })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(mockPersistFigures).not.toHaveBeenCalled();
  });

  it('PDF senza figure → persist con lista vuota, niente throw', async () => {
    const pdfPath = tmpPdf('vuoto.pdf');
    const extractFigures = jest.fn(async () => ({ figures: [] }));
    const result = await ingestFiguresFromPdf({
      organizationId: 1001,
      pdfPath,
      extractFigures,
      embedder: mockEmbedder(),
    });
    expect(result).toEqual({ figures: [], count: 0 });
    expect(mockPersistFigures).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 1001,
        figures: [],
        sourcePdf: 'vuoto.pdf',
      })
    );
    expect(extractFigures).toHaveBeenCalled();
  });

  it('chiama persist con organization_id e embedding_space del mock CLIP', async () => {
    const pdfPath = tmpPdf('simboli.pdf');
    const embedder = mockEmbedder();
    const figures = [{
      page: 1,
      bbox: [10, 20, 110, 80],
      kind: 'vector',
      path: 'figures/p1_vector_001.png',
      caption: 'Simbolo di prova',
    }];
    mockPersistFigures.mockResolvedValue([{ id: 7, embedding_space: SPACE }]);

    const result = await ingestFiguresFromPdf({
      organizationId: 1001,
      companyId: 10,
      pdfPath,
      extractFigures: async () => ({ figures }),
      embedder,
    });

    expect(result.count).toBe(1);
    expect(mockPersistFigures).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 1001,
        companyId: 10,
        sourcePdf: 'simboli.pdf',
        figures,
        embedder,
      })
    );
    expect(embedder.embeddingSpace()).toBe(SPACE);
    expect(mockPersistFigures.mock.calls[0][0].organizationId).not.toBe(9999);
  });

  it('isolamento org: org A e org B chiamano persist con id distinti', async () => {
    const pdfA = tmpPdf('a.pdf');
    const pdfB = tmpPdf('b.pdf');
    const extractFigures = async () => ({
      figures: [{ page: 1, bbox: [0, 0, 10, 10], kind: 'raster', path: 'figures/x.png' }],
    });
    mockPersistFigures.mockResolvedValue([{ id: 1 }]);

    await ingestFiguresFromPdf({ organizationId: 1001, pdfPath: pdfA, extractFigures });
    await ingestFiguresFromPdf({ organizationId: 1004, pdfPath: pdfB, extractFigures });

    expect(mockPersistFigures.mock.calls[0][0].organizationId).toBe(1001);
    expect(mockPersistFigures.mock.calls[1][0].organizationId).toBe(1004);
    expect(mockPersistFigures.mock.calls[0][0].organizationId)
      .not.toBe(mockPersistFigures.mock.calls[1][0].organizationId);
  });

  it('PDF assente sul disco → PDF_NOT_FOUND, niente persist', async () => {
    const missing = path.join(os.tmpdir(), 'sgq-fig-missing-' + Date.now() + '.pdf');
    await expect(
      ingestFiguresFromPdf({
        organizationId: 1001,
        pdfPath: missing,
        extractFigures: async () => ({ figures: [] }),
      })
    ).rejects.toMatchObject({ code: 'PDF_NOT_FOUND' });
    expect(mockPersistFigures).not.toHaveBeenCalled();
  });

  it('path fuori dalle radici autorizzate → INVALID_PDF_PATH', async () => {
    await expect(
      ingestFiguresFromPdf({
        organizationId: 1001,
        pdfPath: '/etc/passwd.pdf',
        extractFigures: async () => ({ figures: [] }),
      })
    ).rejects.toMatchObject({ code: 'INVALID_PDF_PATH' });
    expect(mockPersistFigures).not.toHaveBeenCalled();
  });
});
