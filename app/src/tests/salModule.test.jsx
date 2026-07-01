/**
 * Test L1 — SALModule (Stato Avanzamento Lavori, Fase 1 UI)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

import { SAL_COMPANY_SCOPE_KEY } from '../utils/salCompanyScope';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin', company_access: [] } }),
}));

vi.mock('../services/apiService', () => ({
  default: {
    getCompanies: vi.fn(),
    getGapMatrix: vi.fn(),
    updateGapStatus: vi.fn(),
    seedGapMatrix: vi.fn(),
  },
}));

import apiService from '../services/apiService';
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

async function renderSalWithCompany(companyId = '1') {
  window.localStorage.setItem(SAL_COMPANY_SCOPE_KEY, companyId);
  apiService.getCompanies.mockResolvedValue({
    data: [{ id: 1, name: 'Acme Srl' }],
  });
  apiService.getGapMatrix.mockResolvedValue(MATRIX_RESPONSE);
  apiService.updateGapStatus.mockResolvedValue({ success: true, data: {} });

  await act(async () => {
    render(<SALModule />);
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
      render(<SALModule />);
    });

    expect(screen.getByText(/Seleziona un'azienda nell'ambito/)).toBeInTheDocument();
  });
});
