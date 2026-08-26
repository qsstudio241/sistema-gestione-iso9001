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
import {
    PT_ACC_OPTIONS,
    PT_SURFACE_OPTIONS,
    PT_CLEANING_OPTIONS,
    PT_APP_OPTIONS,
    PT_FINAL_OPTIONS,
    PT_DEFECTS,
    PT_WORD_NA_ONLY_CODES,
    MT_TRACER_OPTIONS,
    MT_MAG_OPTIONS,
    MT_MAG_MODE_OPTIONS,
    MT_DEMAG_OPTIONS,
    ptDefectPlaceholders,
} from './ndtMethodParams.js';

export const VT_WORD_TEMPLATE_URL = '/templates/VT-verbale.docx';

/** Valori checkbox Word (placeholder semantici, non FORMCHECKBOX). */
export const WORD_CHECK_ON = '\u2611';
export const WORD_CHECK_OFF = '\u2610';

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

function placeholderKey(ph) {
    return String(ph || '').replace(/^\{|\}$/g, '');
}

/** Gruppo esclusivo: un solo placeholder acceso (☑), gli altri ☐. */
function applyExclusiveChecks(out, options, selectedValue) {
    (options || []).forEach(function(opt) {
        var key = placeholderKey(opt.placeholder);
        if (!key) return;
        out[key] = opt.value === selectedValue ? WORD_CHECK_ON : WORD_CHECK_OFF;
    });
}

/** Multi-scelta (es. pulizia PT): ☑ per ogni valore selezionato. */
function applyMultiChecks(out, options, selectedValues) {
    var selected = Array.isArray(selectedValues) ? selectedValues : [];
    (options || []).forEach(function(opt) {
        var key = placeholderKey(opt.placeholder);
        if (!key) return;
        out[key] = selected.indexOf(opt.value) >= 0 ? WORD_CHECK_ON : WORD_CHECK_OFF;
    });
}

function ptPresentLabel(present) {
    if (present === 'yes') return 's\u00ec';
    if (present === 'na') return 'NA';
    return '';
}

/**
 * CND-W — method_params.pt / .mt → chiavi semantiche docxtemplater (appendice PLAN).
 * Nessun nome FORMCHECKBOX. VT non passa di qui (lux già nel payload base).
 */
export function buildPtMtPlaceholderData(report, params) {
    var reportType = String((report && report.report_type) || '').toUpperCase();
    var root = params || {};
    if (reportType === 'PT') {
        return buildPtPlaceholderData(report, root.pt || {});
    }
    if (reportType === 'MT') {
        return buildMtPlaceholderData(report, root.mt || {});
    }
    return {};
}

function buildPtPlaceholderData(report, pt) {
    var out = {};
    applyExclusiveChecks(out, PT_ACC_OPTIONS, pt.acc);
    applyExclusiveChecks(out, PT_SURFACE_OPTIONS, pt.surface);
    applyMultiChecks(out, PT_CLEANING_OPTIONS, pt.cleaning);
    applyExclusiveChecks(out, PT_APP_OPTIONS, pt.application);
    applyExclusiveChecks(out, PT_FINAL_OPTIONS, pt.final);

    out.inspection_pct = pt.inspection_pct != null && String(pt.inspection_pct).trim() !== ''
        ? String(pt.inspection_pct)
        : '';
    out.pt_pen = pt.pen != null ? String(pt.pen) : '';
    out.pt_pen_lot = pt.pen_lot != null ? String(pt.pen_lot) : '';
    out.pt_sol = pt.sol != null ? String(pt.sol) : '';
    out.pt_sol_lot = pt.sol_lot != null ? String(pt.sol_lot) : '';
    out.pt_det = pt.det != null ? String(pt.det) : '';
    out.pt_det_lot = pt.det_lot != null ? String(pt.det_lot) : '';
    out.pt_lux = pt.lux != null ? String(pt.lux) : '';
    out.pt_temp = pt.temp != null ? String(pt.temp) : '';

    out.pt_date_insp = fmtDate(report && report.inspection_date);
    out.pt_date_iss = fmtDate(report && report.certificate_date);
    out.pt_name_resp = nd(report && report.responsible);
    out.pt_name_insp = nd(report && report.inspector);
    out.pt_name_cli = nd(report && report.client_representative);

    var defects = (pt.defects && typeof pt.defects === 'object') ? pt.defects : {};
    PT_DEFECTS.forEach(function(d) {
        var keys = ptDefectPlaceholders(d.code);
        var row = defects[d.code] || {};
        out[placeholderKey(keys.yn)] = ptPresentLabel(row.present);
        out[placeholderKey(keys.a)] = row.outcome ? String(row.outcome) : '';
        // Mason Word 502–515: placeholder singolo {pt_d_*_na}, non solo _yn/_a
        if (keys.na || PT_WORD_NA_ONLY_CODES.indexOf(d.code) >= 0) {
            var naKey = keys.na ? placeholderKey(keys.na) : ('pt_d_' + d.code + '_na');
            var isNa = (!row.present && !row.outcome)
                || row.present === 'na'
                || row.outcome === 'NA';
            out[naKey] = isNa ? WORD_CHECK_ON : WORD_CHECK_OFF;
        }
    });

    return out;
}

function buildMtPlaceholderData(report, mt) {
    var out = {};
    applyExclusiveChecks(out, MT_TRACER_OPTIONS, mt.tracer);
    applyExclusiveChecks(out, MT_MAG_OPTIONS, mt.mag);
    applyExclusiveChecks(out, MT_MAG_MODE_OPTIONS, mt.mag_mode);
    applyExclusiveChecks(out, MT_DEMAG_OPTIONS, mt.demag);

    out.mt_pole_pitch = mt.pole_pitch != null ? String(mt.pole_pitch) : '';
    out.mt_curr_type = mt.curr_type != null ? String(mt.curr_type) : '';
    out.mt_curr_a = mt.curr_a != null ? String(mt.curr_a) : '';
    out.mt_field = mt.field != null ? String(mt.field) : '';
    out.mt_surf = mt.surf != null ? String(mt.surf) : '';
    out.mt_judg = mt.judg != null ? String(mt.judg) : '';
    out.inspection_pct = mt.inspection_pct != null && String(mt.inspection_pct).trim() !== ''
        ? String(mt.inspection_pct)
        : '';

    out.mt_date_insp = fmtDate(report && report.inspection_date);
    out.mt_date_iss = fmtDate(report && report.certificate_date);
    out.mt_name_resp = nd(report && report.responsible);
    out.mt_name_insp = nd(report && report.inspector);
    out.mt_name_cli = nd(report && report.client_representative);

    return out;
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

    var base = {
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

    var methodFields = buildPtMtPlaceholderData(report, params);
    Object.keys(methodFields).forEach(function(k) {
        base[k] = methodFields[k];
    });
    return base;
}

export async function loadVtTemplate(templateUrl, options) {
    options = options || {};
    var api = options.api || apiService;
    var reportType = String(options.reportType || 'VT').toUpperCase();
    if (['VT', 'MT', 'PT', 'UT'].indexOf(reportType) < 0) {
        reportType = 'VT';
    }
    if (!options.skipServer && api && typeof api.resolveCndReportTemplate === 'function') {
        try {
            var resolved = await api.resolveCndReportTemplate(reportType);
            if (resolved && resolved.id && typeof api.getReportTemplateArrayBuffer === 'function') {
                return await api.getReportTemplateArrayBuffer(resolved.id);
            }
        } catch (e) {
            console.warn('[vtWordExport] template VPS non disponibile, fallback locale:', e && e.message);
        }
    }
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
    var arrayBuffer = await loadVtTemplate(templateUrl, {
        api: options.api || apiService,
        reportType: (report && report.report_type) || 'VT',
        skipServer: options.skipServer,
    });
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
