/**
 * Helper creazione NC manuale / Action Plan multi-fonte
 * ISO 9001:2015 §6.1 + §9.3 + §10.2 + §10.3
 */

/** Sezioni ISO 9001 HLS per dropdown creazione manuale */
export const NC_MANUAL_SECTIONS = [
  { value: 'clause4',  label: '4 - Contesto dell\u2019organizzazione' },
  { value: 'clause5',  label: '5 - Leadership' },
  { value: 'clause6',  label: '6 - Pianificazione' },
  { value: 'clause7',  label: '7 - Supporto' },
  { value: 'clause8',  label: '8 - Attivit\u00E0 operative' },
  { value: 'clause9',  label: '9 - Valutazione delle prestazioni' },
  { value: 'clause10', label: '10 - Miglioramento' },
];

export const NC_SOURCE_TYPE_LABELS = {
  manual:            'Manuale',
  audit_nc:          'Audit NC',
  audit_oss:         'Audit OSS',
  complaint:         'Reclamo',
  reaudit_persists:  'Rilievo persistente',
};

/**
 * Categorie di origine per il Piano Azioni unificato.
 * label  — etichetta UI
 * iso    — clausola ISO di riferimento
 * defaultSection — section_code di default per NC non legate ad audit
 * requiresAudit  — true = audit_id obbligatorio
 * icon   — codice unicode emoji (stringa JS, mai JSX grezzo)
 */
export const NC_SOURCE_CATEGORIES = {
  audit: {
    label: 'Audit interno',
    iso: '\u00A79.2',
    defaultSection: 'clause9',
    requiresAudit: true,
    icon: '\uD83D\uDCCB',
  },
  complaint: {
    label: 'Reclamo cliente',
    iso: '\u00A78.2.1',
    defaultSection: 'clause8',
    requiresAudit: false,
    icon: '\uD83D\uDCE8',
  },
  risk_action: {
    label: 'Analisi rischi',
    iso: '\u00A76.1',
    defaultSection: 'clause6',
    requiresAudit: false,
    icon: '\u26A0\uFE0F',
  },
  management_review: {
    label: 'Riesame di Direzione',
    iso: '\u00A79.3',
    defaultSection: 'clause9',
    requiresAudit: false,
    icon: '\uD83C\uDFE2',
  },
  improvement: {
    label: 'Miglioramento continuo',
    iso: '\u00A710.3',
    defaultSection: 'clause10',
    requiresAudit: false,
    icon: '\uD83D\uDCC8',
  },
  operational: {
    label: 'Rilievo operativo',
    iso: '\u00A78.7',
    defaultSection: 'clause8',
    requiresAudit: false,
    icon: '\uD83D\uDD0D',
  },
  external_audit: {
    label: 'Audit esterno',
    iso: '\u00A79.2',
    defaultSection: 'clause9',
    requiresAudit: false,
    icon: '\uD83D\uDD0E',
  },
  sal_gap: {
    label: 'Gap SAL implementazione',
    iso: '\u00A74\u201310',
    defaultSection: 'clause10',
    requiresAudit: false,
    icon: '\uD83D\uDCCA',
  },
};

export const NC_SOURCE_CATEGORY_OPTIONS = Object.entries(NC_SOURCE_CATEGORIES).map(
  ([value, cfg]) => ({ value, label: `${cfg.icon} ${cfg.label}`, iso: cfg.iso }),
);

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
 * Payload per POST /non-conformities (Action Plan multi-fonte).
 * @param {object} form
 * @param {string} [form.source_category] - categoria origine (default 'audit')
 * @param {number} [form.audit_id]        - obbligatorio solo se source_category='audit'
 * @param {string} form.section_code
 * @param {string} form.description
 * @param {string} form.severity
 * @param {string} [form.source_origin_text] - testo libero origine per categorie non-audit
 * @param {string} [form.nc_number]
 * @param {string} [form.responsible_person]
 * @param {string} [form.due_date]
 * @param {number|null} [form.source_complaint_id] - ID reclamo collegato (solo se source_category='complaint')
 * @param {number|string} [form.company_id] - azienda/ambito (solo categorie non legate ad audit)
 * @param {number|string} [form.project_id] - commessa ISO 3834 (opzionale)
 * @param {string|number} [auditNumber]   - usato per generare il nc_number
 */
export function buildManualNcPayload(form, auditNumber) {
  const description = (form.description || '').trim();
  const source_category = form.source_category || 'audit';
  const cfg = NC_SOURCE_CATEGORIES[source_category];
  const requiresAudit = cfg?.requiresAudit ?? true;

  if (requiresAudit && !form.audit_id) {
    return { ok: false, message: 'Selezionare l\u2019audit di riferimento.' };
  }
  if (!form.section_code) {
    return { ok: false, message: 'Selezionare la sezione ISO.' };
  }
  if (!description) {
    return { ok: false, message: 'Inserire una descrizione.' };
  }
  if (!form.severity) {
    return { ok: false, message: 'Selezionare la severit\u00E0.' };
  }

  const ncNumberBase = requiresAudit ? auditNumber : source_category.toUpperCase();
  const managementReviewId = (form.management_review_id != null && form.management_review_id !== '')
    ? parseInt(form.management_review_id, 10)
    : null;
  return {
    ok: true,
    payload: {
      ...(requiresAudit ? { audit_id: parseInt(form.audit_id, 10) } : {}),
      ...(managementReviewId != null ? { management_review_id: managementReviewId } : {}),
      source_category,
      source_origin_text: (form.source_origin_text || '').trim() || null,
      source_complaint_id: (source_category === 'complaint' && form.source_complaint_id)
        ? parseInt(form.source_complaint_id, 10)
        : null,
      nc_number: (form.nc_number || '').trim() || buildManualNcNumber(ncNumberBase),
      section_code: form.section_code,
      description,
      severity: form.severity,
      responsible_person: (form.responsible_person || '').trim() || null,
      responsible_contact_id: form.responsible_contact_id ?? null,
      due_date: form.due_date || null,
      ...(!requiresAudit && form.company_id ? { company_id: parseInt(form.company_id, 10) } : {}),
      ...(form.project_id ? { project_id: parseInt(form.project_id, 10) } : {}),
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
