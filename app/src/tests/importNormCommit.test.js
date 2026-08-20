import { describe, it, expect } from 'vitest';
import {
  guessStandardCodeFromFilename,
  extractEditionYearFromStandardCode,
  buildInitialNormTypeData,
  buildCommitFormFromFile,
  applyNormLookupToTypeData,
  buildNormCommitPayload,
  isNormDocType,
} from '../utils/importNormCommit';

describe('importNormCommit', () => {
  it('isNormDocType riconosce norma', () => {
    expect(isNormDocType('norma')).toBe(true);
    expect(isNormDocType('norma_tecnica')).toBe(true);
    expect(isNormDocType('wps')).toBe(false);
  });

  it('guessStandardCodeFromFilename converte underscore', () => {
    expect(guessStandardCodeFromFilename('ISO_9606_1_2017.pdf')).toBe('ISO 9606 1 2017');
    expect(guessStandardCodeFromFilename('fattura.pdf')).toBe('');
  });

  it('extractEditionYearFromStandardCode legge anno da :YYYY', () => {
    expect(extractEditionYearFromStandardCode('BS EN ISO 9606-1:2017')).toBe(2017);
    expect(extractEditionYearFromStandardCode('ISO 9606 1 2017')).toBe(2017);
  });

  it('buildInitialNormTypeData integra AI e filename', () => {
    const tsd = buildInitialNormTypeData(
      { title: 'Qualification testing', type_specific_data: { issuing_body: 'ISO' } },
      { original_name: 'ISO_9001_2015.pdf' }
    );
    expect(tsd.standard_code).toBe('ISO 9001 2015');
    expect(tsd.edition_year).toBe(2015);
    expect(tsd.norm_title).toBe('Qualification testing');
  });

  it('buildCommitFormFromFile usa solo il nome file se original_name è un path', () => {
    const { form } = buildCommitFormFromFile(
      { document_type_guess: 'capitolato' },
      { original_name: 'Commesse/Rossi-2024/capitolato.pdf' },
      ''
    );
    expect(form.title).toBe('capitolato.pdf');
  });

  it('buildCommitFormFromFile usa document_type_guess norma', () => {
    const { isNorm, form } = buildCommitFormFromFile(
      { document_type_guess: 'norma', type_specific_data: { standard_code: 'ISO 9001:2015' } },
      { original_name: 'doc.pdf' },
      ''
    );
    expect(isNorm).toBe(true);
    expect(form.doc_type).toBe('norma');
    expect(form.typeData.standard_code).toBe('ISO 9001:2015');
  });

  it('buildCommitFormFromFile normalizza norma_tecnica da AI', () => {
    const { isNorm, form } = buildCommitFormFromFile(
      { document_type_guess: 'norma_tecnica', title: 'Qualification testing' },
      { original_name: 'ISO_9001_2015.pdf' },
      ''
    );
    expect(isNorm).toBe(true);
    expect(form.doc_type).toBe('norma');
    expect(form.typeData.standard_code).toBe('ISO 9001 2015');
    expect(form.typeData.edition_year).toBe(2015);
  });

  it('applyNormLookupToTypeData mappa vigore e catalogo', () => {
    const out = applyNormLookupToTypeData(
      { standard_code: 'ISO 9001:2015' },
      {
        status: 'active',
        catalogUrl: 'https://www.iso.org/search.html?q=ISO%209001',
        checkedAt: '2026-05-29T10:00:00.000Z',
        supersededBy: null,
      }
    );
    expect(out.validity_status).toBe('vigente');
    expect(out.validity_check_url).toContain('iso.org');
    expect(out.last_validity_check).toBeTruthy();
  });

  it('buildNormCommitPayload serializza type_specific_data', () => {
    const payload = buildNormCommitPayload({
      title: 'Fallback',
      typeData: {
        standard_code: 'UNI EN ISO 9001:2015',
        norm_title: 'Sistemi di gestione',
        issuing_body: 'UNI',
        edition_year: 2015,
      },
      notes: 'da import',
    });
    expect(payload.doc_type).toBe('norma');
    expect(payload.type_specific_data.standard_code).toContain('UNI EN ISO 9001');
    expect(payload.title).toContain('Sistemi di gestione');
    expect(payload.notes).toBe('da import');
  });
});
