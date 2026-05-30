/**
 * Test L1  NcDetailPanel (NC Fase 1 Slice 5)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockUpdateNcStatus = vi.hoisted(() => vi.fn());

vi.mock('../services/apiService', () => ({
  default: {
    updateNcStatus: (...args) => mockUpdateNcStatus(...args),
    getAttachments: vi.fn().mockResolvedValue({ data: [] }),
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    getAttachmentDownloadUrl: vi.fn(),
  },
}));

vi.mock('../components/ChecklistModule.css', () => ({}));
vi.mock('../components/AttachmentSection.css', () => ({}));
vi.mock('../contexts/RouterContext', () => ({
  Link: ({ children, to, ...rest }) => React.createElement('a', { href: to, ...rest }, children),
}));

import NcDetailPanel from '../components/NcDetailPanel';

const baseNc = {
  nc_id: 42,
  nc_number: 'NC-2026-001',
  status: 'open',
  severity: 'major',
  description: 'Descrizione NC di test',
  root_cause: 'Causa radice di test',
  verification_notes: 'Note verifica di test',
  verification_responsible: 'Luigi Verdi',
  responsible_person: 'Mario Rossi',
  due_date: '2026-06-15T00:00:00.000Z',
  corrective_action: 'Azione legacy deprecata',
};

describe('NcDetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateNcStatus.mockResolvedValue({ success: true });
  });

  it('renderizza i campi popolati dalla NC', () => {
    render(React.createElement(NcDetailPanel, { nc: baseNc, onSaved: vi.fn() }));

    expect(screen.getByLabelText(/Descrizione/i)).toHaveValue('Descrizione NC di test');
    expect(screen.getByLabelText(/Analisi causa radice/i)).toHaveValue('Causa radice di test');
    expect(screen.getByLabelText(/Note verifica efficacia/i)).toHaveValue('Note verifica di test');
    expect(screen.getByLabelText(/Responsabile verifica/i)).toHaveValue('Luigi Verdi');
    expect(screen.getByLabelText(/Responsabile NC/i)).toHaveValue('Mario Rossi');
    expect(screen.getByLabelText(/Scadenza NC/i)).toHaveValue('2026-06-15');
    expect(screen.getByText('Azione legacy deprecata')).toBeInTheDocument();
  });

  it('usa la classe notes-textarea sulle textarea principali', () => {
    render(React.createElement(NcDetailPanel, { nc: baseNc, onSaved: vi.fn() }));

    const textareas = screen.getAllByRole('textbox');
    const notesAreas = textareas.filter(el => el.classList.contains('notes-textarea'));
    expect(notesAreas.length).toBeGreaterThanOrEqual(3);
  });

  it('submit chiama updateNcStatus con payload atteso', async () => {
    const onSaved = vi.fn();
    render(React.createElement(NcDetailPanel, { nc: baseNc, onSaved }));

    fireEvent.change(screen.getByLabelText(/Descrizione/i), {
      target: { value: 'Descrizione aggiornata' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Salva modifiche/i }));

    await waitFor(() => {
      expect(mockUpdateNcStatus).toHaveBeenCalledWith(42, {
        description: 'Descrizione aggiornata',
        root_cause: 'Causa radice di test',
        verification_notes: 'Note verifica di test',
        verification_responsible: 'Luigi Verdi',
        severity: 'major',
        responsible_person: 'Mario Rossi',
        due_date: '2026-06-15',
      });
    });

    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('NC closed: campi read-only e senza pulsante Salva', () => {
    render(React.createElement(NcDetailPanel, {
      nc: { ...baseNc, status: 'closed' },
      onSaved: vi.fn(),
    }));

    expect(screen.getByLabelText(/Descrizione/i)).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: /Salva modifiche/i })).not.toBeInTheDocument();
  });

  it('NC verified: campi read-only e senza pulsante Salva', () => {
    render(React.createElement(NcDetailPanel, {
      nc: { ...baseNc, status: 'verified' },
      onSaved: vi.fn(),
    }));

    expect(screen.getByLabelText(/Severit/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Salva modifiche/i })).not.toBeInTheDocument();
  });

  it('errore API: mostra messaggio senza crash', async () => {
    mockUpdateNcStatus.mockRejectedValue(new Error('Network error'));

    render(React.createElement(NcDetailPanel, { nc: baseNc, onSaved: vi.fn() }));

    fireEvent.click(screen.getByRole('button', { name: /Salva modifiche/i }));

    await waitFor(() => {
      expect(screen.getByText(/Errore durante il salvataggio/i)).toBeInTheDocument();
    });
  });
});
