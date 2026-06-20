/**
 * vtWordExport.js -- Export Word Verbale CND (VT/MT/PT/UT)
 *
 * Template: app/public/templates/VT-verbale.docx
 * Usa docxtemplater con loop {#items}...{/items} per l'Elenco Marche.
 */

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import * as fileSaverModule from 'file-saver';
import { formatDateIt } from './auditDatePeriod.js';
import {
    fixWordXmlMojibake,
    repairDocxtemplaterFragmentedTags,
} from './wordExport.js';

export const VT_WORD_TEMPLATE_URL = '/templates/VT-verbale.docx';

const saveAs =
    fileSaverModule.saveAs ||
    (fileSaverModule.default && fileSaverModule.default.saveAs) ||
    fileSaverModule.default;

const EVALUATION_LABELS = { A: 'ACC.', R: 'DA RIPARARE', S: 'SCARTO' };
const STATUS_LABELS = {
    draft: 'Bozza',
    completed: 'Completato',
    approved: 'Approvato',
};

function fmtDate(value) {
    if (!value) return 'N/D';
    return formatDateIt(value) || value;
}

function nd(value) {
    if (value == null || String(value).trim() === '') return 'N/D';
    return String(value).trim();
}

function sanitize(value, fallback) {
    fallback = fallback || 'VT';
    return String(value || fallback).replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || fallback;
}

export function buildVtWordFileName(report) {
    const num = sanitize(report && report.report_number, (report && report.report_type) || 'VT');
    const client = sanitize(report && report.client, 'Cliente');
    return num + '_' + client + '.docx';
}

export function buildVtTemplateData(report) {
    var params = report.method_params
        ? (typeof report.method_params === 'string' ? JSON.parse(report.method_params) : report.method_params)
        : {};

    var items = (report.items || []).map(function(item, idx) {
        return {
            rowNum:               String(idx + 1),
            positionCode:         nd(item.position_code),
            quantity:             nd(item.quantity),
            description:          nd(item.description),
            examinedPart:         nd(item.examined_part) || 'SALDATURA',
            surfaceCondition:     nd(item.surface_condition) || 'M/S',
            inspectionPercentage: item.inspection_percentage != null ? String(item.inspection_percentage) : '100',
            defects:              nd(item.defects) || 'NESSUNO',
            evaluation:           EVALUATION_LABELS[item.evaluation] || nd(item.evaluation) || 'ACC.',
        };
    });

    var instruments = (report.instruments || []).reduce(function(acc, inst) {
        if (acc.gauge === 'N/D' && inst.instrument_role === 'gauge') {
            acc.gauge   = nd(inst.asset_name);
            acc.gaugeId = nd(inst.serial_number || inst.model);
        } else if (acc.luxmeter === 'N/D' && inst.instrument_role === 'luxmeter') {
            acc.luxmeter   = nd(inst.asset_name);
            acc.luxmeterId = nd(inst.serial_number || inst.model);
        } else if (acc.lamp === 'N/D' && inst.instrument_role === 'lamp') {
            acc.lamp   = nd(inst.asset_name);
            acc.lampId = nd(inst.serial_number || inst.model);
        }
        return acc;
    }, { gauge: 'N/D', gaugeId: 'N/D', luxmeter: 'N/D', luxmeterId: 'N/D', lamp: 'N/D', lampId: 'N/D' });

    return {
        reportNumber:         nd(report.report_number),
        reportYear:           nd(report.report_year),
        reportType:           nd(report.report_type),
        client:               nd(report.client),
        jobOrder:             nd(report.job_order),
        wpsNumber:            nd(report.wps_number),
        baseMaterial:         nd(report.base_material),
        materialStandard:     nd(report.material_standard),
        jointType:            nd(report.joint_type),
        qualityLevel:         nd(report.quality_level),
        toolGauge:            instruments.gauge,
        toolGaugeId:          instruments.gaugeId,
        toolLuxmeter:         instruments.luxmeter,
        toolLuxmeterId:       instruments.luxmeterId,
        toolLamp:             instruments.lamp,
        toolLampId:           instruments.lampId,
        illuminanceMin:       params.illuminance_min != null ? String(params.illuminance_min) : '350',
        illuminanceMax:       params.illuminance_max != null ? String(params.illuminance_max) : '500',
        illuminanceMeasured:  params.illuminance_measured != null ? String(params.illuminance_measured) : 'N/D',
        powerW:               nd(params.power_w),
        wavelength:           nd(params.wavelength),
        items:                items,
        itemsCount:           String(items.length),
        notes:                nd(report.notes),
        inspectionDate:       fmtDate(report.inspection_date),
        certificateDate:      fmtDate(report.certificate_date),
        responsible:          nd(report.responsible),
        inspector:            nd(report.inspector),
        clientRepresentative: nd(report.client_representative),
        statusLabel:          STATUS_LABELS[report.status] || nd(report.status),
        generatedAt: new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
}

async function loadVtTemplate(templateUrl) {
    templateUrl = templateUrl || VT_WORD_TEMPLATE_URL;
    var resp = await fetch(templateUrl, { cache: 'no-store' });
    if (!resp.ok) {
        throw new Error('Template "' + templateUrl + '" non trovato. Caricare VT-verbale.docx in app/public/templates/.');
    }
    return resp.arrayBuffer();
}

export async function generateVtDocxBlob(report, options) {
    options = options || {};
    var templateUrl = options.templateUrl || VT_WORD_TEMPLATE_URL;
    var arrayBuffer = await loadVtTemplate(templateUrl);
    var zip = new PizZip(arrayBuffer);

    var docPath = 'word/document.xml';
    if (zip.files[docPath]) {
        var repaired = repairDocxtemplaterFragmentedTags(
            fixWordXmlMojibake(zip.files[docPath].asText())
        );
        zip.file(docPath, repaired);
    }

    var doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: function() { return ''; },
    });

    doc.render(buildVtTemplateData(report));

    return doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
}

export async function exportVtToWord(report, options) {
    var blob = await generateVtDocxBlob(report, options);
    var fileName = buildVtWordFileName(report);
    saveAs(blob, fileName);
    return fileName;
}
