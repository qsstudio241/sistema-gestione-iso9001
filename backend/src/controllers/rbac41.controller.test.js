/**
 * Test RBAC Fase 4.1 — guard write su controller (viewer read ? 403)
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');

describe('RBAC Fase 4.1 controller guards', () => {
  const readViewer = {
    user_id: 10,
    role: 'viewer',
    organization_id: 1,
    company_access: [{ company_id: 11, permission: 'read' }],
  };

  const writeClient = {
    user_id: 11,
    role: 'viewer',
    organization_id: 1,
    company_access: [{ company_id: 11, permission: 'write' }],
  };

  afterEach(() => jest.clearAllMocks());

  describe('company.controller updateCompany', () => {
    it('viewer read PUT company ? 403', async () => {
      const { updateCompany } = require('./company.controller');
      const req = {
        user: readViewer,
        params: { id: '11' },
        body: { name: 'Nuovo nome' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await updateCompany(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AUTH_FORBIDDEN' }),
      );
    });

    it('cliente write PUT company ? 200', async () => {
      const { updateCompany } = require('./company.controller');
      query
        .mockResolvedValueOnce({ recordset: [{ id: 11, is_active: 1 }] })
        .mockResolvedValueOnce({ recordset: [] })
        .mockResolvedValueOnce({
          recordset: [{
            id: 11,
            name: 'Aggiornata',
            auditor_org_id: 1,
            vat_number: null,
            sector: null,
            address: null,
            logo_url: null,
            is_active: 1,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        });

      const req = {
        user: writeClient,
        params: { id: '11' },
        body: { name: 'Aggiornata' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await updateCompany(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe('qualifications.controller createQualification', () => {
    it('viewer read POST qualification ? 403', async () => {
      const { createQualification } = require('./qualifications.controller');
      const req = {
        user: readViewer,
        body: {
          person_name: 'Mario Rossi',
          qualification_type: 'ISO 9606',
          company_id: 11,
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await createQualification(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
