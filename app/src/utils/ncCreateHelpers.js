/**
 * Helper creazione NC manuale - NC Fase 1 Slice 6
 */

/** Sezioni ISO 9001 HLS per dropdown creazione manuale */
export const NC_MANUAL_SECTIONS = [
  { value: 'clause4', label: '4 - Contesto dell\'organizzazione' },
  { value: 'clause5', label: '5 - Leadership' },
  { value: 'clause6', label: '6 - Pianificazione' },
  { value: 'clause7', label: '7 - Supporto' },
  { value: 'clause8', label: '8 - Attivit\u00E0 operative' },
  { value: 'clause9', label: '9 - Valutazione delle prestazioni' },
  { value: 'clause10', label: '10 - Miglioramento' },
];

export const NC_SOURCE_TYPE_LABELS = {
  manual: 'Manuale',
  audit_nc: 'Audit NC',
  audit_oss: 'Audit OSS',
  complaint: 'Reclamo',
};

/**
 * Genera numero NC univoco per creazione manuale (prefisso M = manuale).
 * @param {string|number} auditNumber
 * @returns {string}
 */
export function buildManualNcNumber(auditNumber) {
  const base = auditNumber != null && String(auditNumber).trim()
    ? String(auditNumber).trim()
    : 'AUD';
  const suffix = String(Date.now()).slice(-6);
  return `NC-M-${base}-${suffix}`;
}

/**
 * Payload minimo per POST /non-conformities (source_type manual lato server).
 * @param {object} form
 * @param {number} form.audit_id
 * @param {string} form.section_code
 * @param {string} form.description
 * @param {string} form.severity
 * @param {string} [form.nc_number]
 * @param {string} [form.responsible_person]
 * @param {string} [form.due_date]
 */
export function buildManualNcPayload(form, auditNumber) {
  const description = (form.description || '').trim();
  if (!form.audit_id || !form.section_code || !description || !form.severity) {
    return { ok: false, message: 'Compilare audit, sezione, descrizione e severit\u00E0.' };
  }
  return {
    ok: true,
    payload: {
      audit_id: parseInt(form.audit_id, 10),
      nc_number: (form.nc_number || '').trim() || buildManualNcNumber(auditNumber),
      section_code: form.section_code,
      description,
      severity: form.severity,
      responsible_person: (form.responsible_person || '').trim() || null,
      responsible_contact_id: form.useExternalResponsible ? null : form.responsible_contact_id,
      due_date: form.due_date || null,
    },
  };
}

/**
 * Mappa sezioni API checklist in opzioni dropdown modal.
 * @param {Array<{ section_code: string, section_title: string }>} sections
 */
export function mapApiSectionsToOptions(sections) {
  if (!Array.isArray(sections) || sections.length === 0) return [];
  return sections.map(s => ({
    value: s.section_code,
    label: s.section_title
      ? `${s.section_code} - ${s.section_title}`
      : s.section_code,
  }));
}
