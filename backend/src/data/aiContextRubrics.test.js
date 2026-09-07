/**
 * L1 — rubriche contesto AI + score (CTX-0, zero LLM)
 */
const {
  STUDIO_CONTEXT_RUBRIC_V1,
  COMPANY_CONTEXT_RUBRIC_V1,
  getRubric,
  getDefaultRubric,
  contextLevel,
  itemFillRatio,
  scoreAgainstRubric,
} = require('./aiContextRubrics');

describe('aiContextRubrics', () => {
  it('versioni default risolvibili', () => {
    expect(getDefaultRubric('studio').version).toBe('studio-v1');
    expect(getDefaultRubric('company').version).toBe('company-v1');
    expect(getRubric('studio-v1')).toBe(STUDIO_CONTEXT_RUBRIC_V1);
    expect(getRubric('company-v1')).toBe(COMPANY_CONTEXT_RUBRIC_V1);
    expect(getRubric('nope')).toBeNull();
    expect(getDefaultRubric('x')).toBeNull();
  });

  it('contextLevel soglie', () => {
    expect(contextLevel(0)).toBe('incompleto');
    expect(contextLevel(49)).toBe('incompleto');
    expect(contextLevel(50)).toBe('parziale');
    expect(contextLevel(79)).toBe('parziale');
    expect(contextLevel(80)).toBe('pronto');
  });

  it('itemFillRatio: vuoto / parziale minLength / pieno', () => {
    expect(itemFillRatio(null, { key: 'a', minLength: 40 })).toBe(0);
    expect(itemFillRatio('   ', { key: 'a', minLength: 40 })).toBe(0);
    expect(itemFillRatio('corto', { key: 'a', minLength: 40 })).toBeGreaterThan(0);
    expect(itemFillRatio('corto', { key: 'a', minLength: 40 })).toBeLessThan(1);
    expect(itemFillRatio('x'.repeat(40), { key: 'a', minLength: 40 })).toBe(1);
    expect(itemFillRatio('ok', { key: 'a' })).toBe(1);
  });
});

describe('scoreAgainstRubric studio-v1', () => {
  it('0 se vuoto', () => {
    const r = scoreAgainstRubric(STUDIO_CONTEXT_RUBRIC_V1, {});
    expect(r.score).toBe(0);
    expect(r.level).toBe('incompleto');
    expect(r.version).toBe('studio-v1');
    expect(r.missing).toEqual(
      expect.arrayContaining(['organization_name', 'vat_number', 'ai_context_notes', 'audit_report_prefix'])
    );
  });

  it('identità sola = 30', () => {
    const r = scoreAgainstRubric(STUDIO_CONTEXT_RUBRIC_V1, {
      organization_name: 'Al.project',
      vat_number: '01234567890',
    });
    expect(r.score).toBe(30);
    expect(r.level).toBe('incompleto');
  });

  it('note sotto minLength danno frazione sul blocco ops', () => {
    const short = scoreAgainstRubric(STUDIO_CONTEXT_RUBRIC_V1, {
      ai_context_notes: 'breve',
    });
    const full = scoreAgainstRubric(STUDIO_CONTEXT_RUBRIC_V1, {
      ai_context_notes: 'Specializzati in metalmeccanica e saldatura ISO 3834 per PMI.',
    });
    expect(short.score).toBeGreaterThan(0);
    expect(short.score).toBeLessThan(50);
    expect(full.score).toBe(50);
  });

  it('profilo pronto >= 80', () => {
    const r = scoreAgainstRubric(STUDIO_CONTEXT_RUBRIC_V1, {
      organization_name: 'Al.project',
      vat_number: '01234567890',
      ai_context_notes: 'Studio consulenza ISO 9001/3834; tono formale; focus saldatura e NC.',
      audit_report_prefix: 'AL',
    });
    expect(r.score).toBe(100);
    expect(r.level).toBe('pronto');
    expect(r.missing).toEqual([]);
  });
});

describe('scoreAgainstRubric company-v1', () => {
  it('0 se vuoto', () => {
    const r = scoreAgainstRubric(COMPANY_CONTEXT_RUBRIC_V1, {});
    expect(r.score).toBe(0);
    expect(r.missing).toEqual(
      expect.arrayContaining(['name', 'vat_number', 'sector', 'address'])
    );
  });

  it('solo name+vat+sector = 50 (blocco identity)', () => {
    const r = scoreAgainstRubric(COMPANY_CONTEXT_RUBRIC_V1, {
      name: 'Acme Srl',
      vat_number: '111',
      sector: 'Metalmeccanica',
    });
    expect(r.score).toBe(50);
    expect(r.level).toBe('parziale');
  });

  it('pieno = 100', () => {
    const r = scoreAgainstRubric(COMPANY_CONTEXT_RUBRIC_V1, {
      name: 'Acme Srl',
      vat_number: '111',
      sector: 'Metalmeccanica',
      address: 'Via Roma 1, Modena',
    });
    expect(r.score).toBe(100);
    expect(r.level).toBe('pronto');
  });
});
