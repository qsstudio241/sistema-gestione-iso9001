/**
 * Compliance Map CM-4 — filtri KPI HITL + gate azioni (una fonte per dimensione).
 */

export const HITL_LABELS = {
  proposed: 'Proposti',
  accepted: 'Accettati',
  edited: 'Modificati',
  rejected: 'Rifiutati',
};

export const HITL_ROW_CLASS = {
  proposed: 'sq-row-giallo',
  accepted: 'sq-row-verde',
  edited: 'sq-row-giallo',
  rejected: 'sq-row-rosso',
};

export const MAP_STATUS_LABELS = {
  draft: 'Bozza',
  in_review: 'In revisione',
  approved: 'Approvata',
  archived: 'Archiviata',
};

export const COVERAGE_LABELS = {
  unknown: 'Sconosciuta',
  covered: 'Coperta',
  partial: 'Parziale',
  missing: 'Mancante',
  na: 'N/A',
};

export const MUTABLE_MAP_STATUSES = new Set(['draft', 'in_review']);

/** Export citabile: solo items HITL accepted|edited. */
export function countConfirmedHitl(items) {
  let n = 0;
  for (const row of items || []) {
    const st = String(row?.hitl_status || '').toLowerCase();
    if (st === 'accepted' || st === 'edited') n += 1;
  }
  return n;
}

export function canExportMap({ companyId, map, items, busy } = {}) {
  if (busy) return false;
  if (!companyId) return false;
  if (!map) return false;
  return countConfirmedHitl(items) > 0;
}

export function exportMapTitle({ companyId, map, items } = {}) {
  if (!companyId) return "Seleziona un'azienda nell'Ambito in alto";
  if (!map) return 'Seleziona una mappa';
  const n = countConfirmedHitl(items);
  if (n === 0) return 'Nessun item accepted/edited da esportare';
  return `Esporta ${n} nodi confermati (JSON)`;
}

export function countByHitl(items) {
  const c = { proposed: 0, accepted: 0, edited: 0, rejected: 0 };
  for (const row of items || []) {
    const key = String(row?.hitl_status || '').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(c, key)) c[key] += 1;
  }
  return c;
}

export function filterItemsByHitl(items, hitlFilter) {
  if (!hitlFilter) return items || [];
  const f = String(hitlFilter).toLowerCase();
  return (items || []).filter((row) => String(row?.hitl_status || '').toLowerCase() === f);
}

export function hitlRowClass(hitlStatus) {
  const key = String(hitlStatus || '').toLowerCase();
  return HITL_ROW_CLASS[key] || 'sq-row-grigio';
}

/** HITL Accetta/Rifiuta solo su proposed e mappa mutabile. */
export function canHitlAction(action, item, map) {
  if (!item || !map) return false;
  if (!MUTABLE_MAP_STATUSES.has(String(map.status || '').toLowerCase())) return false;
  if (String(item.hitl_status || '').toLowerCase() !== 'proposed') return false;
  return action === 'accept' || action === 'reject';
}

export function hitlActionTitle(action, item, map, { companyId } = {}) {
  if (!companyId) return "Seleziona un'azienda nell'Ambito in alto";
  if (!map) return 'Seleziona una mappa';
  if (!MUTABLE_MAP_STATUSES.has(String(map.status || '').toLowerCase())) {
    return `Mappa in stato ${map.status}: HITL non applicabile`;
  }
  if (!item) return 'Seleziona un requisito';
  if (String(item.hitl_status || '').toLowerCase() !== 'proposed') {
    return 'Solo requisiti in stato proposto';
  }
  if (action === 'accept') return 'Accetta proposta (HITL)';
  if (action === 'reject') return 'Rifiuta proposta (HITL)';
  return '';
}

export function canCompile({ companyId, commercialCaseId, busy } = {}) {
  if (busy) return false;
  if (!companyId) return false;
  const cid = parseInt(commercialCaseId, 10);
  return Number.isFinite(cid) && cid > 0;
}

export function compileTitle({ companyId, commercialCaseId } = {}) {
  if (!companyId) return "Seleziona un'azienda nell'Ambito in alto";
  const cid = parseInt(commercialCaseId, 10);
  if (!Number.isFinite(cid) || cid <= 0) {
    return 'Seleziona un caso commerciale (Riesame requisiti)';
  }
  return 'Compila mappa da caso commerciale (items proposti, HITL)';
}

export function canProposeLinks({ companyId, map, items, busy } = {}) {
  if (busy) return false;
  if (!companyId || !map) return false;
  if (!MUTABLE_MAP_STATUSES.has(String(map.status || '').toLowerCase())) return false;
  return (items || []).some((i) => String(i.hitl_status || '').toLowerCase() === 'proposed');
}

export function proposeLinksTitle({ companyId, map, items } = {}) {
  if (!companyId) return "Seleziona un'azienda nell'Ambito in alto";
  if (!map) return 'Seleziona una mappa';
  if (!MUTABLE_MAP_STATUSES.has(String(map.status || '').toLowerCase())) {
    return `Mappa in stato ${map.status}: propose-links non applicabile`;
  }
  const hasProposed = (items || []).some(
    (i) => String(i.hitl_status || '').toLowerCase() === 'proposed'
  );
  if (!hasProposed) return 'Nessun item proposto da collegare';
  return 'Propone link norma/legge + coverage (HITL, niente auto-accept)';
}
