/**
 * Test L1 — ManagementReviewsPage (Riesame di Direzione ISO 9001 §9.3)
 *
 * Copre il comportamento stabile della pagina e del widget §9.3.2:
 *   - parsing partecipanti: JSON serializzato + fallback testo legacy
 *   - serializzazione array partecipanti in salvataggio (JSON string)
 *   - EMPTY_FORM: nuovo riesame parte con campi vuoti / stato "draft"
 *   - pre-popolamento company_id dall'Ambito attivo (localStorage)
 *   - widget "Dati disponibili §9.3.2": rendering tile + pulsanti pre-compila
 *
 * NOTA: parseParticipants ed EMPTY_FORM non sono esportati dal modulo di
 * produzione; sono quindi verificati indirettamente tramite l'interfaccia
 * (apertura del form e ispezione dei campi renderizzati), senza modificare
 * il codice di produzione.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';

import { MGMT_REVIEW_COMPANY_SCOPE_KEY } from '../utils/managementReviewsCompanyScope';

vi.mock('../services/apiService', () => ({
  default: {
    getCompanies: vi.fn(),
    getCompanyPersonnel: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiService from '../services/apiService';
import ManagementReviewsPage, { InputSummaryWidget } from '../pages/ManagementReviewsPage';

const SUMMARY = {
  period: { from: '2026-01-01', to: '2026-06-24' },
  nc: {
    open: 2,
    overdue: 1,
    total_closed_period: 5,
    details: [
      { id: 11, number: 'NC-2026-001', title: 'Mancata registrazione taratura', severity: 'major', status: 'open', due_date: '2026-07-01' },
    ],
  },
  objectives: { total: 4, achieved: 3, percentage: 75 },
  audits: { conducted: 2, planned: 1 },
  suppliers: { evaluated: 3, avg_score: 82 },
  complaints: { total: 1 },
  risks: { open: 3, mitigated_closed_period: 2, high_priority: 1 },
  previous_review: {
    review_number: 'RD-2025-001',
    review_date: '2025-03-15',
    output_improvements: 'Avviata digitalizzazione registri.',
    output_sgq_changes: 'Aggiornata procedura PG-07.',
    output_resources: 'Assunto un tecnico qualita.',
  },
  norm_coverage: [],
};

/**
 * Configura apiService.get come router per URL. La lista riesami e
 * parametrizzabile per test; input-summary risponde sempre con SUMMARY.
 */
function configureGet(reviews = []) {
  apiService.get.mockImplementation((url) => {
    if (typeof url === 'string' && url.startsWith('/management-reviews/input-summary')) {
      return Promise.resolve({ data: SUMMARY });
    }
    if (typeof url === 'string' && url.startsWith('/management-reviews?')) {
      return Promise.resolve({
        data: reviews,
        pagination: { page: 1, limit: 50, total: reviews.length },
      });
    }
    // /management-reviews/:id (dettaglio per export)
    return Promise.resolve({ data: reviews[0] || {} });
  });
}

async function renderPageWithReviews(reviews, companies = [{ id: 1, name: 'Acme Srl' }, { id: 2, name: 'Beta Spa' }]) {
  apiService.getCompanies.mockResolvedValue({ data: companies });
  configureGet(reviews);
  await act(async () => {
    render(<ManagementReviewsPage />);
  });
}

describe('ManagementReviewsPage — parsing partecipanti', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('deserializza partecipanti da stringa JSON in righe modificabili', async () => {
    await renderPageWithReviews([
      {
        id: 5,
        review_number: 'RD-2026-001',
        review_date: '2026-03-01',
        status: 'draft',
        participants: '[{"name":"Mario Rossi","role":"RQ"}]',
      },
    ]);

    await waitFor(() => expect(screen.getByText('RD-2026-001')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Modifica'));
    fireEvent.click(screen.getByRole('button', { name: /Partecipanti/ }));

    expect(screen.getByDisplayValue('Mario Rossi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('RQ')).toBeInTheDocument();
  });

  it('applica il fallback testo legacy "Nome, Ruolo" (una riga per partecipante)', async () => {
    await renderPageWithReviews([
      {
        id: 6,
        review_number: 'RD-2026-002',
        review_date: '2026-03-02',
        status: 'draft',
        participants: 'Mario Rossi, RQ\nLuigi Verdi, Direttore',
      },
    ]);

    await waitFor(() => expect(screen.getByText('RD-2026-002')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Modifica'));
    fireEvent.click(screen.getByRole('button', { name: /Partecipanti/ }));

    expect(screen.getByDisplayValue('Mario Rossi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('RQ')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Luigi Verdi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Direttore')).toBeInTheDocument();
  });

  it('serializza i partecipanti come stringa JSON al salvataggio', async () => {
    apiService.put.mockResolvedValue({ success: true });
    await renderPageWithReviews([
      {
        id: 5,
        review_number: 'RD-2026-001',
        review_date: '2026-03-01',
        status: 'draft',
        participants: '[{"name":"Mario Rossi","role":"RQ"}]',
      },
    ]);

    await waitFor(() => expect(screen.getByText('RD-2026-001')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle('Modifica'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Aggiorna/ }));
    });

    await waitFor(() => expect(apiService.put).toHaveBeenCalled());
    const [path, payload] = apiService.put.mock.calls[0];
    expect(path).toBe('/management-reviews/5');
    expect(typeof payload.participants).toBe('string');
    expect(JSON.parse(payload.participants)).toEqual([{ name: 'Mario Rossi', role: 'RQ' }]);
  });
});

describe('ManagementReviewsPage — EMPTY_FORM e ambito', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('un nuovo riesame parte con campi vuoti e stato "draft"', async () => {
    await renderPageWithReviews([]);

    await waitFor(() => expect(screen.getByText(/Nessun riesame trovato/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '+ Nuovo riesame' }));

    expect(screen.getByRole('heading', { name: /Nuovo riesame di direzione/ })).toBeInTheDocument();
    // Presidente vuoto
    expect(screen.getByPlaceholderText(/Direttore Qualit/)).toHaveValue('');
    // Partecipanti vuoti
    fireEvent.click(screen.getByRole('button', { name: /Partecipanti/ }));
    expect(screen.getByText(/Nessun partecipante aggiunto/)).toBeInTheDocument();
  });

  it('pre-popola company_id dall Ambito attivo (localStorage)', async () => {
    window.localStorage.setItem(MGMT_REVIEW_COMPANY_SCOPE_KEY, '1');

    await renderPageWithReviews([], [{ id: 1, name: 'Acme Srl' }]);

    await waitFor(() => expect(screen.getByText(/Ambito attivo/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '+ Nuovo riesame' }));

    // Con ambito attivo l'azienda e mostrata come testo fisso "(da ambito)"
    expect(screen.getByText(/da ambito/)).toBeInTheDocument();
    const modal = screen.getByText(/da ambito/).closest('.modal-box');
    expect(within(modal).getByText('Acme Srl')).toBeInTheDocument();
  });
});

describe('InputSummaryWidget — rendering tile e pre-compila', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderizza le tile dei dati §9.3.2 dopo il caricamento', async () => {
    apiService.get.mockResolvedValue({ data: SUMMARY });

    await act(async () => {
      render(<InputSummaryWidget companyId={7} reviewId={null} onPrefill={vi.fn()} onFillAll={vi.fn()} />);
    });

    await waitFor(() => expect(screen.getByText(/Non Conformit/)).toBeInTheDocument());
    expect(screen.getByText(/d\) Obiettivi/)).toBeInTheDocument();
    expect(screen.getByText(/b\) Audit/)).toBeInTheDocument();
    expect(screen.getByText(/f\) Fornitori/)).toBeInTheDocument();
    expect(screen.getByText(/Rischi e opportunit/)).toBeInTheDocument();
    // Dettaglio NC rilevanti
    expect(screen.getByText('NC-2026-001')).toBeInTheDocument();
  });

  it('il pulsante "Pre-compila campo c)" accoda il testo NC sul campo corretto', async () => {
    apiService.get.mockResolvedValue({ data: SUMMARY });
    const onPrefill = vi.fn();

    await act(async () => {
      render(<InputSummaryWidget companyId={7} reviewId={null} onPrefill={onPrefill} onFillAll={vi.fn()} />);
    });

    await waitFor(() => expect(screen.getByText('Pre-compila campo c)')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Pre-compila campo c)'));

    expect(onPrefill).toHaveBeenCalledWith('input_nc_corrective', expect.stringContaining('NC aperte: 2'));
  });

  it('il pulsante "Pre-compila campo d)" accoda il testo Obiettivi', async () => {
    apiService.get.mockResolvedValue({ data: SUMMARY });
    const onPrefill = vi.fn();

    await act(async () => {
      render(<InputSummaryWidget companyId={7} reviewId={null} onPrefill={onPrefill} onFillAll={vi.fn()} />);
    });

    await waitFor(() => expect(screen.getByText('Pre-compila campo d)')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Pre-compila campo d)'));

    expect(onPrefill).toHaveBeenCalledWith('input_objectives', expect.stringContaining('Obiettivi totali: 4'));
  });
});
