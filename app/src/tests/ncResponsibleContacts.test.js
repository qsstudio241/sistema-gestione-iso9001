import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadNcResponsibleContacts,
  NC_SCOPE_ATTUAZIONE,
  NC_SCOPE_VERIFICA,
} from '../utils/ncResponsibleContacts';

describe('loadNcResponsibleContacts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('usa API responsible-options quando companyId presente', async () => {
    const get = vi.fn().mockResolvedValue({
      data: [{ id: 1, name: 'Mario', role_type: 'attuazione', active: true }],
    });
    const api = { get, getNotificationContacts: vi.fn() };

    const rows = await loadNcResponsibleContacts(api, {
      companyId: 11,
      scope: NC_SCOPE_ATTUAZIONE,
    });

    expect(get).toHaveBeenCalledWith('/non-conformities/responsible-options?company_id=11&scope=attuazione');
    expect(api.getNotificationContacts).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
  });

  it('fallback rubrica legacy senza companyId', async () => {
    const getNotificationContacts = vi.fn().mockResolvedValue({ data: [] });
    const api = { get: vi.fn(), getNotificationContacts };

    await loadNcResponsibleContacts(api, {
      companyId: null,
      scope: NC_SCOPE_VERIFICA,
    });

    expect(getNotificationContacts).toHaveBeenCalledWith({ active: 'true' });
  });
});
