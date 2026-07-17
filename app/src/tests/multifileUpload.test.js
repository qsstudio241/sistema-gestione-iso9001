/**
 * Test SLICE C — Multi-file upload allegati su commessa
 *
 * Verifica la logica di handleUploadAttachment multi-file estratta come funzione pura:
 *  1. Upload sequenziale (non parallelo) di N file
 *  2. Errore su un file non blocca gli altri (batch continua)
 *  3. Errore su tutti i file: flag corretto
 *  4. Progress callback chiamata per ogni file
 *  5. anyAnalysis=true se almeno un file restituisce analysis_job_id
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Logica estratta di handleUploadAttachment multi-file.
 * Replica la funzione di ContractReviewPage senza dipendenze React.
 */
async function multiFileUpload({ files, caseId, uploadOneFile, onProgress }) {
  let anyAnalysis = false;
  const partialErrors = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.({ current: i + 1, total: files.length, fileName: file.name });
    try {
      const result = await uploadOneFile(caseId, file);
      if (result?.analysis_job_id != null) anyAnalysis = true;
    } catch (err) {
      partialErrors.push({ fileName: file.name, error: err.message });
    }
  }

  return { anyAnalysis, partialErrors };
}

describe('Multi-file upload (SLICE C)', () => {
  const makeFile = (name) => ({ name });

  beforeEach(() => vi.clearAllMocks());

  it('carica N file sequenzialmente e chiama onProgress per ognuno', async () => {
    const uploadOneFile = vi.fn().mockResolvedValue({ attachment_id: 1 });
    const onProgress = vi.fn();
    const files = [makeFile('doc1.pdf'), makeFile('doc2.pdf'), makeFile('doc3.pdf')];

    const { partialErrors } = await multiFileUpload({ files, caseId: 5, uploadOneFile, onProgress });

    expect(uploadOneFile).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenNthCalledWith(1, { current: 1, total: 3, fileName: 'doc1.pdf' });
    expect(onProgress).toHaveBeenNthCalledWith(2, { current: 2, total: 3, fileName: 'doc2.pdf' });
    expect(onProgress).toHaveBeenNthCalledWith(3, { current: 3, total: 3, fileName: 'doc3.pdf' });
    expect(partialErrors).toHaveLength(0);
  });

  it('errore su un file non blocca gli altri (batch continua)', async () => {
    const uploadOneFile = vi.fn()
      .mockResolvedValueOnce({ attachment_id: 10 })
      .mockRejectedValueOnce(new Error('Tipo file non supportato'))
      .mockResolvedValueOnce({ attachment_id: 12, analysis_job_id: 99 });

    const files = [makeFile('ok1.pdf'), makeFile('fail.xyz'), makeFile('ok2.pdf')];
    const { partialErrors, anyAnalysis } = await multiFileUpload({
      files, caseId: 1, uploadOneFile, onProgress: vi.fn(),
    });

    expect(uploadOneFile).toHaveBeenCalledTimes(3);
    expect(partialErrors).toHaveLength(1);
    expect(partialErrors[0].fileName).toBe('fail.xyz');
    expect(partialErrors[0].error).toBe('Tipo file non supportato');
    // Il terzo file ha analysis_job_id
    expect(anyAnalysis).toBe(true);
  });

  it('tutti i file falliti: partialErrors.length === files.length', async () => {
    const uploadOneFile = vi.fn().mockRejectedValue(new Error('Server error'));
    const files = [makeFile('a.pdf'), makeFile('b.pdf')];

    const { partialErrors, anyAnalysis } = await multiFileUpload({
      files, caseId: 2, uploadOneFile, onProgress: vi.fn(),
    });

    expect(partialErrors).toHaveLength(2);
    expect(anyAnalysis).toBe(false);
  });

  it('anyAnalysis=true se almeno un file restituisce analysis_job_id', async () => {
    const uploadOneFile = vi.fn()
      .mockResolvedValueOnce({ attachment_id: 1 })  // no analysis_job_id
      .mockResolvedValueOnce({ attachment_id: 2, analysis_job_id: 42 }); // con analisi

    const files = [makeFile('drawing.pdf'), makeFile('order.pdf')];
    const { anyAnalysis } = await multiFileUpload({
      files, caseId: 3, uploadOneFile, onProgress: vi.fn(),
    });

    expect(anyAnalysis).toBe(true);
  });

  it('anyAnalysis=false se nessun file ha analysis_job_id', async () => {
    const uploadOneFile = vi.fn().mockResolvedValue({ attachment_id: 7 });
    const files = [makeFile('report.docx'), makeFile('photo.jpg')];

    const { anyAnalysis } = await multiFileUpload({
      files, caseId: 4, uploadOneFile, onProgress: vi.fn(),
    });

    expect(anyAnalysis).toBe(false);
  });

  it('upload sequenziale: il secondo file parte dopo il primo (non parallelo)', async () => {
    const callOrder = [];
    const uploadOneFile = vi.fn().mockImplementation(async (caseId, file) => {
      callOrder.push(`start:${file.name}`);
      await new Promise((r) => setTimeout(r, 5));
      callOrder.push(`end:${file.name}`);
      return { attachment_id: 1 };
    });

    const files = [makeFile('file1.pdf'), makeFile('file2.pdf')];
    await multiFileUpload({ files, caseId: 6, uploadOneFile, onProgress: vi.fn() });

    // Sequenziale: end:file1 deve venire prima di start:file2
    const i1End = callOrder.indexOf('end:file1.pdf');
    const i2Start = callOrder.indexOf('start:file2.pdf');
    expect(i1End).toBeLessThan(i2Start);
  });
});
