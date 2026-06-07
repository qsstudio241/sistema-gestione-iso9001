/**
 * @jest-environment node
 */

const {
  TEMPLATE_MARKER,
  LEGISLATIVO_AMBIENTALE_TEMPLATE,
  isLegislativoAmbientaleDescription,
} = require('./legislativoAmbientaleTemplate');

describe('legislativoAmbientaleTemplate', () => {
  it('template ha 2 sezioni e 46 voci con outcome buttons', () => {
    expect(LEGISLATIVO_AMBIENTALE_TEMPLATE.hasOutcomeButtons).toBe(true);
    expect(LEGISLATIVO_AMBIENTALE_TEMPLATE.sections).toHaveLength(2);
    const total = LEGISLATIVO_AMBIENTALE_TEMPLATE.sections.reduce(
      (n, s) => n + s.items.length,
      0
    );
    expect(total).toBe(46);
    expect(LEGISLATIVO_AMBIENTALE_TEMPLATE.name).toMatch(/152\/06/);
    expect(LEGISLATIVO_AMBIENTALE_TEMPLATE.description).toContain('Non è audit ISO 14001');
    expect(TEMPLATE_MARKER).toBe('[SGQ_TEMPLATE:LEG_AMBIENTE_152]');
  });

  it('isLegislativoAmbientaleDescription riconosce il marker', () => {
    expect(isLegislativoAmbientaleDescription(null)).toBe(false);
    expect(
      isLegislativoAmbientaleDescription(`${TEMPLATE_MARKER} test`)
    ).toBe(true);
  });
});
