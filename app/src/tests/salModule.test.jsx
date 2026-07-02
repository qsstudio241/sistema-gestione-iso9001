/**
 * Test L1 — SALModule (Stato Avanzamento Lavori, Fase 1–2 UI)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RouterProvider } from '../contexts/RouterContext';

import { SAL_COMPANY_SCOPE_KEY } from '../utils/salCompanyScope';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin', company_access: [] } }),
}));

vi.mock('../utils/wordExportSal', () => ({
  exportSalTrackerDocx: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/apiService', () => ({
  default: {
    getCompanies: vi.fn(),
    getGapMatrix: vi.fn(),
    updateGapStatus: vi.fn(),
    seedGapMatrix: vi.fn(),
    getGapStatusHistory: vi.fn(),
    getDocuments: vi.fn(),
  },
}));

import apiService from '../services/apiService';
import { exportSalTrackerDocx } from '../utils/wordExportSal';
import SALModule from '../pages/SALModule';

const MATRIX_ROW = {
  normRequirementId: 101,
  clauseRef: '8.4',
  clauseTitle: 'Controllo fornitori',
  standardCode: 'ISO_9001_2015',
  status: 'discussed',
  notes: null,
  responsible: null,
  dueDate: null,
  evidenceDocumentIds: [],
  evidenceDocuments: [],
};

const MATRIX_RESPONSE = {
  success: true,
  data: {
    companyId: 1,
    rows: [MATRIX_ROW],
    summary: {
      discussed: 1,
      in_progress: 0,
      to_validate: 0,
      completed: 0,
      na: 0,
      not_seeded: 0,
      total: 1,
    },
  },
};

function renderSal(ui) {
  return render(<RouterProvider>{ui}</RouterProvider>);
}

async function renderSalWithCompany(companyId = '1') {
  window.localStorage.setItem(SAL_COMPANY_SCOPE_KEY, companyId);
  apiService.getCompanies.mockResolvedValue({
    data: [{ id: 1, name: 'Acme Srl' }],
  });
  apiService.getGapMatrix.mockResolvedValue(MATRIX_RESPONSE);
  apiService.updateGapStatus.mockResolvedValue({ success: true, data: {} });
  apiService.getGapStatusHistory.mockResolvedValue({ data: { history: [] } });
  apiService.getDocuments.mockResolvedValue({ data: { items: [] } });

  await act(async () => {
    renderSal(<SALModule />);
  });
}

describe('SALModule — griglia e cambio stato', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renderizza titolo e griglia con clausola caricata', async () => {
    await renderSalWithCompany();

    expect(screen.getByText('SAL — Stato Avanzamento Lavori')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('8.4')).toBeInTheDocument());
    expect(screen.getByText('Controllo fornitori')).toBeInTheDocument();
    expect(screen.getByLabelText('Stato clausola 8.4')).toBeInTheDocument();
  });

  it('cambia stato inline chiamando updateGapStatus', async () => {
    await renderSalWithCompany();

    await waitFor(() => expect(screen.getByLabelText('Stato clausola 8.4')).toBeInTheDocument());

    const select = screen.getByLabelText('Stato clausola 8.4');
    fireEvent.change(select, { target: { value: 'in_progress' } });

    await waitFor(() => {
      expect(apiService.updateGapStatus).toHaveBeenCalledWith(
        '1',
        101,
        expect.objectContaining({ status: 'in_progress' }),
      );
    });
  });

  it('mostra prompt selezione azienda se ambito vuoto', async () => {
    apiService.getCompanies.mockResolvedValue({
      data: [{ id: 1, name: 'Acme Srl' }],
    });

    await act(async () => {
      renderSal(<SALModule />);
    });

    expect(screen.getByText(/Seleziona un'azienda nell'ambito/)).toBeInTheDocument();
  });

  it('export Word chiama exportSalTrackerDocx con righe matrice', async () => {
    await renderSalWithCompany();

    await waitFor(() => expect(screen.getByText('Export Word')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Export Word'));

    await waitFor(() => {
      expect(exportSalTrackerDocx).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'Acme Srl',
          rows: expect.arrayContaining([
            expect.objectContaining({ clauseRef: '8.4' }),
          ]),
        }),
      );
    });
  });

  it('modale dettaglio carica storico e sezione evidenze registro documenti', async () => {
    await renderSalWithCompany();

    apiService.getGapStatusHistory.mockResolvedValue({
      data: {
        history: [
          {
            id: 1,
            status: 'discussed',
            notes: 'Prima revisione',
            changedAt: '2026-01-10T10:00:00.000Z',
            changedByName: 'Admin',
          },
        ],
      },
    });
    apiService.getDocuments.mockResolvedValue({
      data: {
        items: [{ id: 42, title: 'Procedura acquisti', doc_type: 'procedura' }],
      },
    });

    await waitFor(() => expect(screen.getByText('Modifica')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Modifica'));

    await waitFor(() => {
      expect(apiService.getGapStatusHistory).toHaveBeenCalledWith(1, 101);
      expect(apiService.getDocuments).toHaveBeenCalledWith(
        expect.objectContaining({ company_id: 1, status: 'rilasciato' }),
      );
    });

    expect(screen.getByText('Evidenze documentali')).toBeInTheDocument();
    expect(screen.getByText('Storico revisioni')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Prima revisione')).toBeInTheDocument());
    expect(screen.getByText('Procedura acquisti')).toBeInTheDocument();
  });
});
