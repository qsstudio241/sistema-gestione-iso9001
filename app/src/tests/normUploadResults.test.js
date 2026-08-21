import { describe, it, expect } from 'vitest';
import {
  normalizeNormUploadResults,
  countNormUploadSuccesses,
  resultsFromNormBatchPayload,
  folderCapNoticeFromPayload,
} from '../utils/normUploadResults';

describe('normUploadResults', () => {
  it('appiattisce metadata annidato dal backend', () => {
    const [row] = normalizeNormUploadResults([{
      success: true,
      filename: 'iso.pdf',
      metadata: {
        norm_title: 'Titolo norma',
        standard_code: 'ISO 9001:2015',
        edition_year: 2015,
        issuing_body: 'ISO',
      },
      textQuality: 'good',
    }]);

    expect(row.norm_title).toBe('Titolo norma');
    expect(row.standard_code).toBe('ISO 9001:2015');
    expect(row.edition_year).toBe(2015);
    expect(row.text_quality).toBe('good');
    expect(row.fileName).toBe('iso.pdf');
  });

  it('mantiene campi già  piatti', () => {
    const [row] = normalizeNormUploadResults([{
      success: true,
      norm_title: 'Già piatto',
      standard_code: 'UNI EN 1',
      fileName: 'a.pdf',
    }]);
    expect(row.norm_title).toBe('Già piatto');
  });

  it('resultsFromNormBatchPayload non butta l\'array su payload di errore', () => {
    const recovered = resultsFromNormBatchPayload({
      success: false,
      results: [{ status: 'duplicate', fileName: 'iso.pdf', standard_code: 'ISO 9001:2015' }],
    });
    expect(recovered).toHaveLength(1);
    expect(recovered[0].status).toBe('duplicate');
  });

  it('folderCapNoticeFromPayload descrive il tetto 20', () => {
    expect(folderCapNoticeFromPayload({ truncated: true, omitted: 7 }))
      .toBe('Prime 20. Ne restano 7.');
    expect(folderCapNoticeFromPayload({ truncated: false, omitted: 0 })).toBeNull();
  });

  it('countNormUploadSuccesses richiede documentId e ignora errori', () => {
    const n = countNormUploadSuccesses([
      { success: true, documentId: 99, norm_title: 'OK' },
      { success: true, norm_title: 'Solo AI, non in archivio' },
      { error: 'fail', fileName: 'x.pdf' },
    ]);
    expect(n).toBe(1);
  });
});
