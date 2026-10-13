/**
 * Riesame Requisiti — inbox «Non assegnati» (default una tantum, tab, stato vuoto, «Assegna a me»).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { INBOX_KIND_LABELS, shouldAutoSwitchToUnassigned } from '../utils/contractReviewLabels';

const api = vi.hoisted(() => ({
  getContractReviewSummary: vi.fn(),
  getContractReviewInbox: vi.fn(),
  updateContractReview: vi.fn(),
  getContractReviews: vi.fn(),
  getCompanies: vi.fn(),
  getSuppliers: vi.fn(),
}));

vi.mock('../services/apiService', () => {
  class ApiError extends Error {}
  return { default: api, ApiError };
});
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { user_id: 7, organization_id: 1001, role: 'admin' } }),
}));
vi.mock('../contexts/StorageContext', () => ({
  useStorage: () => ({ currentAudit: null, currentAuditId: null }),
}));
vi.mock('../contexts/RouterContext', () => ({
  useRouter: () => ({ path: '/contract-reviews' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('../components/AiSuggestionInline', () => ({ default: () => null }));
vi.mock('../components/AiDisclaimer', () => ({ default: () => null }));
vi.mock('../components/FileDropzone', () => ({ default: () => null }));
vi.mock('../components/CoverageFeasibilityBlock', () => ({ default: () => null }));

import ContractReviewPage from '../pages/ContractReviewPage';

const UNASSIGNED_CASE = {
  id: 3,
  title: 'Caso senza assegnatario',
  status: 'INTAKE_REVIEW',
  company_id: null,
  company_name: 'Azienda Test',
};

function setupApi({ summary, inboxByKind }) {
  api.getContractReviewSummary.mockResolvedValue(summary);
  api.getContractReviewInbox.mockImplementation(async (kind) => ({
    kind,
    items: inboxByKind[kind] || [],
  }));
  api.getContractReviews.mockResolvedValue([]);
  api.getCompanies.mockResolvedValue({ data: [] });
  api.getSuppliers.mockResolvedValue({ data: [] });
  api.updateContractReview.mockResolvedValue({});
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('shouldAutoSwitchToUnassigned', () => {
  const base = {
    summary: { assigned_to_me: 0, unassigned_count: 2 },
    inboxKind: 'assigned_to_me',
    userChoseKind: false,
    alreadyResolved: false,
  };

  it('passa a «Non assegnati» solo se «Assegnati a me» è 0 e ci sono non assegnati', () => {
    expect(shouldAutoSwitchToUnassigned(base)).toBe(true);
    expect(shouldAutoSwitchToUnassigned({ ...base, summary: { assigned_to_me: 1, unassigned_count: 2 } })).toBe(false);
    expect(shouldAutoSwitchToUnassigned({ ...base, summary: { assigned_to_me: 0, unassigned_count: 0 } })).toBe(false);
    expect(shouldAutoSwitchToUnassigned({ ...base, summary: { assigned_to_me: 0 } })).toBe(false);
    expect(shouldAutoSwitchToUnassigned({ ...base, summary: null })).toBe(false);
  });

  it('rispetta scelta esplicita, valutazione già fatta e vista diversa dal default', () => {
    expect(shouldAutoSwitchToUnassigned({ ...base, userChoseKind: true })).toBe(false);
    expect(shouldAutoSwitchToUnassigned({ ...base, alreadyResolved: true })).toBe(false);
    expect(shouldAutoSwitchToUnassigned({ ...base, inboxKind: 'stale' })).toBe(false);
  });

  it('etichetta vista con accenti/UTF-8 corretti', () => {
    expect(INBOX_KIND_LABELS.unassigned).toBe('Non assegnati');
  });
});

describe('ContractReviewPage — inbox Non assegnati', () => {
  it('apre «Non assegnati» al primo caricamento se «Assegnati a me» è 0', async () => {
    setupApi({
      summary: { open_count: 1, assigned_to_me: 0, unassigned_count: 1, pending_approval: 0 },
      inboxByKind: { unassigned: [UNASSIGNED_CASE] },
    });
    render(<ContractReviewPage />);

    expect(await screen.findByText('Caso senza assegnatario')).toBeTruthy();
    expect(screen.getByLabelText('Tipo inbox').value).toBe('unassigned');
    expect(api.getContractReviewInbox).toHaveBeenCalledWith('assigned_to_me', 15);
    expect(api.getContractReviewInbox).toHaveBeenCalledWith('unassigned', 15);
    expect(screen.getByRole('button', { name: 'Assegna a me' })).toBeTruthy();
    expect(screen.getAllByText('Non assegnati').length).toBeGreaterThan(1);
  });

  it('mantiene «Assegnati a me» se ci sono casi assegnati', async () => {
    setupApi({
      summary: { open_count: 2, assigned_to_me: 1, unassigned_count: 1, pending_approval: 0 },
      inboxByKind: { assigned_to_me: [{ ...UNASSIGNED_CASE, id: 5, title: 'Mio caso' }] },
    });
    render(<ContractReviewPage />);

    expect(await screen.findByText('Mio caso')).toBeTruthy();
    expect(screen.getByLabelText('Tipo inbox').value).toBe('assigned_to_me');
    expect(api.getContractReviewInbox).not.toHaveBeenCalledWith('unassigned', 15);
    expect(screen.queryByRole('button', { name: 'Assegna a me' })).toBeNull();
  });

  it('rispetta la scelta esplicita e non rientra automaticamente (nessun loop)', async () => {
    setupApi({
      summary: { open_count: 1, assigned_to_me: 0, unassigned_count: 1, pending_approval: 0 },
      inboxByKind: { unassigned: [UNASSIGNED_CASE] },
    });
    render(<ContractReviewPage />);
    await screen.findByText('Caso senza assegnatario');

    fireEvent.change(screen.getByLabelText('Tipo inbox'), { target: { value: 'assigned_to_me' } });
    await waitFor(() => expect(screen.getByLabelText('Tipo inbox').value).toBe('assigned_to_me'));
    expect(await screen.findByText('Nessun elemento in questa inbox.')).toBeTruthy();
    expect(api.getContractReviewSummary).toHaveBeenCalledTimes(1);
  });

  it('stato vuoto della vista «Non assegnati»', async () => {
    setupApi({
      summary: { open_count: 0, assigned_to_me: 0, unassigned_count: 0, pending_approval: 0 },
      inboxByKind: {},
    });
    render(<ContractReviewPage />);
    await screen.findByText('Casi aperti');

    fireEvent.change(screen.getByLabelText('Tipo inbox'), { target: { value: 'unassigned' } });
    expect(await screen.findByText('Nessun caso non assegnato.')).toBeTruthy();
  });

  it('«Assegna a me» riusa PUT del caso con l\'utente corrente e ricarica summary/inbox', async () => {
    setupApi({
      summary: { open_count: 1, assigned_to_me: 0, unassigned_count: 1, pending_approval: 0 },
      inboxByKind: { unassigned: [UNASSIGNED_CASE] },
    });
    render(<ContractReviewPage />);
    const btn = await screen.findByRole('button', { name: 'Assegna a me' });
    const summaryCalls = api.getContractReviewSummary.mock.calls.length;

    fireEvent.click(btn);
    await waitFor(() =>
      expect(api.updateContractReview).toHaveBeenCalledWith(3, { current_assignee_id: 7 }),
    );
    await waitFor(() =>
      expect(api.getContractReviewSummary.mock.calls.length).toBeGreaterThan(summaryCalls),
    );
  });
});
