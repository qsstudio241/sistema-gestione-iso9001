/**
 * @jest-environment node
 *
 * CND-4: resolve template scope cnd (studio poi sistema).
 */
jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const {
  getCndReportTemplate,
  normalizeCndMethodKey,
  CND_METHOD_KEYS,
} = require('./reportTemplate.service');

afterEach(() => jest.clearAllMocks());

describe('reportTemplate.service — CND-4', () => {
  it('normalizeCndMethodKey accetta VT|MT|PT|UT', () => {
    expect(CND_METHOD_KEYS).toEqual(['VT', 'MT', 'PT', 'UT']);
    expect(normalizeCndMethodKey('pt')).toBe('PT');
    expect(normalizeCndMethodKey('VT')).toBe('VT');
    expect(normalizeCndMethodKey('doc')).toBeNull();
  });

  it('getCndReportTemplate preferisce il template studio', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 21, file_path: '/uploads/templates/1001/pt.docx', name: 'PT studio' }],
    });
    const tpl = await getCndReportTemplate(1001, 'PT');
    expect(tpl).toEqual({ id: 21, file_path: '/uploads/templates/1001/pt.docx', name: 'PT studio' });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual({ organization_id: 1001, standard_key: 'PT' });
  });

  it('getCndReportTemplate cade sul modello di sistema', async () => {
    query
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [{ id: 4, file_path: '/templates/CND-PT-verbale.docx', name: 'Verbale CND PT (sistema)' }],
      });
    const tpl = await getCndReportTemplate(1001, 'pt');
    expect(tpl.id).toBe(4);
    expect(tpl.file_path).toContain('CND-PT-verbale');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('getCndReportTemplate lancia se manca sia studio sia sistema', async () => {
    query.mockResolvedValue({ recordset: [] });
    await expect(getCndReportTemplate(1001, 'UT')).rejects.toThrow(/Nessun template CND/);
  });
});
