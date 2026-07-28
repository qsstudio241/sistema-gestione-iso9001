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
    embedImagesInZip,
} from './wordExport.js';
import {
    escXml,
    xmlHyperlinkPara,
    buildWordInlineImageRun,
    wordEmbeddableExtFromMime,
    getDisplayImagePixelDimensions,
    scaleImageToMaxEmu,
    normalizeImageDataUrlForWordEmbed,
} from './wordExportHelpers.js';

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
        // Nome dedicato: evita conflitto con {description} della NC a livello root in docxtemplater
        actionDescription: displayOrNd(action.description),
        responsible: displayOrNd(action.responsible),
        dueDate: formatDate(action.due_date),
        completedAt: formatDateTime(action.completed_at),
        verificationNote: displayOrNd(action.verification_note),
    });

    const correctionRows = corrections.map(mapAction);
    const actionRows = otherActions.map(mapAction);

    const attCount = (attachments || []).length || nc?.attachments_count || 0;

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
        effectivenessVerificationNotes: displayOrNd(nc?.effectiveness_verification_notes),
        verificationResponsible: displayOrNd(nc?.verification_responsible),
        approvedByName: displayOrNd(nc?.approved_by_name),
        approvedAt: formatDateTime(nc?.approved_at),
        attachmentsCount: String(attCount),
        generatedAt: formatDateTime(new Date()),
        noCorrections: correctionRows.length === 0,
        corrections: correctionRows,
        noActions: actionRows.length === 0,
        actions: actionRows,
    };
}

const NC_IMAGE_MAX_W_EMU = 4572000;  // ~12 cm
const NC_IMAGE_MAX_H_EMU = 5715000; // ~15 cm

const IMAGE_MIME_SET = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

function normMime(m) {
    return String(m || '').split(';')[0].trim().toLowerCase();
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function preloadNcAttachmentImages(attachments, fetchAttachmentBlob) {
    if (typeof fetchAttachmentBlob !== 'function') return;
    await Promise.allSettled(
        attachments.map(async (att) => {
            const mime = normMime(att.mime_type);
            if (!IMAGE_MIME_SET.has(mime)) return;
            const id = att.attachment_id;
            if (!id) return;
            try {
                const { blob, mimeType } = await fetchAttachmentBlob(id, 'view');
                const realMime = normMime(mimeType || blob?.type || mime);
                if (!IMAGE_MIME_SET.has(realMime)) return;
                att.imageBase64 = await normalizeImageDataUrlForWordEmbed(
                    await blobToBase64(blob), realMime,
                );
                att.imageMimeType = realMime;
            } catch (e) {
                console.warn('[ncWordExport] preload image failed', id, e.message);
            }
        }),
    );
}

function findWordParagraphStartBefore(xml, beforeIndex) {
    if (!xml || beforeIndex < 0) return -1;
    let pos = beforeIndex;
    while (pos >= 0) {
        const idx = xml.lastIndexOf('<w:p', pos);
        if (idx === -1) return -1;
        const next = xml.charAt(idx + 4);
        // Solo <w:p> o <w:p ...> — esclude <w:pPr>, <w:pStyle>, ecc.
        if (next === '>' || next === ' ') {
            return idx;
        }
        pos = idx - 1;
    }
    return -1;
}

function replaceNcAttachmentsMarker(xml, attachOoxml) {
    if (!xml || typeof xml !== 'string') return xml;
    const marker = 'NC_ATTACHMENTS_MARKER';
    if (!xml.includes(marker)) return xml;

    const idx = xml.indexOf(marker);
    const pEnd = xml.indexOf('</w:p>', idx);
    if (pEnd === -1) return xml;

    const pStart = findWordParagraphStartBefore(xml, idx);
    if (pStart === -1 || pStart >= pEnd) return xml;

    const segment = xml.slice(pStart, pEnd + 6);
    if (!segment.includes(marker)) return xml;

    return xml.slice(0, pStart) + attachOoxml + xml.slice(pEnd + 6);
}

function buildNcAttachmentsOoxml(attachments, getViewUrl, imageRegistry) {
    if (!attachments || attachments.length === 0) {
        return '<w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr>' +
            '<w:r><w:rPr><w:i/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>' +
            `<w:t xml:space="preserve">Nessuna evidenza allegata.</w:t></w:r></w:p>`;
    }

    let ooxml = '';
    let imgCounter = 200;

    for (const att of attachments) {
        const fileName = att.file_name || 'allegato';
        const ext = wordEmbeddableExtFromMime(att.imageMimeType);

        if (att.imageBase64 && ext) {
            const rId = `rIdNcAtt${imgCounter}`;
            const b64 = att.imageBase64.includes(',') ? att.imageBase64.split(',')[1] : att.imageBase64;
            const dims = getDisplayImagePixelDimensions(b64, att.imageMimeType);
            const { cx, cy } = dims
                ? scaleImageToMaxEmu(dims.w, dims.h, NC_IMAGE_MAX_W_EMU, NC_IMAGE_MAX_H_EMU)
                : { cx: NC_IMAGE_MAX_W_EMU, cy: Math.round(NC_IMAGE_MAX_W_EMU * 0.75) };

            imageRegistry.push({ rId, imgId: imgCounter, base64: att.imageBase64, mimeType: att.imageMimeType, ext });
            ooxml += `<w:p><w:pPr><w:spacing w:before="120" w:after="40"/></w:pPr>` +
                buildWordInlineImageRun(rId, imgCounter, cx, cy) + '</w:p>';
            imgCounter++;

            ooxml += `<w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr>` +
                `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/><w:color w:val="6B7280"/></w:rPr>` +
                `<w:t xml:space="preserve">${escXml(fileName)}</w:t></w:r></w:p>`;
        } else {
            const id = att.attachment_id;
            if (id && getViewUrl) {
                ooxml += xmlHyperlinkPara(getViewUrl(id), `\uD83D\uDCCE ${fileName}`, { size: 20 });
            } else {
                ooxml += `<w:p><w:pPr><w:spacing w:before="60" w:after="60"/></w:pPr>` +
                    `<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>` +
                    `<w:t xml:space="preserve">${escXml('\uD83D\uDCCE ' + fileName)}</w:t></w:r></w:p>`;
            }
        }
    }
    return ooxml;
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
    const getViewUrl = options.getViewUrl || null;
    const fetchAttachmentBlob = options.fetchAttachmentBlob || null;
    const arrayBuffer = await loadNcWordTemplate(templateUrl);
    const zip = new PizZip(arrayBuffer);
    const docPath = 'word/document.xml';

    if (zip.files[docPath]) {
        const repaired = repairDocxtemplaterFragmentedTags(
            fixWordXmlMojibake(zip.files[docPath].asText()),
        );
        zip.file(docPath, repaired);
    }

    const attList = attachments || [];
    if (fetchAttachmentBlob) {
        await preloadNcAttachmentImages(attList, fetchAttachmentBlob);
    }

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter() { return ''; },
    });

    doc.render(buildNcTemplateData(nc, actions, attList));

    const outZip = doc.getZip();
    let xml = outZip.files[docPath]?.asText() || '';

    if (xml.includes('NC_ATTACHMENTS_MARKER')) {
        const imageRegistry = [];
        const attachOoxml = buildNcAttachmentsOoxml(attList, getViewUrl, imageRegistry);
        xml = replaceNcAttachmentsMarker(xml, attachOoxml);
        outZip.file(docPath, xml);
        if (imageRegistry.length > 0) {
            embedImagesInZip(outZip, imageRegistry);
        }
    }

    return outZip.generate({
        type: options.outputType || 'blob',
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
    if (!nc) throw new Error('Non conformità non trovata');

    const actions = actionsRes?.data || [];
    let attachments = nc.attachments || [];
    if (attachments.length === 0 && typeof apiService.getAttachments === 'function') {
        try {
            const attRes = await apiService.getAttachments(null, ncId);
            attachments = attRes?.data || [];
        } catch {
            // fallback silenzioso: usa solo nc.attachments
        }
    }

    const templateUrl = await resolveNcTemplateUrl(apiService);
    const getViewUrl = (id) => apiService.getAttachmentViewUrl(id);
    const fetchAttachmentBlob = typeof apiService.fetchAttachmentBlob === 'function'
        ? (id, mode) => apiService.fetchAttachmentBlob(id, mode)
        : null;
    const blob = await generateNcDocxBlob(nc, actions, attachments, {
        templateUrl,
        getViewUrl,
        fetchAttachmentBlob,
    });
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
