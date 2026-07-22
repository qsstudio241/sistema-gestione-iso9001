/** Stati implementazione SAL — allineati a gapAnalysis.service.js (Fase 0) */

export const SAL_STATUS_OPTIONS = [
  { value: 'discussed', label: 'Discusso' },
  { value: 'in_progress', label: 'In corso' },
  { value: 'to_validate', label: 'Da validare' },
  { value: 'completed', label: 'Completato' },
  { value: 'na', label: 'N/A' },
];

export const SAL_STATUS_LABEL = Object.fromEntries(
  SAL_STATUS_OPTIONS.map((o) => [o.value, o.label]),
);

export const SAL_STANDARD_TABS = [
  { code: '', label: 'Tutti' },
  { code: 'ISO_9001_2015', label: 'ISO 9001', badgeClass: 'sal-std-9001' },
  { code: 'ISO_14001_2015', label: 'ISO 14001', badgeClass: 'sal-std-14001' },
  { code: 'ISO_45001_2018', label: 'ISO 45001', badgeClass: 'sal-std-45001' },
];

export const SAL_STANDARD_LABEL = {
  ISO_9001_2015: 'ISO 9001',
  ISO_14001_2015: 'ISO 14001',
  ISO_45001_2018: 'ISO 45001',
};

export function salStandardBadgeClass(standardCode) {
  if (standardCode === 'ISO_9001_2015') return 'sal-std-9001';
  if (standardCode === 'ISO_14001_2015') return 'sal-std-14001';
  if (standardCode === 'ISO_45001_2018') return 'sal-std-45001';
  return 'sal-std-default';
}

/** Hint audit (conformity_status checklist) — sola lettura in SAL */
export const SAL_CONFORMITY_HINT_LABEL = {
  C: 'Conforme',
  NC: 'Non conforme',
  OSS: 'Osservazione',
  OM: 'Opportunità',
  NA: 'N/A',
};

export function clauseRefToSectionCode(clauseRef) {
  if (!clauseRef || typeof clauseRef !== 'string') return 'clause10';
  const major = clauseRef.split('.')[0];
  if (!/^\d+$/.test(major)) return 'clause10';
  return `clause${major}`;
}

export function buildSalGapActionDescription(row) {
  const ref = row?.clauseRef || '?';
  const title = row?.clauseTitle || '';
  const std = SAL_STANDARD_LABEL[row?.standardCode] || row?.standardCode || '';
  const status = SAL_STATUS_LABEL[row?.status] || row?.status || '';
  const hint = row?.conformityHint
    ? (SAL_CONFORMITY_HINT_LABEL[row.conformityHint] || row.conformityHint)
    : null;
  const lines = [
    `Gap implementazione SAL — clausola ${ref}${title ? `: ${title}` : ''}`,
    std ? `Standard: ${std}` : null,
    status ? `Stato implementazione: ${status}` : null,
    hint ? `Hint audit: ${hint}` : null,
    row?.notes ? `Note SAL: ${row.notes}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

export function buildSalGapOriginText(row) {
  const ref = row?.clauseRef || 'SAL';
  return `SAL ${ref}`;
}
