/**
 * Test L1 — commercialChecklistTemplate merge / core coverage (ING-4)
 */

const {
  mergeTemplateWithDefaults,
  assertCoreCoverage,
  buildSeedItemsFromDefaults,
  PRELIMINARY_ITEMS,
  FINAL_ITEMS,
} = require('../data/commercialChecklistDefaults');

describe('commercialChecklistDefaults — ISO §8.2 fidelity', () => {
  it('merge senza template restituisce solo core preliminare', () => {
    const items = mergeTemplateWithDefaults('preliminary', []);
    expect(items).toHaveLength(PRELIMINARY_ITEMS.length);
    expect(items.every((i) => i.is_core)).toBe(true);
    expect(items.map((i) => i.ref)).toEqual(PRELIMINARY_ITEMS.map((i) => i.ref));
  });

  it('merge con variante testo core mantiene il ref e aggiorna il testo', () => {
    const items = mergeTemplateWithDefaults('preliminary', [
      { item_ref: 'P1', item_text: 'Requisiti tecnici (variante studio)', is_core: 1 },
    ]);
    const p1 = items.find((i) => i.ref === 'P1');
    expect(p1.text).toBe('Requisiti tecnici (variante studio)');
    expect(items).toHaveLength(PRELIMINARY_ITEMS.length);
  });

  it('merge aggiunge extras senza rimuovere core', () => {
    const items = mergeTemplateWithDefaults('final', [
      { item_ref: 'F1', item_text: FINAL_ITEMS[0].text, is_core: 1 },
      { item_ref: 'F7', item_text: 'Controllo imballo cliente specifico', is_core: 0, sort_order: 99 },
    ]);
    expect(items.map((i) => i.ref)).toContain('F6');
    const extra = items.find((i) => i.ref === 'F7');
    expect(extra).toMatchObject({ text: 'Controllo imballo cliente specifico', is_core: false });
    expect(items.filter((i) => i.is_core)).toHaveLength(FINAL_ITEMS.length);
  });

  it('assertCoreCoverage segnala bypass norma', () => {
    const missing = assertCoreCoverage([
      { phase: 'preliminary', item_ref: 'P1', item_text: 'solo P1' },
    ]);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing).toContain('preliminary:P2');
  });

  it('seed defaults copre tutte le voci core', () => {
    const seed = buildSeedItemsFromDefaults();
    expect(assertCoreCoverage(seed)).toEqual([]);
    expect(seed.filter((i) => i.phase === 'preliminary')).toHaveLength(10);
    expect(seed.filter((i) => i.phase === 'final')).toHaveLength(6);
  });
});
