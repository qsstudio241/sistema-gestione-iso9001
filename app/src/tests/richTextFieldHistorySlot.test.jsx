/**
 * Test L1 — RichTextField: lo slot dello storico testo esiste già prima del
 * primo blur.
 *
 * Regressione reale (28/07/2026): il blocco "Storico testo" veniva montato solo
 * al primo blur del campo. Il mousedown su "Salva correzione" causava il blur,
 * il blocco appariva, i controlli sottostanti scendevano di ~27px e il mouseup
 * cadeva fuori dal pulsante: nessun evento click, primo salvataggio ignorato.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../components/RichTextField.css', () => ({}));
vi.mock('../components/AutoTextarea.css', () => ({}));

import RichTextField from '../components/RichTextField';

function renderField(props = {}) {
  return render(
    React.createElement(RichTextField, {
      id: 'campo-test',
      value: 'Testo iniziale',
      onChange: vi.fn(),
      draftScopeId: 'nc:42:actions',
      draftFieldId: 'new_correction_description',
      organizationId: 1001,
      persistLocalDraft: true,
      ...props,
    }),
  );
}

describe('RichTextField — slot storico testo', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('riserva lo slot storico prima del primo blur (nessuno spostamento layout)', () => {
    const { container } = renderField();

    const slot = container.querySelector('.rich-text-field-history');
    expect(slot).not.toBeNull();
    // Slot presente ma ancora senza toggle: nessuna voce in storico
    expect(screen.queryByRole('button', { name: /Storico testo/i })).not.toBeInTheDocument();
  });

  it('lo slot resta lo stesso elemento dopo il blur, che aggiunge il toggle', () => {
    const { container } = renderField();

    const slotBefore = container.querySelector('.rich-text-field-history');
    fireEvent.blur(screen.getByRole('textbox'), { target: { value: 'Testo modificato' } });

    const slotAfter = container.querySelector('.rich-text-field-history');
    expect(slotAfter).toBe(slotBefore);
    expect(screen.getByRole('button', { name: /Storico testo/i })).toBeInTheDocument();
  });

  it('campo readOnly: nessuno slot storico', () => {
    const { container } = renderField({ readOnly: true });
    expect(container.querySelector('.rich-text-field-history')).toBeNull();
  });

  it('senza draftScopeId/draftFieldId non riserva lo slot', () => {
    const { container } = renderField({ draftScopeId: null, draftFieldId: null });
    expect(container.querySelector('.rich-text-field-history')).toBeNull();
  });
});
