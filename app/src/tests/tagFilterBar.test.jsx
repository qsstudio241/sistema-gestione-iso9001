/**
 * Test L1 — TagFilterBar component
 *
 * Copre: rendering chip, stato attivo/inattivo, raggruppamento per categoria,
 * dropdown "Tutti i tag", reset filtri.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TagFilterBar from '../components/TagFilterBar';

const sampleTags = [
  { id: 1, name: 'Urgente',   color: '#e53e3e', category_id: 1, category_name: 'Priorità' },
  { id: 2, name: 'Revisione', color: '#3182ce', category_id: 1, category_name: 'Priorità' },
  { id: 3, name: 'Saldatura', color: '#38a169', category_id: 2, category_name: 'Processo' },
];

// ??? Rendering ??????????????????????????????????????????????????????????????

describe('TagFilterBar — Rendering', () => {
  it('renderizza chip per ogni tag', () => {
    render(<TagFilterBar tags={sampleTags} activeTagIds={[]} onToggle={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText('Urgente')).toBeInTheDocument();
    expect(screen.getByText('Revisione')).toBeInTheDocument();
    expect(screen.getByText('Saldatura')).toBeInTheDocument();
  });

  it('non renderizza nulla per tags vuoto', () => {
    const { container } = render(<TagFilterBar tags={[]} activeTagIds={[]} onToggle={vi.fn()} onReset={vi.fn()} />);
    const chips = container.querySelectorAll('.tag-filter-bar__chip');
    expect(chips).toHaveLength(0);
  });

  it('mostra pulsante "Tutti i tag" solo se ci sono più di 10 tag', () => {
    render(<TagFilterBar tags={sampleTags} activeTagIds={[]} onToggle={vi.fn()} onReset={vi.fn()} />);
    expect(screen.queryByText(/tutti i tag/i)).toBeNull();

    const manyTags = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1, name: `Tag ${i + 1}`, color: '#ccc', category_id: 0, category_name: 'Default',
    }));
    const { rerender } = render(<TagFilterBar tags={manyTags} activeTagIds={[]} onToggle={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByText(/tutti i tag/i)).toBeInTheDocument();
  });
});

// ??? Interazioni ????????????????????????????????????????????????????????????

describe('TagFilterBar — Interazioni', () => {
  it('chiama onToggle con id del tag cliccato', () => {
    const onToggle = vi.fn();
    render(<TagFilterBar tags={sampleTags} activeTagIds={[]} onToggle={onToggle} onReset={vi.fn()} />);
    fireEvent.click(screen.getByText('Urgente'));
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('chiama onToggle con tag_id se presente al posto di id', () => {
    const tagWithTagId = [{ tag_id: 42, name: 'Speciale', color: '#000', category_id: 0 }];
    const onToggle = vi.fn();
    render(<TagFilterBar tags={tagWithTagId} activeTagIds={[]} onToggle={onToggle} onReset={vi.fn()} />);
    fireEvent.click(screen.getByText('Speciale'));
    expect(onToggle).toHaveBeenCalledWith(42);
  });

  it('mostra pulsante reset solo se ci sono filtri attivi', () => {
    const { rerender } = render(
      <TagFilterBar tags={sampleTags} activeTagIds={[]} onToggle={vi.fn()} onReset={vi.fn()} />
    );
    expect(screen.queryByText(/reset filtri/i)).toBeNull();

    rerender(
      <TagFilterBar tags={sampleTags} activeTagIds={[1]} onToggle={vi.fn()} onReset={vi.fn()} />
    );
    expect(screen.getByText(/reset filtri/i)).toBeInTheDocument();
  });

  it('chiama onReset al click su reset', () => {
    const onReset = vi.fn();
    render(<TagFilterBar tags={sampleTags} activeTagIds={[1, 2]} onToggle={vi.fn()} onReset={onReset} />);
    fireEvent.click(screen.getByText(/reset filtri/i));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});

// ??? Stile attivo/inattivo ??????????????????????????????????????????????????

describe('TagFilterBar — Stile attivo/inattivo', () => {
  it('chip attivo ha classe --active', () => {
    const { container } = render(
      <TagFilterBar tags={sampleTags} activeTagIds={[1]} onToggle={vi.fn()} onReset={vi.fn()} />
    );
    const chips = container.querySelectorAll('.tag-filter-bar__chip');
    const urgenteChip = [...chips].find(c => c.textContent === 'Urgente');
    expect(urgenteChip.className).toContain('--active');
  });

  it('chip inattivo ha classe --inactive', () => {
    const { container } = render(
      <TagFilterBar tags={sampleTags} activeTagIds={[1]} onToggle={vi.fn()} onReset={vi.fn()} />
    );
    const chips = container.querySelectorAll('.tag-filter-bar__chip');
    const saldaturaChip = [...chips].find(c => c.textContent === 'Saldatura');
    expect(saldaturaChip.className).toContain('--inactive');
  });
});
