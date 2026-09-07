/**
 * @vitest-environment jsdom
 *
 * CM-4: gate Ambito — pulsanti visibili ma disabled senza company_id;
 * Accetta/Rifiuta solo su proposed; niente auto-confirm.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const scopeState = {
  companyId: '',
  scopeCompanyName: 'Tutto lo studio',
  isStudioWide: true,
  companies: [{ id: 11, name: 'Mason Demo' }],
  setCompanyId: () => {},
  reloadCompanies: vi.fn(),
  locked: false,
  companyScoped: false,
  isStudioPatrimonio: false,
  scopeReady: true,
};

vi.mock('../contexts/CompanyScopeContext', () => ({
  useCompanyScope: () => scopeState,
}));

vi.mock('../services/apiService', () => ({
  default: {
    listComplianceMaps: vi.fn(),
    getComplianceMap: vi.fn(),
    compileComplianceMap: vi.fn(),
    proposeComplianceMapLinks: vi.fn(),
    patchComplianceMapItemHitl: vi.fn(),
    exportComplianceMap: vi.fn(),
    getContractReviews: vi.fn(),
  },
}));

vi.mock('../components/SgqDataGrid', () => ({
  default: function MockGrid({ rows, emptyMessage, renderCell, columns, onRowClick }) {
    if (!rows?.length) {
      return <div data-testid="cm-grid-empty">{emptyMessage}</div>;
    }
    return (
      <ul data-testid="cm-grid">
        {rows.map((row) => (
          <li key={row.id}>
            <button type="button" onClick={() => onRowClick?.(row)}>
              {row.title || row.req_key || row.id}
            </button>
            {columns?.map((col) => (
              <div key={col.id} data-col={col.id}>
                {renderCell ? renderCell(row, col) : row[col.id]}
              </div>
            ))}
          </li>
        ))}
      </ul>
    );
  },
}));

vi.mock('../components/StatusBadge', () => ({
  default: ({ label, status }) => <span data-testid="badge">{label || status}</span>,
}));

vi.mock('../components/AiDisclaimer', () => ({
  default: () => <div data-testid="ai-disclaimer">disclaimer</div>,
}));

import apiService from '../services/apiService';
import ComplianceMapsPage from '../pages/ComplianceMapsPage.jsx';

describe('ComplianceMapsPage — CM-4/CM-5 gate + HITL + export', () => {
  beforeEach(() => {
    scopeState.companyId = '';
    scopeState.isStudioWide = true;
    scopeState.scopeCompanyName = 'Tutto lo studio';
    apiService.listComplianceMaps.mockReset();
    apiService.getComplianceMap.mockReset();
    apiService.compileComplianceMap.mockReset();
    apiService.proposeComplianceMapLinks.mockReset();
    apiService.patchComplianceMapItemHitl.mockReset();
    apiService.exportComplianceMap.mockReset();
    apiService.getContractReviews.mockReset();
    apiService.getContractReviews.mockResolvedValue({ data: [] });
    apiService.listComplianceMaps.mockResolvedValue({ data: { maps: [] } });
    apiService.getComplianceMap.mockResolvedValue({ data: { map: null, items: [] } });
  });

  it('senza Ambito: Compila, Propone link ed Esporta disabled + title Ambito', async () => {
    render(<ComplianceMapsPage />);
    const compileBtn = await screen.findByTestId('cm-compile-btn');
    const proposeBtn = screen.getByTestId('cm-propose-links-btn');
    const exportBtn = screen.getByTestId('cm-export-btn');
    expect(compileBtn).toBeDisabled();
    expect(proposeBtn).toBeDisabled();
    expect(exportBtn).toBeDisabled();
    expect(compileBtn.getAttribute('title')).toMatch(/Ambito/i);
    expect(proposeBtn.getAttribute('title')).toMatch(/Ambito/i);
    expect(exportBtn.getAttribute('title')).toMatch(/Ambito/i);
    expect(apiService.listComplianceMaps).not.toHaveBeenCalled();
    expect(screen.getByTestId('ai-disclaimer')).toBeInTheDocument();
  });

  it('con Ambito: lista mappe, Accetta/Rifiuta su proposed, patch HITL', async () => {
    scopeState.companyId = '11';
    scopeState.isStudioWide = false;
    scopeState.scopeCompanyName = 'Mason Demo';
    apiService.getContractReviews.mockResolvedValue({
      data: [{ id: 42, title: 'Capitolato X', company_id: 11 }],
    });
    apiService.listComplianceMaps.mockResolvedValue({
      data: {
        maps: [{ id: 5, title: 'Mappa A', status: 'draft', map_version: 1, updated_at: '2026-09-07' }],
      },
    });
    apiService.getComplianceMap.mockResolvedValue({
      data: {
        map: { id: 5, title: 'Mappa A', status: 'draft' },
        items: [
          {
            id: 101,
            req_key: 'R1',
            req_text: 'Requisito uno',
            hitl_status: 'proposed',
            coverage: 'unknown',
          },
          {
            id: 102,
            req_key: 'R2',
            req_text: 'Requisito due',
            hitl_status: 'accepted',
            coverage: 'covered',
          },
        ],
      },
    });
    apiService.patchComplianceMapItemHitl.mockResolvedValue({
      data: { item: { id: 101, hitl_status: 'accepted' } },
    });

    const user = userEvent.setup();
    render(<ComplianceMapsPage />);

    await waitFor(() => {
      expect(apiService.listComplianceMaps).toHaveBeenCalledWith('11');
    });
    await waitFor(() => {
      expect(apiService.getComplianceMap).toHaveBeenCalledWith('11', 5);
    });

    const acceptProposed = await screen.findByTestId('cm-accept-101');
    const rejectProposed = screen.getByTestId('cm-reject-101');
    expect(acceptProposed).not.toBeDisabled();
    expect(rejectProposed).not.toBeDisabled();

    const acceptAccepted = screen.getByTestId('cm-accept-102');
    expect(acceptAccepted).toBeDisabled();

    await user.click(acceptProposed);
    await waitFor(() => {
      expect(apiService.patchComplianceMapItemHitl).toHaveBeenCalledWith(
        '11',
        5,
        101,
        { hitl_status: 'accepted' }
      );
    });
    // niente auto-confirm: patch solo dopo click
    expect(apiService.patchComplianceMapItemHitl).toHaveBeenCalledTimes(1);
  });

  it('esclude casi con company_id null (allineato a compile BE)', async () => {
    scopeState.companyId = '179';
    scopeState.isStudioWide = false;
    scopeState.scopeCompanyName = 'ADA';
    apiService.getContractReviews.mockResolvedValue({
      data: [
        { id: 7, title: 'Riesame smoke null company', company_id: null },
        { id: 3, title: 'Caso Mason', company_id: 11 },
      ],
    });
    apiService.listComplianceMaps.mockResolvedValue({ data: { maps: [] } });

    render(<ComplianceMapsPage />);

    const select = await screen.findByTestId('cm-case-select');
    await waitFor(() => expect(select).toBeDisabled());
    expect(select).toHaveAttribute('title', expect.stringMatching(/Nessun caso/i));
    expect(select.querySelectorAll('option')).toHaveLength(1);
    expect(select.querySelector('option')?.textContent).toMatch(/Nessun caso/i);
    expect(screen.queryByText(/Riesame smoke/i)).not.toBeInTheDocument();
  });

  it('Compila da caso abilitato con Ambito + caso; propose-links con proposed', async () => {
    scopeState.companyId = '11';
    scopeState.isStudioWide = false;
    apiService.getContractReviews.mockResolvedValue({
      data: [{ id: 42, title: 'Caso', company_id: 11 }],
    });
    apiService.listComplianceMaps.mockResolvedValue({
      data: { maps: [{ id: 5, title: 'M', status: 'draft', map_version: 1 }] },
    });
    apiService.getComplianceMap.mockResolvedValue({
      data: {
        map: { id: 5, title: 'M', status: 'draft' },
        items: [{ id: 1, req_key: 'a', req_text: 't', hitl_status: 'proposed' }],
      },
    });
    apiService.compileComplianceMap.mockResolvedValue({
      data: { map: { id: 9 } },
    });
    apiService.proposeComplianceMapLinks.mockResolvedValue({
      data: { updated_count: 1 },
    });

    const user = userEvent.setup();
    render(<ComplianceMapsPage />);

    const compileBtn = await screen.findByTestId('cm-compile-btn');
    await waitFor(() => expect(compileBtn).not.toBeDisabled());

    await user.click(compileBtn);
    await waitFor(() => {
      expect(apiService.compileComplianceMap).toHaveBeenCalledWith('11', {
        commercial_case_id: 42,
      });
    });

    const proposeBtn = screen.getByTestId('cm-propose-links-btn');
    await waitFor(() => expect(proposeBtn).not.toBeDisabled());
    await user.click(proposeBtn);
    await waitFor(() => {
      // dopo compile la UI seleziona la nuova mappa (id 9)
      expect(apiService.proposeComplianceMapLinks).toHaveBeenCalledWith('11', 9, {});
    });
  });

  it('CM-5: Esporta JSON abilitato con item accepted e chiama export', async () => {
    scopeState.companyId = '11';
    scopeState.isStudioWide = false;
    apiService.getContractReviews.mockResolvedValue({ data: [] });
    apiService.listComplianceMaps.mockResolvedValue({
      data: { maps: [{ id: 5, title: 'Mappa A', status: 'approved', map_version: 1 }] },
    });
    apiService.getComplianceMap.mockResolvedValue({
      data: {
        map: { id: 5, title: 'Mappa A', status: 'approved' },
        items: [
          { id: 101, req_key: 'R1', req_text: 'ok', hitl_status: 'accepted', coverage: 'covered' },
          { id: 102, req_key: 'R2', req_text: 'no', hitl_status: 'proposed' },
        ],
      },
    });
    apiService.exportComplianceMap.mockResolvedValue({
      data: { itemCount: 1, items: [{ node_id: 101 }], map: { id: 5 } },
    });

    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const user = userEvent.setup();
    render(<ComplianceMapsPage />);

    const exportBtn = await screen.findByTestId('cm-export-btn');
    await waitFor(() => expect(exportBtn).not.toBeDisabled());
    await user.click(exportBtn);
    await waitFor(() => {
      expect(apiService.exportComplianceMap).toHaveBeenCalledWith('11', 5, { format: 'json' });
    });

    clickSpy.mockRestore();
  });
});
