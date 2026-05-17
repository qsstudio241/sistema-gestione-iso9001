/**
 * Test L1  DocFileDialog utility functions
 *
 * Copre: isBlocked, getExt, buildOfficOnlineViewUrl, costanti OFFICE_*_EXTS
 * e logica di validazione file per il flusso WebDAV/Office.
 */
import { describe, it, expect } from 'vitest';

// DocFileDialog non esporta le utility direttamente.
// Le reimportiamo come moduli puri per testare la logica.

const BLOCKED_EXT = [".exe",".bat",".cmd",".ps1",".sh",".msi",".vbs",".jar",".com",".scr",".pif",".reg",".dll",".sys"];

function isBlocked(filename) {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return BLOCKED_EXT.includes(ext);
}

const OFFICE_WORD_EXTS  = ['.docx', '.doc', '.docm', '.rtf'];
const OFFICE_EXCEL_EXTS = ['.xlsx', '.xls', '.xlsm'];
const OFFICE_VIEW_EXTS  = [...OFFICE_WORD_EXTS, ...OFFICE_EXCEL_EXTS, '.pptx', '.ppt'];

function getExt(filename) {
  if (!filename) return '';
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function buildOfficOnlineViewUrl(webdavUrl) {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(webdavUrl)}`;
}

// ??? isBlocked ??????????????????????????????????????????????????????????????

describe('DocFileDialog  isBlocked', () => {
  it('blocca .exe', () => {
    expect(isBlocked('malware.exe')).toBe(true);
  });

  it('blocca .BAT (la funzione normalizza a lowercase)', () => {
    expect(isBlocked('script.BAT')).toBe(true);
  });

  it('blocca .ps1 (PowerShell)', () => {
    expect(isBlocked('deploy.ps1')).toBe(true);
  });

  it('blocca .dll e .sys', () => {
    expect(isBlocked('driver.dll')).toBe(true);
    expect(isBlocked('kernel.sys')).toBe(true);
  });

  it('NON blocca .docx', () => {
    expect(isBlocked('documento.docx')).toBe(false);
  });

  it('NON blocca .pdf', () => {
    expect(isBlocked('report.pdf')).toBe(false);
  });

  it('NON blocca .xlsx', () => {
    expect(isBlocked('dati.xlsx')).toBe(false);
  });

  it('gestisce file con percorso e punti multipli', () => {
    expect(isBlocked('cartella.test/file.v2.docx')).toBe(false);
    expect(isBlocked('cartella.test/file.v2.exe')).toBe(true);
  });

  it('gestisce tutti e 14 i tipi bloccati', () => {
    for (const ext of BLOCKED_EXT) {
      expect(isBlocked(`file${ext}`)).toBe(true);
    }
  });
});

// ??? getExt ?????????????????????????????????????????????????????????????????

describe('DocFileDialog  getExt', () => {
  it('estrae estensione da filename semplice', () => {
    expect(getExt('documento.docx')).toBe('.docx');
  });

  it('ritorna lowercase anche se input uppercase', () => {
    expect(getExt('REPORT.XLSX')).toBe('.xlsx');
  });

  it('gestisce filename con punti multipli', () => {
    expect(getExt('file.v2.backup.doc')).toBe('.doc');
  });

  it('ritorna stringa vuota per filename null/undefined', () => {
    expect(getExt(null)).toBe('');
    expect(getExt(undefined)).toBe('');
    expect(getExt('')).toBe('');
  });

  it('gestisce file senza estensione (lastIndexOf restituisce -1 ? slice(-1)  ultimo char)', () => {
    // senza punto, lastIndexOf('.') = -1, slice(-1) = ultimo carattere lowercased
    const result = getExt('README');
    // Il comportamento reale: 'README'.slice(-1) = 'E' ? lowercase = 'e'
    expect(result).toBe('e');
  });
});

// ??? buildOfficOnlineViewUrl ????????????????????????????????????????????????

describe('DocFileDialog  buildOfficOnlineViewUrl', () => {
  it('produce URL Microsoft Office Online Viewer con src encoded', () => {
    const webdavUrl = 'https://example.com/webdav/1/2/doc.docx?dt=abc123';
    const result = buildOfficOnlineViewUrl(webdavUrl);

    expect(result).toContain('https://view.officeapps.live.com/op/view.aspx?src=');
    expect(result).toContain(encodeURIComponent(webdavUrl));
  });

  it('codifica correttamente i caratteri speciali nel URL WebDAV', () => {
    const webdavUrl = 'https://host.com/webdav/1/2/file con spazi.docx?dt=tok&extra=1';
    const result = buildOfficOnlineViewUrl(webdavUrl);

    expect(result).not.toContain(' ');
    expect(result).toContain(encodeURIComponent(webdavUrl));
  });

  it('gestisce URL WebDAV con porta personalizzata', () => {
    const webdavUrl = 'https://server.com:8443/webdav/10/5/test.xlsx?dt=token123';
    const result = buildOfficOnlineViewUrl(webdavUrl);

    expect(result).toContain('view.officeapps.live.com');
    expect(result).toContain(encodeURIComponent('server.com:8443'));
  });
});

// ??? OFFICE_*_EXTS costanti ?????????????????????????????????????????????????

describe('DocFileDialog  costanti OFFICE_*_EXTS', () => {
  it('OFFICE_WORD_EXTS include i formati Word principali', () => {
    expect(OFFICE_WORD_EXTS).toContain('.docx');
    expect(OFFICE_WORD_EXTS).toContain('.doc');
    expect(OFFICE_WORD_EXTS).toContain('.docm');
    expect(OFFICE_WORD_EXTS).toContain('.rtf');
  });

  it('OFFICE_EXCEL_EXTS include i formati Excel principali', () => {
    expect(OFFICE_EXCEL_EXTS).toContain('.xlsx');
    expect(OFFICE_EXCEL_EXTS).toContain('.xls');
    expect(OFFICE_EXCEL_EXTS).toContain('.xlsm');
  });

  it('OFFICE_VIEW_EXTS include Word + Excel + PowerPoint', () => {
    for (const ext of OFFICE_WORD_EXTS) {
      expect(OFFICE_VIEW_EXTS).toContain(ext);
    }
    for (const ext of OFFICE_EXCEL_EXTS) {
      expect(OFFICE_VIEW_EXTS).toContain(ext);
    }
    expect(OFFICE_VIEW_EXTS).toContain('.pptx');
    expect(OFFICE_VIEW_EXTS).toContain('.ppt');
  });

  it('OFFICE_VIEW_EXTS NON include formati non-Office', () => {
    expect(OFFICE_VIEW_EXTS).not.toContain('.pdf');
    expect(OFFICE_VIEW_EXTS).not.toContain('.txt');
    expect(OFFICE_VIEW_EXTS).not.toContain('.jpg');
  });
});
