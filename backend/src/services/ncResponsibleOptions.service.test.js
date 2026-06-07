/**
 * @jest-environment node
 */
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('./personnelNotificationBridge.service', () => ({
  ensurePersonnelNotificationContact: jest.fn(),
  roleTypeForPersonnel: jest.fn((p) => {
    if (p.can_actuation && !p.can_verify) return 'attuazione';
    if (p.can_verify && !p.can_actuation) return 'verifica';
    return 'generico';
  }),
}));

const { query } = require('../config/database');
const { ensurePersonnelNotificationContact } = require('./personnelNotificationBridge.service');
const { listNcResponsibleOptions } = require('./ncResponsibleOptions.service');

afterEach(() => jest.clearAllMocks());

describe('listNcResponsibleOptions', () => {
  it('attuazione: include personale can_actuation e rubrica azienda', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 10, name: 'Rubrica Azienda', email: 'a@x.it', role_type: 'attuazione', active: 1 }],
      })
      .mockResolvedValueOnce({
        recordset: [{
          id: 5,
          organization_id: 1001,
          company_id: 11,
          name: 'Mario',
          email: 'm@x.it',
          active: 1,
          can_actuation: 1,
          can_verify: 0,
          notification_contact_id: null,
        }],
      })
      .mockResolvedValueOnce({
        recordset: [{ id: 20, name: 'Mario', email: 'm@x.it', role_type: 'attuazione', active: 1 }],
      });

    ensurePersonnelNotificationContact.mockResolvedValue(20);

    const result = await listNcResponsibleOptions(1001, 11, 'attuazione');

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id).sort()).toEqual([10, 20]);
    expect(result.find((r) => r.id === 20)?.source).toBe('personale');
    expect(query.mock.calls[0][0]).toContain('company_id = @company_id');
  });

  it('verifica: include rubrica studio e personale can_verify', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [{ id: 1, name: 'Studio Ver', email: 's@x.it', role_type: 'verifica', active: 1 }],
      })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [{
          id: 6,
          organization_id: 1001,
          company_id: 11,
          name: 'Luigi',
          email: null,
          active: 1,
          can_actuation: 0,
          can_verify: 1,
          notification_contact_id: 30,
        }],
      });

    ensurePersonnelNotificationContact.mockResolvedValue(30);
    query.mockResolvedValueOnce({
      recordset: [{ id: 30, name: 'Luigi', email: 'l@x.it', role_type: 'verifica', active: 1 }],
    });

    const result = await listNcResponsibleOptions(1001, 11, 'verifica');

    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === 1)?.source).toBe('rubrica_studio');
    expect(query.mock.calls[0][0]).toContain('company_id IS NULL');
  });
});
