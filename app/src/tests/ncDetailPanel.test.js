/**
 * Test L1 - NcDetailPanel (NC Fase 1 Slice 5)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockUpdateNcStatus = vi.hoisted(() => vi.fn());
const mockGetNotificationContacts = vi.hoisted(() => vi.fn().mockResolvedValue({ data: [] }));

vi.mock('../utils/ncResponsibleContacts', () => ({
  loadNcResponsibleContacts: vi.fn().mockResolvedValue([]),
  NC_SCOPE_ATTUAZIONE: 'attuazione',
  NC_SCOPE_VERIFICA: 'verifica',
}));

vi.mock('../components/NcActionsList', () => ({
  default: () => null,
}));

vi.mock('../components/NcCorrectionSection', () => ({
  default: () => null,
}));

vi.mock('../hooks/useNcActions', () => ({
  useNcActions: () => ({
    actions: [],
    loading: false,
    contacts: [],
    dueFilter: 'all',
    setDueFilter: vi.fn(),
    editDraft: null,
    isClosed: false,
    filteredActions: [],
    immediateActions: [],
    otherActions: [],
    overdueActionsCount: 0,
    dueSoonActionsCount: 0,
    hasCompletedCorrection: false,
    load: vi.fn(),
    createAction: vi.fn(),
    handleStatus: vi.fn(),
    handleStartEdit: vi.fn(),
    handleCancelEdit: vi.fn(),
    handleSaveEdit: vi.fn(),
    handleDelete: vi.fn(),
  }),
}));

vi.mock('../services/apiService', () => ({
  default: {
    updateNcStatus: (...args) => mockUpdateNcStatus(...args),
    getNcActions: vi.fn().mockResolvedValue({ data: [] }),
    getNotificationContacts: (...args) => mockGetNotificationContacts(...args),
    getAttachments: vi.fn().mockResolvedValue({ data: [] }),
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
    getAttachmentDownloadUrl: vi.fn(),
  },
}));

vi.mock('../components/ChecklistModule.css', () => ({}));
vi.mock('../components/AttachmentSection.css', () => ({}));
vi.mock('../components/AutoTextarea.css', () => ({}));
vi.mock('../components/RichTextField.css', () => ({}));
vi.mock('../contexts/RouterContext', () => ({
  Link: ({ children, to, ...rest }) => React.createElement('a', { href: to, ...rest }, children),
  useNavigate: () => () => {},
}));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { organization_id: 1001, role: 'admin' } }),
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
    mockGetNotificationContacts.mockResolvedValue({ data: [] });
  });

  it('renderizza i campi popolati dalla NC', () => {
    render(React.createElement(NcDetailPanel, { nc: baseNc, onSaved: vi.fn() }));

    expect(screen.getByText('1. Scheda NC')).toBeInTheDocument();
    expect(screen.getByText('2. Difetto/Problema')).toBeInTheDocument();
    expect(screen.getByText('3. Trattamento')).toBeInTheDocument();
    expect(screen.getByText('4. Cause e valutazione')).toBeInTheDocument();
    expect(screen.getByText('6. Azioni correttive / preventive')).toBeInTheDocument();
    expect(screen.getByText('7. Evidenze')).toBeInTheDocument();
    expect(screen.getByText('8. Verifica efficacia')).toBeInTheDocument();

    expect(screen.getByLabelText(/Descrizione/i)).toHaveValue('Descrizione NC di test');
    expect(screen.getByLabelText(/Analisi causa radice/i)).toHaveValue('Causa radice di test');
    expect(screen.getByLabelText(/Note verifica efficacia/i)).toHaveValue('Note verifica di test');
    expect(screen.getByLabelText(/Responsabile verifica/i)).toHaveValue('Luigi Verdi');
    expect(screen.getByLabelText(/Responsabile NC/i)).toHaveValue('');
    expect(screen.getByText(/Valore attuale: Mario Rossi/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Scadenza NC/i)).toHaveValue('2026-06-15');
    expect(screen.getByText('Azione legacy deprecata')).toBeInTheDocument();
  });

  it('ordine DOM: difetto prima di cause, cause prima di verifica', () => {
    render(React.createElement(NcDetailPanel, { nc: baseNc, onSaved: vi.fn() }));

    const desc = screen.getByLabelText(/Descrizione/i);
    const root = screen.getByLabelText(/Analisi causa radice/i);
    const verif = screen.getByLabelText(/Note verifica efficacia/i);

    expect(desc.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(root.compareDocumentPosition(verif) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sezione 2 workflow visibile con callback onStatusChange', () => {
    render(React.createElement(NcDetailPanel, {
      nc: baseNc,
      onSaved: vi.fn(),
      onStatusChange: vi.fn(),
    }));

    expect(screen.getByText('5. Stato workflow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Avvia lavorazione/i })).toBeInTheDocument();
  });

  it('NC open: sezione verifica collassata con hint', () => {
    render(React.createElement(NcDetailPanel, { nc: baseNc, onSaved: vi.fn() }));

    expect(screen.getByText(/Compilare a fine lavori/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mostra/i })).toBeInTheDocument();
  });

  it('usa la classe notes-textarea sulle textarea principali', () => {
    render(React.createElement(NcDetailPanel, {
      nc: { ...baseNc, status: 'resolved' },
      onSaved: vi.fn(),
    }));

    const textareas = screen.getAllByRole('textbox');
    const notesAreas = textareas.filter((el) => el.classList.contains('notes-textarea'));
    expect(notesAreas.length).toBeGreaterThanOrEqual(3);
  });

  it('submit chiama updateNcStatus con payload atteso', async () => {
    const onSaved = vi.fn();
    render(React.createElement(NcDetailPanel, {
      nc: { ...baseNc, status: 'resolved' },
      onSaved,
    }));

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
        verification_contact_id: null,
        severity: 'major',
        responsible_person: 'Mario Rossi',
        responsible_contact_id: null,
        due_date: '2026-06-15',
        corrective_action_needed: null,
        corrective_action_evaluation_notes: null,
      });
    });

    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('NC closed: campi read-only e senza pulsante Salva', () => {
    render(React.createElement(NcDetailPanel, {
      nc: { ...baseNc, status: 'closed', approved_at: '2026-05-30' },
      onSaved: vi.fn(),
      readOnly: true,
    }));

    expect(screen.getByLabelText(/Descrizione/i)).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Salva modifiche/i })).not.toBeInTheDocument();
  });

  it('NC closed + isRq: pulsante Riapri NC in sezione Chiusura', () => {
    render(React.createElement(NcDetailPanel, {
      nc: { ...baseNc, status: 'closed', approved_at: '2026-05-30' },
      onSaved: vi.fn(),
      readOnly: true,
      isRq: true,
      onStatusChange: vi.fn(),
    }));

    expect(screen.getByText('9. Chiusura')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Riapri NC/i })).toBeInTheDocument();
  });

  it('NC verified: campi read-only e senza pulsante Salva', () => {
    render(React.createElement(NcDetailPanel, {
      nc: { ...baseNc, status: 'verified' },
      onSaved: vi.fn(),
    }));

    expect(document.getElementById('nc-sev-42')).toBeDisabled();
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
