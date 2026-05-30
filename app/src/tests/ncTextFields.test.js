/**
 * Test L1 - bozza locale NC + storico testo + draft guard scope nc:
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveNcFieldDraft,
  loadNcFieldDraft,
  clearNcFieldDraft,
  pickNcFieldValue,
} from '../utils/ncFieldDraftStorage';
import {
  appendTextFieldHistory,
  getTextFieldHistory,
} from '../utils/textFieldHistory';
import {
  markDraft,
  isDraft,
  clearDraft,
  _resetDraftRegistryForTests,
} from '../utils/draftFieldRegistry';

describe('ncFieldDraftStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('salva e ricarica bozza per org/scope/campo', () => {
    saveNcFieldDraft(1001, 'nc:42', 'description', 'Testo bozza');
    const loaded = loadNcFieldDraft(1001, 'nc:42', 'description');
    expect(loaded?.value).toBe('Testo bozza');
    expect(loaded?.savedAt).toBeTypeOf('number');
  });

  it('pickNcFieldValue preferisce bozza pi� ricca del server', () => {
    const draft = { value: 'Bozza lunga con dettagli aggiuntivi' };
    expect(pickNcFieldValue('Breve', draft)).toBe(draft.value);
  });

  it('clearNcFieldDraft rimuove la voce', () => {
    saveNcFieldDraft(1, 'nc:1', 'root_cause', 'x');
    clearNcFieldDraft(1, 'nc:1', 'root_cause');
    expect(loadNcFieldDraft(1, 'nc:1', 'root_cause')).toBeNull();
  });
});

describe('textFieldHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('appendTextFieldHistory evita duplicati consecutivi', () => {
    appendTextFieldHistory('nc:7', 'description', 'Prima versione');
    appendTextFieldHistory('nc:7', 'description', 'Prima versione');
    appendTextFieldHistory('nc:7', 'description', 'Seconda versione');
    const hist = getTextFieldHistory('nc:7', 'description');
    expect(hist).toHaveLength(2);
    expect(hist[0].text).toBe('Seconda versione');
    expect(hist[1].text).toBe('Prima versione');
  });
});

describe('draftFieldRegistry - scope NC', () => {
  beforeEach(() => {
    _resetDraftRegistryForTests();
  });

  it('markDraft con scope nc: id', () => {
    markDraft('nc:99', 'description');
    expect(isDraft('nc:99', 'description')).toBe(true);
    clearDraft('nc:99', 'description');
    expect(isDraft('nc:99', 'description')).toBe(false);
  });
});
