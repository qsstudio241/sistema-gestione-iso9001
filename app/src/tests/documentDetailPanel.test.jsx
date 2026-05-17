/**
 * Test L1 - DocumentDetailPanel
 *
 * Copre: STATUS_CONFIG mapping, DOC_TYPE_LABELS, rendering stati lifecycle,
 * cronologia, azioni Modifica/Archivia, pannello dettaglio.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentDetailPanel from '../components/DocumentDetailPanel';

const STATUS_CONFIG = {
  rilasciato:   { label: "Rilasciato",   className: "doc-detail__badge--green" },
  vigente:      { label: "Rilasciato",   className: "doc-detail__badge--green" },
  in_revisione: { label: "In revisione", className: "doc-detail__badge--yellow" },
  obsoleto:     { label: "Obsoleto",     className: "doc-detail__badge--grey" },
  bozza:        { label: "Bozza",        className: "doc-detail__badge--blue" },
};

const baseDoc = {
  id: 1,
  title: 'Procedura Saldature',
  doc_code: 'PG-001',
  doc_type: 'procedure',
  revision: 3,
  status: 'rilasciato',
  issue_date: '2026-01-15T00:00:00.000Z',
  responsible: 'Ing. Rossi',
  company_name: 'Acme SRL',
};

// -- STATUS_CONFIG mapping --

describe('DocumentDetailPanel - STATUS_CONFIG', () => {
  it('ogni stato lifecycle ha label e className definiti', () => {
    for (const [key, cfg] of Object.entries(STATUS_CONFIG)) {
      expect(cfg.label).toBeTruthy();
      expect(cfg.className).toBeTruthy();
    }
  });

  it('"rilasciato" e "vigente" mappano entrambi a "Rilasciato"', () => {
    expect(STATUS_CONFIG.rilasciato.label).toBe('Rilasciato');
    expect(STATUS_CONFIG.vigente.label).toBe('Rilasciato');
  });

  it('"bozza" ha badge blue', () => {
    expect(STATUS_CONFIG.bozza.className).toContain('blue');
  });

  it('"obsoleto" ha badge grey', () => {
    expect(STATUS_CONFIG.obsoleto.className).toContain('grey');
  });
});

// -- Rendering --

describe('DocumentDetailPanel - Rendering', () => {
  it('ritorna null se document e null', () => {
    const { container } = render(
      <DocumentDetailPanel document={null} onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('mostra titolo del documento', () => {
    render(
      <DocumentDetailPanel document={baseDoc} onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Procedura Saldature')).toBeInTheDocument();
  });

  it('mostra badge di stato "Rilasciato"', () => {
    render(
      <DocumentDetailPanel document={baseDoc} onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Rilasciato')).toBeInTheDocument();
  });

  it('mostra badge "Bozza" per stato bozza', () => {
    render(
      <DocumentDetailPanel
        document={{ ...baseDoc, status: 'bozza' }}
        onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()}
      />
    );
    expect(screen.getByText('Bozza')).toBeInTheDocument();
  });

  it('mostra codice documento', () => {
    render(
      <DocumentDetailPanel document={baseDoc} onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('PG-001')).toBeInTheDocument();
  });

  it('mostra revisione formattata', () => {
    render(
      <DocumentDetailPanel document={baseDoc} onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Rev. 3')).toBeInTheDocument();
  });

  it('mostra responsabile', () => {
    render(
      <DocumentDetailPanel document={baseDoc} onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Ing. Rossi')).toBeInTheDocument();
  });

  it('mostra azienda', () => {
    render(
      <DocumentDetailPanel document={baseDoc} onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Acme SRL')).toBeInTheDocument();
  });

  it('non mostra righe con valori null/undefined', () => {
    const sparseDoc = { ...baseDoc, responsible: null, company_name: undefined };
    const { container } = render(
      <DocumentDetailPanel document={sparseDoc} onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    const labels = [...container.querySelectorAll('.doc-detail__info-label')];
    const labelTexts = labels.map(l => l.textContent);
    expect(labelTexts).not.toContain('Responsabile');
    expect(labelTexts).not.toContain('Azienda');
  });
});

// -- Cronologia --

describe('DocumentDetailPanel - Cronologia', () => {
  it('mostra cronologia se presente', () => {
    const history = [
      { action: 'Creazione', user_name: 'Admin', created_at: '2026-01-15T10:00:00Z' },
      { action: 'Modifica titolo', user_name: 'Rossi', created_at: '2026-02-01T08:30:00Z' },
    ];
    render(
      <DocumentDetailPanel document={baseDoc} history={history} onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('Creazione')).toBeInTheDocument();
    expect(screen.getByText('Modifica titolo')).toBeInTheDocument();
  });

  it('mostra placeholder se cronologia vuota', () => {
    render(
      <DocumentDetailPanel document={baseDoc} history={[]} onEdit={vi.fn()} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText(/Nessuna attivit.+ registrata/)).toBeInTheDocument();
  });
});

// -- Azioni --

describe('DocumentDetailPanel - Azioni', () => {
  it('click su "Modifica" chiama onEdit', () => {
    const onEdit = vi.fn();
    render(
      <DocumentDetailPanel document={baseDoc} onEdit={onEdit} onArchive={vi.fn()} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByText('Modifica'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('click su "Archivia" chiama onArchive', () => {
    const onArchive = vi.fn();
    render(
      <DocumentDetailPanel document={baseDoc} onEdit={vi.fn()} onArchive={onArchive} onClose={vi.fn()} />
    );
    fireEvent.click(screen.getByText('Archivia'));
    expect(onArchive).toHaveBeenCalledTimes(1);
  });

  it('click pulsante chiudi chiama onClose', () => {
    const onClose = vi.fn();
    render(
      <DocumentDetailPanel document={baseDoc} onEdit={vi.fn()} onArchive={vi.fn()} onClose={onClose} />
    );
    fireEvent.click(screen.getByLabelText('Chiudi'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
