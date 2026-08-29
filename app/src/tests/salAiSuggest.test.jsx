/**
 * Test L1 - SAL Fase 5-A: suggeritore stato AI (human-in-the-loop)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
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
import SalAiSuggestDialog, {
  getMissingEvidenceSuggestion,
} from '../components/SalAiSuggestDialog';

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
  missingEvidenceSuggestion: null,
};

const MISSING_EVIDENCE = {
  typicalDocType: 'procedura',
  typicalDocTypeLabel: 'Procedura',
  candidates: [
    { id: 10, title: 'PG-07 Acquisti', doc_type: 'procedura', doc_code: 'PG-07' },
  ],
  reason: 'Nessuna evidenza collegata alla clausola 8.4. Tipo tipico: Procedura.',
};

const SUGGESTION_MISSING = {
  ...SUGGESTION,
  suggestedStatus: 'discussed',
  confidence: 'low',
  rationale: 'Collega i documenti al requisito prima di valutare la clausola.',
  evidenceRefs: [],
  missingEvidenceSuggestion: MISSING_EVIDENCE,
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

async function renderSalWithCompany(rowOverrides = {}) {
  const row = { ...MATRIX_ROW, ...rowOverrides };
  apiService.getCompanies.mockResolvedValue({ data: [{ id: 1, name: 'Acme Srl' }] });
  apiService.getGapMatrix.mockResolvedValue({
    success: true,
    data: { ...MATRIX_RESPONSE.data, rows: [row] },
  });
  apiService.updateGapStatus.mockResolvedValue({ success: true, data: {} });
  apiService.getGapStatusHistory.mockResolvedValue({ data: { history: [] } });
  apiService.getDocuments.mockResolvedValue({ data: { items: [] } });
  apiService.syncSalAuditHints.mockResolvedValue({ data: { updated: 0 } });

  await act(async () => {
    render(<RouterProvider>{withCompanyScope(<SALModule />, '1')}</RouterProvider>);
  });
}

function renderDialog(props = {}) {
  return render(
    <RouterProvider>
      <SalAiSuggestDialog
        open
        suggestions={[SUGGESTION]}
        companyId={1}
        {...props}
      />
    </RouterProvider>,
  );
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
    const dialog = await screen.findByRole('dialog', { name: /Suggerimenti stato/ });
    // Attendi lo stato proposto nel dialog (items sync) prima di Accetta.
    // Non usare screen.getByText('Completato'): è già nelle option della griglia.
    expect(within(dialog).getByText(/Completato/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Accetta' }));

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

describe('SalAiSuggestDialog - S2b documento mancante HITL', () => {
  it('getMissingEvidenceSuggestion: oggetto sì, null/assente no', () => {
    expect(getMissingEvidenceSuggestion({ missingEvidenceSuggestion: MISSING_EVIDENCE })).toBe(MISSING_EVIDENCE);
    expect(getMissingEvidenceSuggestion({ missingEvidenceSuggestion: null })).toBeNull();
    expect(getMissingEvidenceSuggestion({})).toBeNull();
    expect(getMissingEvidenceSuggestion({ missingEvidenceSuggestion: 'x' })).toBeNull();
  });

  it('mostra tipo tipico, reason e candidati se missingEvidenceSuggestion e oggetto', () => {
    renderDialog({ suggestions: [SUGGESTION_MISSING] });
    const block = screen.getByTestId('sal-ai-missing-evidence');
    expect(within(block).getByText('Documento mancante')).toBeInTheDocument();
    expect(within(block).getByText('Procedura')).toBeInTheDocument();
    expect(within(block).getByText(/Nessuna evidenza collegata alla clausola 8.4/)).toBeInTheDocument();
    expect(within(block).getByText(/PG-07 Acquisti/)).toBeInTheDocument();
    expect(within(block).getByRole('button', { name: /Collega/ })).toBeInTheDocument();
    expect(within(block).getByRole('link', { name: 'Carica nel registro' })).toHaveAttribute(
      'href',
      '/documents?tab=catalog&company_id=1',
    );
    expect(screen.getByText(/supervisione di un professionista/)).toBeInTheDocument();
  });

  it('non mostra il blocco se missingEvidenceSuggestion e null', () => {
    renderDialog({ suggestions: [SUGGESTION] });
    expect(screen.queryByTestId('sal-ai-missing-evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('Documento mancante')).not.toBeInTheDocument();
  });

  it('Ignora nasconde il blocco senza chiamare onLinkCandidate', () => {
    const onLinkCandidate = vi.fn();
    renderDialog({ suggestions: [SUGGESTION_MISSING], onLinkCandidate });
    fireEvent.click(screen.getByRole('button', { name: 'Ignora' }));
    expect(screen.queryByTestId('sal-ai-missing-evidence')).not.toBeInTheDocument();
    expect(onLinkCandidate).not.toHaveBeenCalled();
  });

  it('Collega chiama onLinkCandidate solo al click; apertura dialog zero write', async () => {
    const onLinkCandidate = vi.fn().mockResolvedValue(true);
    renderDialog({ suggestions: [SUGGESTION_MISSING], onLinkCandidate });
    expect(onLinkCandidate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Collega PG-07/ }));
    expect(onLinkCandidate).toHaveBeenCalledTimes(1);
    expect(onLinkCandidate).toHaveBeenCalledWith(
      SUGGESTION_MISSING,
      MISSING_EVIDENCE.candidates[0],
    );
    await waitFor(() => {
      expect(screen.queryByTestId('sal-ai-missing-evidence')).not.toBeInTheDocument();
    });
  });
});

describe('SALModule - S2b collega candidato (PATCH evidenze)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('Collega scrive solo evidenceDocumentIds, non lo stato AI, e solo dopo il click', async () => {
    apiService.suggestSalGapStatus.mockResolvedValue({
      success: true,
      data: { aiAvailable: true, suggestions: [SUGGESTION_MISSING] },
    });

    await renderSalWithCompany({ evidenceDocumentIds: [], status: 'discussed' });
    await waitFor(() => expect(screen.getByText('8.4')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Suggerisci stato \(AI\)/ }));
    const dialog = await screen.findByRole('dialog', { name: /Suggerimenti stato/ });

    expect(apiService.updateGapStatus).not.toHaveBeenCalled();
    expect(within(dialog).getByTestId('sal-ai-missing-evidence')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: /Collega PG-07/ }));

    await waitFor(() => {
      expect(apiService.updateGapStatus).toHaveBeenCalledWith(
        '1',
        101,
        expect.objectContaining({
          status: 'discussed',
          evidenceDocumentIds: [10],
        }),
      );
    });
    expect(apiService.updateGapStatus).toHaveBeenCalledTimes(1);
  });
});
