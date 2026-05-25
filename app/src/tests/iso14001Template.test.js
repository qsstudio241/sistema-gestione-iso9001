import { describe, it, expect } from 'vitest';
import { ISO_14001_TEMPLATE, ISO_14001_LEGISLATIVO_TEMPLATE } from '../data/checklistTemplates';

describe('ISO 14001 checklist templates', () => {
  it('ISO_14001_TEMPLATE copre il SGA (clausole 4-10), non la matrice legislativa', () => {
    const codes = ISO_14001_TEMPLATE.sections.map((s) => s.sectionCode);
    expect(codes).toEqual([
      '14001_c4', '14001_c5', '14001_c6', '14001_c7',
      '14001_c8', '14001_c9', '14001_c10',
    ]);
    const totalQ = ISO_14001_TEMPLATE.sections.reduce(
      (n, s) => n + s.questions.length,
      0,
    );
    expect(totalQ).toBe(53);
    const texts = ISO_14001_TEMPLATE.sections.flatMap((s) =>
      s.questions.map((q) => q.questionText),
    );
    expect(texts.some((t) => t.includes('SGA'))).toBe(true);
    expect(texts.some((t) => t.includes('EDILIZIA'))).toBe(false);
    expect(texts.some((t) => t.includes('VIA)'))).toBe(false);
  });

  it('matrice legislativa resta disponibile come template separato', () => {
    const codes = ISO_14001_LEGISLATIVO_TEMPLATE.sections.map((s) => s.sectionCode);
    expect(codes).toContain('14001_s4');
    const texts = ISO_14001_LEGISLATIVO_TEMPLATE.sections.flatMap((s) =>
      s.questions.map((q) => q.questionText),
    );
    expect(texts.some((t) => t.includes('RIFIUTI'))).toBe(true);
  });
});
