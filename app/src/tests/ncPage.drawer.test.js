/**
 * Test L1 - NCPage drawer dettaglio laterale
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ncPagePath = resolve(process.cwd(), 'src/pages/NCPage.jsx');
const ncPageCssPath = resolve(process.cwd(), 'src/pages/NCPage.css');

describe('NCPage drawer', () => {
  it('usa overlay doc-detail e delega flusso a NcDetailPanel', () => {
    const src = readFileSync(ncPagePath, 'utf8');
    expect(src).toContain('doc-detail__overlay');
    expect(src).toContain('nc-detail-drawer');
    expect(src).toContain('handleCloseDetail');
    expect(src).toContain('DocumentDetailPanel.css');
    expect(src).toContain('onStatusChange');
    expect(src).toContain('exportNcToWord');
    expect(src).toContain('Scarica Word');
    expect(src).toContain('nc-export-word-btn');
    expect(src).not.toMatch(/className="nc-detail-section"/);
  });

  it('deep-link select imposta viewMode registro NC', () => {
    const src = readFileSync(ncPagePath, 'utf8');
    expect(src).toContain('params.get("select")');
    expect(src).toMatch(/setViewMode\("nc"\)/);
  });

  it('CSS drawer NC con sezioni flusso operativo', () => {
    const css = readFileSync(ncPageCssPath, 'utf8');
    expect(css).toContain('.nc-detail-drawer');
    expect(css).toContain('.nc-detail-drawer-resizer');
    expect(css).toContain('.nc-drawer-section');
    expect(css).toContain('.nc-action-due-filters .status-btn');
    expect(css).toMatch(/\.nc-action-due-filters \.status-btn[\s\S]*width:\s*auto/);
    expect(css).not.toContain('.nc-detail-section');
  });

  it('integra hook resize drawer con persistenza localStorage', () => {
    const src = readFileSync(ncPagePath, 'utf8');
    expect(src).toContain('useNcDrawerWidth');
    expect(src).toContain('nc-detail-drawer-resizer');
    expect(src).toContain('startDrawerResize');
  });

  it('sottotitolo ISO usa escape Unicode in stringa JS (non testo JSX grezzo)', () => {
    const src = readFileSync(ncPagePath, 'utf8');
    expect(src).toMatch(
      /nc-page-sub">\{"ISO 9001:2015 \\u00A76\.1 \+ \\u00A79\.3 \+ \\u00A710\.2 \+ \\u00A710\.3 \\u2014 Registro cross-fonte"\}/
    );
    // Vietato: \u fuori da stringa JS (comparirebbe letterale in UI)
    expect(src).not.toMatch(/nc-page-sub">ISO 9001:2015 \\u00A7/);
  });
});
