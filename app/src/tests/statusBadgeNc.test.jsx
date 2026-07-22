/**
 * Test L1 — StatusBadge (type="nc")
 *
 * Verifica che il badge unificato renderizzi l'etichetta corretta
 * per ogni stato NC usato da PendingIssuesCascade.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';

const NC_STATES = [
  { status: 'open', label: 'Aperta' },
  { status: 'in_progress', label: 'In corso' },
  { status: 'resolved', label: 'Risolta' },
  { status: 'verified', label: 'Verificata' },
  { status: 'closed', label: 'Chiusa' },
];

describe('StatusBadge — stato NC', () => {
  it.each(NC_STATES)(
    'renderizza "$label" per lo stato "$status"',
    ({ status, label }) => {
      const { container } = render(
        <StatusBadge type="nc" status={status} size="small" />
      );
      const badge = container.querySelector('.sgq-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe(label);
      expect(badge.getAttribute('data-status')).toBe(status);
      expect(badge.getAttribute('data-type')).toBe('nc');
      expect(badge.classList.contains('sgq-badge--small')).toBe(true);
    }
  );
});
