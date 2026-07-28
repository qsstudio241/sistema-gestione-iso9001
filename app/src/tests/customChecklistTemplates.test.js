import { describe, it, expect } from 'vitest';
import {
  LEG_AMBIENTE_TEMPLATE_MARKER,
  isLegislativoAmbientaleChecklist,
} from '../constants/customChecklistTemplates';
import { ISO_45001_LEGISLATIVO_TEMPLATE } from '../data/checklistTemplates';

describe('customChecklistTemplates', () => {
  it('riconosce checklist legislativa dal marker in description', () => {
    expect(
      isLegislativoAmbientaleChecklist({
        name: 'Conformità legislativa ambientale (D.Lgs. 152/06)',
        description: `${LEG_AMBIENTE_TEMPLATE_MARKER} test`,
      })
    ).toBe(true);
    expect(isLegislativoAmbientaleChecklist({ description: 'altro' })).toBe(false);
  });

  it('mantiene univoci capitoli e sotto-domande del registro sicurezza', () => {
    expect(ISO_45001_LEGISLATIVO_TEMPLATE.standardCode).toBe('LEG_SICUREZZA_81');
    expect(ISO_45001_LEGISLATIVO_TEMPLATE.sections).toHaveLength(28);

    const sectionCodes = ISO_45001_LEGISLATIVO_TEMPLATE.sections.map(
      (section) => section.sectionCode
    );
    expect(new Set(sectionCodes).size).toBe(sectionCodes.length);

    const sectionsWithReference = ISO_45001_LEGISLATIVO_TEMPLATE.sections.filter(
      (section) => section.referenceText
    );
    expect(sectionsWithReference.length).toBeGreaterThanOrEqual(23);

    for (const section of ISO_45001_LEGISLATIVO_TEMPLATE.sections) {
      const itemCodes = section.questions.map((question) => question.clauseRef);
      expect(new Set(itemCodes).size).toBe(itemCodes.length);
      for (const question of section.questions) {
        expect(question.responseType).toBe('legal_check');
      }
    }
  });
});
