/**
 * Test L1 - SAL Fase 5-A: suggeritore stato AI (human-in-the-loop)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { RouterProvider } from '../contexts/RouterContext';
import { withCompanyScope } from './helpers/withCompanyScope';

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

/** Suggerimento con asse legislativo valorizzato (SAL 5-B). */
const SUGGESTION_LEGAL = {
  normRequirementId: 101,
  clauseRef: '8.4',
  clauseTitle: 'Controllo fornitori',
  standardCode: 'ISO_45001_2018',
  suggestedStatus: 'to_validate',
  confidence: 'medium',
  rationale: 'Evidenze presenti, da validare.',
  evidenceRefs: [{ documentId: 42, title: 'DVR', used: true }],
  aiUsed: true,
  legal: {
    evaluated: true,
    confidence: 'medium',
    articles: [
      {
        articleRef: 'D.Lgs. 81/2008 art.28',
        standardCode: 'DLgs_81_2008',
        clauseRef: 'art.28',
        title: 'Oggetto della valutazione dei rischi',
        sourceUrl: 'https://www.normattiva.it/dlgs81-art28',
        source: 'local_db',
        textAvailable: true,
        coverage: 'partial',
        gap: 'Manca aggiornamento periodico del DVR.',
        rationale: 'Il DVR copre i rischi ma non risulta aggiornato.',
      },
    ],
  },
};

async function renderSalWithCompany() {
  apiService.getCompanies.mockResolvedValue({ data: [{ id: 1, name: 'Acme Srl' }] });
  apiService.getGapMatrix.mockResolvedValue(MATRIX_RESPONSE);
  apiService.updateGapStatus.mockResolvedValue({ success: true, data: {} });
  apiService.getGapStatusHistory.mockResolvedValue({ data: { history: [] } });
  apiService.getDocuments.mockResolvedValue({ data: { items: [] } });
  apiService.syncSalAuditHints.mockResolvedValue({ data: { updated: 0 } });

  await act(async () => {
    render(<RouterProvider>{withCompanyScope(<SALModule />, '1')}</RouterProvider>);
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

  it('mostra la sezione Conformita legislativa quando il suggerimento ha legal', async () => {
    apiService.suggestSalGapStatus.mockResolvedValue({
      success: true,
      data: { aiAvailable: true, suggestions: [SUGGESTION_LEGAL] },
    });

    await renderSalWithCompany();
    await waitFor(() => expect(screen.getByText('8.4')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Suggerisci stato \(AI\)/ }));
    await screen.findByText('Suggerimenti stato (AI)');

    // Due assi distinti + articolo di legge con copertura + gap + link.
    expect(screen.getByText('Conformit\u00E0 legislativa')).toBeInTheDocument();
    expect(screen.getByText('Conformit\u00E0 norma tecnica')).toBeInTheDocument();
    expect(screen.getByText('D.Lgs. 81/2008 art.28')).toBeInTheDocument();
    expect(screen.getByText('Parziale')).toBeInTheDocument();
    expect(screen.getByText(/Manca aggiornamento periodico/)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Vedi articolo' });
    expect(link).toHaveAttribute('href', 'https://www.normattiva.it/dlgs81-art28');
  });

  it('nessuna sezione legislativa quando il suggerimento non ha legal (graceful)', async () => {
    apiService.suggestSalGapStatus.mockResolvedValue({
      success: true,
      data: { aiAvailable: true, suggestions: [SUGGESTION] },
    });

    await renderSalWithCompany();
    await waitFor(() => expect(screen.getByText('8.4')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Suggerisci stato \(AI\)/ }));
    await screen.findByText('Suggerimenti stato (AI)');

    expect(screen.queryByText('Conformit\u00E0 legislativa')).not.toBeInTheDocument();
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
