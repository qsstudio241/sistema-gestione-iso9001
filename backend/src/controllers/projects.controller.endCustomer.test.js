/**
 * @jest-environment node
 */

/**
 * Test L1 — projects.controller: cliente commessa collegato all'anagrafica aziende
 * (company_counterparties, ruolo end_customer) invece del solo testo libero.
 *
 * Copre:
 *  - createProject: usa end_customer_id (FK) quando selezionato → sincronizza client_name
 *  - createProject: usa client_name testo libero quando nessuna controparte selezionata
 *  - updateProject: aggiorna end_customer_id preservando client_name esistente se non passato
 *  - updateProject: rimuove il collegamento FK quando end_customer_id è null
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./projects.controller');

const ORG_ID = 1004;
const USER_ID = 9;
const COMPANY_ID = 47;

function mockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

afterEach(() => jest.clearAllMocks());

describe('createProject — cliente da anagrafica aziende', () => {
  it('collega end_customer_id e sincronizza client_name dalla controparte', async () => {
    // 1) resolveCommercialCustomerFields → fetchCounterpartyForCompany
    query.mockResolvedValueOnce({
      recordset: [{ id: 3, name: 'PT.MAIDO', external_ref: 'PT001', role: 'end_customer', company_id: COMPANY_ID, organization_id: ORG_ID, is_active: 1 }],
    });
    // 2) INSERT INTO projects
    query.mockResolvedValueOnce({ recordset: [{ id: 55 }] });

    const req = {
      user: { organization_id: ORG_ID, user_id: USER_ID },
      body: {
        project_code: 'J26-0099',
        company_id: String(COMPANY_ID),
        end_customer_id: '3',
        client_name: 'testo ignorato perché FK impostata',
      },
    };
    const res = mockRes();

    await ctrl.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = query.mock.calls[1];
    const insertParams = insertCall[1];
    expect(insertParams.end_customer_id).toBe(3);
    expect(insertParams.client_name).toBe('PT.MAIDO');
    expect(insertParams.company_id).toBe(COMPANY_ID);
  });

  it('usa client_name testo libero quando nessuna controparte è selezionata', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 56 }] });

    const req = {
      user: { organization_id: ORG_ID, user_id: USER_ID },
      body: {
        project_code: 'J26-0100',
        company_id: String(COMPANY_ID),
        client_name: 'ERAM',
      },
    };
    const res = mockRes();

    await ctrl.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const insertParams = query.mock.calls[0][1];
    expect(insertParams.end_customer_id).toBeNull();
    expect(insertParams.client_name).toBe('ERAM');
  });
});

describe('updateProject — cliente da anagrafica aziende', () => {
  it('collega la controparte FK e aggiorna il nome anche se client_name non è passato', async () => {
    // 1) SELECT existing project
    query.mockResolvedValueOnce({
      recordset: [{ id: 1, company_id: COMPANY_ID, end_customer_id: null, client_name: 'ERAM' }],
    });
    // 2) fetchCounterpartyForCompany
    query.mockResolvedValueOnce({
      recordset: [{ id: 3, name: 'PT.MAIDO', external_ref: 'PT001', role: 'end_customer', company_id: COMPANY_ID, organization_id: ORG_ID, is_active: 1 }],
    });
    // 3) UPDATE
    query.mockResolvedValueOnce({ recordset: [] });

    const req = {
      params: { id: '1' },
      user: { organization_id: ORG_ID },
      body: { end_customer_id: '3' },
    };
    const res = mockRes();

    await ctrl.updateProject(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const updateParams = query.mock.calls[2][1];
    expect(updateParams.end_customer_id).toBe(3);
    expect(updateParams.client_name).toBe('PT.MAIDO');
  });

  it('deseleziona la FK e passa a testo libero quando end_customer_id è null', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 1, company_id: COMPANY_ID, end_customer_id: 3, client_name: 'PT.MAIDO' }],
    });
    query.mockResolvedValueOnce({ recordset: [] }); // UPDATE

    const req = {
      params: { id: '1' },
      user: { organization_id: ORG_ID },
      body: { end_customer_id: '', client_name: 'PT.MAIDO (testo libero)' },
    };
    const res = mockRes();

    await ctrl.updateProject(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const updateParams = query.mock.calls[1][1];
    expect(updateParams.end_customer_id).toBeNull();
    expect(updateParams.client_name).toBe('PT.MAIDO (testo libero)');
  });

  it('preserva end_customer_id/client_name esistenti se il body non li include', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 1, company_id: COMPANY_ID, end_customer_id: 3, client_name: 'PT.MAIDO' }],
    });
    query.mockResolvedValueOnce({ recordset: [] }); // UPDATE

    const req = {
      params: { id: '1' },
      user: { organization_id: ORG_ID },
      body: { notes: 'aggiornamento note' },
    };
    const res = mockRes();

    await ctrl.updateProject(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    // Nessuna query per il cliente: solo SELECT + UPDATE
    expect(query).toHaveBeenCalledTimes(2);
  });
});
