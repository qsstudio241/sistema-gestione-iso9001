/**
 * Test L1 — StatusBadge (type="user")
 *
 * Verifica che il badge unificato renderizzi l'etichetta corretta
 * per ogni stato utente. UsersAdminPage migra il badge "inactive";
 * gli altri stati restano coperti dalla config condivisa.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';

const USER_STATES = [
  { status: 'active', label: 'Attivo' },
  { status: 'inactive', label: 'Disattivato' },
  { status: 'orphan', label: 'Incompleto' },
];

describe('StatusBadge — stato utente', () => {
  it.each(USER_STATES)(
    'renderizza "$label" per lo stato "$status"',
    ({ status, label }) => {
      const { container } = render(
        <StatusBadge type="user" status={status} size="small" />
      );
      const badge = container.querySelector('.sgq-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe(label);
      expect(badge.getAttribute('data-status')).toBe(status);
      expect(badge.getAttribute('data-type')).toBe('user');
    }
  );

  it('non renderizza nulla per uno stato sconosciuto senza label', () => {
    const { container } = render(
      <StatusBadge type="user" status="inesistente" />
    );
    expect(container.querySelector('.sgq-badge')).toBeNull();
  });
});
