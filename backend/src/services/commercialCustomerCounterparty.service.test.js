/**
 * Test commercialCustomerCounterparty.service
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const svc = require('./commercialCustomerCounterparty.service');

const ORG_ID = 1004;
const COMPANY_ID = 55;

afterEach(() => jest.clearAllMocks());

describe('resolveCommercialCustomerFields', () => {
  it('sincronizza snapshot da controparte quando FK impostata', async () => {
    query.mockResolvedValueOnce({
      recordset: [{
        id: 7,
        name: 'PT.MAIDO',
        external_ref: 'PT001',
        role: 'end_customer',
        company_id: COMPANY_ID,
        organization_id: ORG_ID,
        is_active: 1,
      }],
    });

    const result = await svc.resolveCommercialCustomerFields({
      organizationId: ORG_ID,
      companyId: COMPANY_ID,
      commercialCustomerIdRaw: 7,
    });

    expect(result.ok).toBe(true);
    expect(result.commercialCustomerId).toBe(7);
    expect(result.commercialCustomerName).toBe('PT.MAIDO');
    expect(result.commercialCustomerRef).toBe('PT001');
  });

  it('rifiuta FK senza company_id', async () => {
    const result = await svc.resolveCommercialCustomerFields({
      organizationId: ORG_ID,
      companyId: null,
      commercialCustomerIdRaw: 7,
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('mantiene testo libero se FK assente', async () => {
    const result = await svc.resolveCommercialCustomerFields({
      organizationId: ORG_ID,
      companyId: COMPANY_ID,
      commercialCustomerNameRaw: 'Cliente manuale',
      commercialCustomerRefRaw: 'REF-1',
    });

    expect(result.ok).toBe(true);
    expect(result.commercialCustomerId).toBeNull();
    expect(result.commercialCustomerName).toBe('Cliente manuale');
    expect(result.commercialCustomerRef).toBe('REF-1');
  });

  it('azzera FK e conserva testo manuale', async () => {
    const result = await svc.resolveCommercialCustomerFields({
      organizationId: ORG_ID,
      companyId: COMPANY_ID,
      commercialCustomerIdRaw: null,
      commercialCustomerNameRaw: 'Nuovo testo',
      existing: {
        commercial_customer_id: 3,
        commercial_customer_name: 'Vecchio',
        commercial_customer_ref: 'OLD',
      },
    });

    expect(result.ok).toBe(true);
    expect(result.commercialCustomerId).toBeNull();
    expect(result.commercialCustomerName).toBe('Nuovo testo');
  });
});
