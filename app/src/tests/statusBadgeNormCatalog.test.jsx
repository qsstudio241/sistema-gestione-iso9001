/**
 * Test L1 — StatusBadge (type="norm_catalog")
 *
 * Verifica le etichette per lo stato norma nel catalogo dell'ente,
 * usato da ImportJobsPage (CommitNormStatusBadge). I valori reali
 * emessi dal lookup sono active/withdrawn/superseded/unknown, più lo
 * stato transitorio loading.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';

const NORM_STATES = [
  { status: 'active', label: 'In vigore' },
  { status: 'withdrawn', label: 'Ritirata' },
  { status: 'superseded', label: 'Sostituita' },
  { status: 'unknown', label: 'Stato non disponibile' },
  { status: 'loading', label: 'Verifica in corso\u2026' },
];

describe('StatusBadge — stato norma catalogo', () => {
  it.each(NORM_STATES)(
    'renderizza "$label" per lo stato "$status"',
    ({ status, label }) => {
      const { container } = render(
        <StatusBadge type="norm_catalog" status={status} size="small" />
      );
      const badge = container.querySelector('.sgq-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe(label);
      expect(badge.getAttribute('data-status')).toBe(status);
      expect(badge.getAttribute('data-type')).toBe('norm_catalog');
    }
  );

  it('usa la label override per "Sostituita da <norma>"', () => {
    const { container } = render(
      <StatusBadge
        type="norm_catalog"
        status="superseded"
        label="Sostituita da UNI EN 1090-2"
        size="small"
      />
    );
    expect(container.querySelector('.sgq-badge').textContent).toBe(
      'Sostituita da UNI EN 1090-2'
    );
  });

  it('non renderizza nulla per uno stato sconosciuto senza label', () => {
    const { container } = render(
      <StatusBadge type="norm_catalog" status="inesistente" />
    );
    expect(container.querySelector('.sgq-badge')).toBeNull();
  });
});
