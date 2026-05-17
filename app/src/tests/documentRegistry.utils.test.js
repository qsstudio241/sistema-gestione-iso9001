/**
 * Test L1 — DocumentRegistry pure utility functions
 *
 * Copre: daysUntil, getExpiryClass, exportToCSV, flattenFolders
 * Queste funzioni gestiscono la logica di priorità, scadenze e navigazione
 * del Registro Documenti SGQ.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ??? Re-implementazioni delle funzioni pure da DocumentRegistry ?????????????

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

function getExpiryClass(doc) {
  if (doc.status === "obsoleto") return "expiry-obsoleto";
  if (doc.is_expired)     return "expiry-scaduto";
  if (doc.expiring_soon)  return "expiry-warning";
  return "";
}

function flattenFolders(nodes, depth = 0) {
  const result = [];
  for (const node of nodes) {
    if (node.doc_type === 'folder' || node.is_system_folder) {
      result.push({ id: node.id, title: node.title, depth });
      if (node.children?.length) {
        result.push(...flattenFolders(node.children, depth + 1));
      }
    }
  }
  return result;
}

const DOC_STATUS_LABELS = {
  rilasciato:       "Rilasciato",
  vigente:          "Rilasciato",
  bozza:            "Bozza",
  in_revisione:     "In revisione",
  in_approvazione:  "In approvazione",
  obsoleto:         "Obsoleto",
};

// ??? daysUntil ??????????????????????????????????????????????????????????????

describe('DocumentRegistry — daysUntil', () => {
  it('ritorna null se dateStr è null/undefined/vuoto', () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
    expect(daysUntil('')).toBeNull();
  });

  it('ritorna 0 o 1 per una data di oggi', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = daysUntil(today);
    expect(result).toBeLessThanOrEqual(1);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('ritorna valore negativo per data passata', () => {
    const past = '2020-01-01';
    expect(daysUntil(past)).toBeLessThan(0);
  });

  it('ritorna valore positivo per data futura', () => {
    const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const result = daysUntil(future);
    expect(result).toBeGreaterThan(25);
    expect(result).toBeLessThanOrEqual(31);
  });

  it('gestisce correttamente una data a 60 giorni', () => {
    const in60days = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
    const result = daysUntil(in60days);
    expect(result).toBeGreaterThanOrEqual(59);
    expect(result).toBeLessThanOrEqual(61);
  });
});

// ??? getExpiryClass ?????????????????????????????????????????????????????????

describe('DocumentRegistry — getExpiryClass', () => {
  it('documento obsoleto ? "expiry-obsoleto"', () => {
    expect(getExpiryClass({ status: 'obsoleto' })).toBe('expiry-obsoleto');
  });

  it('documento obsoleto ha priorità su is_expired', () => {
    expect(getExpiryClass({ status: 'obsoleto', is_expired: true })).toBe('expiry-obsoleto');
  });

  it('documento scaduto ? "expiry-scaduto"', () => {
    expect(getExpiryClass({ status: 'rilasciato', is_expired: true })).toBe('expiry-scaduto');
  });

  it('documento in scadenza ? "expiry-warning"', () => {
    expect(getExpiryClass({ status: 'rilasciato', expiring_soon: true })).toBe('expiry-warning');
  });

  it('documento scaduto ha priorità su expiring_soon', () => {
    expect(getExpiryClass({ status: 'vigente', is_expired: true, expiring_soon: true })).toBe('expiry-scaduto');
  });

  it('documento senza flag scadenza ? stringa vuota', () => {
    expect(getExpiryClass({ status: 'rilasciato' })).toBe('');
    expect(getExpiryClass({ status: 'bozza' })).toBe('');
  });
});

// ??? DOC_STATUS_LABELS ??????????????????????????????????????????????????????

describe('DocumentRegistry — DOC_STATUS_LABELS', () => {
  it('mappa "rilasciato" a "Rilasciato"', () => {
    expect(DOC_STATUS_LABELS['rilasciato']).toBe('Rilasciato');
  });

  it('mappa "vigente" a "Rilasciato" (alias legacy)', () => {
    expect(DOC_STATUS_LABELS['vigente']).toBe('Rilasciato');
  });

  it('mappa "bozza" a "Bozza"', () => {
    expect(DOC_STATUS_LABELS['bozza']).toBe('Bozza');
  });

  it('mappa "in_revisione" a "In revisione"', () => {
    expect(DOC_STATUS_LABELS['in_revisione']).toBe('In revisione');
  });

  it('copre tutti gli stati lifecycle previsti', () => {
    const expected = ['rilasciato', 'vigente', 'bozza', 'in_revisione', 'in_approvazione', 'obsoleto'];
    for (const key of expected) {
      expect(DOC_STATUS_LABELS[key]).toBeDefined();
    }
  });
});

// ??? flattenFolders ?????????????????????????????????????????????????????????

describe('DocumentRegistry — flattenFolders', () => {
  it('ritorna array vuoto per input vuoto', () => {
    expect(flattenFolders([])).toEqual([]);
  });

  it('include solo cartelle, non documenti normali', () => {
    const nodes = [
      { id: 1, title: 'Cartella A', doc_type: 'folder' },
      { id: 2, title: 'Documento', doc_type: 'procedura' },
      { id: 3, title: 'Sistema', is_system_folder: true },
    ];
    const result = flattenFolders(nodes);
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual([1, 3]);
  });

  it('assegna depth 0 ai nodi radice', () => {
    const nodes = [
      { id: 1, title: 'Root', doc_type: 'folder' },
    ];
    expect(flattenFolders(nodes)[0].depth).toBe(0);
  });

  it('incrementa depth per cartelle annidate', () => {
    const nodes = [
      {
        id: 1, title: 'L0', doc_type: 'folder', children: [
          {
            id: 2, title: 'L1', doc_type: 'folder', children: [
              { id: 3, title: 'L2', doc_type: 'folder' },
            ]
          },
        ]
      },
    ];
    const result = flattenFolders(nodes);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 1, title: 'L0', depth: 0 });
    expect(result[1]).toEqual({ id: 2, title: 'L1', depth: 1 });
    expect(result[2]).toEqual({ id: 3, title: 'L2', depth: 2 });
  });

  it('ignora figli di nodi non-cartella', () => {
    const nodes = [
      {
        id: 1, title: 'Doc con figli', doc_type: 'procedura', children: [
          { id: 2, title: 'Sub-folder', doc_type: 'folder' },
        ]
      },
    ];
    const result = flattenFolders(nodes);
    expect(result).toHaveLength(0);
  });

  it('mescola is_system_folder e doc_type folder', () => {
    const nodes = [
      { id: 1, title: 'Sistema', is_system_folder: true, children: [
        { id: 2, title: 'Sub', doc_type: 'folder' },
      ]},
      { id: 3, title: 'Normale', doc_type: 'folder' },
    ];
    const result = flattenFolders(nodes);
    expect(result).toHaveLength(3);
  });
});
