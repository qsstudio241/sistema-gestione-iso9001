/**
 * Test L1  validazione upload template Word (ReportTemplatesAdminPage)
 */
import { describe, it, expect } from 'vitest';
import {
  validateDocxFile,
  MAX_TEMPLATE_BYTES,
  stripDocxExtension,
} from '../utils/reportTemplateUpload';

function createFile(name, size, type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('validateDocxFile  template report', () => {
  it('accetta .docx entro 5 MB', () => {
    const file = createFile('verbale.docx', 1024);
    expect(validateDocxFile(file)).toBeNull();
  });

  it('rifiuta estensioni diverse da .docx', () => {
    const file = createFile('verbale.pdf', 1024, 'application/pdf');
    expect(validateDocxFile(file)).toMatch(/\.docx/);
  });

  it('rifiuta file oltre 5 MB', () => {
    const file = createFile('grande.docx', MAX_TEMPLATE_BYTES + 1);
    expect(validateDocxFile(file)).toMatch(/5 MB/);
  });

  it('richiede un file selezionato', () => {
    expect(validateDocxFile(null)).toMatch(/Seleziona/);
  });
});

describe('stripDocxExtension', () => {
  it('rimuove .docx dal nome file', () => {
    expect(stripDocxExtension('VerbaleVisita.docx')).toBe('VerbaleVisita');
  });
});
