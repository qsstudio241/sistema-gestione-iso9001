/**
 * wordExportReview.js — Export Word verbale Riesame di Direzione ISO 9001 §9.3
 *
 * Usa docxtemplater + PizZip con il template:
 *   app/public/templates/management-review-verbale.docx
 *
 * Segnaposto gestiti:
 *   {review_number}  {review_date}  {company_name}  {chairperson}
 *   {status_label}   {period_from}  {period_to}  {participants_text}
 *   input_*  (tutti i campi §9.3.2)
 *   output_* (tutti i campi §9.3.3)
 *   {notes}
 */

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import * as fileSaverModule from 'file-saver';

const saveAs = fileSaverModule.saveAs ?? fileSaverModule.default?.saveAs ?? fileSaverModule.default;

const STATUS_LABELS = {
  draft:     'Bozza',
  finalized: 'Finalizzato',
  approved:  'Approvato',
};

function formatDateIt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function parseParticipantsText(raw) {
  if (!raw || !raw.trim()) return 'Nessun partecipante registrato.';
  let list;
  try {
    list = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return raw;
  }
  if (!Array.isArray(list)) return String(raw);
  return list
    .map((p) => `${p.name || ''}${p.role ? ` (${p.role})` : ''}`)
    .filter(Boolean)
    .join('\n') || 'Nessun partecipante registrato.';
}

function safe(val) {
  if (val === null || val === undefined) return '';
  return String(val);
}

/**
 * Scarica il verbale Word del riesame.
 *
 * @param {Object} review   — dati del riesame (tutti i campi del form)
 * @param {string} [periodFrom]  — data inizio periodo esaminato (YYYY-MM-DD)
 * @param {string} [periodTo]    — data fine periodo esaminato (YYYY-MM-DD)
 */
export async function exportManagementReviewDocx(review, periodFrom, periodTo) {
  const templateUrl = '/templates/management-review-verbale.docx';

  let arrayBuffer;
  try {
    const res = await fetch(templateUrl);
    if (!res.ok) throw new Error(`Template non trovato: ${res.status}`);
    arrayBuffer = await res.arrayBuffer();
  } catch (err) {
    throw new Error(`Impossibile caricare il template Word: ${err.message}`);
  }

  const zip    = new PizZip(arrayBuffer);
  const doc    = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks:    true,
  });

  const today = new Date().toISOString().slice(0, 10);

  doc.render({
    review_number:  safe(review.review_number),
    review_date:    formatDateIt(review.review_date),
    company_name:   safe(review.company_name),
    chairperson:    safe(review.chairperson),
    status_label:   STATUS_LABELS[review.status] || safe(review.status),
    period_from:    formatDateIt(periodFrom || review.review_date),
    period_to:      formatDateIt(periodTo   || today),
    participants_text: parseParticipantsText(review.participants),

    // §9.3.2 Input
    input_previous_actions:      safe(review.input_previous_actions),
    input_context_changes:       safe(review.input_context_changes),
    input_audits:                safe(review.input_audits),
    input_nc_corrective:         safe(review.input_nc_corrective),
    input_objectives:            safe(review.input_objectives),
    input_process_performance:   safe(review.input_process_performance),
    input_monitoring:            safe(review.input_monitoring),
    input_customer_satisfaction: safe(review.input_customer_satisfaction),
    input_complaints:            safe(review.input_complaints),
    input_suppliers:             safe(review.input_suppliers),
    input_resources:             safe(review.input_resources),
    input_risk_effectiveness:    safe(review.input_risk_effectiveness),
    input_improvements:          safe(review.input_improvements),

    // §9.3.3 Output
    output_improvements: safe(review.output_improvements),
    output_sgq_changes:  safe(review.output_sgq_changes),
    output_resources:    safe(review.output_resources),

    notes: safe(review.notes),
  });

  const blob = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const filename = `Riesame-${safe(review.review_number) || 'verbale'}-${safe(review.review_date || today)}.docx`;
  saveAs(blob, filename);
}
