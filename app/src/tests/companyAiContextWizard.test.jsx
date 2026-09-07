/**
 * L1 — CTX-2 badge + wizard contesto AI su scheda azienda
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CompanyDetailPage from '../pages/CompanyDetailPage';

const mockNavigate = vi.fn();

vi.mock('../contexts/RouterContext', () => ({
  useRouter: () => ({ path: '/companies/42' }),
  useNavigate: () => mockNavigate,
  Link: ({ to, children, className, ...props }) => (
    <a href={to} className={className} {...props}>{children}</a>
  ),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'auditor', auditor_org_id: 1, licensed_modules: ['audit'] },
  }),
}));

vi.mock('../components/CompanyPersonnelPanel', () => ({
  default: () => <div data-testid="personnel-panel">Personale mock</div>,
}));

vi.mock('../components/CompanyCounterpartiesPanel', () => ({
  default: () => <div data-testid="counterparties-panel">Controparti mock</div>,
}));

vi.mock('../components/CompanyProfilePanel', () => ({
  default: () => null,
}));

vi.mock('../components/CompanyRegistrySearch', () => ({
  default: () => null,
}));

const mockGetCompany = vi.fn();
const mockUpdateCompany = vi.fn();

vi.mock('../services/apiService', () => ({
  default: {
    getCompany: (...args) => mockGetCompany(...args),
    getCompanyLogoUrl: (id) => `https://api.test/companies/${id}/logo`,
    updateCompany: (...args) => mockUpdateCompany(...args),
    uploadCompanyLogo: vi.fn(),
    getCompanyProfile: vi.fn(),
    updateCompanyProfile: vi.fn(),
    detectCompanyProfileImport: vi.fn(),
    importCompanyProfile: vi.fn(),
    downloadCompanyProfileTemplate: vi.fn(),
    lookupCompanyProfile: vi.fn(),
    searchCompanyRegistry: vi.fn(),
  },
}));

describe('CompanyDetailPage CTX-2 ai context', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGetCompany.mockReset();
    mockUpdateCompany.mockReset();
    mockGetCompany.mockResolvedValue({
      data: {
        id: 42,
        name: 'Acme',
        vat_number: '',
        sector: '',
        address: '',
        ai_context: {
          score: 25,
          level: 'incompleto',
          version: 'company-v1',
          missing: ['vat_number', 'sector', 'address'],
        },
      },
    });
    mockUpdateCompany.mockResolvedValue({
      data: {
        id: 42,
        name: 'Acme Srl',
        vat_number: 'IT123',
        sector: 'Metal',
        address: 'Via Roma 12',
        ai_context: { score: 100, level: 'pronto', version: 'company-v1', missing: [] },
      },
    });
  });

  it('mostra badge score e checklist missing', async () => {
    render(<CompanyDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('company-ai-context-score')).toBeInTheDocument();
    });
    expect(screen.getByTestId('company-ai-context-score')).toHaveTextContent(/%/);
    expect(screen.getByTestId('company-ai-context-score')).toHaveTextContent(/Incompleto|Parziale|Pronto/i);
    expect(screen.getByTestId('company-ai-context-wizard')).toBeInTheDocument();
    expect(screen.getByTestId('company-ai-context-wizard')).toHaveTextContent(/Settore|P\.IVA|Indirizzo/i);
  });

  it('anteprima live: campi pieni riducono i missing', async () => {
    const user = userEvent.setup();
    render(<CompanyDetailPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/P\.IVA/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/P\.IVA/i), 'IT12345678901');
    await user.type(screen.getByLabelText(/Settore/i), 'Metalmeccanica');
    await user.type(screen.getByLabelText(/Indirizzo/i), 'Via Roma 12, Padova');
    await waitFor(() => {
      const wizard = screen.queryByTestId('company-ai-context-wizard');
      expect(wizard).toBeNull();
    });
    expect(screen.getByTestId('company-ai-context-score')).toHaveTextContent(/100%|Pronto/i);
  });

  it('salva solo su click Salva anagrafica (HITL)', async () => {
    const user = userEvent.setup();
    render(<CompanyDetailPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Settore/i)).toBeInTheDocument();
    });
    expect(mockUpdateCompany).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Settore/i), 'Metal');
    expect(mockUpdateCompany).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Salva anagrafica/i }));
    await waitFor(() => {
      expect(mockUpdateCompany).toHaveBeenCalledTimes(1);
    });
  });
});
