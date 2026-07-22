import { describe, it, expect } from 'vitest';
import {
  STATUS_LABELS,
  DETAIL_SLIDES,
  TERMINAL_STATUSES,
  COUNTERPARTY_LABELS,
  DIRECTION_LABELS,
  formatCommercialDocMetaBadge,
} from '../utils/contractReviewLabels';

describe('contractReviewLabels', () => {
  it('espone etichette per tutti gli stati pilota', () => {
    expect(STATUS_LABELS.DRAFT).toBe('Bozza');
    expect(STATUS_LABELS.FINAL_REVIEW).toBe('Riesame finale');
    expect(STATUS_LABELS.APPROVED).toBe('Approvato');
  });

  it('slide dettaglio in ordine operativo', () => {
    const ids = DETAIL_SLIDES.map((s) => s.id);
    expect(ids).toEqual(['workflow', 'checklist', 'clarifications', 'documents', 'drawing', 'ai']);
  });

  it('stati terminali', () => {
    expect(TERMINAL_STATUSES.has('APPROVED')).toBe(true);
    expect(TERMINAL_STATUSES.has('DRAFT')).toBe(false);
  });

  it('etichette controparte e direzione documenti', () => {
    expect(COUNTERPARTY_LABELS.supplier).toBe('Fornitore');
    expect(DIRECTION_LABELS.in).toBe('In entrata');
    expect(formatCommercialDocMetaBadge('supplier', 'in')).toBe('Fornitore · in');
  });
});
