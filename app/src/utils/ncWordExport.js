/**
 * ncWordExport.js  -  Export Word scheda singola NC (ISO 9001  - 10.2)
 *
 * Template: app/public/templates/NC-scheda.docx
 * Rigenera con: node scripts/generateNcTemplate.js
 */

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import * as fileSaverModule from 'file-saver';
import { formatDateIt } from './auditDatePeriod.js';
import { NC_SOURCE_TYPE_LABELS } from './ncCreateHelpers.js';
import {
    fixWordXmlMojibake,
    repairDocxtemplaterFragmentedTags,
} from './wordExport.js';

export const NC_WORD_TEMPLATE_URL = '/templates/NC-scheda.docx';

const NC_STATUS_LABELS = {
    open: 'Aperta',
    in_progress: 'In corso',
    resolved: 'Risolta',
    verified: 'Verificata',
    closed: 'Chiusa',
};

const NC_SEVERITY_LABELS = {
    major: 'Grave',
    minor: 'Lieve',
    observation: 'Osservazione',
};

const NC_ACTION_TYPE_LABELS = {
    immediate: 'Immediata',
    corrective: 'Correttiva',
    preventive: 'Preventiva',
};

const NC_ACTION_STATUS_LABELS = {
    open: 'Aperta',
    in_progress: 'In corso',
    completed: 'Completata',
    verified: 'Verificata',
};

const saveAs =
    fileSaverModule.saveAs ||
    (fileSaverModule.default && fileSaverModule.default.saveAs) ||
    fileSaverModule.default;

function formatDate(value) {
    if (!value) return 'N/D';
    return formatDateIt(value) || 'N/D';
}

function formatDateTime(value) {
    if (!value) return 'N/D';
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return formatDate(value);
        return d.toLocaleString('it-IT', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return formatDate(value);
    }
}

function plainText(value) {
    if (value == null) return '';
    return String(value).trim();
}

function displayOrNd(value) {
    const text = plainText(value);
    return text || 'N/D';
}

function sanitizeFilePart(value, fallback = 'NC') {
    const cleaned = String(value || fallback).replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_');
    return cleaned.replace(/^_|_$/g, '') || fallback;
}

export function buildNcWordFileName(nc) {
    const number = sanitizeFilePart(nc?.nc_number, 'NC');
    const client = sanitizeFilePart(nc?.client_name, 'Cliente');
    return `${number}_${client}.docx`;
}

const CA_NEEDED_LABELS = {
    yes: 'S\u00EC, necessaria',
    no: 'No, non necessaria',
};

export function buildNcTemplateData(nc, actions = [], attachments = []) {
    const allActions = actions || [];
    const corrections = allActions.filter(a => a.action_type === 'immediate');
    const otherActions = allActions.filter(a => a.action_type !== 'immediate');

    const mapAction = (action, index) => ({
        actionIndex: index + 1,
        typeLabel: NC_ACTION_TYPE_LABELS[action.action_type] || action.action_type || 'N/D',
        statusLabel: NC_ACTION_STATUS_LABELS[action.status] || action.status || 'N/D',
        description: displayOrNd(action.description),
        responsible: displayOrNd(action.responsible),
        dueDate: formatDate(action.due_date),
        completedAt: formatDateTime(action.completed_at),
        verificationNote: displayOrNd(action.verification_note),
    });

    const correctionRows = corrections.map(mapAction);
    const actionRows = otherActions.map(mapAction);

    const attachmentRows = (attachments || []).map((att) => ({
        fileName: displayOrNd(att.file_name),
        category: displayOrNd(att.category),
        fileDescription: displayOrNd(att.description),
        uploadedAt: formatDateTime(att.created_at),
    }));

    return {
        ncNumber: displayOrNd(nc?.nc_number),
        clientName: displayOrNd(nc?.client_name),
        auditNumber: displayOrNd(nc?.audit_number),
        auditDate: formatDate(nc?.audit_date),
        sectionTitle: displayOrNd(nc?.section_title),
        sourceTypeLabel: NC_SOURCE_TYPE_LABELS[nc?.source_type] || displayOrNd(nc?.source_type),
        severityLabel: NC_SEVERITY_LABELS[nc?.severity] || displayOrNd(nc?.severity),
        statusLabel: NC_STATUS_LABELS[nc?.status] || displayOrNd(nc?.status),
        dueDate: formatDate(nc?.due_date),
        resolutionDate: formatDate(nc?.resolution_date),
        responsiblePerson: displayOrNd(nc?.responsible_person),
        description: displayOrNd(nc?.description),
        rootCause: displayOrNd(nc?.root_cause),
        correctiveActionNeeded: CA_NEEDED_LABELS[nc?.corrective_action_needed] || 'Non valutato',
        correctiveActionEvalNotes: displayOrNd(nc?.corrective_action_evaluation_notes),
        verificationNotes: displayOrNd(nc?.verification_notes),
        verificationResponsible: displayOrNd(nc?.verification_responsible),
        approvedByName: displayOrNd(nc?.approved_by_name),
        approvedAt: formatDateTime(nc?.approved_at),
        attachmentsCount: String(attachmentRows.length || nc?.attachments_count || 0),
        generatedAt: formatDateTime(new Date()),
        noCorrections: correctionRows.length === 0,
        corrections: correctionRows,
        noActions: actionRows.length === 0,
        actions: actionRows,
        attachments: attachmentRows,
    };
}

async function loadNcWordTemplate(templateUrl = NC_WORD_TEMPLATE_URL) {
    const resp = await fetch(templateUrl, { cache: 'no-store' });
    if (!resp.ok) {
        throw new Error(
            `Impossibile caricare il template "${templateUrl}". Verifica Admin > Template report o esegui: node scripts/generateNcTemplate.js`,
        );
    }
    return resp.arrayBuffer();
}

/**
 * @param {import('../services/apiService.js').default} apiService
 * @returns {Promise<string>}
 */
export async function resolveNcTemplateUrl(apiService) {
    if (!apiService?.resolveNcReportTemplate) return NC_WORD_TEMPLATE_URL;
    try {
        const resolved = await apiService.resolveNcReportTemplate();
        return resolved?.url || NC_WORD_TEMPLATE_URL;
    } catch {
        return NC_WORD_TEMPLATE_URL;
    }
}

export async function generateNcDocxBlob(nc, actions = [], attachments = [], options = {}) {
    const templateUrl = options.templateUrl || NC_WORD_TEMPLATE_URL;
    const arrayBuffer = await loadNcWordTemplate(templateUrl);
    const zip = new PizZip(arrayBuffer);
    const docPath = 'word/document.xml';

    if (zip.files[docPath]) {
        const repaired = repairDocxtemplaterFragmentedTags(
            fixWordXmlMojibake(zip.files[docPath].asText()),
        );
        zip.file(docPath, repaired);
    }

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter() { return ''; },
    });

    doc.render(buildNcTemplateData(nc, actions, attachments));
    return doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
}

/**
 * Carica NC + azioni + allegati dal backend e scarica il documento Word.
 * @param {number|string} ncId
 * @param {import('../services/apiService.js').default} apiService
 */
export async function exportNcToWord(ncId, apiService) {
    const [ncRes, actionsRes] = await Promise.all([
        apiService.get(`/non-conformities/${ncId}`),
        apiService.getNcActions(ncId),
    ]);

    const nc = ncRes?.data;
    if (!nc) throw new Error('Non conformità  non trovata');

    const actions = actionsRes?.data || [];
    const attachments = nc.attachments || [];
    const templateUrl = await resolveNcTemplateUrl(apiService);
    const blob = await generateNcDocxBlob(nc, actions, attachments, { templateUrl });
    const fileName = buildNcWordFileName(nc);
    saveAs(blob, fileName);
    return fileName;
}

export {
    NC_STATUS_LABELS,
    NC_SEVERITY_LABELS,
    NC_ACTION_TYPE_LABELS,
    NC_ACTION_STATUS_LABELS,
};
