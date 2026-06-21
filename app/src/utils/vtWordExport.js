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
import apiService from '../services/apiService.js';

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
        supplierName:         nd(report.supplier_name),
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

// ── Fetch foto allegate alle righe con difetti (R o S) ───────────────────────
async function fetchDefectPhotos(report) {
    var defectItems = (report.items || []).filter(function(i) {
        return i.evaluation === 'R' || i.evaluation === 'S';
    });
    var photoGroups = [];
    for (var i = 0; i < defectItems.length; i++) {
        var item = defectItems[i];
        if (!item.id) continue;
        try {
            var res = await apiService.get('/attachments?ndt_report_item_id=' + item.id);
            var atts = (res && (res.data || res.attachments)) || [];
            // Scarica solo immagini e converte in base64
            var photos = [];
            for (var j = 0; j < atts.length; j++) {
                var att = atts[j];
                if (!att.mime_type || !att.mime_type.startsWith('image/')) continue;
                try {
                    var token = apiService.getToken ? apiService.getToken() : null;
                    var url = apiService.baseUrl + '/attachments/' + att.attachment_id + '/download';
                    if (token) url += '?token=' + encodeURIComponent(token);
                    var resp = await fetch(url, { credentials: 'include' });
                    if (!resp.ok) continue;
                    var blob = await resp.blob();
                    var b64 = await new Promise(function(resolve, reject) {
                        var reader = new FileReader();
                        reader.onload = function() { resolve(reader.result); };
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                    photos.push({ base64: b64, name: att.file_name, mimeType: blob.type || att.mime_type });
                } catch (e) { /* foto non caricabile, salta */ }
            }
            if (photos.length) {
                photoGroups.push({ item: item, photos: photos });
            }
        } catch (e) { /* nessun allegato per questa riga */ }
    }
    return photoGroups;
}

// ── Inietta sezione foto nel documento OOXML ─────────────────────────────────
function injectPhotosSection(zip, photoGroups) {
    if (!photoGroups || photoGroups.length === 0) return;

    var docXml = zip.files['word/document.xml'] && zip.files['word/document.xml'].asText();
    if (!docXml) return;

    // Legge _rels per trovare prossimo rId libero
    var relsPath = 'word/_rels/document.xml.rels';
    var relsXml = zip.files[relsPath] ? zip.files[relsPath].asText() : '';
    var rIdCounter = 200; // parte da 200 per evitare conflitti con rId esistenti
    var relEntries = '';
    var mediaEntries = [];

    var imageOoxml = '';

    // Intestazione sezione foto
    imageOoxml += '<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr>' +
        '<w:r><w:t>Documentazione fotografica difetti</w:t></w:r></w:p>';

    photoGroups.forEach(function(group) {
        var item = group.item;
        var label = (item.position_code || '?') +
            (item.description ? ' — ' + item.description : '') +
            ' [' + (item.evaluation || '') + ']' +
            (item.defects && item.defects !== 'NESSUNO' ? ' (' + item.defects + ')' : '');

        imageOoxml += '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>' +
            label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
            '</w:t></w:r></w:p>';

        if (item.notes) {
            imageOoxml += '<w:p><w:r><w:t>' +
                item.notes.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') +
                '</w:t></w:r></w:p>';
        }

        group.photos.forEach(function(photo, pIdx) {
            var rId = 'rId' + rIdCounter++;
            var imgId = rIdCounter++;
            var ext = (photo.mimeType === 'image/png') ? 'png' : 'jpeg';
            var mediaPath = 'word/media/ndt_photo_' + imgId + '.' + ext;
            var b64Data = photo.base64.includes(',') ? photo.base64.split(',')[1] : photo.base64;

            // Aggiungi media alla ZIP
            mediaEntries.push({ path: mediaPath, data: b64Data });

            // Aggiungi relazione
            var contentType = photo.mimeType || ('image/' + ext);
            relEntries += '<Relationship Id="' + rId + '" ' +
                'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ' +
                'Target="media/ndt_photo_' + imgId + '.' + ext + '"/>';

            // Immagine 6cm x auto (EMU: 1cm ≈ 360000)
            var cx = 2160000; // 6cm
            var cy = 1620000; // 4.5cm (proporzionale 4:3)
            imageOoxml += '<w:p><w:r><w:drawing>' +
                '<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
                '<wp:extent cx="' + cx + '" cy="' + cy + '"/>' +
                '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
                '<wp:docPr id="' + imgId + '" name="Foto ' + imgId + '"/>' +
                '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
                '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
                '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
                '<pic:nvPicPr><pic:cNvPr id="' + imgId + '" name="Foto ' + imgId + '"/>' +
                '<pic:cNvPicPr/></pic:nvPicPr>' +
                '<pic:blipFill>' +
                '<a:blip r:embed="' + rId + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>' +
                '<a:stretch><a:fillRect/></a:stretch>' +
                '</pic:blipFill>' +
                '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm>' +
                '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
                '</pic:spPr></pic:pic></a:graphicData></a:graphic>' +
                '</wp:inline></w:drawing></w:r></w:p>';
        });
    });

    // Inietta paragrafi prima di </w:body>
    docXml = docXml.replace('</w:body>', imageOoxml + '</w:body>');
    zip.file('word/document.xml', docXml);

    // Aggiorna _rels
    if (relEntries) {
        var newRels = relsXml.replace('</Relationships>', relEntries + '</Relationships>');
        zip.file(relsPath, newRels);
    }

    // Aggiunge file media alla ZIP
    mediaEntries.forEach(function(m) {
        zip.file(m.path, m.data, { base64: true });
    });
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

    // Recupera ZIP post-render e inietta foto difetti
    var renderedZip = doc.getZip();
    if (!options.skipPhotos) {
        try {
            var photoGroups = await fetchDefectPhotos(report);
            injectPhotosSection(renderedZip, photoGroups);
        } catch (e) {
            console.warn('[vtWordExport] foto non caricate:', e.message);
        }
    }

    return renderedZip.generate({
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
