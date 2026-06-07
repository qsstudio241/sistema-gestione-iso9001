/**
 * Test L1 — StatusBadge (type="norm_quality")
 *
 * Verifica che il badge unificato renderizzi l'etichetta corretta
 * per ogni valore di qualità testo norma emesso dal backend
 * (good / partial / ocr_poor), usato da NormUploadButton.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';

const QUALITY_STATES = [
  { status: 'good', label: 'Buona' },
  { status: 'partial', label: 'Parziale' },
  { status: 'ocr_poor', label: 'OCR scarso' },
];

describe('StatusBadge — qualità testo norma', () => {
  it.each(QUALITY_STATES)(
    'renderizza "$label" per la qualità "$status"',
    ({ status, label }) => {
      const { container } = render(
        <StatusBadge type="norm_quality" status={status} size="small" />
      );
      const badge = container.querySelector('.sgq-badge');
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe(label);
      expect(badge.getAttribute('data-status')).toBe(status);
      expect(badge.getAttribute('data-type')).toBe('norm_quality');
    }
  );

  it('mantiene la retrocompatibilità con il valore legacy "poor"', () => {
    const { container } = render(
      <StatusBadge type="norm_quality" status="poor" />
    );
    expect(container.querySelector('.sgq-badge').textContent).toBe('OCR scarso');
  });
});
