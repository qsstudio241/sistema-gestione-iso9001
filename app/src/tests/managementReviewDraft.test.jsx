/**
 * Test L1 — InputSummaryWidget: generazione bozza §9.3.2
 *
 * Copre il wiring del pulsante "Genera bozza testo" verso l'endpoint backend
 * POST /management-reviews/:id/generate-draft, con fallback robusto ai template locali.
 *
 * Scenari:
 *   - Riesame salvato + AI configurata → usa i summary del backend, badge "AI attiva"
 *   - Riesame salvato + fallback server (ai_used:false) → badge "Bozza automatica"
 *   - Chiamata backend fallita → degradazione ai template locali (nessun blocco UI)
 *   - Riesame non salvato (nessun reviewId) → nessuna chiamata backend, template locali
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { InputSummaryWidget } from '../pages/ManagementReviewsPage';

vi.mock('../services/apiService', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import apiService from '../services/apiService';

const SUMMARY = {
  period: { from: '2026-01-01', to: '2026-06-23' },
  nc:         { open: 2, overdue: 1, total_closed_period: 5 },
  objectives: { total: 4, achieved: 3, percentage: 75 },
  audits:     { conducted: 2, planned: 1 },
  suppliers:  { evaluated: 3, avg_score: 82 },
  complaints: { total: 1 },
  norm_coverage: [],
};

/** Attende che l'auto-load §9.3.2 abiliti il pulsante "Genera bozza testo" */
async function renderAndWait(props) {
  apiService.get.mockResolvedValue({ success: true, data: SUMMARY });
  const onFillAll = vi.fn();
  await act(async () => {
    render(<InputSummaryWidget onFillAll={onFillAll} onPrefill={vi.fn()} {...props} />);
  });
  await waitFor(() => {
    const btn = screen.getByText(/Genera bozza testo/);
    expect(btn.disabled).toBe(false);
  });
  return { onFillAll };
}

describe('InputSummaryWidget — generazione bozza §9.3.2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('riesame salvato + AI: usa i summary backend e mostra badge "AI attiva"', async () => {
    const { onFillAll } = await renderAndWait({ reviewId: 42, companyId: 7 });

    apiService.post.mockResolvedValue({
      success: true,
      drafts: {
        nc_summary: 'Sintesi NC AI.',
        objectives_summary: 'Sintesi obiettivi AI.',
        audits_summary: 'Sintesi audit AI.',
        suppliers_summary: 'Sintesi fornitori AI.',
        norm_gaps: 'Gap normativi AI.',
      },
      meta: { ai_used: true },
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Genera bozza testo/));
    });

    expect(apiService.post).toHaveBeenCalledTimes(1);
    const [path, body] = apiService.post.mock.calls[0];
    expect(path).toBe('/management-reviews/42/generate-draft');
    expect(body.company_id).toBe(7);
    expect(body.period_from).toBe('2026-01-01');

    // Mappatura dei 5 summary sui campi corretti
    expect(onFillAll).toHaveBeenCalledWith('input_nc_corrective', 'Sintesi NC AI.');
    expect(onFillAll).toHaveBeenCalledWith('input_objectives', 'Sintesi obiettivi AI.');
    expect(onFillAll).toHaveBeenCalledWith('input_audits', 'Sintesi audit AI.');
    expect(onFillAll).toHaveBeenCalledWith('input_suppliers', 'Sintesi fornitori AI.');
    expect(onFillAll).toHaveBeenCalledWith('input_improvements', 'Gap normativi AI.');

    await waitFor(() => expect(screen.getByText('AI attiva')).toBeTruthy());
  });

  it('riesame salvato + fallback server: badge "Bozza automatica"', async () => {
    const { onFillAll } = await renderAndWait({ reviewId: 42, companyId: null });

    apiService.post.mockResolvedValue({
      success: true,
      drafts: { nc_summary: 'Testo deterministico server.' },
      meta: { ai_used: false },
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Genera bozza testo/));
    });

    expect(onFillAll).toHaveBeenCalledWith('input_nc_corrective', 'Testo deterministico server.');
    await waitFor(() => expect(screen.getByText('Bozza automatica')).toBeTruthy());
  });

  it('chiamata backend fallita: degrada ai template locali (nessun blocco)', async () => {
    const { onFillAll } = await renderAndWait({ reviewId: 42, companyId: null });

    apiService.post.mockRejectedValue(new Error('Network Error'));

    await act(async () => {
      fireEvent.click(screen.getByText(/Genera bozza testo/));
    });

    // I template locali compilano comunque i campi dai dati aggregati
    const filledFields = onFillAll.mock.calls.map((c) => c[0]);
    expect(filledFields).toContain('input_nc_corrective');
    expect(filledFields).toContain('input_objectives');
    expect(filledFields).toContain('input_audits');
    await waitFor(() => expect(screen.getByText('Bozza automatica')).toBeTruthy());
  });

  it('riesame non salvato (nessun reviewId): nessuna chiamata backend', async () => {
    const { onFillAll } = await renderAndWait({ reviewId: null, companyId: null });

    await act(async () => {
      fireEvent.click(screen.getByText(/Genera bozza testo/));
    });

    expect(apiService.post).not.toHaveBeenCalled();
    expect(onFillAll).toHaveBeenCalledWith('input_nc_corrective', expect.stringContaining('NC aperte'));
    await waitFor(() => expect(screen.getByText('Bozza automatica')).toBeTruthy());
  });
});
