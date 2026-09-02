import { describe, it, expect, vi } from 'vitest';
import PizZip from 'pizzip';
import {
  buildContractReviewChecklistFileName,
  generateContractReviewChecklistBlob,
} from '../utils/wordExportContractReviewChecklist';

vi.mock('file-saver', () => ({ saveAs: vi.fn(), default: { saveAs: vi.fn() } }));

function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

const SAMPLE_CHECKLIST = [
  {
    id: 1,
    phase: 'preliminary',
    item_ref: 'P1',
    item_text: 'Requisiti tecnici del cliente chiaramente identificati',
    answer: 'yes',
    notes: 'Capitolato rev. B',
  },
  {
    id: 2,
    phase: 'preliminary',
    item_ref: 'P10',
    item_text: 'Rischi contrattuali valutati',
    answer: 'partial',
    notes: '',
  },
  {
    id: 3,
    phase: 'final',
    item_ref: 'F1',
    item_text: "Ordine conforme all'offerta inviata",
    answer: 'no',
    notes: 'Attesa conferma cliente',
  },
];

describe('wordExportContractReviewChecklist', () => {
  it('produce OOXML con P1/F1, esiti e disclaimer §8.2', async () => {
    const blob = await generateContractReviewChecklistBlob({
      caseMeta: {
        id: 42,
        title: 'Commessa Demo',
        external_ref: 'RFQ-2026-01',
        status: 'INTAKE_REVIEW',
        commercial_customer_name: 'Cliente Spa',
        company_name: 'Appaltatrice Srl',
      },
      checklist: SAMPLE_CHECKLIST,
    });
    expect(blob.size).toBeGreaterThan(500);

    const zip = new PizZip(await blobToArrayBuffer(blob));
    expect(zip.files['word/document.xml']).toBeTruthy();
    const xml = zip.files['word/document.xml'].asText();
    expect(xml).toContain('Riesame dei requisiti');
    expect(xml).toContain('§8.2');
    expect(xml).toContain('non è Riesame di direzione');
    expect(xml).toContain('Commessa Demo');
    expect(xml).toContain('P1');
    expect(xml).toContain('F1');
    expect(xml).toContain('Sì');
    expect(xml).toContain('Capitolato rev. B');
    expect(xml).toContain('Attesa conferma cliente');
  });

  it('appendice gap sintetica se snapshot presente', async () => {
    const blob = await generateContractReviewChecklistBlob({
      caseMeta: { id: 7, title: 'Caso gap' },
      checklist: SAMPLE_CHECKLIST,
      gapReport: {
        generated_at: '2026-09-01T10:00:00.000Z',
        summary: { status: 'gap', gaps_count: 2, requirements_count: 5 },
        gaps: [
          { code: 'WPS', message: 'WPS mancante per processo 135' },
          { code: 'QUAL', message: 'Patentino scaduto' },
        ],
      },
    });
    const zip = new PizZip(await blobToArrayBuffer(blob));
    const xml = zip.files['word/document.xml'].asText();
    expect(xml).toContain('Appendice');
    expect(xml).toContain('gap capacità');
    expect(xml).toContain('WPS mancante');
    expect(xml).toContain('Gap rispetto alla capacità');
  });

  it('senza checklist lancia errore chiaro', async () => {
    await expect(
      generateContractReviewChecklistBlob({
        caseMeta: { id: 1 },
        checklist: [],
      }),
    ).rejects.toThrow(/Checklist assente/);
  });

  it('nome file sanitizzato', () => {
    const name = buildContractReviewChecklistFileName({
      caseMeta: { title: 'Caso / Alfa*' },
    });
    expect(name).toMatch(/^RiesameRequisiti_Checklist_Caso.*\.docx$/);
    expect(name).not.toContain('/');
    expect(name).not.toContain('*');
  });
});
