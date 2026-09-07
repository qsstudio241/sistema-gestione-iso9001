/**
 * L1 — CTX-1 badge + wizard contesto AI su Il mio Studio
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabAnagrafica } from '../pages/StudioSettingsPage';

const mockGetMyOrganization = vi.fn();
const mockPatchMyOrganization = vi.fn();

vi.mock('../services/apiService', () => ({
  default: {
    getMyOrganization: (...args) => mockGetMyOrganization(...args),
    patchMyOrganization: (...args) => mockPatchMyOrganization(...args),
    getOrganizationLogoUrl: () => 'https://example.test/logo',
    getToken: () => null,
    uploadOrganizationLogo: vi.fn(),
    deleteOrganizationLogo: vi.fn(),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'admin', organization_id: 1001 } }),
}));

describe('TabAnagrafica CTX-1 ai context', () => {
  beforeEach(() => {
    mockGetMyOrganization.mockReset();
    mockPatchMyOrganization.mockReset();
    mockGetMyOrganization.mockResolvedValue({
      data: {
        organization_id: 1001,
        organization_code: 'ALP',
        organization_name: 'Al.project',
        vat_number: '',
        logo_url: null,
        audit_report_prefix: null,
        ai_context_notes: '',
        ai_context: {
          score: 15,
          level: 'incompleto',
          version: 'studio-v1',
          missing: ['vat_number', 'ai_context_notes', 'audit_report_prefix'],
        },
      },
    });
    mockPatchMyOrganization.mockResolvedValue({
      data: {
        organization_id: 1001,
        organization_code: 'ALP',
        organization_name: 'Al.project',
        vat_number: 'IT123',
        audit_report_prefix: 'ALP',
        ai_context_notes: 'x'.repeat(40),
        ai_context: { score: 100, level: 'pronto', version: 'studio-v1', missing: [] },
      },
    });
  });

  it('mostra badge score e checklist missing', async () => {
    render(<TabAnagrafica />);
    await waitFor(() => {
      expect(screen.getByTestId('ai-context-score')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ai-context-score')).toHaveTextContent(/%/);
    expect(screen.getByTestId('ai-context-score')).toHaveTextContent(/Incompleto|Parziale|Pronto/i);
    expect(screen.getByTestId('ai-context-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('ai-context-wizard')).toHaveTextContent(/Note operative/i);
  });

  it('anteprima live: note lunghe riducono i missing', async () => {
    const user = userEvent.setup();
    render(<TabAnagrafica />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Note di contesto studio/i)).toBeInTheDocument();
    });
    const notes = screen.getByLabelText(/Note di contesto studio/i);
    await user.clear(notes);
    await user.type(
      notes,
      'Studio consulenza ISO 9001 e 3834 per PMI metalmeccaniche; tono formale.'
    );
    await waitFor(() => {
      const wizard = screen.queryByTestId('ai-context-wizard');
      if (wizard) {
        expect(wizard).not.toHaveTextContent(/Note operative AI/);
      }
    });
  });

  it('salva solo su click Salva (HITL)', async () => {
    const user = userEvent.setup();
    render(<TabAnagrafica />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Note di contesto studio/i)).toBeInTheDocument();
    });
    expect(mockPatchMyOrganization).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Note di contesto studio/i), 'nota');
    expect(mockPatchMyOrganization).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Salva personalizzazioni/i }));
    await waitFor(() => {
      expect(mockPatchMyOrganization).toHaveBeenCalledTimes(1);
    });
  });
});
