/**
 * Test L1 — StatusBadge (type="audit")
 *
 * Verifica che il badge unificato renderizzi l'etichetta corretta
 * per ogni stato audit usato da AuditAccordionLayout e MetricsDashboard.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';

const AUDIT_STATES = [
  { status: 'draft', label: 'Bozza' },
  { status: 'in_progress', label: 'In corso' },
  { status: 'suspended', label: 'Sospeso' },
  { status: 'completed', label: 'Completato' },
  { status: 'approved', label: 'Approvato' },
  { status: 'archived', label: 'Archiviato' },
];

describe('StatusBadge — stato audit', () => {
  it.each(AUDIT_STATES)(
    'renderizza "$label" per lo stato "$status"',
    ({ status, label }) => {
      const { container } = render(
        <StatusBadge type="audit" status={status} />
      );
      const badge = container.querySelector('.sgq-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe(label);
      expect(badge.getAttribute('data-status')).toBe(status);
      expect(badge.getAttribute('data-type')).toBe('audit');
    }
  );

  it('non renderizza nulla per uno stato sconosciuto senza label', () => {
    const { container } = render(
      <StatusBadge type="audit" status="inesistente" />
    );
    expect(container.querySelector('.sgq-badge')).toBeNull();
  });
});
