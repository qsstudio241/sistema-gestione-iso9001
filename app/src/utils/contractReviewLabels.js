/** Etichette UI e slide dettaglio — riesame requisiti contratto */

export const STATUS_LABELS = {
  DRAFT: 'Bozza',
  INTAKE_REVIEW: 'Verifica acquisizione',
  CLARIFICATION: 'Chiarimenti',
  QUOTE_PREP: 'Preparazione offerta',
  QUOTE_APPROVAL: 'Approvazione offerta',
  QUOTE_SENT: 'Offerta inviata',
  ORDER_RECEIVED: 'Ordine ricevuto',
  FINAL_REVIEW: 'Riesame finale',
  APPROVED: 'Approvato',
  CANCELLED: 'Annullato',
  REJECTED: 'Respinto',
};

export const TERMINAL_STATUSES = new Set(['APPROVED', 'CANCELLED', 'REJECTED']);

/** Slide dettaglio caso — ordine operativo ISO §8.2 */
export const DETAIL_SLIDES = [
  { id: 'workflow', label: 'Workflow' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'clarifications', label: 'Chiarimenti' },
  { id: 'documents', label: 'Documenti' },
  { id: 'ai', label: 'Analisi AI' },
];

export const INBOX_KIND_LABELS = {
  assigned_to_me: 'Assegnati a me',
  pending_approval: 'In attesa approvazione',
  stale: 'Inattivi (>14 gg)',
};
