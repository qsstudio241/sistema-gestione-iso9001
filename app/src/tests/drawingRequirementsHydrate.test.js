/**
 * Test FIX — idratazione pannello "Requisiti da disegno" al mount tab.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  latestExtractionByAttachment,
  pickDrawingAttachmentId,
  hydrateDrawingRequirements,
} from '../utils/drawingExtractionHydrate';

describe('drawingExtractionHydrate', () => {
  const drawings = [
    { attachment_id: 99, file_name: 'd1.pdf', commercial_doc_role: 'drawing' },
    { attachment_id: 100, file_name: 'd2.pdf', commercial_doc_role: 'drawing' },
  ];

  it('latestExtractionByAttachment tiene solo il job più recente per allegato', () => {
    const map = latestExtractionByAttachment([
      { id: 3, attachment_id: 99, status: 'done', created_at: '2026-07-01' },
      { id: 2, attachment_id: 99, status: 'error', created_at: '2026-06-30' },
      { id: 4, attachment_id: 100, status: 'done', created_at: '2026-07-01' },
    ]);
    expect(map.get(99).id).toBe(3);
    expect(map.get(100).id).toBe(4);
  });

  it('pickDrawingAttachmentId usa selezione o il primo disegno', () => {
    expect(pickDrawingAttachmentId(drawings, 100)).toBe(100);
    expect(pickDrawingAttachmentId(drawings, null)).toBe(99);
  });

  it('hydrateDrawingRequirements carica requisiti del job done più recente', async () => {
    const listDrawingExtractions = vi.fn().mockResolvedValue({
      extractions: [{ id: 10, attachment_id: 99, status: 'done' }],
    });
    const getDrawingExtraction = vi.fn().mockResolvedValue({
      id: 10,
      status: 'done',
      provider: 'gemini',
      requirements: [{ id: 1, req_type: 'material', value_text: 'S355' }],
    });

    const result = await hydrateDrawingRequirements({
      caseId: 5,
      drawings,
      selectedDocId: null,
      listDrawingExtractions,
      getDrawingExtraction,
    });

    expect(listDrawingExtractions).toHaveBeenCalledWith(5);
    expect(getDrawingExtraction).toHaveBeenCalledWith(5, 10);
    expect(result.reqs).toHaveLength(1);
    expect(result.targetDocId).toBe(99);
  });

  it('hydrateDrawingRequirements avvia polling se job in processing', async () => {
    const onStartPolling = vi.fn();
    const listDrawingExtractions = vi.fn().mockResolvedValue({
      extractions: [{ id: 11, attachment_id: 99, status: 'processing' }],
    });
    const getDrawingExtraction = vi.fn();

    const result = await hydrateDrawingRequirements({
      caseId: 5,
      drawings,
      selectedDocId: 99,
      listDrawingExtractions,
      getDrawingExtraction,
      onStartPolling,
    });

    expect(onStartPolling).toHaveBeenCalledWith(11);
    expect(getDrawingExtraction).not.toHaveBeenCalled();
    expect(result.extraction.status).toBe('processing');
    expect(result.reqs).toEqual([]);
  });
});
