/**
 * Test SLICE B — Pre-popolazione checklist §8.2 con suggerimenti AI da documenti
 *
 * Verifica:
 *  1. Che `handleApplyExtractedToChecklist` PRE-POPOLI le note delle voci senza risposta
 *  2. NON sovrascriva voci con risposta già data dall'utente
 *  3. Usi overlapScore per il matching (voci con score < 1 vengono saltate)
 *  4. Gestisca correttamente summary vuoto (nessuna chiamata a saveChecklistAnswer)
 *  5. Scope multi-tenant: la funzione usa sempre caseId (non hardcoded)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Replica isolata di overlapScore (stessa logica di ContractReviewPage.jsx).
 */
function tokenize(s) {
  return String(s || '').toLowerCase().split(/\W+/).filter((w) => w.length > 2);
}
function overlapScore(textA, textB) {
  const a = new Set(tokenize(textA));
  if (!a.size) return 0;
  let n = 0;
  for (const w of tokenize(textB)) {
    if (a.has(w)) n++;
  }
  return n;
}

/**
 * Logica estratta di pre-popolazione (replica handleApplyExtractedToChecklist).
 * Parametri espliciti per testabilità totale senza React.
 */
async function applyExtractedToChecklist({ caseId, checklistItems, requirements, saveChecklistAnswer }) {
  const applied = [];
  const aiPrefix = '[AI doc] ';
  for (const item of checklistItems) {
    if (item.answer && item.answer !== 'not_evaluated') continue;
    let best = null;
    let bestScore = 0;
    const haystack = `${item.item_text || ''} ${item.item_ref || ''}`;
    for (const r of requirements) {
      const blob = `${r.value_text || ''} ${r.field_key || ''} ${r.req_type || ''}`;
      const sc = overlapScore(haystack, blob);
      if (sc > bestScore) {
        bestScore = sc;
        best = r;
      }
    }
    if (!best || bestScore < 1) continue;
    const rawNotes = best.value_text || '';
    if (!rawNotes) continue;
    const notes = item.notes && String(item.notes).includes(aiPrefix)
      ? item.notes
      : `${aiPrefix}${rawNotes}`;
    await saveChecklistAnswer(caseId, item.id, { notes });
    applied.push({ itemId: item.id, notes });
  }
  return applied;
}

describe('Pre-popolazione checklist §8.2 con suggerimenti AI (SLICE B)', () => {
  const saveChecklistAnswer = vi.fn().mockResolvedValue({});

  beforeEach(() => {
    saveChecklistAnswer.mockClear();
  });

  const requirements = [
    { id: 1, req_type: 'material', field_key: 'materiale', value_text: 'Acciaio S355 certificato EN 10025', confidence: 0.92, review_status: 'extracted' },
    // field_key senza underscore e value_text con token presenti in item 11
    { id: 2, req_type: 'spec', field_key: 'saldatura', value_text: 'Qualifica saldatori ISO 3834-2 livello completo', confidence: 0.85, review_status: 'confirmed' },
    { id: 3, req_type: 'delivery', field_key: 'consegna', value_text: 'Consegna entro 60 giorni lavorativi', confidence: 0.78, review_status: 'edited' },
  ];

  it('pre-popola le note delle voci senza risposta se c\'è un match', async () => {
    const checklistPrelim = [
      { id: 10, item_ref: '§8.2.2', item_text: 'Verifica materiale impiegato e certificazione', answer: null, notes: '' },
      { id: 11, item_ref: '§8.2.3', item_text: 'Verifica saldatura e qualifica saldatori', answer: null, notes: '' },
    ];

    const result = await applyExtractedToChecklist({
      caseId: 1,
      checklistItems: checklistPrelim,
      requirements,
      saveChecklistAnswer,
    });

    // Entrambe le voci devono aver avuto un match (overlap > 0 con "materiale" e "saldatura")
    expect(saveChecklistAnswer).toHaveBeenCalledTimes(2);
    expect(result.length).toBe(2);
    // Voce 10 deve matchare il requisito materiale
    const call10 = saveChecklistAnswer.mock.calls.find((c) => c[1] === 10);
    expect(call10).toBeDefined();
    expect(call10[2].notes).toContain('[AI doc]');
    expect(call10[2].notes).toContain('S355');
  });

  it('NON sovrascrive voci con risposta già data dall\'utente', async () => {
    const checklistPrelim = [
      { id: 20, item_ref: '§8.2.2', item_text: 'Verifica materiale impiegato e certificazione', answer: 'yes', notes: 'Già verificato' },
      { id: 21, item_ref: '§8.2.1', item_text: 'Requisiti consegna e tempi', answer: null, notes: '' },
    ];

    const result = await applyExtractedToChecklist({
      caseId: 1,
      checklistItems: checklistPrelim,
      requirements,
      saveChecklistAnswer,
    });

    // Solo la voce 21 (senza risposta) viene processata
    expect(saveChecklistAnswer).not.toHaveBeenCalledWith(1, 20, expect.anything());
    const applied = result.map((r) => r.itemId);
    expect(applied).not.toContain(20);
  });

  it('salta voci dove overlapScore < 1 (nessun match)', async () => {
    const checklistPrelim = [
      { id: 30, item_ref: '§8.2.9', item_text: 'Taratura strumenti di misura', answer: null, notes: '' },
    ];

    const result = await applyExtractedToChecklist({
      caseId: 1,
      checklistItems: checklistPrelim,
      requirements,
      saveChecklistAnswer,
    });

    // "Taratura strumenti" non ha token in comune con i requisiti
    expect(saveChecklistAnswer).not.toHaveBeenCalled();
    expect(result.length).toBe(0);
  });

  it('gestisce requirements vuoti senza errori e senza chiamate a saveChecklistAnswer', async () => {
    const checklistPrelim = [
      { id: 40, item_ref: '§8.2.1', item_text: 'Verifica requisiti cliente', answer: null, notes: '' },
    ];

    const result = await applyExtractedToChecklist({
      caseId: 5,
      checklistItems: checklistPrelim,
      requirements: [],
      saveChecklistAnswer,
    });

    expect(saveChecklistAnswer).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('usa caseId corretto (scope multi-tenant)', async () => {
    const checklistPrelim = [
      { id: 50, item_ref: '§8.2.2', item_text: 'Verifica materiale acciaio', answer: null, notes: '' },
    ];

    await applyExtractedToChecklist({
      caseId: 99,
      checklistItems: checklistPrelim,
      requirements,
      saveChecklistAnswer,
    });

    // Ogni chiamata deve usare caseId=99
    for (const call of saveChecklistAnswer.mock.calls) {
      expect(call[0]).toBe(99);
    }
  });

  it('tratta "not_evaluated" come voce senza risposta (pre-popola ugualmente)', async () => {
    const checklistPrelim = [
      { id: 60, item_ref: '§8.2.2', item_text: 'Verifica materiale acciaio certificato', answer: 'not_evaluated', notes: '' },
    ];

    const result = await applyExtractedToChecklist({
      caseId: 1,
      checklistItems: checklistPrelim,
      requirements,
      saveChecklistAnswer,
    });

    expect(result.length).toBe(1);
  });

  it('applica anche alla checklist finale (F1-F6)', async () => {
    const checklistFinal = [
      { id: 70, phase: 'final', item_ref: 'F1', item_text: 'Confronto ordine e offerta con tempi consegna', answer: null, notes: '' },
    ];

    const result = await applyExtractedToChecklist({
      caseId: 1,
      checklistItems: checklistFinal,
      requirements,
      saveChecklistAnswer,
    });

    expect(result.length).toBe(1);
    expect(saveChecklistAnswer.mock.calls[0][2].notes).toContain('60 giorni');
  });
});
