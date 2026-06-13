/**
 * Test L1 - ncWordExport
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildNcTemplateData,
  buildNcWordFileName,
  exportNcToWord,
  NC_ACTION_TYPE_LABELS,
  NC_STATUS_LABELS,
} from '../utils/ncWordExport';

const { DocxtemplaterMock, PizZipMock } = vi.hoisted(() => {
  class DocxtemplaterMock {
    constructor() {
      this.render = vi.fn();
    }

    getZip() {
      return {
        generate: () => new Blob(['docx'], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      };
    }
  }

  class PizZipMock {
    constructor() {
      this.files = {
        'word/document.xml': {
          asText: () => '<w:document>{ncNumber}</w:document>',
        },
      };
      this.file = vi.fn();
    }
  }

  return { DocxtemplaterMock, PizZipMock };
});

vi.mock('docxtemplater', () => ({
  default: DocxtemplaterMock,
}));

vi.mock('pizzip', () => ({
  default: PizZipMock,
}));

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('../utils/wordExport.js', () => ({
  fixWordXmlMojibake: (xml) => xml,
  repairDocxtemplaterFragmentedTags: (xml) => xml,
}));

describe('ncWordExport', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
  });

  it('buildNcTemplateData mappa campi NC, azioni e allegati', () => {
    const data = buildNcTemplateData(
      {
        nc_number: 'NC-2026-001',
        client_name: 'Cliente Demo',
        audit_number: 'AUD-01',
        audit_date: '2026-06-01',
        section_title: '10 - Miglioramento',
        source_type: 'manual',
        severity: 'major',
        status: 'in_progress',
        due_date: '2026-06-30',
        resolution_date: null,
        responsible_person: 'Mario Rossi',
        description: 'Descrizione NC',
        root_cause: 'Causa radice',
        verification_notes: 'Note verifica',
        verification_responsible: 'Luigi Verdi',
        approved_by_name: 'RQ Studio',
        approved_at: '2026-06-10T10:00:00.000Z',
      },
      [{
        action_type: 'corrective',
        status: 'open',
        description: 'Azione 1',
        responsible: 'Anna',
        due_date: '2026-07-01',
        completed_at: null,
        verification_note: '',
      }],
      [{
        file_name: 'evidenza.pdf',
        category: 'evidence',
        description: 'Foto difetto',
        created_at: '2026-06-02T08:00:00.000Z',
      }],
    );

    expect(data.ncNumber).toBe('NC-2026-001');
    expect(data.statusLabel).toBe(NC_STATUS_LABELS.in_progress);
    expect(data.noActions).toBe(false);
    expect(data.actions).toHaveLength(1);
    expect(data.actions[0].typeLabel).toBe(NC_ACTION_TYPE_LABELS.corrective);
    expect(data.attachments).toHaveLength(1);
    expect(data.attachmentsCount).toBe('1');
  });

  it('buildNcWordFileName sanitizza numero e cliente', () => {
    expect(buildNcWordFileName({
      nc_number: 'NC/2026-001',
      client_name: 'Azienda & Co.',
    })).toBe('NC_2026-001_Azienda_Co..docx');
  });

  it('exportNcToWord scarica blob con dati API', async () => {
    const apiService = {
      get: vi.fn().mockResolvedValue({
        data: {
          nc_number: 'NC-001',
          client_name: 'Cliente',
          attachments: [],
        },
      }),
      getNcActions: vi.fn().mockResolvedValue({ data: [] }),
    };

    const fileName = await exportNcToWord(42, apiService);
    expect(fileName).toBe('NC-001_Cliente.docx');
    expect(apiService.get).toHaveBeenCalledWith('/non-conformities/42');
    expect(apiService.getNcActions).toHaveBeenCalledWith(42);
  });
});
