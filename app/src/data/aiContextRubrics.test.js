/**
 * L1 — mirror FE rubrica studio-v1 (CTX-1)
 */
import { describe, it, expect } from 'vitest';
import {
  STUDIO_CONTEXT_RUBRIC_V1,
  STUDIO_FIELD_LABELS,
  contextLevel,
  scoreStudioContext,
} from './aiContextRubrics';

describe('aiContextRubrics FE (studio-v1)', () => {
  it('versione e label campi', () => {
    expect(STUDIO_CONTEXT_RUBRIC_V1.version).toBe('studio-v1');
    expect(STUDIO_FIELD_LABELS.organization_name).toMatch(/Nome studio/i);
    expect(STUDIO_FIELD_LABELS.ai_context_notes).toMatch(/40/);
  });

  it('contextLevel soglie', () => {
    expect(contextLevel(49)).toBe('incompleto');
    expect(contextLevel(50)).toBe('parziale');
    expect(contextLevel(80)).toBe('pronto');
  });

  it('score vuoto / pieno', () => {
    const empty = scoreStudioContext({});
    expect(empty.score).toBe(0);
    expect(empty.level).toBe('incompleto');
    expect(empty.missing).toEqual(
      expect.arrayContaining(['organization_name', 'vat_number', 'ai_context_notes', 'audit_report_prefix'])
    );

    const full = scoreStudioContext({
      organization_name: 'QS Studio',
      vat_number: 'IT12345678901',
      ai_context_notes: 'Studio consulenza ISO 9001/3834; tono formale; focus saldatura e NC.',
      audit_report_prefix: 'AL',
    });
    expect(full.score).toBe(100);
    expect(full.level).toBe('pronto');
    expect(full.missing).toEqual([]);
  });
});
