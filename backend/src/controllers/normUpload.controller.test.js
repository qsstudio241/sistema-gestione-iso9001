/**
 * @jest-environment node
 */

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../services/normCodesImport.service', () => ({
  resolveNormFolderId: jest.fn(),
}));

jest.mock('../services/normIngest.service', () => ({
  extractNormFromPdf: jest.fn(),
  commitNormFromFields: jest.fn(),
  applyNormToExistingDocument: jest.fn(),
  assertFolderIsNorms: jest.fn(),
  listFolderNormPdfs: jest.fn(),
}));

jest.mock('../services/ingestStaging.service', () => ({
  createStagingRecord: jest.fn(),
}));

jest.mock('../services/companyAccess.service', () => ({
  assertMutatingAllowed: jest.fn().mockResolvedValue(null),
  sendAccessDenied: (res, denied) => res.status(denied.status).json(denied.body),
}));

const fsSync = require('fs');
const {
  extractNormFromPdf,
  applyNormToExistingDocument,
  assertFolderIsNorms,
  listFolderNormPdfs,
} = require('../services/normIngest.service');
const { createStagingRecord } = require('../services/ingestStaging.service');
const { assertMutatingAllowed } = require('../services/companyAccess.service');
const { ingestFromFolder } = require('./normUpload.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ingestFromFolder (IA-12)', () => {
  const reqBase = {
    user: { user_id: 7, organization_id: 1001 },
    body: { folder_id: 23 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    assertMutatingAllowed.mockResolvedValue(null);
    jest.spyOn(fsSync, 'existsSync').mockReturnValue(true);
    jest.spyOn(require('fs').promises, 'readFile').mockResolvedValue(Buffer.from('%PDF'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('400 se manca folder_id', async () => {
    const res = mockRes();
    await ingestFromFolder({ user: reqBase.user, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FOLDER_REQUIRED' }));
  });

  it('400 se la cartella non ha PDF', async () => {
    assertFolderIsNorms.mockResolvedValue({ id: 23, company_id: 8 });
    listFolderNormPdfs.mockResolvedValue([]);
    const res = mockRes();
    await ingestFromFolder(reqBase, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NO_FOLDER_PDFS' }));
    expect(extractNormFromPdf).not.toHaveBeenCalled();
  });

  it('applica sul documento esistente senza creare un record nuovo', async () => {
    assertFolderIsNorms.mockResolvedValue({ id: 23, company_id: 8 });
    listFolderNormPdfs.mockResolvedValue([{
      id: 88,
      title: 'iso9001.pdf',
      file_name: 'iso9001.pdf',
      storage_path: '/uploads/import/iso9001.pdf',
      mime_type: 'application/pdf',
      file_size: 2048,
      company_id: 8,
    }]);
    extractNormFromPdf.mockResolvedValue({
      status: 'ready_commit',
      fields: { standard_code: 'ISO 9001:2015', norm_title: 'Qualità' },
      field_confidence: {},
      catalog_lookup: { status: 'active' },
      warnings: [],
      extracted_text: 'testo',
      text_quality: 'good',
    });
    applyNormToExistingDocument.mockResolvedValue({
      document_id: 88,
      standard_code: 'ISO 9001:2015',
      norm_title: 'Qualità',
      validity_status: 'vigente',
      text_quality: 'good',
    });

    const res = mockRes();
    await ingestFromFolder(reqBase, res);

    expect(extractNormFromPdf).toHaveBeenCalledWith(
      expect.any(Buffer),
      'iso9001.pdf',
      1001,
      23,
      { excludeDocumentId: 88, companyId: 8, folderId: 23 },
    );
    expect(assertMutatingAllowed).toHaveBeenCalledWith(reqBase.user, { companyId: 8 });
    expect(applyNormToExistingDocument).toHaveBeenCalledWith(
      88,
      expect.objectContaining({ standard_code: 'ISO 9001:2015' }),
      1001,
      expect.objectContaining({
        filePath: '/uploads/import/iso9001.pdf',
        user: reqBase.user,
        expectedFolderId: 23,
      }),
    );
    expect(createStagingRecord).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.results[0].status).toBe('confirmed');
    expect(payload.results[0].documentId).toBe(88);
  });

  it('mette in revisione se l\'estrazione non è deterministica', async () => {
    assertFolderIsNorms.mockResolvedValue({ id: 23, company_id: 8 });
    listFolderNormPdfs.mockResolvedValue([{
      id: 90,
      file_name: 'ambiguo.pdf',
      storage_path: '/uploads/import/ambiguo.pdf',
      mime_type: 'application/pdf',
      company_id: 8,
    }]);
    extractNormFromPdf.mockResolvedValue({
      status: 'pending_review',
      fields: { standard_code: 'ISO 9001:2015' },
      field_confidence: { standard_code: 'low' },
      warnings: ['Catalogo ambiguo'],
      extracted_text: 'x',
      text_quality: 'partial',
    });
    createStagingRecord.mockResolvedValue(501);

    const res = mockRes();
    await ingestFromFolder(reqBase, res);

    expect(applyNormToExistingDocument).not.toHaveBeenCalled();
    expect(createStagingRecord).toHaveBeenCalledWith(expect.objectContaining({
      fields: expect.objectContaining({ _target_document_id: 90 }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].results[0].status).toBe('pending_review');
  });

  it('403 se company_access copre solo azienda A e la cartella 2.3 è azienda B', async () => {
    assertFolderIsNorms.mockResolvedValue({ id: 23, company_id: 99 });
    assertMutatingAllowed.mockResolvedValue({
      status: 403,
      body: { error: 'Permesso negato', code: 'AUTH_FORBIDDEN' },
    });
    const req = {
      user: {
        user_id: 7,
        organization_id: 1001,
        role: 'cliente',
        company_access: [{ company_id: 8, permission: 'write' }],
      },
      body: { folder_id: 23 },
    };
    const res = mockRes();
    await ingestFromFolder(req, res);

    expect(assertMutatingAllowed).toHaveBeenCalledWith(req.user, { companyId: 99 });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_FORBIDDEN' }));
    expect(listFolderNormPdfs).not.toHaveBeenCalled();
    expect(extractNormFromPdf).not.toHaveBeenCalled();
  });

  it('200 con results visibili se tutti i file sono duplicati (niente confirmed)', async () => {
    assertFolderIsNorms.mockResolvedValue({ id: 23, company_id: 8 });
    listFolderNormPdfs.mockResolvedValue({
      docs: [{
        id: 88,
        file_name: 'iso9001.pdf',
        storage_path: '/uploads/import/iso9001.pdf',
        mime_type: 'application/pdf',
        company_id: 8,
      }],
      truncated: false,
      omitted: 0,
    });
    extractNormFromPdf.mockResolvedValue({
      status: 'duplicate',
      standard_code: 'ISO 9001:2015',
      norm_title: 'Qualità',
      warnings: ['Duplicato'],
    });

    const res = mockRes();
    await ingestFromFolder(reqBase, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].status).toBe('duplicate');
    expect(applyNormToExistingDocument).not.toHaveBeenCalled();
  });

  it('segnala truncated/omitted se la cartella ha più di 20 PDF', async () => {
    assertFolderIsNorms.mockResolvedValue({ id: 23, company_id: 8 });
    listFolderNormPdfs.mockResolvedValue({
      docs: [{
        id: 88,
        file_name: 'iso9001.pdf',
        storage_path: '/uploads/import/iso9001.pdf',
        mime_type: 'application/pdf',
        company_id: 8,
      }],
      truncated: true,
      omitted: 5,
    });
    extractNormFromPdf.mockResolvedValue({
      status: 'duplicate',
      standard_code: 'ISO 9001:2015',
      warnings: ['Duplicato'],
    });

    const res = mockRes();
    await ingestFromFolder(reqBase, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toEqual(expect.objectContaining({
      truncated: true,
      omitted: 5,
    }));
  });
});
