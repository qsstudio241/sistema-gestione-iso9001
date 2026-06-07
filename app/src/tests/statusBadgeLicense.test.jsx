/**
 * Test L1 — StatusBadge (type="license")
 *
 * Verifica che il badge unificato renderizzi l'etichetta corretta
 * per gli stati licenza modulo usati da LicensesSettingsPage.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';

const LICENSE_STATES = [
  { status: 'active', label: 'Attivo' },
  { status: 'inactive', label: 'Non attivo' },
];

describe('StatusBadge — stato licenza', () => {
  it.each(LICENSE_STATES)(
    'renderizza "$label" per lo stato "$status"',
    ({ status, label }) => {
      const { container } = render(
        <StatusBadge type="license" status={status} size="small" />
      );
      const badge = container.querySelector('.sgq-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe(label);
      expect(badge.getAttribute('data-status')).toBe(status);
      expect(badge.getAttribute('data-type')).toBe('license');
    }
  );

  it('non renderizza nulla per uno stato sconosciuto senza label', () => {
    const { container } = render(
      <StatusBadge type="license" status="inesistente" />
    );
    expect(container.querySelector('.sgq-badge')).toBeNull();
  });
});
