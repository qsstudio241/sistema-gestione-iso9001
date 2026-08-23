/**
 * Test L1 - HomePage panoramica (NC + qualifiche + rischi + licenze)
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
const mockGetQualificationsStats = vi.hoisted(() => vi.fn());
const mockGetRisksStats = vi.hoisted(() => vi.fn());
const mockHasLicensedModule = vi.hoisted(() => vi.fn(() => true));

vi.mock('../services/apiService', () => ({
  default: {
    getDocumentStats: (...args) => mockGetDocumentStats(...args),
    getNonConformitiesStatistics: (...args) => mockGetNonConformitiesStatistics(...args),
    getAudits: (...args) => mockGetAudits(...args),
    getDocuments: (...args) => mockGetDocuments(...args),
    getQualificationsStats: (...args) => mockGetQualificationsStats(...args),
    getRisksStats: (...args) => mockGetRisksStats(...args),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { full_name: 'Mario Rossi' },
    canWriteModule: () => true,
    hasLicensedModule: (...args) => mockHasLicensedModule(...args),
  }),
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

describe('HomePage - panoramica moduli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasLicensedModule.mockImplementation(() => true);
    mockGetDocumentStats.mockResolvedValue({
      data: { vigenti: 10, scaduti: 0, in_scadenza_30gg: 0 },
    });
    mockGetNonConformitiesStatistics.mockResolvedValue({
      data: { open: 5, overdue: 2, open_like: 5 },
    });
    mockGetAudits.mockResolvedValue({ data: [] });
    mockGetDocuments.mockResolvedValue({ data: [] });
    mockGetQualificationsStats.mockResolvedValue({
      total: 12, valide: 9, in_scadenza_30: 2, scadute: 1,
    });
    mockGetRisksStats.mockResolvedValue({
      data: { total: 8, open: 3, in_treatment: 1, high_priority: 2, closed: 2 },
    });
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

  it('non blocca Azioni aperte se il modulo NC è licenziato ma le stats mancano', async () => {
    mockGetNonConformitiesStatistics.mockResolvedValue(null);

    render(React.createElement(HomePage));

    await waitFor(() => {
      const label = screen.getByText('Azioni aperte');
      expect(label.closest('.stat-box')).not.toHaveClass('stat-box-locked');
    });
  });

  it('mostra conteggi qualifiche e rischi dalle API', async () => {
    render(React.createElement(HomePage));

    await waitFor(() => {
      expect(mockGetQualificationsStats).toHaveBeenCalledTimes(1);
      expect(mockGetRisksStats).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Qualifiche')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('1 scadute')).toBeInTheDocument();
    expect(screen.getByText('Rischi aperti')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2 alta priorità')).toBeInTheDocument();
  });

  it('blocca solo i moduli non licenziati e non chiama le loro API', async () => {
    mockHasLicensedModule.mockImplementation((key) => key !== 'qualifiche' && key !== 'rischi');

    render(React.createElement(HomePage));

    await waitFor(() => {
      expect(screen.getByText('Qualifiche').closest('.stat-box')).toHaveClass('stat-box-locked');
      expect(screen.getByText('Rischi aperti').closest('.stat-box')).toHaveClass('stat-box-locked');
    });

    expect(mockGetQualificationsStats).not.toHaveBeenCalled();
    expect(mockGetRisksStats).not.toHaveBeenCalled();
    expect(mockGetNonConformitiesStatistics).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Azioni aperte').closest('.stat-box')).not.toHaveClass('stat-box-locked');
    expect(screen.queryAllByText('Non attivato')).toHaveLength(2);
  });
});
