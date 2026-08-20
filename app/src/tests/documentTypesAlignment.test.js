import { describe, it, expect } from 'vitest';
import { DOC_TYPE_OPTIONS, DOC_TYPE_LABELS } from '../data/documentTypes';
import { getSuggestedFolderCode, getSuggestedFolderLabel, DOC_TYPE_FOLDER_MAP } from '../data/documentFolderMapping';
import { getSchemaForDocType } from '../data/documentTypeSchemas';

describe('documentTypes allineamento P0-P3', () => {
  it('DOC_TYPE_OPTIONS usa chiavi snake_case', () => {
    for (const { value } of DOC_TYPE_OPTIONS) {
      expect(value).toMatch(/^[a-z0-9_]+$/);
    }
    expect(DOC_TYPE_LABELS.procedura).toBe('Procedura');
  });

  it('include nuovi tipi certificato_materiale, sal, rdp, capitolato', () => {
    const values = DOC_TYPE_OPTIONS.map((o) => o.value);
    expect(values).toContain('certificato_materiale');
    expect(values).toContain('sal');
    expect(values).toContain('rdp');
    expect(values).toContain('capitolato');
  });
});

describe('documentFolderMapping', () => {
  it('certificato_materiale -> 2.1 CERTIFICATI', () => {
    expect(getSuggestedFolderCode('certificato_materiale')).toBe('2.1');
  });

  it('wps/wpqr usano sotto-cartella 9.1 (template 3834)', () => {
    expect(DOC_TYPE_FOLDER_MAP.wps).toBe('9.1');
    expect(DOC_TYPE_FOLDER_MAP.wpqr).toBe('9.1');
  });

  it('capitolato → 2.2 CAPITOLATI', () => {
    expect(getSuggestedFolderCode('capitolato')).toBe('2.2');
    expect(getSuggestedFolderLabel('capitolato')).toBe('CAPITOLATI (2.2)');
  });
});

describe('documentTypeSchemas AI', () => {
  it('espone schemi AI per tipi a scadenza', () => {
    for (const type of ['cert_ndt', 'cert_taratura', 'qualifica_14732', 'wpqr']) {
      const schema = getSchemaForDocType(type);
      expect(schema).toBeTruthy();
      expect(schema.aiPrompt).toBeTruthy();
      expect(schema.aiExpectedSchema).toBeTruthy();
    }
  });

  it('certificato_materiale ha schema EN 10204', () => {
    const schema = getSchemaForDocType('certificato_materiale');
    expect(schema?.aiExpectedSchema?.certificate_type).toContain('3.1');
  });
});

describe('patentino_saldatore - norma di riferimento (fix default 9606-1:2017)', () => {
  it('propone come prima opzione/default la norma vigente ISO 9606-1:2017, non la 2012 superata', () => {
    const schema = getSchemaForDocType('patentino_saldatore');
    const field = schema.fields.find((f) => f.key === 'standard_reference');
    expect(field).toBeTruthy();
    expect(field.options[0].value).toBe('ISO 9606-1:2017');
  });

  it('mantiene selezionabile la 2012 per registrare certificati storici legittimi', () => {
    const schema = getSchemaForDocType('patentino_saldatore');
    const field = schema.fields.find((f) => f.key === 'standard_reference');
    const values = field.options.map((o) => o.value);
    expect(values).toContain('ISO 9606-1:2012');
  });

  it('il prompt AI indica 2017 come default quando il certificato non specifica l\'anno', () => {
    const schema = getSchemaForDocType('patentino_saldatore');
    expect(schema.aiPrompt).toMatch(/ISO 9606-1:2017.*default/);
  });
});
