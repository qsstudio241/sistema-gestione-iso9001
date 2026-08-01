/**
 * Test L1 — customChecklist.service (ADR-019 D2)
 * Verifica lettura/scrittura reference_text e linked_legislation sulle sezioni.
 */

jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const mockQuery = jest.fn();
jest.mock('../config/database', () => ({ query: mockQuery }));

const customChecklistService = require('./customChecklist.service');

const REQ_USER = { organization_id: 1001, role: 'admin', auditor_org_id: null };
const CHECKLIST_ROW = {
  id: 42,
  organization_id: 1001,
  auditor_org_id: null,
  name: 'Test checklist',
  description: null,
  is_active: 1,
  has_outcome_buttons: 0,
};

function mockChecklistFound() {
  return { recordset: [CHECKLIST_ROW] };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('customChecklist.service — sezioni con riferimento legislativo', () => {
  it('createSection persiste e restituisce reference_text e linked_legislation', async () => {
    mockQuery
      .mockResolvedValueOnce(mockChecklistFound())
      .mockResolvedValueOnce({
        recordset: [{
          id: 7,
          code: 'cap5',
          title: '5. IMPIANTI TERMICI',
          display_order: 1,
          reference_text: 'D.Lgs. 152/2006, Parte V',
          linked_legislation: 'D.Lgs. 152/2006 art.272; art.273',
        }],
      });

    const result = await customChecklistService.createSection(42, REQ_USER, {
      code: 'cap5',
      title: '5. IMPIANTI TERMICI',
      display_order: 1,
      reference_text: 'D.Lgs. 152/2006, Parte V',
      linked_legislation: 'D.Lgs. 152/2006 art.272; art.273',
    });

    expect(result).toEqual(expect.objectContaining({
      reference_text: 'D.Lgs. 152/2006, Parte V',
      linked_legislation: 'D.Lgs. 152/2006 art.272; art.273',
    }));

    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[0]).toContain('reference_text');
    expect(insertCall[0]).toContain('linked_legislation');
    expect(insertCall[1]).toMatchObject({
      reference_text: 'D.Lgs. 152/2006, Parte V',
      linked_legislation: 'D.Lgs. 152/2006 art.272; art.273',
    });
  });

  it('createSection senza campi legislativi usa null (retrocompatibile)', async () => {
    mockQuery
      .mockResolvedValueOnce(mockChecklistFound())
      .mockResolvedValueOnce({
        recordset: [{
          id: 8,
          code: 's1',
          title: 'Sezione base',
          display_order: 0,
          reference_text: null,
          linked_legislation: null,
        }],
      });

    const result = await customChecklistService.createSection(42, REQ_USER, {
      code: 's1',
      title: 'Sezione base',
    });

    expect(result.reference_text).toBeNull();
    expect(result.linked_legislation).toBeNull();
    expect(mockQuery.mock.calls[1][1]).toMatchObject({
      reference_text: null,
      linked_legislation: null,
    });
  });

  it('listSections include reference_text e linked_legislation', async () => {
    mockQuery
      .mockResolvedValueOnce(mockChecklistFound())
      .mockResolvedValueOnce({
        recordset: [{
          id: 7,
          code: 'cap5',
          title: '5. IMPIANTI TERMICI',
          display_order: 1,
          reference_text: 'Testo narrativo',
          linked_legislation: 'D.Lgs. 81/2008 art.28',
        }],
      });

    const sections = await customChecklistService.listSections(42, REQ_USER);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      reference_text: 'Testo narrativo',
      linked_legislation: 'D.Lgs. 81/2008 art.28',
    });
    expect(mockQuery.mock.calls[1][0]).toContain('reference_text');
    expect(mockQuery.mock.calls[1][0]).toContain('linked_legislation');
  });

  it('updateSection aggiorna solo i campi legislativi passati', async () => {
    mockQuery
      .mockResolvedValueOnce(mockChecklistFound())
      .mockResolvedValueOnce({
        recordset: [{
          id: 7,
          code: 'cap5',
          title: '5. IMPIANTI TERMICI',
          display_order: 1,
          reference_text: 'Vecchio testo',
          linked_legislation: 'D.Lgs. 81/2008 art.28',
        }],
      })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [{
          id: 7,
          code: 'cap5',
          title: '5. IMPIANTI TERMICI',
          display_order: 1,
          reference_text: 'Nuovo testo',
          linked_legislation: 'D.Lgs. 81/2008 art.28',
        }],
      });

    const result = await customChecklistService.updateSection(7, 42, REQ_USER, {
      reference_text: 'Nuovo testo',
    });

    expect(result.reference_text).toBe('Nuovo testo');
    expect(result.linked_legislation).toBe('D.Lgs. 81/2008 art.28');
    expect(mockQuery.mock.calls[2][1]).toMatchObject({
      reference_text: 'Nuovo testo',
      linked_legislation: 'D.Lgs. 81/2008 art.28',
    });
  });

  it('getChecklistWithStructure propaga i campi legislativi nelle sezioni', async () => {
    mockQuery
      .mockResolvedValueOnce(mockChecklistFound())
      .mockResolvedValueOnce(mockChecklistFound())
      .mockResolvedValueOnce({
        recordset: [{
          id: 7,
          code: 'cap5',
          title: '5. IMPIANTI TERMICI',
          display_order: 1,
          reference_text: 'Riferimento',
          linked_legislation: 'D.Lgs. 152/2006',
        }],
      })
      .mockResolvedValueOnce(mockChecklistFound())
      .mockResolvedValueOnce({ recordset: [] });

    const data = await customChecklistService.getChecklistWithStructure(42, REQ_USER);

    expect(data.sections).toHaveLength(1);
    expect(data.sections[0]).toMatchObject({
      reference_text: 'Riferimento',
      linked_legislation: 'D.Lgs. 152/2006',
      items: [],
    });
  });
});
