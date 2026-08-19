/**
 * @jest-environment node
 *
 * Test L1 — GET /ai/figures/search (MR-1).
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
}));
jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const { resolveAiCompanyScope } = require('../services/aiCompanyScope.service');
const { searchFiguresByText } = require('../services/figureKnowledge.service');
const { searchFigures, getFigureImage } = require('./figureKnowledge.controller');

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
