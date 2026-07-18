/**
 * Test L1 - SAL Fase 5-A: suggeritore stato AI (human-in-the-loop)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RouterProvider } from '../contexts/RouterContext';
import { SAL_COMPANY_SCOPE_KEY } from '../utils/salCompanyScope';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'admin', company_access: [] },
    hasLicensedModule: (key) => key === 'ai_norms' || key === 'sal',
  }),
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
    syncSalAuditHints: vi.fn(),
    suggestSalGapStatus: vi.fn(),
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
  evidenceDocumentIds: [42],
  evidenceDocuments: [],
};

const MATRIX_RESPONSE = {
  success: true,
  data: {
    companyId: 1,
    rows: [MATRIX_ROW],
    summary: { discussed: 1, in_progress: 0, to_validate: 0, completed: 0, na: 0, not_seeded: 0, total: 1 },
  },
};

const SUGGESTION = {
  normRequirementId: 101,
  clauseRef: '8.4',
  clauseTitle: 'Controllo fornitori',
  standardCode: 'ISO_9001_2015',
  suggestedStatus: 'completed',
  confidence: 'high',
  rationale: 'La procedura acquisti copre il controllo dei fornitori esterni.',
  evidenceRefs: [{ documentId: 42, title: 'Procedura acquisti', used: true }],
  aiUsed: true,
};

async function renderSalWithCompany() {
  window.localStorage.setItem(SAL_COMPANY_SCOPE_KEY, '1');
  apiService.getCompanies.mockResolvedValue({ data: [{ id: 1, name: 'Acme Srl' }] });
  apiService.getGapMatrix.mockResolvedValue(MATRIX_RESPONSE);
  apiService.updateGapStatus.mockResolvedValue({ success: true, data: {} });
  apiService.getGapStatusHistory.mockResolvedValue({ data: { history: [] } });
  apiService.getDocuments.mockResolvedValue({ data: { items: [] } });
  apiService.syncSalAuditHints.mockResolvedValue({ data: { updated: 0 } });

  await act(async () => {
    render(<RouterProvider><SALModule /></RouterProvider>);
  });
}

describe('SALModule - suggeritore stato AI (Fase 5-A)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('mostra i pulsanti AI quando la licenza ai_norms e attiva', async () => {
    await renderSalWithCompany();
    await waitFor(() => expect(screen.getByText('8.4')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Suggerisci stato \(AI\)/ })).toBeInTheDocument();
  });

  it('bulk AI apre il dialog con proposta e confidenza', async () => {
    apiService.suggestSalGapStatus.mockResolvedValue({
      success: true,
      data: { companyId: 1, aiAvailable: true, provider: 'gemini', suggestions: [SUGGESTION] },
    });

    await renderSalWithCompany();
    await waitFor(() => expect(screen.getByText('8.4')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Suggerisci stato \(AI\)/ }));

    await waitFor(() => {
      expect(apiService.suggestSalGapStatus).toHaveBeenCalledWith('1', { normRequirementIds: [101] });
    });
    expect(await screen.findByText('Suggerimenti stato (AI)')).toBeInTheDocument();
    expect(screen.getByText(/copre il controllo dei fornitori/)).toBeInTheDocument();
    // Confidenza alta -> badge "Alta" (presente solo nel dialog AI)
    expect(screen.getByText('Alta')).toBeInTheDocument();
  });

  it('Accetta scrive lo stato proposto via updateGapStatus', async () => {
    apiService.suggestSalGapStatus.mockResolvedValue({
      success: true,
      data: { aiAvailable: true, suggestions: [SUGGESTION] },
    });

    await renderSalWithCompany();
    await waitFor(() => expect(screen.getByText('8.4')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Suggerisci stato \(AI\)/ }));
    await screen.findByText('Suggerimenti stato (AI)');

    fireEvent.click(screen.getByRole('button', { name: 'Accetta' }));

    await waitFor(() => {
      expect(apiService.updateGapStatus).toHaveBeenCalledWith(
        '1',
        101,
        expect.objectContaining({ status: 'completed' }),
      );
    });
  });

  it('graceful degradation: aiAvailable=false non apre il dialog', async () => {
    apiService.suggestSalGapStatus.mockResolvedValue({
      success: true,
      data: { aiAvailable: false, message: 'Nessun provider AI configurato', suggestions: [] },
    });

    await renderSalWithCompany();
    await waitFor(() => expect(screen.getByText('8.4')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Suggerisci stato \(AI\)/ }));

    await waitFor(() => {
      expect(screen.queryByText('Suggerimenti stato (AI)')).not.toBeInTheDocument();
    });
  });
});
