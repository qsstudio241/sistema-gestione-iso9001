/**
 * @jest-environment node
 *
 * Gate ruoli su duplica/carica/elimina template.
 * authorize() lascia già passare superadmin; il controller non deve ribloccarlo.
 */
const mockQuery = jest.fn();
jest.mock('../config/database', () => ({
  query: (...args) => mockQuery(...args),
}));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const {
  duplicateTemplate,
  uploadTemplate,
  deleteTemplate,
} = require('./reportTemplate.controller');

function mockRes() {
  const res = { statusCode: 200, headersSent: false };
  res.status = jest.fn(function status(code) {
    this.statusCode = code;
    return this;
  });
  res.json = jest.fn(function json() {
    this.headersSent = true;
    return this;
  });
  return res;
}

describe('reportTemplate RBAC — superadmin non è un viewer', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('duplicateTemplate: viewer → 403; superadmin supera il gate ruolo', async () => {
    const viewerRes = mockRes();
    await duplicateTemplate(
      { params: { id: '4' }, body: { name: 'Copia' }, user: { role: 'viewer', organization_id: 1001 } },
      viewerRes,
    );
    expect(viewerRes.status).toHaveBeenCalledWith(403);
    expect(viewerRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );

    mockQuery.mockResolvedValue({ recordset: [] });
    const superRes = mockRes();
    await duplicateTemplate(
      { params: { id: '4' }, body: { name: 'Copia' }, user: { role: 'superadmin', organization_id: 1001 } },
      superRes,
    );
    expect(superRes.status).not.toHaveBeenCalledWith(403);
    expect(superRes.status).toHaveBeenCalledWith(404);
  });

  it('uploadTemplate: viewer → 403; superadmin supera il gate ruolo', async () => {
    const viewerRes = mockRes();
    await uploadTemplate(
      { user: { role: 'viewer', organization_id: 1001 }, file: null, body: {} },
      viewerRes,
    );
    expect(viewerRes.status).toHaveBeenCalledWith(403);

    const superRes = mockRes();
    await uploadTemplate(
      { user: { role: 'superadmin', organization_id: 1001 }, file: null, body: {} },
      superRes,
    );
    expect(superRes.status).not.toHaveBeenCalledWith(403);
    expect(superRes.status).toHaveBeenCalledWith(400);
    expect(superRes.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MISSING_FILE' }),
    );
  });

  it('deleteTemplate: viewer → 403; superadmin supera il gate ruolo', async () => {
    const viewerRes = mockRes();
    await deleteTemplate(
      { params: { id: '12' }, user: { role: 'viewer', organization_id: 1001 } },
      viewerRes,
    );
    expect(viewerRes.status).toHaveBeenCalledWith(403);

    mockQuery.mockResolvedValue({ recordset: [] });
    const superRes = mockRes();
    await deleteTemplate(
      { params: { id: '12' }, user: { role: 'superadmin', organization_id: 1001 } },
      superRes,
    );
    expect(superRes.status).not.toHaveBeenCalledWith(403);
    expect(superRes.status).toHaveBeenCalledWith(404);
  });
});
