/**
 * @jest-environment node
 *
 * Test L1 — GET search (MR-1), GET image (MR-2), POST ingest (MR-3), POST search-by-image (MR-4).
 */

const mockAccess = jest.fn();
const mockQuery = jest.fn();

jest.mock('fs', () => ({
  promises: { access: (...args) => mockAccess(...args) },
}));
jest.mock('../config/database', () => ({
  query: (...args) => mockQuery(...args),
}));
jest.mock('../services/aiCompanyScope.service', () => ({
  resolveAiCompanyScope: jest.fn(),
}));
jest.mock('../services/companyAccess.service', () => ({
  sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));
jest.mock('../services/figureKnowledge.service', () => ({
  searchFiguresByText: jest.fn(),
  searchFiguresByImage: jest.fn(),
}));
jest.mock('../services/figureIngest.service', () => ({
  ingestFiguresFromPdf: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const { resolveAiCompanyScope } = require('../services/aiCompanyScope.service');
const { searchFiguresByText, searchFiguresByImage } = require('../services/figureKnowledge.service');
const { ingestFiguresFromPdf } = require('../services/figureIngest.service');
const { searchFigures, searchFiguresByImage: searchFiguresByImageCtrl, getFigureImage, ingestFigures } = require('./figureKnowledge.controller');

function createRes() {
  const res = { statusCode: 200, headers: {} };
  res.status = jest.fn(function status(code) {
    this.statusCode = code;
    return this;
  });
  res.json = jest.fn(function json() {
    return this;
  });
  res.setHeader = jest.fn(function setHeader(k, v) {
    this.headers[k] = v;
    return this;
  });
  res.sendFile = jest.fn(function sendFile() {
    return this;
  });
  return res;
}

describe('figureKnowledge.controller — searchFigures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveAiCompanyScope.mockResolvedValue({ companyId: null, denied: null });
  });

  it('400 se manca q', async () => {
    const req = { user: { organization_id: 1001 }, query: {} };
    const res = createRes();
    await searchFigures(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(searchFiguresByText).not.toHaveBeenCalled();
  });

  it('200 con figures vuote se nessun match', async () => {
    searchFiguresByText.mockResolvedValue([]);
    const req = {
      user: { organization_id: 1001, user_id: 7 },
      query: { q: 'simbolo' },
    };
    const res = createRes();
    await searchFigures(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith({ figures: [] });
    expect(searchFiguresByText).toHaveBeenCalledWith(
      'simbolo',
      1001,
      expect.objectContaining({ companyId: null })
    );
  });

  it('usa organization_id del JWT, non un parametro client', async () => {
    searchFiguresByText.mockResolvedValue([
      { id: 1, page: 1, bbox: [1, 2, 3, 4], kind: 'vector', caption: 'x', path: 'a.png', score: 0.9, embedding_space: 'mock-clip' },
    ]);
    const req = {
      user: { organization_id: 1001 },
      query: { q: 'simbolo', organization_id: 9999 },
    };
    const res = createRes();
    await searchFigures(req, res);
    expect(searchFiguresByText.mock.calls[0][1]).toBe(1001);
    expect(res.json.mock.calls[0][0].figures).toHaveLength(1);
  });
});

describe('figureKnowledge.controller — getFigureImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.mockReset();
    mockQuery.mockReset();
  });

  it('401 se manca organization_id nel JWT', async () => {
    const req = { user: {}, params: { id: '7' } };
    const res = createRes();
    await getFigureImage(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('400 se id non valido', async () => {
    const req = { user: { organization_id: 1001 }, params: { id: 'abc' } };
    const res = createRes();
    await getFigureImage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('usa organization_id del JWT, non un parametro client', async () => {
    mockQuery.mockResolvedValue({ recordset: [] });
    const req = {
      user: { organization_id: 1001 },
      params: { id: '7' },
      query: { organization_id: 9999 },
    };
    const res = createRes();
    await getFigureImage(req, res);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('organization_id'),
      expect.objectContaining({ id: 7, orgId: 1001 })
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('404 se il PNG non è sul disco (placeholder FE)', async () => {
    mockQuery.mockResolvedValue({
      recordset: [{ id: 7, png_path: '/tmp/missing.png', organization_id: 1001 }],
    });
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    const req = { user: { organization_id: 1001 }, params: { id: '7' } };
    const res = createRes();
    await getFigureImage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  it('200 sendFile se il PNG esiste e appartiene all\'org', async () => {
    mockQuery.mockResolvedValue({
      recordset: [{ id: 7, png_path: '/tmp/fig.png', organization_id: 1001 }],
    });
    mockAccess.mockResolvedValue();
    const req = { user: { organization_id: 1001 }, params: { id: '7' } };
    const res = createRes();
    await getFigureImage(req, res);
    expect(res.sendFile).toHaveBeenCalled();
    expect(res.headers['Content-Type']).toBe('image/png');
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('figureKnowledge.controller — ingestFigures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveAiCompanyScope.mockResolvedValue({ companyId: null, denied: null });
  });

  it('401 se manca organization_id nel JWT', async () => {
    const req = { user: {}, body: { pdfPath: '/tmp/a.pdf' } };
    const res = createRes();
    await ingestFigures(req, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(ingestFiguresFromPdf).not.toHaveBeenCalled();
  });

  it('400 se manca pdfPath', async () => {
    const req = { user: { organization_id: 1001 }, body: {} };
    const res = createRes();
    await ingestFigures(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ingestFiguresFromPdf).not.toHaveBeenCalled();
  });

  it('usa organization_id del JWT, non body.organization_id del client', async () => {
    ingestFiguresFromPdf.mockResolvedValue({ figures: [], count: 0 });
    const req = {
      user: { organization_id: 1001 },
      body: { pdfPath: '/tmp/a.pdf', organization_id: 9999 },
    };
    const res = createRes();
    await ingestFigures(req, res);
    expect(ingestFiguresFromPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 1001,
        pdfPath: '/tmp/a.pdf',
      })
    );
    expect(ingestFiguresFromPdf.mock.calls[0][0].organizationId).not.toBe(9999);
  });

  it('200 con figures vuote se il PDF non ha tavole', async () => {
    ingestFiguresFromPdf.mockResolvedValue({ figures: [], count: 0 });
    const req = {
      user: { organization_id: 1001 },
      body: { pdfPath: '/tmp/vuoto.pdf' },
    };
    const res = createRes();
    await ingestFigures(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith({ figures: [], count: 0 });
  });
});

describe('figureKnowledge.controller — searchFiguresByImage (MR-4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resolveAiCompanyScope.mockResolvedValue({ companyId: null, denied: null });
  });

  it('400 se manca il file', async () => {
    const req = { user: { organization_id: 1001 }, body: {}, file: undefined };
    const res = createRes();
    await searchFiguresByImageCtrl(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(searchFiguresByImage).not.toHaveBeenCalled();
  });

  it('200 con figures vuote se nessun match', async () => {
    searchFiguresByImage.mockResolvedValue([]);
    const req = {
      user: { organization_id: 1001 },
      body: {},
      file: { originalname: 'crop.png', buffer: Buffer.from('x'), mimetype: 'image/png' },
    };
    const res = createRes();
    await searchFiguresByImageCtrl(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.json).toHaveBeenCalledWith({ figures: [] });
  });

  it('usa organization_id del JWT, non body.organization_id del client', async () => {
    searchFiguresByImage.mockResolvedValue([{ id: 1, score: 0.9 }]);
    const req = {
      user: { organization_id: 1001 },
      body: { organization_id: 9999 },
      file: { originalname: 'crop_vector.png', buffer: Buffer.from('x'), mimetype: 'image/png' },
    };
    const res = createRes();
    await searchFiguresByImageCtrl(req, res);
    expect(searchFiguresByImage.mock.calls[0][1]).toBe(1001);
    expect(searchFiguresByImage.mock.calls[0][1]).not.toBe(9999);
    expect(res.json.mock.calls[0][0].figures).toHaveLength(1);
  });

  it('503 se embedding locale non disponibile', async () => {
    const err = new Error('no clip');
    err.code = 'FIGURE_EMBED_UNAVAILABLE';
    searchFiguresByImage.mockRejectedValue(err);
    const req = {
      user: { organization_id: 1001 },
      body: {},
      file: { originalname: 'crop.png', buffer: Buffer.from('x'), mimetype: 'image/png' },
    };
    const res = createRes();
    await searchFiguresByImageCtrl(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
