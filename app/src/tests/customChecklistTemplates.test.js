import { describe, it, expect } from 'vitest';
import {
  LEG_AMBIENTE_TEMPLATE_MARKER,
  isLegislativoAmbientaleChecklist,
} from '../constants/customChecklistTemplates';

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
});
