/**
 * CND-7 — test L1 posa verbale NDT nel Registro Documenti
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('./documentTreeProvisioner.service', () => ({
  folderCodeForDocType: jest.fn((t) => (t === 'report_ndt' ? '9.3' : null)),
  resolveFolderByCode: jest.fn(),
  parentIdForExistingFolder: jest.fn((folder) => (folder && folder.id ? folder.id : null)),
  calculatePathCache: jest.fn().mockResolvedValue('/10/99/'),
}));

const { query } = require('../config/database');
const {
  folderCodeForDocType,
  resolveFolderByCode,
  parentIdForExistingFolder,
  calculatePathCache,
} = require('./documentTreeProvisioner.service');
const {
  poseNdtReportInRegistry,
  FOLDER_MISSING_MSG,
  DOC_TYPE,
} = require('./ndtReportRegistryPose.service');

const ORG = 1001;

function baseReport(overrides = {}) {
  return {
    id: 42,
    report_number: 'VT-2026-007',
    report_type: 'VT',
    company_id: 11,
    client: 'Mason',
    inspector: 'Rossi',
    inspection_date: '2026-08-20',
    status: 'completed',
    ...overrides,
  };
}

afterEach(() => jest.clearAllMocks());

describe('poseNdtReportInRegistry', () => {
  it('non posa se status \u00e8 draft', async () => {
    const out = await poseNdtReportInRegistry({
      organizationId: ORG,
      report: baseReport({ status: 'draft' }),
    });
    expect(out).toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('crea report_ndt in cartella 9.3 quando l\'albero c\'\u00e8', async () => {
    resolveFolderByCode.mockResolvedValue({ id: 10, company_id: 11 });
    parentIdForExistingFolder.mockReturnValue(10);
    query
      .mockResolvedValueOnce({ recordset: [] }) // find by ndt_report_id
      .mockResolvedValueOnce({ recordset: [] }) // find by doc_code
      .mockResolvedValueOnce({ recordset: [{ id: 99 }] }) // INSERT
      .mockResolvedValueOnce({ recordset: [] }); // path_cache update

    const out = await poseNdtReportInRegistry({
      organizationId: ORG,
      report: baseReport(),
      userId: 1,
    });

    expect(folderCodeForDocType).toHaveBeenCalledWith(DOC_TYPE);
    expect(resolveFolderByCode).toHaveBeenCalledWith(ORG, '9.3', 11);
    expect(out).toMatchObject({
      document_id: 99,
      created: true,
      folder_code: '9.3',
      parent_id: 10,
      folder_missing: false,
    });
    expect(out.message).toMatch(/9\.3/);

    const insertCall = query.mock.calls.find(([sql]) => /INSERT INTO document_registry/i.test(sql));
    expect(insertCall).toBeTruthy();
    expect(insertCall[1]).toMatchObject({
      organization_id: ORG,
      company_id: 11,
      parent_id: 10,
      doc_type: 'report_ndt',
      doc_code: 'VT-2026-007',
      content_scope: 'client',
    });
    const tsd = JSON.parse(insertCall[1].type_specific_data);
    expect(tsd.ndt_report_id).toBe(42);
    expect(tsd.ndt_method).toBe('VT');
    expect(calculatePathCache).toHaveBeenCalledWith(99, ORG);
  });

  it('cartella 9.3 assente \u2192 parent_id null + messaggio Cartella mancante', async () => {
    resolveFolderByCode.mockResolvedValue(null);
    parentIdForExistingFolder.mockReturnValue(null);
    query
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 100 }] });

    const out = await poseNdtReportInRegistry({
      organizationId: ORG,
      report: baseReport(),
    });

    expect(out.folder_missing).toBe(true);
    expect(out.parent_id).toBeNull();
    expect(out.message).toBe(FOLDER_MISSING_MSG);
    const insertCall = query.mock.calls.find(([sql]) => /INSERT INTO document_registry/i.test(sql));
    expect(insertCall[1].parent_id).toBeNull();
    expect(insertCall[1].notes).toBe(FOLDER_MISSING_MSG);
  });

  it('secondo Completa non duplica (UPDATE esistente)', async () => {
    resolveFolderByCode.mockResolvedValue({ id: 10, company_id: 11 });
    parentIdForExistingFolder.mockReturnValue(10);
    query
      .mockResolvedValueOnce({ recordset: [{ id: 88, parent_id: 10 }] }) // find by link
      .mockResolvedValueOnce({ recordset: [] }) // UPDATE
      .mockResolvedValueOnce({ recordset: [] }); // path_cache

    const out = await poseNdtReportInRegistry({
      organizationId: ORG,
      report: baseReport({ status: 'approved' }),
    });

    expect(out).toMatchObject({
      document_id: 88,
      created: false,
      folder_missing: false,
      parent_id: 10,
    });
    const inserts = query.mock.calls.filter(([sql]) => /INSERT INTO document_registry/i.test(sql));
    expect(inserts).toHaveLength(0);
    const updates = query.mock.calls.filter(([sql]) => /UPDATE document_registry SET/i.test(sql));
    expect(updates.length).toBeGreaterThanOrEqual(1);
  });

  it('senza company_id: folder_missing, crea comunque con parent_id null', async () => {
    parentIdForExistingFolder.mockReturnValue(null);
    query
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 101 }] });

    const out = await poseNdtReportInRegistry({
      organizationId: ORG,
      report: baseReport({ company_id: null }),
    });

    expect(resolveFolderByCode).not.toHaveBeenCalled();
    expect(out.folder_missing).toBe(true);
    expect(out.parent_id).toBeNull();
    const insertCall = query.mock.calls.find(([sql]) => /INSERT INTO document_registry/i.test(sql));
    expect(insertCall[1].company_id).toBeNull();
    expect(insertCall[1].content_scope).toBe('studio');
  });
});
