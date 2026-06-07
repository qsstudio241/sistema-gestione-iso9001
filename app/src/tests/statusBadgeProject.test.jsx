/**
 * Test L1 — StatusBadge (type="project")
 *
 * Verifica le etichette per gli stati commessa realmente usati da
 * ProjectsPage (offerta/aperta/chiusa/sospesa) e la retrocompatibilità
 * con gli stati storici della config condivisa.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';

const PROJECT_STATES = [
  { status: 'offerta', label: 'Offerta' },
  { status: 'aperta', label: 'Aperta' },
  { status: 'chiusa', label: 'Chiusa' },
  { status: 'sospesa', label: 'Sospesa' },
];

const LEGACY_STATES = [
  { status: 'attivo', label: 'Attivo' },
  { status: 'sospeso', label: 'Sospeso' },
  { status: 'completato', label: 'Completato' },
  { status: 'annullato', label: 'Annullato' },
];

describe('StatusBadge — stato commessa', () => {
  it.each(PROJECT_STATES)(
    'renderizza "$label" per lo stato "$status"',
    ({ status, label }) => {
      const { container } = render(
        <StatusBadge type="project" status={status} />
      );
      const badge = container.querySelector('.sgq-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe(label);
      expect(badge.getAttribute('data-status')).toBe(status);
      expect(badge.getAttribute('data-type')).toBe('project');
    }
  );

  it.each(LEGACY_STATES)(
    'mantiene la retrocompatibilità: "$label" per "$status"',
    ({ status, label }) => {
      const { container } = render(
        <StatusBadge type="project" status={status} />
      );
      expect(container.querySelector('.sgq-badge').textContent).toBe(label);
    }
  );
});
