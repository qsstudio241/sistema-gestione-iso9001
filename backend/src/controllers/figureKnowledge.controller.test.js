/**
 * @jest-environment node
 *
 * Test L1 — GET /ai/figures/search (MR-1).
 */

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
const { searchFigures } = require('./figureKnowledge.controller');

function createRes() {
  const res = { statusCode: 200 };
  res.status = jest.fn(function status(code) {
    this.statusCode = code;
    return this;
  });
  res.json = jest.fn(function json() {
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
