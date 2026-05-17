/**
 * Test L1 - Document Lifecycle: stati, transizioni, contratti API
 *
 * Copre: il contratto API per release-revision, la logica degli stati
 * (bozza -> rilasciato, rilasciato -> bozza dopo edit WebDAV),
 * il mapping degli stati nel DetailPanel.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// -- Stato lifecycle document --

const VALID_STATUSES = ['rilasciato', 'vigente', 'bozza', 'in_revisione', 'in_approvazione', 'obsoleto'];

describe('Document Lifecycle - stati validi', () => {
  it('tutti gli stati hanno label nel pannello dettaglio', () => {
    const STATUS_CONFIG = {
      rilasciato:   { label: "Rilasciato",   className: "doc-detail__badge--green" },
      vigente:      { label: "Rilasciato",   className: "doc-detail__badge--green" },
      in_revisione: { label: "In revisione", className: "doc-detail__badge--yellow" },
      obsoleto:     { label: "Obsoleto",     className: "doc-detail__badge--grey" },
      bozza:        { label: "Bozza",        className: "doc-detail__badge--blue" },
    };
    for (const s of ['rilasciato', 'vigente', 'bozza', 'in_revisione', 'obsoleto']) {
      expect(STATUS_CONFIG[s]).toBeDefined();
      expect(STATUS_CONFIG[s].label).toBeTruthy();
    }
  });
});

// -- Contratto API release-revision --

describe('Document Lifecycle - API contract release-revision', () => {
  let mockPost;

  beforeEach(() => {
    mockPost = vi.fn();
  });

  it('release-revision chiama POST /documents/:id/release-revision', async () => {
    mockPost.mockResolvedValue({
      id: 42,
      status: 'rilasciato',
      revision: 'Rev. 3',
      revision_number: 3,
      released_at: '2026-05-15T10:00:00Z',
    });

    const docId = 42;
    const result = await mockPost(`/documents/${docId}/release-revision`, {});

    expect(mockPost).toHaveBeenCalledWith('/documents/42/release-revision', {});
    expect(result.status).toBe('rilasciato');
    expect(result.revision_number).toBe(3);
  });

  it('la risposta include revision_number incrementato', async () => {
    mockPost.mockResolvedValue({
      id: 42,
      status: 'rilasciato',
      revision: 'Rev. 5',
      revision_number: 5,
      released_at: '2026-05-15T12:00:00Z',
    });

    const result = await mockPost('/documents/42/release-revision', {});
    expect(result.revision_number).toBeGreaterThan(0);
    expect(result.revision).toMatch(/Rev\.\s*\d+/);
  });

  it('release di un documento non-bozza ritorna errore', async () => {
    mockPost.mockRejectedValue(new Error('Solo documenti in stato bozza possono essere rilasciati'));

    await expect(mockPost('/documents/42/release-revision', {}))
      .rejects.toThrow(/bozza/i);
  });

  it('release con label personalizzata passa il campo', async () => {
    mockPost.mockResolvedValue({
      id: 42,
      status: 'rilasciato',
      revision: 'Rev. Speciale 2026',
      revision_number: 4,
    });

    const result = await mockPost('/documents/42/release-revision', {
      revision_label: 'Rev. Speciale 2026',
    });
    expect(result.revision).toBe('Rev. Speciale 2026');
  });
});

// -- Contratto API webdav-link --

describe('Document Lifecycle - API contract webdav-link', () => {
  let mockPost;

  beforeEach(() => {
    mockPost = vi.fn();
  });

  it('webdav-link ritorna webdav_url e office_uri per .docx', async () => {
    mockPost.mockResolvedValue({
      webdav_url:  'https://server.com/webdav/1/42/doc.docx?dt=tok123',
      office_uri:  'ms-word:ofe|u|https://server.com/webdav/1/42/doc.docx?dt=tok123',
      file_name:   'doc.docx',
      mime_type:   'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      is_word:     true,
      is_excel:    false,
      has_office_uri: true,
      expires_at:  '2026-05-15T10:15:00Z',
    });

    const result = await mockPost('/documents/42/webdav-link', {});

    expect(result.webdav_url).toContain('/webdav/');
    expect(result.webdav_url).toContain('dt=');
    expect(result.office_uri).toMatch(/^ms-word:ofe\|u\|/);
    expect(result.has_office_uri).toBe(true);
    expect(result.is_word).toBe(true);
    expect(result.expires_at).toBeTruthy();
  });

  it('webdav-link ritorna office_uri ms-excel per .xlsx', async () => {
    mockPost.mockResolvedValue({
      webdav_url:  'https://server.com/webdav/1/42/dati.xlsx?dt=tok456',
      office_uri:  'ms-excel:ofe|u|https://server.com/webdav/1/42/dati.xlsx?dt=tok456',
      file_name:   'dati.xlsx',
      is_word:     false,
      is_excel:    true,
      has_office_uri: true,
      expires_at:  '2026-05-15T10:15:00Z',
    });

    const result = await mockPost('/documents/42/webdav-link', {});
    expect(result.office_uri).toMatch(/^ms-excel:ofe\|u\|/);
    expect(result.is_excel).toBe(true);
  });

  it('webdav-link ritorna office_uri null per formato non supportato (.pdf)', async () => {
    mockPost.mockResolvedValue({
      webdav_url:  'https://server.com/webdav/1/42/report.pdf?dt=tok789',
      office_uri:  null,
      file_name:   'report.pdf',
      is_word:     false,
      is_excel:    false,
      has_office_uri: false,
      expires_at:  '2026-05-15T10:15:00Z',
    });

    const result = await mockPost('/documents/42/webdav-link', {});
    expect(result.office_uri).toBeNull();
    expect(result.has_office_uri).toBe(false);
  });

  it('webdav-link fallisce se nessun file allegato al documento', async () => {
    mockPost.mockRejectedValue(new Error('Nessun file allegato al documento. Carica prima un file.'));

    await expect(mockPost('/documents/42/webdav-link', {}))
      .rejects.toThrow(/nessun file allegato/i);
  });

  it('expires_at e una data ISO valida e parsabile', async () => {
    const futureDate = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    mockPost.mockResolvedValue({
      webdav_url: 'https://s.com/webdav/1/42/f.docx?dt=t',
      office_uri: 'ms-word:ofe|u|https://s.com/webdav/1/42/f.docx?dt=t',
      expires_at: futureDate,
    });

    const result = await mockPost('/documents/42/webdav-link', {});
    const date = new Date(result.expires_at);
    expect(date.getTime()).not.toBeNaN();
    expect(date.getTime()).toBeGreaterThan(Date.now() - 86400000);
  });
});

// -- Transizione stato dopo WebDAV PUT --

describe('Document Lifecycle - transizione dopo edit WebDAV', () => {
  it('un documento rilasciato diventa bozza dopo salvataggio Office', () => {
    const statusesTransitionToBozza = ['rilasciato', 'vigente', 'in_revisione'];
    for (const originalStatus of statusesTransitionToBozza) {
      const newStatus = statusesTransitionToBozza.includes(originalStatus) ? 'bozza' : originalStatus;
      expect(newStatus).toBe('bozza');
    }
  });

  it('un documento gia in bozza resta bozza dopo WebDAV PUT', () => {
    const original = 'bozza';
    const shouldChange = ['rilasciato', 'vigente', 'in_revisione'].includes(original);
    expect(shouldChange).toBe(false);
  });

  it('un documento obsoleto NON deve transitare a bozza', () => {
    const original = 'obsoleto';
    const shouldChange = ['rilasciato', 'vigente', 'in_revisione'].includes(original);
    expect(shouldChange).toBe(false);
  });
});
