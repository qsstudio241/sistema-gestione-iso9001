import { describe, expect, test } from 'vitest';
import {
  deriveOrderEvadibilitySignal,
  parseCapabilityGapReport,
  evadibilityStatusClass,
} from './orderEvadibilitySignal';

function att(id, role, mime = 'application/pdf', name = `f${id}.pdf`) {
  return {
    attachment_id: id,
    commercial_doc_role: role,
    mime_type: mime,
    file_name: name,
  };
}

describe('parseCapabilityGapReport', () => {
  test('parse string JSON + fallback generated_at', () => {
    const r = parseCapabilityGapReport('{"summary":{"status":"ok"}}', '2026-09-01T10:00:00Z');
    expect(r.summary.status).toBe('ok');
    expect(r.generated_at).toMatch(/2026-09-01/);
  });

  test('null su JSON invalido', () => {
    expect(parseCapabilityGapReport('{nope')).toBeNull();
  });
});

describe('deriveOrderEvadibilitySignal', () => {
  test('senza allegati → need_input', () => {
    const s = deriveOrderEvadibilitySignal({});
    expect(s.status).toBe('need_input');
    expect(s.reasons[0]).toMatch(/Nessun allegato/);
  });

  test('catalogo incompleto (solo other) → need_input', () => {
    const s = deriveOrderEvadibilitySignal({
      attachments: [att(1, 'other')],
    });
    expect(s.status).toBe('need_input');
    expect(s.sources.catalog.canAnalyze).toBe(false);
  });

  test('catalogo ok + report ok → evadibile', () => {
    const s = deriveOrderEvadibilitySignal({
      attachments: [att(1, 'drawing', 'image/png', 'pezzo.png')],
      gapReport: { summary: { status: 'ok', gaps_count: 0 } },
    });
    expect(s.status).toBe('evadibile');
    expect(s.label).toMatch(/evadibile/i);
    expect(s.sources.capabilityStatus).toBe('ok');
  });

  test('report gap → gap anche con catalogo ok', () => {
    const s = deriveOrderEvadibilitySignal({
      attachments: [att(1, 'order', 'application/pdf')],
      gapReport: { summary: { status: 'gap', gaps_count: 2 } },
    });
    expect(s.status).toBe('gap');
    expect(s.reasons.some((r) => /2 gap/i.test(r))).toBe(true);
  });

  test('report need_input → need_input', () => {
    const s = deriveOrderEvadibilitySignal({
      attachments: [att(1, 'capitolato', 'application/pdf')],
      gapReport: { summary: { status: 'need_input', gaps_count: 1 } },
    });
    expect(s.status).toBe('need_input');
  });

  test('catalogo ok ma report assente → need_input', () => {
    const s = deriveOrderEvadibilitySignal({
      attachments: [att(1, 'drawing', 'image/png')],
      gapReport: null,
    });
    expect(s.status).toBe('need_input');
    expect(s.reasons.some((r) => /Report capacità non ancora/i.test(r))).toBe(true);
  });

  test('checklist No peggiora a gap', () => {
    const s = deriveOrderEvadibilitySignal({
      attachments: [att(1, 'drawing', 'image/png')],
      gapReport: { summary: { status: 'ok', gaps_count: 0 } },
      checklist: [
        { item_ref: 'P1', answer: 'yes' },
        { item_ref: 'P2', answer: 'no' },
      ],
    });
    expect(s.status).toBe('gap');
    expect(s.reasons.some((r) => /No/i.test(r))).toBe(true);
  });

  test('checklist parzialmente compilata → need_input se capability ok', () => {
    const s = deriveOrderEvadibilitySignal({
      attachments: [att(1, 'drawing', 'image/png')],
      gapReport: { summary: { status: 'ok', gaps_count: 0 } },
      checklist: [
        { item_ref: 'P1', answer: 'yes' },
        { item_ref: 'P2', answer: null },
      ],
    });
    expect(s.status).toBe('need_input');
  });

  test('checklist tutta unanswered non peggiora da sola (soft)', () => {
    const s = deriveOrderEvadibilitySignal({
      attachments: [att(1, 'drawing', 'image/png')],
      gapReport: { summary: { status: 'ok', gaps_count: 0 } },
      checklist: [
        { item_ref: 'P1', answer: null },
        { item_ref: 'P2', answer: 'not_evaluated' },
      ],
    });
    expect(s.status).toBe('evadibile');
  });

  test('soft-warn catalogo: restano uncataloged ma status da capability', () => {
    const s = deriveOrderEvadibilitySignal({
      attachments: [
        att(1, 'drawing', 'image/png'),
        att(2, null, 'application/pdf', 'misc.pdf'),
      ],
      gapReport: { summary: { status: 'ok', gaps_count: 0 } },
    });
    expect(s.status).toBe('evadibile');
    expect(s.sources.catalog.softWarnUncataloged).toBe(true);
    expect(s.reasons.some((r) => /da catalogare/i.test(r))).toBe(true);
  });
});

describe('evadibilityStatusClass', () => {
  test('mappa classi CSS studio', () => {
    expect(evadibilityStatusClass('evadibile')).toBe('cr-studio-status-ok');
    expect(evadibilityStatusClass('gap')).toBe('cr-studio-status-gap');
    expect(evadibilityStatusClass('need_input')).toBe('cr-studio-status-need');
  });
});
