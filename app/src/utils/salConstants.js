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
