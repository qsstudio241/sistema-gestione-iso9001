/**
 * Test L1 — StatusBadge (type="document")
 *
 * Verifica che il badge unificato renderizzi l'etichetta corretta
 * per ogni stato documento usato da DocumentRegistry e DocumentDataGrid.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';

const DOCUMENT_STATES = [
  { status: 'vigente', label: 'Vigente' },
  { status: 'rilasciato', label: 'Rilasciato' },
  { status: 'bozza', label: 'Bozza' },
  { status: 'in_revisione', label: 'In revisione' },
  { status: 'in_approvazione', label: 'In approvazione' },
  { status: 'obsoleto', label: 'Obsoleto' },
];

describe('StatusBadge — stato documento', () => {
  it.each(DOCUMENT_STATES)(
    'renderizza "$label" per lo stato "$status"',
    ({ status, label }) => {
      const { container } = render(
        <StatusBadge type="document" status={status} />
      );
      const badge = container.querySelector('.sgq-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe(label);
      expect(badge.getAttribute('data-status')).toBe(status);
      expect(badge.getAttribute('data-type')).toBe('document');
    }
  );

  it('non renderizza nulla per uno stato sconosciuto senza label', () => {
    const { container } = render(
      <StatusBadge type="document" status="inesistente" />
    );
    expect(container.querySelector('.sgq-badge')).toBeNull();
  });
});
