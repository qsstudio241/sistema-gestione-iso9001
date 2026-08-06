/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const { query } = require('../config/database');
const {
  LEG_SICUREZZA_TEMPLATE_MARKER,
  seedLegislativoSicurezzaChecklist,
} = require('./customChecklist.service');
const {
  LEGISLATIVO_SICUREZZA_TEMPLATE,
} = require('../data/legislativoSicurezzaTemplate');

describe('customChecklist legislativo sicurezza', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('espone un template strutturalmente valido e senza capitoli duplicati', () => {
    expect(LEG_SICUREZZA_TEMPLATE_MARKER).toBe(
      '[SGQ_TEMPLATE:LEG_SICUREZZA_81]'
    );
    expect(LEGISLATIVO_SICUREZZA_TEMPLATE.sections).toHaveLength(28);

    const codes = LEGISLATIVO_SICUREZZA_TEMPLATE.sections.map(
      (section) => section.code
    );
    expect(new Set(codes).size).toBe(codes.length);
    expect(
      LEGISLATIVO_SICUREZZA_TEMPLATE.sections.filter(
        (section) => section.referenceText
      )
    ).toHaveLength(27);

    for (const section of LEGISLATIVO_SICUREZZA_TEMPLATE.sections) {
      const itemCodes = section.items.map((item) => item.code);
      expect(new Set(itemCodes).size).toBe(itemCodes.length);
      for (const item of section.items) {
        expect(item.responseType).toBe('legal_check');
      }
    }
  });

  it('seeda una sola volta e persiste i riferimenti di sezione', async () => {
    const state = {
      checklist: null,
      sections: [],
      nextSectionId: 1000,
    };

    query.mockImplementation(async (sql, params = {}) => {
      if (sql.includes('CHARINDEX(@marker, description)')) {
        return {
          recordset: state.checklist ? [{ id: state.checklist.id }] : [],
        };
      }

      if (sql.includes('INSERT INTO custom_checklists')) {
        state.checklist = {
          id: 501,
          organization_id: params.organization_id,
          auditor_org_id: params.auditor_org_id,
          name: params.name,
          description: params.description,
          is_active: params.is_active,
          has_outcome_buttons: params.has_outcome_buttons,
        };
        return { recordset: [state.checklist] };
      }

      if (
        sql.includes('FROM custom_checklists') &&
        sql.includes('WHERE id = @id')
      ) {
        return {
          recordset:
            state.checklist && Number(params.id) === state.checklist.id
              ? [state.checklist]
              : [],
        };
      }

      if (sql.includes('INSERT INTO custom_checklist_sections')) {
        const section = {
          id: state.nextSectionId++,
          code: params.code,
          title: params.title,
          display_order: params.display_order,
          reference_text: params.reference_text,
          linked_legislation: params.linked_legislation,
        };
        state.sections.push(section);
        return { recordset: [section] };
      }

      if (
        sql.includes('SELECT id, code, title, display_order, reference_text') &&
        sql.includes('FROM custom_checklist_sections')
      ) {
        return { recordset: state.sections };
      }

      if (sql.includes('SELECT cci.id')) {
        return { recordset: [] };
      }

      throw new Error(`Query inattesa nel test: ${sql}`);
    });

    const reqUser = {
      organization_id: 77,
      auditor_org_id: null,
      role: 'admin',
    };

    const first = await seedLegislativoSicurezzaChecklist(reqUser);
    const second = await seedLegislativoSicurezzaChecklist(reqUser);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.data.sections).toHaveLength(28);
    expect(second.data.sections).toHaveLength(28);

    const checklistInserts = query.mock.calls.filter(([sql]) =>
      sql.includes('INSERT INTO custom_checklists')
    );
    const sectionInserts = query.mock.calls.filter(([sql]) =>
      sql.includes('INSERT INTO custom_checklist_sections')
    );
    expect(checklistInserts).toHaveLength(1);
    expect(sectionInserts).toHaveLength(28);
    expect(
      sectionInserts.filter(([, params]) => params.reference_text)
    ).toHaveLength(27);
  });
});
