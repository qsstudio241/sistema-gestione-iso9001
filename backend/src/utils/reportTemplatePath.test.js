/**
 * L1 — lookup file template di sistema per Duplica (VPS senza app/public).
 */
const path = require('path');
const fs = require('fs');
const { resolveTemplateSourcePath } = require('./reportTemplatePath');

describe('resolveTemplateSourcePath', () => {
  it('trova ISO 3834-2 dalla copia backend/templates', () => {
    const found = resolveTemplateSourcePath('/templates/ISO3834-audit-report.docx');
    expect(found).toBeTruthy();
    expect(fs.existsSync(found)).toBe(true);
    expect(path.basename(found)).toBe('ISO3834-audit-report.docx');
  });

  it('trova gli altri modelli di sistema seed (9001/14001/45001/verbale/NC)', () => {
    const names = [
      'ISO9001-audit-report.docx',
      'ISO14001-audit-report.docx',
      'ISO45001-audit-report.docx',
      'VerbaleVisita-generic.docx',
      'NC-scheda.docx',
      'Verbale_di_riunione_QTAFI_VIS001.docx',
    ];
    for (const name of names) {
      const found = resolveTemplateSourcePath(`/templates/${name}`);
      expect(found).toBeTruthy();
      expect(fs.existsSync(found)).toBe(true);
    }
  });

  it('null se il file non esiste', () => {
    expect(resolveTemplateSourcePath('/templates/non-esiste.docx')).toBeNull();
  });

  it('null se path vuoto o non riconosciuto', () => {
    expect(resolveTemplateSourcePath(null)).toBeNull();
    expect(resolveTemplateSourcePath('/altro/ISO3834-audit-report.docx')).toBeNull();
  });
});
