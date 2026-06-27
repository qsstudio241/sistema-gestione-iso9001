/**
 * @jest-environment node
 */

const {
  TEMPLATE_MARKER,
  QTAFI_VIS001_TEMPLATE,
  isQtafiVis001Description,
} = require('./qtafiVis001Template');

describe('qtafiVis001Template', () => {
  it('template ha 5 sezioni e 11 voci verbale', () => {
    expect(QTAFI_VIS001_TEMPLATE.hasOutcomeButtons).toBe(false);
    expect(QTAFI_VIS001_TEMPLATE.sections).toHaveLength(5);
    const total = QTAFI_VIS001_TEMPLATE.sections.reduce(
      (n, s) => n + s.items.length,
      0
    );
    expect(total).toBe(11);
    expect(QTAFI_VIS001_TEMPLATE.name).toMatch(/QTAFI_VIS001/);
    expect(TEMPLATE_MARKER).toBe('[SGQ_TEMPLATE:QTAFI_VIS001]');
  });

  it('isQtafiVis001Description riconosce il marker', () => {
    expect(isQtafiVis001Description(null)).toBe(false);
    expect(isQtafiVis001Description(`${TEMPLATE_MARKER} test`)).toBe(true);
  });
});
