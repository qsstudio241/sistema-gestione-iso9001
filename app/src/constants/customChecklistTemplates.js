/** Marker in description per checklist seedate dal sistema */
export const LEG_AMBIENTE_TEMPLATE_MARKER = '[SGQ_TEMPLATE:LEG_AMBIENTE_152]';

export function isLegislativoAmbientaleChecklist(checklist) {
  const desc = checklist?.description ?? '';
  return typeof desc === 'string' && desc.includes(LEG_AMBIENTE_TEMPLATE_MARKER);
}
