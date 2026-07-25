/**
 * Test L1 — NcCreateModal: sincronizzazione ambito azienda ↔ responsabili
 *
 * Regressione (25/07/2026): il selettore "Azienda / ambito" (categorie non
 * legate ad audit) scriveva solo in form.company_id (usato per il payload),
 * ma i menu Responsabile attuazione/verifica restavano agganciati alla
 * variabile selectedCompanyId, mai aggiornata dal nuovo select — risultato:
 * la rubrica proposta non corrispondeva all'azienda selezionata.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockLoadNcResponsibleContacts = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock('../utils/ncResponsibleContacts', () => ({
  loadNcResponsibleContacts: (...args) => mockLoadNcResponsibleContacts(...args),
  NC_SCOPE_ATTUAZIONE: 'attuazione',
  NC_SCOPE_VERIFICA: 'verifica',
}));

vi.mock('../components/ChecklistModule.css', () => ({}));

vi.mock('../services/apiService', () => ({
  default: {
    getCompanies: vi.fn(),
    getAudits: vi.fn().mockResolvedValue({ data: [] }),
    getComplaints: vi.fn().mockResolvedValue({ data: [] }),
    getAudit: vi.fn(),
    getChecklistSectionsByStandard: vi.fn(),
    createNonConformity: vi.fn(),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { organization_id: 1002, role: 'admin' } }),
}));

import apiService from '../services/apiService';
import NcCreateModal from '../components/NcCreateModal';

const COMPANIES = [
  { id: 7, name: 'ERAM TECHNOLOGIES' },
  { id: 9, name: 'ALTRA AZIENDA SRL' },
];

describe('NcCreateModal — ambito azienda per categorie non-audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCompanies.mockResolvedValue({ data: COMPANIES });
    apiService.getAudits.mockResolvedValue({ data: [] });
    apiService.getComplaints.mockResolvedValue({ data: [] });
    mockLoadNcResponsibleContacts.mockResolvedValue([]);
  });

  it('propaga companyId a loadNcResponsibleContacts quando si sceglie l\u2019azienda', async () => {
    render(React.createElement(NcCreateModal, {
      open: true,
      onClose: vi.fn(),
      onCreated: vi.fn(),
      defaultCategory: 'risk_action',
    }));

    // Attende il caricamento aziende e la prima chiamata (companyId assente)
    await waitFor(() => expect(apiService.getCompanies).toHaveBeenCalled());
    await screen.findByLabelText(/Azienda \/ ambito/i);
    await waitFor(() => {
      expect(mockLoadNcResponsibleContacts).toHaveBeenCalledWith(
        apiService,
        expect.objectContaining({ companyId: null }),
      );
    });

    mockLoadNcResponsibleContacts.mockClear();

    fireEvent.change(screen.getByLabelText(/Azienda \/ ambito/i), { target: { value: '7' } });

    await waitFor(() => {
      expect(mockLoadNcResponsibleContacts).toHaveBeenCalledWith(
        apiService,
        expect.objectContaining({ companyId: '7' }),
      );
    });
  });

  it('include company_id nel payload di creazione per categorie non-audit', async () => {
    apiService.createNonConformity.mockResolvedValue({ data: { nc_id: 1 } });
    const onCreated = vi.fn();

    render(React.createElement(NcCreateModal, {
      open: true,
      onClose: vi.fn(),
      onCreated,
      defaultCategory: 'risk_action',
    }));

    await screen.findByLabelText(/Azienda \/ ambito/i);
    fireEvent.change(screen.getByLabelText(/Azienda \/ ambito/i), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/Descrizione/i), { target: { value: 'Rischio di test' } });

    fireEvent.click(screen.getByRole('button', { name: /^Crea$/i }));

    await waitFor(() => expect(apiService.createNonConformity).toHaveBeenCalled());
    const payload = apiService.createNonConformity.mock.calls[0][0];
    expect(payload.company_id).toBe(7);
  });

  it('resetta selectedCompanyId senza lasciare residui quando si passa a categoria audit', async () => {
    render(React.createElement(NcCreateModal, {
      open: true,
      onClose: vi.fn(),
      onCreated: vi.fn(),
      defaultCategory: 'risk_action',
    }));

    await screen.findByLabelText(/Azienda \/ ambito/i);
    fireEvent.change(screen.getByLabelText(/Azienda \/ ambito/i), { target: { value: '7' } });
    await waitFor(() => {
      expect(mockLoadNcResponsibleContacts).toHaveBeenCalledWith(
        apiService,
        expect.objectContaining({ companyId: '7' }),
      );
    });

    mockLoadNcResponsibleContacts.mockClear();
    fireEvent.change(screen.getByLabelText(/Categoria origine/i), { target: { value: 'audit' } });

    await waitFor(() => {
      expect(mockLoadNcResponsibleContacts).toHaveBeenCalledWith(
        apiService,
        expect.objectContaining({ companyId: null }),
      );
    });
  });
});
