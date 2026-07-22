/**
 * @jest-environment node
 *
 * Test L1 — provisionStudioPatrimony: crea la radice "Patrimonio Studio" con
 * content_scope='studio' e company_id NULL (mai legata a un'azienda cliente).
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const { query } = require('../config/database');
const { provisionStudioPatrimony } = require('./documentTreeProvisioner.service');

const ORG = 1001;

const STRUCTURE = JSON.stringify([
  { code: 'STD', title: 'PATRIMONIO STUDIO', children: [
    { code: 'STD.1', title: 'MODELLI E TEMPLATE' },
  ] },
]);

beforeEach(() => {
  jest.clearAllMocks();
  let nextId = 500;
  query.mockImplementation(async (sql) => {
    if (sql.includes('FROM document_tree_templates')) {
      return { recordset: [{ structure: STRUCTURE }] };
    }
    // Nodo non ancora esistente -> forza INSERT
    if (sql.includes('SELECT id FROM document_registry')) {
      return { recordset: [] };
    }
    if (sql.includes('INSERT INTO document_registry')) {
      return { recordset: [{ id: ++nextId }] };
    }
    if (sql.includes('SELECT parent_id FROM document_registry')) {
      return { recordset: [{ parent_id: null }] };
    }
    // SELECT radice finale (folder_code STD, content_scope studio)
    if (sql.includes("content_scope = 'studio'")) {
      return { recordset: [{ id: 501 }] };
    }
    return { recordset: [] };
  });
});

describe('provisionStudioPatrimony', () => {
  it('inserisce nodi con content_scope=studio e company_id NULL', async () => {
    const result = await provisionStudioPatrimony(ORG);

    const inserts = query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO document_registry'))
      .map(([, p]) => p);

    expect(inserts.length).toBeGreaterThan(0);
    inserts.forEach((p) => {
      expect(p.content_scope).toBe('studio');
      expect(p.company_id).toBeNull();
      expect(p.org_id).toBe(ORG);
    });

    expect(result.rootId).toBe(501);
  });

  it('usa il template studio_patrimonio_v1', async () => {
    await provisionStudioPatrimony(ORG);
    const templateLookup = query.mock.calls.find(([sql]) => sql.includes('FROM document_tree_templates'));
    expect(templateLookup[1].code).toBe('studio_patrimonio_v1');
  });
});
