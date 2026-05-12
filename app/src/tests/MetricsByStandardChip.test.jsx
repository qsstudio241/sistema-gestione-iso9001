/**
 * Test L1 — MetricsByStandardChip (ADR-009 Fase 1)
 *
 * Verifica DoD: sidebar audit ISO 9001+14001 mostra
 * "9001: 2 NC · 14001: 1 NC · totale 3".
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MetricsByStandardChip from '../components/MetricsByStandardChip';

describe('MetricsByStandardChip', () => {
  it('multi-standard ISO 9001 + ISO 14001 → mostra label per ogni norma + totale', () => {
    render(
      <MetricsByStandardChip
        selectedStandards={['ISO_9001_2015', 'ISO_14001_2015']}
        byStandard={{
          ISO_9001: { totalNC: 2, totalOSS: 0, totalOM: 0, totalQuestions: 35, answeredQuestions: 35, completionPercentage: 100 },
          ISO_14001: { totalNC: 1, totalOSS: 0, totalOM: 0, totalQuestions: 53, answeredQuestions: 53, completionPercentage: 100 },
        }}
      />,
    );

    const wrapper = screen.getByTestId('metrics-by-standard-chip');
    // DoD: la riga deve contenere "9001: 2 NC", "14001: 1 NC", "totale 3 NC"
    expect(wrapper.textContent).toMatch(/9001\s*:\s*2 NC/);
    expect(wrapper.textContent).toMatch(/14001\s*:\s*1 NC/);
    expect(wrapper.textContent).toMatch(/totale\s+3 NC/);
  });

  it('mono-standard → mostra solo "N NC" senza prefisso e senza totale', () => {
    render(
      <MetricsByStandardChip
        selectedStandards={['ISO_9001_2015']}
        byStandard={{
          ISO_9001: { totalNC: 5, totalOSS: 0, totalOM: 0, totalQuestions: 35, answeredQuestions: 35, completionPercentage: 100 },
        }}
      />,
    );

    const wrapper = screen.getByTestId('metrics-by-standard-chip');
    expect(wrapper.textContent).toMatch(/5 NC/);
    expect(wrapper.textContent).not.toMatch(/totale/);
    expect(wrapper.textContent).not.toMatch(/9001\s*:/);
  });

  it('opzione includeOss/includeOm → aggiunge i conteggi al chip', () => {
    render(
      <MetricsByStandardChip
        selectedStandards={['ISO_9001_2015', 'ISO_14001_2015']}
        byStandard={{
          ISO_9001: { totalNC: 2, totalOSS: 1, totalOM: 1, totalQuestions: 10, answeredQuestions: 10, completionPercentage: 100 },
          ISO_14001: { totalNC: 1, totalOSS: 2, totalOM: 0, totalQuestions: 10, answeredQuestions: 10, completionPercentage: 100 },
        }}
        includeOss
        includeOm
      />,
    );

    const wrapper = screen.getByTestId('metrics-by-standard-chip');
    expect(wrapper.textContent).toMatch(/9001\s*:\s*2 NC\s*·\s*1 OSS\s*·\s*1 OM/);
    expect(wrapper.textContent).toMatch(/14001\s*:\s*1 NC\s*·\s*2 OSS\s*·\s*0 OM/);
    expect(wrapper.textContent).toMatch(/totale\s+3 NC\s*·\s*3 OSS\s*·\s*1 OM/);
  });

  it('byStandard mancante per una norma selezionata → la salta senza esplodere', () => {
    render(
      <MetricsByStandardChip
        selectedStandards={['ISO_9001_2015', 'ISO_14001_2015']}
        byStandard={{
          ISO_9001: { totalNC: 1, totalOSS: 0, totalOM: 0, totalQuestions: 1, answeredQuestions: 1, completionPercentage: 100 },
          // ISO_14001 assente — il chip non deve renderizzarla
        }}
      />,
    );

    const wrapper = screen.getByTestId('metrics-by-standard-chip');
    expect(wrapper.textContent).toMatch(/1 NC/);
    expect(wrapper.textContent).not.toMatch(/14001/);
    // Una sola norma effettiva → niente totale (è ridondante)
    expect(wrapper.textContent).not.toMatch(/totale/);
  });

  it('byStandard completamente vuoto / nessuna norma → componente non renderizza', () => {
    const { container } = render(
      <MetricsByStandardChip selectedStandards={[]} byStandard={{}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('aggiunge ISO 45001 al registry → il chip lo mostra senza modifiche al componente', () => {
    // Test di scalabilità ADR-009: la presenza nel registry basta a far
    // funzionare il chip per un nuovo standard.
    render(
      <MetricsByStandardChip
        selectedStandards={['ISO_9001_2015', 'ISO_45001_2018']}
        byStandard={{
          ISO_9001: { totalNC: 2, totalOSS: 0, totalOM: 0, totalQuestions: 35, answeredQuestions: 35, completionPercentage: 100 },
          ISO_45001: { totalNC: 4, totalOSS: 1, totalOM: 0, totalQuestions: 53, answeredQuestions: 53, completionPercentage: 100 },
        }}
      />,
    );

    const wrapper = screen.getByTestId('metrics-by-standard-chip');
    expect(wrapper.textContent).toMatch(/9001\s*:\s*2 NC/);
    expect(wrapper.textContent).toMatch(/45001\s*:\s*4 NC/);
    expect(wrapper.textContent).toMatch(/totale\s+6 NC/);
  });
});
