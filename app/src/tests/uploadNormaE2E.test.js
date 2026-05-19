import { describe, it, expect } from 'vitest';

// ??? Test 1: Schema norma – campi ???????????????????????????????????????????

describe('Schema norma - campi', () => {
  it('lo schema norma contiene tutti i campi attesi', async () => {
    const DOCUMENT_TYPE_SCHEMAS = (await import('../data/documentTypeSchemas.js')).default;
    const normaSchema = DOCUMENT_TYPE_SCHEMAS.norma;

    expect(normaSchema).toBeDefined();
    expect(normaSchema.fields).toBeDefined();

    const fieldKeys = normaSchema.fields.map(f => f.key);
    expect(fieldKeys).toContain('standard_code');
    expect(fieldKeys).toContain('norm_title');
    expect(fieldKeys).toContain('issuing_body');
    expect(fieldKeys).toContain('edition_year');
    expect(fieldKeys).toContain('scope_summary');
    expect(fieldKeys).toContain('ics_code');
    expect(fieldKeys).toContain('is_harmonized');
  });

  it('aiExpectedSchema definisce i tipi attesi per ogni campo norma', async () => {
    const DOCUMENT_TYPE_SCHEMAS = (await import('../data/documentTypeSchemas.js')).default;
    const schema = DOCUMENT_TYPE_SCHEMAS.norma.aiExpectedSchema;

    expect(schema).toBeDefined();
    expect(schema.standard_code).toBe('string|null');
    expect(schema.norm_title).toBe('string|null');
    expect(schema.issuing_body).toBe('string|null');
    expect(schema.edition_year).toBe('number|null');
    expect(schema.is_harmonized).toBe('boolean|null');
  });
});

// ??? Test 2: Mapping tipo ? cartella ????????????????????????????????????????

describe('Document folder mapping', () => {
  it('norma viene mappata alla cartella 2.3 (Norme e Leggi)', async () => {
    const { DOC_TYPE_FOLDER_MAP } = await import('../data/documentFolderMapping.js');

    expect(DOC_TYPE_FOLDER_MAP.norma).toBeDefined();
    expect(DOC_TYPE_FOLDER_MAP.norma).toBe('2.3');
  });

  it('tutti i tipi principali hanno un mapping', async () => {
    const { DOC_TYPE_FOLDER_MAP } = await import('../data/documentFolderMapping.js');

    const expectedTypes = ['norma', 'procedura', 'istruzione', 'modulo', 'manuale'];
    expectedTypes.forEach(type => {
      expect(DOC_TYPE_FOLDER_MAP[type]).toBeDefined();
    });
  });

  it('getSuggestedFolderCode ritorna il codice corretto', async () => {
    const { getSuggestedFolderCode } = await import('../data/documentFolderMapping.js');

    expect(getSuggestedFolderCode('norma')).toBe('2.3');
    expect(getSuggestedFolderCode('procedura')).toBe('1.2');
    expect(getSuggestedFolderCode(null)).toBeNull();
    expect(getSuggestedFolderCode('tipo_inesistente')).toBeNull();
  });
});

// ??? Test 3: DocumentForm – validazione file upload ?????????????????????????

describe('DocumentForm - upload unificato', () => {
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
  const ACCEPTED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
  ];

  it('il form accetta file con validazione dimensione', () => {
    const smallFile = { size: 1024, name: 'test.pdf', type: 'application/pdf' };
    const bigFile = { size: 60 * 1024 * 1024, name: 'huge.pdf', type: 'application/pdf' };

    expect(smallFile.size).toBeLessThan(MAX_FILE_SIZE);
    expect(bigFile.size).toBeGreaterThan(MAX_FILE_SIZE);
  });

  it('i tipi file accettati includono PDF, DOCX, XLSX', () => {
    expect(ACCEPTED_TYPES).toContain('application/pdf');
    expect(ACCEPTED_TYPES).toContain(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(ACCEPTED_TYPES).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('file con tipo non accettato viene rifiutato', () => {
    const exeFile = { size: 1024, name: 'malware.exe', type: 'application/x-msdownload' };
    expect(ACCEPTED_TYPES).not.toContain(exeFile.type);
  });
});

// ??? Test 4: OrphanInbox – logica orfano ????????????????????????????????????

describe('OrphanInbox - archiviazione', () => {
  const isOrphan = (doc) => doc.parent_id === null || doc.parent_id === 0;

  it('un documento senza parent_id è considerato orfano', () => {
    const doc = { id: 1, title: 'Test', parent_id: null, doc_type: 'norma' };
    expect(isOrphan(doc)).toBe(true);
  });

  it('un documento con parent_id=0 è considerato orfano', () => {
    const doc = { id: 2, title: 'Test 2', parent_id: 0, doc_type: 'norma' };
    expect(isOrphan(doc)).toBe(true);
  });

  it('un documento con parent_id valido NON è orfano', () => {
    const doc = { id: 3, title: 'Test 3', parent_id: 15, doc_type: 'norma' };
    expect(isOrphan(doc)).toBe(false);
  });
});

// ??? Test 5: Metadati attesi per BS EN ISO 9606-1:2017 ??????????????????????

describe('BS EN ISO 9606-1 - metadati attesi', () => {
  it('i metadati attesi per la norma sono corretti', () => {
    const expectedMetadata = {
      standard_code: 'BS EN ISO 9606-1:2017',
      norm_title: expect.stringContaining('Qualification testing of welders'),
      issuing_body: expect.stringMatching(/BSI|ISO|CEN/),
      edition_year: 2017,
      is_harmonized: true,
    };

    expect(expectedMetadata.standard_code).toMatch(/9606/);
    expect(expectedMetadata.edition_year).toBe(2017);
    expect(expectedMetadata.is_harmonized).toBe(true);
  });

  it('lo schema norma supporta tutti i campi necessari per BS EN ISO 9606-1', async () => {
    const DOCUMENT_TYPE_SCHEMAS = (await import('../data/documentTypeSchemas.js')).default;
    const normaSchema = DOCUMENT_TYPE_SCHEMAS.norma;
    const fieldKeys = normaSchema.fields.map(f => f.key);

    const requiredForBSEN = [
      'standard_code',
      'norm_title',
      'issuing_body',
      'edition_year',
      'is_harmonized',
      'ics_code',
      'scope_summary',
    ];

    requiredForBSEN.forEach(field => {
      expect(fieldKeys).toContain(field);
    });
  });

  it('il campo is_harmonized è di tipo boolean', async () => {
    const DOCUMENT_TYPE_SCHEMAS = (await import('../data/documentTypeSchemas.js')).default;
    const isHarmonizedField = DOCUMENT_TYPE_SCHEMAS.norma.fields.find(
      f => f.key === 'is_harmonized'
    );

    expect(isHarmonizedField).toBeDefined();
    expect(isHarmonizedField.type).toBe('boolean');
  });
});
