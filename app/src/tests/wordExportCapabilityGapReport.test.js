/**
 * L1 — Export Word report studio (gap capacità, snapshot VC-1).
 */
import { describe, it, expect, vi } from 'vitest';
import PizZip from 'pizzip';
import {
  buildCapabilityGapReportFileName,
  generateCapabilityGapReportBlob,
  exportCapabilityGapReportFromApi,
} from '../utils/wordExportCapabilityGapReport.js';

vi.mock('file-saver', () => ({ saveAs: vi.fn(), default: { saveAs: vi.fn() } }));

function blobToArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}

const SAMPLE_REPORT = {
  version: 1,
  generated_at: '2026-09-01T12:00:00.000Z',
  case_id: 42,
  organization_id: 1001,
  company_id: 7,
  project_id: 3,
  summary: {
    status: 'gap',
    requirements_count: 4,
    extracted_profile_active: true,
    gaps_count: 2,
    coverage: { covered: 1, total: 2, uncovered: 1, partial: 0 },
  },
  gaps: [
    {
      code: 'WPS_UNCOVERED',
      severity: 'gap',
      source: 'welder_coverage',
      message: 'Nessun saldatore operativo copre la WPS WPS-01.',
    },
    {
      code: 'WPQR_NEED_INPUT',
      severity: 'need_input',
      source: 'wpqr_advisory',
      message: 'Dati incompleti per valutare WPQR: giunto A',
    },
  ],
  coverage: {
    has_wps: true,
    summary: { covered: 1, total: 2, uncovered: 1, partial: 0 },
    rows: [
      {
        wps_id: 1,
        wps_code: 'WPS-01',
        welding_process: '135',
        esito: 'rosso',
        qualified_count: 0,
      },
      {
        wps_id: 2,
        wps_code: 'WPS-02',
        welding_process: '111',
        esito: 'verde',
        qualified_count: 2,
      },
    ],
  },
};

describe('buildCapabilityGapReportFileName', () => {
  it('usa titolo caso e data snapshot', () => {
    const name = buildCapabilityGapReportFileName({
      report: SAMPLE_REPORT,
      caseTitle: 'Offerta Mason FW',
    });
    expect(name).toMatch(/^ReportStudio_GapCapacita_Offerta_Mason_FW_2026-09-01\.docx$/);
  });
});

describe('generateCapabilityGapReportBlob', () => {
  it('produce OOXML con esito, gap e WPS dallo snapshot', async () => {
    const blob = await generateCapabilityGapReportBlob({
      report: SAMPLE_REPORT,
      caseTitle: 'Caso Demo',
      companyLabel: 'Mason Srl',
    });
    expect(blob.size).toBeGreaterThan(500);

    const zip = new PizZip(await blobToArrayBuffer(blob));
    expect(zip.files['word/document.xml']).toBeTruthy();
    const xml = zip.files['word/document.xml'].asText();
    expect(xml).toContain('Caso Demo');
    expect(xml).toContain('Mason Srl');
    expect(xml).toContain('Gap rispetto alla capacit');
    expect(xml).toContain('WPS_UNCOVERED');
    expect(xml).toContain('WPS-01');
    expect(xml).toContain('Report studio');
  });

  it('senza report lancia errore chiaro', async () => {
    await expect(generateCapabilityGapReportBlob({ report: null })).rejects.toThrow(
      /assente|genera/i,
    );
  });
});

describe('exportCapabilityGapReportFromApi', () => {
  it('usa GET snapshot e rifiuta se null', async () => {
    const api = {
      getCapabilityGapReport: vi.fn().mockResolvedValue({ report: null }),
    };
    await expect(exportCapabilityGapReportFromApi(9, api)).rejects.toThrow(/Nessuno snapshot/i);
    expect(api.getCapabilityGapReport).toHaveBeenCalledWith(9);
  });

  it('scarica quando lo snapshot c’è', async () => {
    const { saveAs } = await import('file-saver');
    const api = {
      getCapabilityGapReport: vi.fn().mockResolvedValue({ report: SAMPLE_REPORT }),
    };
    const fileName = await exportCapabilityGapReportFromApi(42, api, {
      caseTitle: 'X',
    });
    expect(fileName).toMatch(/\.docx$/);
    expect(saveAs).toHaveBeenCalled();
  });
});
