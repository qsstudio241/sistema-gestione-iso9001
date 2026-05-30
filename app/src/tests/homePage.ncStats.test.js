/**
 * Test L1 - HomePage statistiche NC (NC Fase 1 Slice 1)
 *
 * Verifica alias apiService e caricamento conteggi NC in dashboard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const mockGetDocumentStats = vi.hoisted(() => vi.fn());
const mockGetNonConformitiesStatistics = vi.hoisted(() => vi.fn());
const mockGetAudits = vi.hoisted(() => vi.fn());
const mockGetDocuments = vi.hoisted(() => vi.fn());

vi.mock('../services/apiService', () => ({
  default: {
    getDocumentStats: (...args) => mockGetDocumentStats(...args),
    getNonConformitiesStatistics: (...args) => mockGetNonConformitiesStatistics(...args),
    getAudits: (...args) => mockGetAudits(...args),
    getDocuments: (...args) => mockGetDocuments(...args),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { full_name: 'Mario Rossi' } }),
}));

vi.mock('../contexts/RouterContext', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../pages/HomePage.css', () => ({}));

import HomePage from '../pages/HomePage';

const apiServicePath = resolve(process.cwd(), 'src/services/apiService.js');

describe('apiService - alias getNonConformitiesStatistics', () => {
  it('espone alias che delega a getNcStats', () => {
    const src = readFileSync(apiServicePath, 'utf8');
    expect(src).toMatch(/async getNonConformitiesStatistics\(params = \{\}\)/);
    expect(src).toMatch(/return this\.getNcStats\(params\)/);
  });
});

describe('HomePage - statistiche NC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDocumentStats.mockResolvedValue({
      data: { vigenti: 10, scaduti: 0, in_scadenza_30gg: 0 },
    });
    mockGetNonConformitiesStatistics.mockResolvedValue({
      data: { open: 5, overdue: 2 },
    });
    mockGetAudits.mockResolvedValue({ data: [] });
    mockGetDocuments.mockResolvedValue({ data: [] });
  });

  it('chiama getNonConformitiesStatistics al caricamento', async () => {
    render(React.createElement(HomePage));

    await waitFor(() => {
      expect(mockGetNonConformitiesStatistics).toHaveBeenCalledTimes(1);
    });
  });

  it('mostra azioni aperte e sottotitolo in ritardo quando le stats NC sono disponibili', async () => {
    render(React.createElement(HomePage));

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    expect(screen.getByText('Azioni aperte')).toBeInTheDocument();
    expect(screen.getByText('2 in ritardo')).toBeInTheDocument();
  });

  it('mostra alert NC in ritardo quando overdue > 0', async () => {
    render(React.createElement(HomePage));

    await waitFor(() => {
      expect(screen.getByText('Azioni NC in ritardo')).toBeInTheDocument();
    });
  });

  it('blocca stat box azioni quando getNonConformitiesStatistics non restituisce dati', async () => {
    mockGetNonConformitiesStatistics.mockResolvedValue(null);

    render(React.createElement(HomePage));

    await waitFor(() => {
      const label = screen.getByText('Azioni aperte');
      expect(label.closest('.stat-box')).toHaveClass('stat-box-locked');
    });
  });
});
