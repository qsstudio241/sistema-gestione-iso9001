/**
 * wordExport.js — Export Word audit ISO 9001
 *
 * ARCHITETTURA (template-based):
 *   1. Carica app/public/templates/ISO9001-audit-report.docx
 *      └─ Questo file puoi aprire e modificare in Word:
 *         header, footer, logo, font, colori, stili titoli, testo fisso.
 *         NON rimuovere i segnaposto {varName} e i marker CHECKLIST/RILIEVI.
 *
 *   2. docxtemplater sostituisce i segnaposto testo:
 *         {clientName}  {committenteName}  {auditPartyTypeLabel}  {fornitoreName}
 *         {auditDate}  {auditNumber}  {procedureCode}
 *         {auditObject}  {scope}  {referenceDocuments}  {processes}
 *         {programCommunicatedDate}  {auditor}  {objectiveDescription}
 *         {#participants}{role}{name}{/participants}
 *         {conclusions}  {ncCount}  {ossCount}  {omCount}  {nvCount}  {summaryText}
 *
 *   3. wordExportHelpers.js genera le tabelle colorate come OOXML
 *
 *   4. injectOoxmlMarkers() sostituisce i marker nel XML del .docx:
 *         CHECKLIST_MARKER  → sezione rilievi pendenti + tutte le clausole
 *         RILIEVI_MARKER    → tabella sintesi CONF/NC/OSS/OM/N.A./NV
 *
 * AGGIUNGERE UN NUOVO STANDARD:
 *   1. Ottieni il template: copia ISO9001-audit-report.docx, rinominalo e aprilo in Word
 *   2. Modifica titoli/sezioni a piacere, salva
 *   3. Aggiungi la mappatura in TEMPLATE_MAP (qui sotto)
 *   Zero modifiche al codice per layout/branding!
 */

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import * as fileSaverModule from 'file-saver';
import {
    buildChecklistSectionOoxml,
    buildRileviSummaryOoxml,
    buildCustomChecklistSectionOoxml,
    buildCustomRileviSummaryOoxml,
    buildWordInlineImageRun,
    calculateMetrics,
    wordEmbeddableExtFromMime,
} from './wordExportHelpers.js';

// ─── Mappa standard → template ────────────────────────────────────────────────
// PER AGGIUNGERE UNA NUOVA NORMA: inserire qui la coppia chiave→percorso template.
// Nient'altro da modificare nel codice.
const TEMPLATE_MAP = {
    'ISO_9001':   '/templates/ISO9001-audit-report.docx',
    'ISO_14001':  '/templates/ISO14001-audit-report.docx',
    'ISO_45001':  '/templates/ISO45001-audit-report.docx',
    'ISO_3834_2': '/templates/ISO3834-audit-report.docx',
    'default':    '/templates/ISO9001-audit-report.docx',
    'custom_checklist': '/templates/Verbale_di_riunione_QTAFI_VIS001.docx',
};

/**
 * Normalizza una chiave standard al formato usato in TEMPLATE_MAP.
 * 'ISO_9001_2015' → 'ISO_9001'  |  'ISO_14001' → 'ISO_14001'
 * Usata sia per la selezione del template che per il filtraggio della checklist.
 */
function normalizeStdKey(key) {
    if (!key) return 'default';
    const k = String(key).toUpperCase().trim();
    if (TEMPLATE_MAP[k]) return k;
    // Rimuovi suffisso anno: ISO_9001_2015 → ISO_9001, ISO_3834_2_2021 → ISO_3834_2
    const withoutYear = k.replace(/_\d{4}$/, '');
    if (TEMPLATE_MAP[withoutYear]) return withoutYear;
    // Gestione ISO 3834 con varianti (ISO_3834, ISO_3834_2, ISO_3834_2_2021)
    if (k.includes('3834')) return 'ISO_3834_2';
    return 'default';
}

function getTemplateUrl(standardKey) {
    return TEMPLATE_MAP[normalizeStdKey(standardKey)] || TEMPLATE_MAP['default'];
}

/** Mappa standardKey -> standard_id per API resolve */
const STANDARD_KEY_TO_ID = {
    'ISO_9001': 1, 'ISO_14001': 2, 'ISO_45001': 3,
    'ISO_3834_2': 6, 'RDP_MSN': 7,
    'default': 1,
};
const saveAs =
    fileSaverModule.saveAs ||
    (fileSaverModule.default && fileSaverModule.default.saveAs) ||
    fileSaverModule.default;

function formatDate(dateStr) {
    if (!dateStr) return 'N/D';
    try {
        const d = new Date(dateStr);
        return isNaN(d.getTime())
            ? String(dateStr)
            : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return String(dateStr); }
}

function normalizeMimeType(mimeType) {
    return String(mimeType || '').split(';')[0].trim().toLowerCase();
}

function buildTemplateData(audit) {
    const meta    = audit.metadata       || {};
    const gd      = meta.generalData     || {};
    const obj     = meta.auditObjective  || {};
    const outcome = meta.auditOutcome    || {};
    const m       = calculateMetrics(audit.checklist);

    const isAuditorPlaceholder = (v) => {
        const t = String(v || '').trim().toLowerCase();
        return !t || t === 'non specificato' || t === 'n/d' || t === 'n.d.' || t === 'nd';
    };
    const pickAuditorName = () => {
        for (const v of [meta.auditorName, gd.auditors?.[0], meta.auditors?.[0], meta.auditor]) {
            if (!isAuditorPlaceholder(v)) return String(v).trim();
        }
        return 'N/D';
    };

    const auditPartyType = meta.auditPartyType || 'first_party';
    const auditPartyTypeLabel = auditPartyType === 'second_party'
        ? 'Seconda parte (fornitore)'
        : 'Prima parte (interno)';
    const fornitoreNameRaw = auditPartyType === 'second_party'
        ? String(meta.fornitoreName || meta.exportCompanyName || meta.clientName || '').trim()
        : '';
    const fornitoreAddressRaw = auditPartyType === 'second_party'
        ? String(meta.fornitoreAddress || meta.exportCompanyAddress || '').trim()
        : String(meta.fornitoreAddress || meta.exportCompanyAddress || '').trim();
    const fornitoreName = fornitoreNameRaw && fornitoreAddressRaw
        ? `${fornitoreNameRaw} - ${fornitoreAddressRaw}`
        : (fornitoreNameRaw || fornitoreAddressRaw);
    const reportClientName = (auditPartyType === 'second_party' && fornitoreNameRaw)
        ? fornitoreNameRaw
        : (meta.clientName || 'Cliente');
    const reportScope = gd.scope || '—';
    const primaryAuditor = pickAuditorName();
    const fallbackParticipants = (gd.auditors || [])
        .map((v) => String(v || '').trim())
        .filter((v) => !isAuditorPlaceholder(v))
        .filter((v) => v !== primaryAuditor)
        .map((name) => ({ role: 'Ispettore affiancante', name }));
    const participantList = (obj.participants || []).length > 0
        ? (obj.participants || [])
        : fallbackParticipants;

    const orgBrand = audit.exportOrganizationBranding || {};

    return {
        organizationName:       orgBrand.name || '',
        organizationVat:        orgBrand.vat || '',
        clientName:             reportClientName,
        committenteName:        meta.clientName  || 'Cliente',
        auditPartyTypeLabel,
        fornitoreName:          fornitoreName || '—',
        fornitoreIndirizzo:     fornitoreAddressRaw || '—',
        auditNumber:            meta.auditNumber || 'N/A',
        procedureCode:          meta.procedureCode || '—',
        auditDate:              formatDate(meta.auditDate || gd.auditDate),
        auditObject:            gd.auditObject   || 'Audit di Verifica ispettiva interna',
        scope:                  reportScope,
        referenceDocuments:     Array.isArray(gd.referenceDocuments)
            ? gd.referenceDocuments.join(', ')
            : (gd.referenceDocuments || '—'),
        processes:              gd.processes     || 'Tutti i processi aziendali',
        ispettore:              primaryAuditor,
        programCommunicatedDate: formatDate(gd.programCommunicatedDate),
        auditor:                primaryAuditor,
        objectiveDescription:   obj.description  ||
            'Verificare il grado di implementazione del Sistema di Gestione della Qualit\u00e0 ' +
            'secondo la norma UNI EN ISO 9001:2015.',
        participants: participantList.map(p => ({
            role: p.role || 'N/D',
            name: p.name || '',
        })),
        conclusions: outcome.conclusions || 'Nessuna conclusione documentata.',
        cCount:      String(m.totalC),
        ncCount:     String(m.totalNC),
        ossCount:    String(m.totalOSS),
        omCount:     String(m.totalOM),
        nvCount:     String(m.totalNV),
        naCount:     String(m.totalNA),
        summaryText: outcome.emergingFindings?.summary ||
            'Totale: ' + m.total + ' | Risposte: ' + m.answered +
            ' | NC: ' + m.totalNC + ' | OSS: ' + m.totalOSS + ' | OM: ' + m.totalOM +
            ' | N.A.: ' + m.totalNA + ' | NV: ' + m.totalNV,
    };
}

/**
 * Trova il paragrafo contenente il marker e lo sostituisce con l OOXML fornito.
 * Versione robusta: usa carattere per carattere per trovare <w:p> e non <w:pPr>.
 */
/**
 * w:tblInd negativo sposta la tabella fuori dai margini (effetto opposto a "Adatta alla finestra").
 * Normalizza documento, intestazioni e piè di pagina dopo il caricamento del template.
 */
function normalizeNegativeTableIndentsInZip(zip) {
    if (!zip || !zip.files) return;
    const replacement = '<w:tblInd w:w="0" w:type="dxa"/>';
    let parts = 0;
    Object.keys(zip.files).forEach((p) => {
        if (!/^word\/(document|header\d+|footer\d+)\.xml$/.test(p)) return;
        const f = zip.files[p];
        if (!f || f.dir) return;
        const t = f.asText();
        if (!t.includes('tblInd') || !t.includes('w:w="-')) return;
        const u = t.replace(/<w:tblInd w:w="-\d+" w:type="dxa"\/>/g, replacement);
        if (u !== t) {
            zip.file(p, u);
            parts++;
        }
    });
    if (parts > 0) {
        console.log('[wordExport] Rientro tabella: azzerato tblInd negativo in', parts, 'file XML (document/header/footer).');
    }
}

/**
 * Ripara attributi OOXML non quotati (template salvati/exportati in modo non conforme).
 * Word e parser XML rigidi possono rifiutare il documento o corrompere la struttura.
 */
function repairWordDocumentXmlMalformedAttrs(xml) {
    if (!xml || typeof xml !== 'string') return xml;
    let s = xml;
    // Template corrotti: <w:p ...><w:p><w:pPr> (w:p non puo contenere w:p in OOXML)
    s = s.replace(/(<w:p[^>]*>)<w:p>(?=<w:pPr>)/g, '$1');
    s = s.replace(/xml:space=preserve\b/g, 'xml:space="preserve"');
    s = s.replace(/\bw:before=(\d+)(?=[\s/>])/g, 'w:before="$1"');
    s = s.replace(/\bw:after=(\d+)(?=[\s/>])/g, 'w:after="$1"');
    s = s.replace(/\bw:line=(\d+)(?=[\s/>])/g, 'w:line="$1"');
    s = s.replace(/\bw:lineRule=([A-Za-z0-9]+)(?=[\s/>])/g, 'w:lineRule="$1"');
    // w:val=AAAAAA (colore) o altri token non numerici
    s = s.replace(/\bw:val=([0-9A-Fa-f]{6})(?=[\s/>])/g, 'w:val="$1"');
    // w:val numerico rimasto senza virgolette
    s = s.replace(/\bw:val=(\d+)(?=[\s/>])/g, 'w:val="$1"');
    return s;
}

/**
 * Word spezza spesso i segnaposto docxtemplater in più <w:r>/<w:t> (spell/grammar proofErr).
 * docxtemplater vede solo testo continuo per run: {auditObject} spezzato non viene sostituito.
 * Ricompone tag `{nome}` e le celle loop `{#participants}{role}` / `{name}{/participants}`.
 */
const SIMPLE_DOCXTEMPLATE_VAR_NAMES = [
    'referenceDocuments', 'programCommunicatedDate', 'objectiveDescription', 'auditPartyTypeLabel',
    'committenteName', 'fornitoreName', 'fornitoreIndirizzo', 'procedureCode', 'auditNumber', 'auditObject',
    'clientName', 'processes', 'ispettore', 'conclusions', 'summaryText',
    'auditor', 'scope', 'auditDate', 'cCount', 'ncCount', 'ossCount', 'omCount', 'nvCount', 'naCount',
    'organizationName', 'organizationVat',
];

/** proofErr è elemento vuoto: <w:proofErr w:type="spellStart"/>. */
/**
 * Almeno un proofErr tra le parti: con * zero-proof si matchava il { del TOC fino ai veri placeholder.
 * I tag spezzati da Word hanno spell/gram tra { e nome e tra nome e }.
 */
const PROOF_ERR_REQ = '(?:\\s*<w:proofErr[^>]*/>)+';
/** rPr non annidato: *? globale può saltare al </w:rPr> sbagliato se l’XML ha rPr sbilanciati nel TOC. */
const RPR_BLK = '(?:<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>)';

export function repairDocxtemplaterFragmentedTags(xml) {
    if (!xml || typeof xml !== 'string') return xml;
    let out = xml;
    for (const v of SIMPLE_DOCXTEMPLATE_VAR_NAMES) {
        const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(
            '<w:r(\\s[^>]*)?>' + RPR_BLK + '?<w:t(?:\\s[^>]*)?>\\{\\s*</w:t></w:r>' +
            PROOF_ERR_REQ +
            '<w:r(?:\\s[^>]*)?>' + RPR_BLK + '?<w:t(?:\\s[^>]*)?>' + esc + '</w:t></w:r>' +
            PROOF_ERR_REQ +
            '<w:r(?:\\s[^>]*)?>' + RPR_BLK + '?<w:t(?:\\s[^>]*)?>\\}</w:t></w:r>',
            'g'
        );
        out = out.replace(re, (_m, rAttrs) => {
            const attrs = rAttrs || '';
            return `<w:r${attrs}><w:t xml:space="preserve">{${v}}</w:t></w:r>`;
        });
    }
    const reParticipantsOpen = new RegExp(
        '<w:r(\\s[^>]*)?><w:t(?:\\s[^>]*)?>\\{#</w:t></w:r>' + PROOF_ERR_REQ +
        '<w:r(?:\\s[^>]*)?><w:t(?:\\s[^>]*)?>participants\\}\\{</w:t></w:r>' + PROOF_ERR_REQ +
        '<w:r(?:\\s[^>]*)?><w:t(?:\\s[^>]*)?>role\\}</w:t></w:r>',
        'g'
    );
    out = out.replace(reParticipantsOpen, (_m, rAttrs) => {
        const attrs = rAttrs || '';
        return `<w:r${attrs}><w:t xml:space="preserve">{#participants}{role}</w:t></w:r>`;
    });
    const reParticipantsClose = new RegExp(
        '<w:r(\\s[^>]*)?><w:t(?:\\s[^>]*)?>\\{name\\}\\{/</w:t></w:r>' + PROOF_ERR_REQ +
        '<w:r(?:\\s[^>]*)?><w:t(?:\\s[^>]*)?>participants</w:t></w:r>' + PROOF_ERR_REQ +
        '<w:r(?:\\s[^>]*)?><w:t(?:\\s[^>]*)?>\\}</w:t></w:r>',
        'g'
    );
    out = out.replace(reParticipantsClose, (_m, rAttrs) => {
        const attrs = rAttrs || '';
        return `<w:r${attrs}><w:t xml:space="preserve">{name}{/participants}</w:t></w:r>`;
    });
    return out;
}

/**
 * Trattini e apici spesso salvati nel .docx come sequenze errate (UTF-8 letto come CP1252).
 * Esempio reale nel template: U+2013 EN DASH appare come â + € + “ (E2 80 93 mal decodificati).
 * Word spezza spesso la sequenza in più <w:t> (TOC, proofErr): es. <w:t>1 â</w:t>…<w:t>€" DATI</w:t>.
 */
/** Chiusura/apertura run Word tra due metà della stessa sequenza mojibake. */
const MOJIBAKE_W_RUN_BRIDGE =
    '(?:<\\/w:t><\\/w:r>(?:<w:proofErr[^>]*\\/>)*<w:r(?:\\s[^>]*)?>(?:<w:rPr>[\\s\\S]*?<\\/w:rPr>)?<w:t(?:\\s[^>]*)?>)?';

function fixWordXmlMojibake(xml) {
    if (!xml || typeof xml !== 'string') return xml;
    let s = xml;
    const bridge = MOJIBAKE_W_RUN_BRIDGE;
    const en = new RegExp(`\\u00E2${bridge}\\u20AC\\u201C`, 'g');
    const em = new RegExp(`\\u00E2${bridge}\\u20AC\\u201D`, 'g');
    const ap = new RegExp(`\\u00E2${bridge}\\u20AC\\u2122`, 'g');
    s = s.replace(en, '\u2013');
    s = s.replace(em, '\u2014');
    s = s.replace(ap, '\u2019');
    s = s.replace(/\u00E2\u20AC\u0153/g, '\u201C');
    s = s.replace(/\u00E2\u20AC\u009D/g, '\u201D');
    return s;
}

/** Parti OOXML testuali da normalizzare (anche dopo injectOoxmlMarkers). */
const WORD_XML_MOJIBAKE_PATH_RE =
    /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/;

function applyMojibakeFixToWordXmlPartsInZip(zip) {
    if (!zip || !zip.files) return;
    for (const p of Object.keys(zip.files)) {
        if (!WORD_XML_MOJIBAKE_PATH_RE.test(p)) continue;
        const f = zip.files[p];
        if (!f || f.dir) continue;
        const t0 = f.asText();
        const t1 = fixWordXmlMojibake(t0);
        if (t1 !== t0) zip.file(p, t1);
    }
}

function preprocessDocxtemplaterPartsInZip(zip) {
    if (!zip || !zip.files) return;
    const paths = Object.keys(zip.files).filter((p) => WORD_XML_MOJIBAKE_PATH_RE.test(p));
    for (const p of paths) {
        const f = zip.files[p];
        if (!f || f.dir) continue;
        let t = f.asText();
        t = fixWordXmlMojibake(t);
        t = repairDocxtemplaterFragmentedTags(t);
        t = repairWordDocumentXmlMalformedAttrs(t);
        zip.file(p, t);
    }
}

/** Data URL → mime + base64 (senza spazi). */
function parseImageDataUrl(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const m = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(dataUrl.trim());
    if (!m) return null;
    return { mime: m[1].trim().toLowerCase(), base64: m[2].replace(/\s/g, '') };
}

/** Massimo indice numerico usato negli Id="rIdN" nel package (evita collisioni nuove relazioni). */
function maxRIdNumericInZip(zip) {
    let max = 0;
    Object.keys(zip.files).forEach((p) => {
        if (!/\/_rels\/.+\.rels$/.test(p)) return;
        const t = zip.files[p]?.asText();
        if (!t) return;
        const re = /Id="rId(\d+)"/g;
        let x;
        while ((x = re.exec(t)) !== null) {
            const n = parseInt(x[1], 10);
            if (Number.isFinite(n) && n > max) max = n;
        }
    });
    return max;
}

function relsPathForWordPart(partPath) {
    const m = /^word\/([^/]+\.xml)$/.exec(partPath);
    if (!m) return null;
    return `word/_rels/${m[1]}.rels`;
}

function ensureRelationshipsXml(relsXml) {
    if (relsXml && relsXml.includes('<Relationships')) return relsXml;
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
}

function appendImageRelationship(relsXml, rId, targetFromWordFolder) {
    if (relsXml.includes(`Id="${rId}"`)) return relsXml;
    const entry =
        `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
        `Target="${targetFromWordFolder}"/>`;
    return relsXml.replace('</Relationships>', `${entry}</Relationships>`);
}

/**
 * Sostituisce il paragrafo che contiene un marker testuale (es. [LOGO], [LOGO_ORG]) con run immagine.
 */
function replaceLogoMarkerParagraph(xml, markerIndex, imageRunsXml, markerText) {
    const marker = markerText || '[LOGO]';
    const markerLen = marker.length;
    let pStart = markerIndex - 1;
    while (pStart >= 4) {
        if (
            xml[pStart] === '<' &&
            xml[pStart + 1] === 'w' &&
            xml[pStart + 2] === ':' &&
            xml[pStart + 3] === 'p' &&
            (xml[pStart + 4] === ' ' || xml[pStart + 4] === '>')
        ) break;
        pStart--;
    }
    const pEnd = xml.indexOf('</w:p>', markerIndex);
    if (pStart < 4 || pEnd < 0) {
        return xml.slice(0, markerIndex) + imageRunsXml + xml.slice(markerIndex + markerLen);
    }
    const oldPara = xml.slice(pStart, pEnd + 6);
    const openM = oldPara.match(/^(<w:p[^>]*>)([\s\S]*)(<\/w:p>)$/);
    if (!openM) return xml.slice(0, markerIndex) + imageRunsXml + xml.slice(markerIndex + markerLen);
    let inner = openM[2];
    let pPr = '';
    if (inner.startsWith('<w:pPr')) {
        const endPpr = inner.indexOf('</w:pPr>');
        if (endPpr !== -1) {
            pPr = inner.slice(0, endPpr + 8);
            inner = inner.slice(endPpr + 8);
        }
    }
    const replacement = `${openM[1]}${pPr}${imageRunsXml}${openM[3]}`;
    return xml.slice(0, pStart) + replacement + xml.slice(pEnd + 6);
}

/**
 * Sostituisce [LOGO] in document/header/footer con immagine da data URL (jpeg/png/gif).
 * Usa un solo file in word/media/; ogni parte ottiene una relazione immagine dedicata.
 */
function injectCompanyLogoInZip(zip, dataUrl) {
    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed) {
        console.warn('[wordExport] Logo: data URL non valido.');
        return;
    }
    const ext = wordEmbeddableExtFromMime(parsed.mime);
    if (!ext) {
        console.warn('[wordExport] Logo: formato non embeddabile in Word:', parsed.mime);
        return;
    }
    const mediaRelTarget = `media/company_logo_export.${ext}`;
    const mediaPath = `word/${mediaRelTarget}`;
    zip.file(mediaPath, parsed.base64, { base64: true });
    ensureImageContentTypesInZip(zip, [ext]);

    let rSeed = maxRIdNumericInZip(zip);

    const partPaths = Object.keys(zip.files).filter((p) =>
        /^word\/(document|header\d+|footer\d+)\.xml$/.test(p)
    );

    for (const partPath of partPaths) {
        let xml = zip.files[partPath]?.asText();
        if (!xml || !xml.includes('[LOGO]')) continue;

        rSeed += 1;
        const rId = `rId${rSeed}`;
        const relsPath = relsPathForWordPart(partPath);
        if (!relsPath) continue;

        let relsXml = zip.files[relsPath]?.asText();
        relsXml = ensureRelationshipsXml(relsXml);
        relsXml = appendImageRelationship(relsXml, rId, mediaRelTarget);
        zip.file(relsPath, relsXml);

        let imgIdLocal = 88001;
        while (xml.includes('[LOGO]')) {
            const drawingRun = buildWordInlineImageRun(rId, imgIdLocal++);
            xml = replaceLogoMarkerParagraph(xml, xml.indexOf('[LOGO]'), drawingRun, '[LOGO]');
        }
        zip.file(partPath, repairWordDocumentXmlMalformedAttrs(xml));
    }
}

const ORG_LOGO_MARKER = '[LOGO_ORG]';

/**
 * Come injectCompanyLogoInZip ma per logo tenant (marker [LOGO_ORG] nei template Word).
 */
function injectOrganizationLogoInZip(zip, dataUrl) {
    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed) {
        console.warn('[wordExport] Logo org: data URL non valido.');
        return;
    }
    const ext = wordEmbeddableExtFromMime(parsed.mime);
    if (!ext) {
        console.warn('[wordExport] Logo org: formato non embeddabile in Word:', parsed.mime);
        return;
    }
    const mediaRelTarget = `media/org_logo_export.${ext}`;
    const mediaPath = `word/${mediaRelTarget}`;
    zip.file(mediaPath, parsed.base64, { base64: true });
    ensureImageContentTypesInZip(zip, [ext]);

    let rSeed = maxRIdNumericInZip(zip);

    const partPaths = Object.keys(zip.files).filter((p) =>
        /^word\/(document|header\d+|footer\d+)\.xml$/.test(p)
    );

    for (const partPath of partPaths) {
        let xml = zip.files[partPath]?.asText();
        if (!xml || !xml.includes(ORG_LOGO_MARKER)) continue;

        rSeed += 1;
        const rId = `rId${rSeed}`;
        const relsPath = relsPathForWordPart(partPath);
        if (!relsPath) continue;

        let relsXml = zip.files[relsPath]?.asText();
        relsXml = ensureRelationshipsXml(relsXml);
        relsXml = appendImageRelationship(relsXml, rId, mediaRelTarget);
        zip.file(relsPath, relsXml);

        let imgIdLocal = 89001;
        while (xml.includes(ORG_LOGO_MARKER)) {
            const drawingRun = buildWordInlineImageRun(rId, imgIdLocal++);
            xml = replaceLogoMarkerParagraph(xml, xml.indexOf(ORG_LOGO_MARKER), drawingRun, ORG_LOGO_MARKER);
        }
        zip.file(partPath, repairWordDocumentXmlMalformedAttrs(xml));
    }
}

function replaceMarker(xml, marker, replacementXml) {
    const idx = xml.indexOf(marker);
    if (idx === -1) {
        console.warn('[wordExport] Marker non trovato: "' + marker + '" — rigenera il template con: node scripts/generateTemplate.js');
        return xml;
    }

    // Cammina a ritroso finche non trova <w:p seguita da spazio o >
    // (esclude <w:pPr>, <w:pStyle> ecc. che hanno altri caratteri dopo <w:p)
    let pStart = idx - 1;
    while (pStart >= 4) {
        if (
            xml[pStart]   === '<' &&
            xml[pStart+1] === 'w' &&
            xml[pStart+2] === ':' &&
            xml[pStart+3] === 'p' &&
            (xml[pStart+4] === ' ' || xml[pStart+4] === '>')
        ) break;
        pStart--;
    }

    const pEnd = xml.indexOf('</w:p>', idx);
    if (pStart < 4 || pEnd < 0) {
        console.error('[wordExport] Impossibile trovare il paragrafo del marker "' + marker + '"');
        return xml;
    }

    return xml.slice(0, pStart) + replacementXml + xml.slice(pEnd + 6);
}

function injectOoxmlMarkers(zip, audit, getViewUrl, options = {}) {
    const imageRegistry = options.photoMode === 'preview' ? [] : null;
    let xml = zip.files['word/document.xml'].asText();

    const customChecklistId = audit?.metadata?.customChecklistId ?? audit?.custom_checklist_id;
    const isCustomChecklist = customChecklistId && audit?.customChecklist;

    if (isCustomChecklist) {
        xml = replaceMarker(
            xml,
            'CHECKLIST_MARKER',
            buildCustomChecklistSectionOoxml(
                audit.customChecklist,
                audit.customResponses || {},
                audit.attachments || [],
                getViewUrl,
                options,
                imageRegistry
            )
        );
        xml = replaceMarker(
            xml,
            'RILIEVI_MARKER',
            buildCustomRileviSummaryOoxml(audit.customChecklist, audit.customResponses || {})
        );
    } else {
        xml = replaceMarker(
            xml,
            'CHECKLIST_MARKER',
            buildChecklistSectionOoxml(
                audit.checklist,
                audit.attachments           || [],
                audit.pendingIssues         || [],
                getViewUrl,
                options,
                imageRegistry,
                audit.certificationFindings || [],
                audit.normExcerpts          || {}
            )
        );
        xml = replaceMarker(
            xml,
            'RILIEVI_MARKER',
            buildRileviSummaryOoxml(audit.checklist, audit.pendingIssues || [])
        );
    }

    // Margini stretti (1.27 cm = 720 DXA) — sostituisce i margini del template
    // senza toccare il file .docx sorgente (evita manipolazione binaria)
    xml = xml.replace(
        /w:top="\d+" w:right="\d+" w:bottom="\d+" w:left="\d+"([^/]*w:header)/,
        'w:top="720" w:right="720" w:bottom="720" w:left="720"$1'
    );

    xml = fixWordXmlMojibake(xml);
    xml = repairWordDocumentXmlMalformedAttrs(xml);
    zip.file('word/document.xml', xml);

    // Embedded images: aggiungi file media + relazioni nel zip
    if (imageRegistry && imageRegistry.length > 0) {
        embedImagesInZip(zip, imageRegistry);
    }
}

/**
 * Ogni parte in word/media/ DEVE avere un Default in [Content_Types].xml.
 * Molti template (es. Verbale) hanno solo png: senza jpg/jpeg/gif Word segnala "contenuto illeggibile".
 */
function ensureImageContentTypesInZip(zip, extensions) {
    const ctPath = '[Content_Types].xml';
    let ct = zip.files[ctPath]?.asText();
    if (!ct || !ct.includes('</Types>')) return;

    const EXT_TO_CT = {
        jpg:  'image/jpeg',
        jpeg: 'image/jpeg',
        png:  'image/png',
        gif:  'image/gif',
    };

    const unique = [...new Set((extensions || []).map((e) => String(e || '').toLowerCase()))];
    let lo = ct.toLowerCase();
    let added = 0;
    for (const ext of unique) {
        const contentType = EXT_TO_CT[ext];
        if (!contentType) continue;
        if (lo.includes(`extension="${ext}"`)) continue;
        ct = ct.replace('</Types>', `<Default Extension="${ext}" ContentType="${contentType}"/></Types>`);
        lo = ct.toLowerCase(); // aggiorna dopo inserimento (ext sempre minuscolo)
        added++;
    }
    if (added > 0) {
        zip.file(ctPath, ct);
        console.log(`[wordExport] [Content_Types].xml: aggiunti ${added} Default per estensioni media.`);
    }
}

/**
 * Aggiunge le immagini al zip Word e aggiorna il file delle relazioni.
 * @param {PizZip} zip
 * @param {Array<{rId,imgId,base64,mimeType,ext}>} imageRegistry
 */
function embedImagesInZip(zip, imageRegistry) {
    // Leggi relazioni esistenti
    const relsPath = 'word/_rels/document.xml.rels';
    let relsXml = zip.files[relsPath]?.asText() || '';
    if (!relsXml || !relsXml.includes('<Relationships')) {
        relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    }

    imageRegistry.forEach(({ rId, base64, mimeType, ext }) => {
        // Strip il prefisso data URL: "data:image/jpeg;base64,..."
        const b64Data = base64.includes(',') ? base64.split(',')[1] : base64;

        // Scrivi nel zip come file binario
        const mediaPath = `word/media/${rId}.${ext}`;
        zip.file(mediaPath, b64Data, { base64: true });

        // Aggiungi relazione
        const relEntry = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${rId}.${ext}"/>`;
        if (!relsXml.includes(`Id="${rId}"`)) {
            relsXml = relsXml.replace('</Relationships>', relEntry + '</Relationships>');
        }
    });

    zip.file(relsPath, relsXml);
    ensureImageContentTypesInZip(zip, imageRegistry.map((r) => r.ext));
    console.log(`[wordExport] ${imageRegistry.length} immagini embedded nel documento.`);
}

async function generateDocxBlob(audit, getViewUrl, options = {}) {
    const customChecklistId = options.customChecklistId ?? audit?.metadata?.customChecklistId ?? audit?.custom_checklist_id;
    const isCustomChecklist = customChecklistId && (audit?.customChecklist || audit?.customResponses);

    let templateUrl;
    const getTemplateResolver = options.getTemplateResolver;

    // Checklist custom: sempre template verbale (o da API se resolver ok). Senza questo blocco,
    // se manca getTemplateResolver si cascava nel ramo ISO e si usava ISO9001-audit-report.docx.
    if (isCustomChecklist) {
        if (getTemplateResolver && typeof getTemplateResolver === 'function') {
            try {
                const resolved = await getTemplateResolver();
                if (resolved?.url) {
                    templateUrl = resolved.url;
                    console.log('[wordExport] Template risolto da API (checklist custom):', resolved.name || templateUrl);
                }
            } catch (e) {
                console.warn('[wordExport] Risoluzione template custom fallita:', e.message);
            }
        }
        if (!templateUrl) {
            templateUrl = TEMPLATE_MAP.custom_checklist || TEMPLATE_MAP.default;
        }
    }

    if (!templateUrl) {
        const rawKey    = options.standardKey || null;
        const normKey   = rawKey ? normalizeStdKey(rawKey) : null;

        // Filtra la checklist alla sola norma richiesta.
        let checklistFiltered = audit.checklist || {};
        if (normKey) {
            const matchKey = Object.keys(checklistFiltered)
                .find(k => normalizeStdKey(k) === normKey);
            checklistFiltered = matchKey
                ? { [matchKey]: checklistFiltered[matchKey] }
                : { [normKey]: {} };
        }

        const stdKey = normKey || Object.keys(checklistFiltered)[0];
        templateUrl = getTemplateUrl(stdKey || 'default');
        if (getTemplateResolver && typeof getTemplateResolver === 'function') {
            const stdId = STANDARD_KEY_TO_ID[stdKey] ?? STANDARD_KEY_TO_ID[normalizeStdKey(stdKey)];
            if (stdId) {
                try {
                    const resolved = await getTemplateResolver(stdId);
                    if (resolved?.url) {
                        templateUrl = resolved.url;
                        console.log('[wordExport] Template risolto da API:', resolved.name || templateUrl);
                    }
                } catch (e) {
                    console.warn('[wordExport] Risoluzione template API fallita, uso TEMPLATE_MAP:', e.message);
                }
            }
        }
    }

    const auditForGen = isCustomChecklist
        ? { ...audit, checklist: audit.checklist || {} }
        : (() => {
            const rawKey = options.standardKey || null;
            const normKey = rawKey ? normalizeStdKey(rawKey) : null;
            let checklistFiltered = audit.checklist || {};
            if (normKey) {
                const matchKey = Object.keys(checklistFiltered).find(k => normalizeStdKey(k) === normKey);
                checklistFiltered = matchKey ? { [matchKey]: checklistFiltered[matchKey] } : { [normKey]: {} };
            }
            return { ...audit, checklist: checklistFiltered };
        })();
    let arrayBuffer;
    try {
        const resp = await fetch(templateUrl, { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        arrayBuffer = await resp.arrayBuffer();
    } catch (e) {
        throw new Error(
            'Impossibile caricare il template "' + templateUrl + '": ' + e.message + '\n' +
            'Esegui: node scripts/generateTemplate.js'
        );
    }

    const zip = new PizZip(arrayBuffer);
    normalizeNegativeTableIndentsInZip(zip);
    preprocessDocxtemplaterPartsInZip(zip);
    const docPath = 'word/document.xml';
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks:    true,
        nullGetter()   { return ''; },
    });

    doc.render(buildTemplateData(auditForGen));
    const processedZip = doc.getZip();
    // Dopo il render il template puo reintrodurre w:p annidati o attributi senza quote.
    if (processedZip.files[docPath]) {
        processedZip.file(
            docPath,
            repairWordDocumentXmlMalformedAttrs(processedZip.files[docPath].asText())
        );
    }

    if (options.photoMode === 'preview') {
        await preloadImagesIntoAudit(auditForGen, getViewUrl);
    }
    injectOoxmlMarkers(processedZip, auditForGen, getViewUrl, options);

    const logoUrl = auditForGen?.embedCompanyLogo?.dataUrl;
    if (logoUrl) {
        try {
            injectCompanyLogoInZip(processedZip, logoUrl);
        } catch (e) {
            console.warn('[wordExport] Inserimento logo fallito:', e.message);
        }
    }

    const orgLogoUrl = auditForGen?.embedOrganizationLogo?.dataUrl;
    if (orgLogoUrl) {
        try {
            injectOrganizationLogoInZip(processedZip, orgLogoUrl);
        } catch (e) {
            console.warn('[wordExport] Inserimento logo organizzazione fallito:', e.message);
        }
    }

    applyMojibakeFixToWordXmlPartsInZip(processedZip);

    return processedZip.generate({
        type:     'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
}

/**
 * Pre-carica le immagini degli allegati come base64 per l'embedding nel Word.
 * Modifica audit.attachments in-place aggiungendo imageBase64.
 */
async function preloadImagesIntoAudit(audit, getViewUrl) {
    // Word support affidabile: evita webp in embedding, mantiene fallback a link.
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const attachments = audit.attachments || [];
    await Promise.allSettled(
        attachments.map(async (att) => {
            // Prima verifica: tipo salvato nel DB
            const storedMimeType = normalizeMimeType(att.mimeType);
            if (!imageTypes.includes(storedMimeType)) return;
            const id = att.serverAttachmentId || att.id;
            if (!id) return;
            try {
                const url = getViewUrl(id);
                const resp = await fetch(url);
                if (!resp.ok) return;
                const blob = await resp.blob();
                // Seconda verifica: tipo REALE restituito dal server
                // Se il server dice che è un PDF o altro, non lo trattiamo come immagine
                const realMimeType = normalizeMimeType(blob.type || storedMimeType);
                if (!imageTypes.includes(realMimeType)) {
                    console.warn('[wordExport] allegato ignorato: tipo reale non è immagine', { stored: att.mimeType, real: realMimeType, id });
                    return;
                }
                att.imageBase64   = await blobToBase64(blob);
                att.imageMimeType = realMimeType;
            } catch (e) {
                console.warn('[wordExport] preload image failed for att', id, e.message);
            }
        })
    );
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function buildFileName(audit, standardKey = null) {
    const client = (audit.metadata?.clientName  || 'Cliente').replace(/[^a-z0-9]/gi, '_');
    const number = (audit.metadata?.auditNumber || 'N-A').replace(/[^a-z0-9]/gi, '_');
    const stdSuffix = standardKey ? '_' + standardKey.replace(/^ISO_/, 'ISO').replace(/_/g, '') : '';
    return 'Audit_' + number + '_' + client + stdSuffix + '.docx';
}

// ─── API pubblica (firma invariata rispetto alla versione precedente) ─────────

export async function exportAuditToWord(audit, getViewUrl = null, options = {}) {
    if (!audit?.metadata) throw new Error('Audit non valido: metadata mancante');
    const blob     = await generateDocxBlob(audit, getViewUrl, options);
    const fileName = buildFileName(audit, options.standardKey || null);
    saveAs(blob, fileName);
    return fileName;
}

// Entry tecnico per test/investigazione: genera blob DOCX senza saveAs.
export async function generateAuditDocxBlobForTesting(audit, getViewUrl = null, options = {}) {
    if (!audit?.metadata) throw new Error('Audit non valido: metadata mancante');
    return generateDocxBlob(audit, getViewUrl, options);
}

export async function exportAuditToFileSystem(audit, getViewUrl = null, options = {}) {
    if (!audit?.metadata) throw new Error('Audit non valido: metadata mancante');
    if (!window.showDirectoryPicker) {
        const fileName = await exportAuditToWord(audit, getViewUrl, options);
        return { success: true, path: 'Download/' + fileName, fileName, fallback: true };
    }
    try {
        const dirHandle    = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'documents' });
        const auditFolder  = await dirHandle.getDirectoryHandle('Audit',  { create: true });
        const year         = audit.metadata.projectYear || new Date().getFullYear();
        const clientName   = (audit.metadata.clientName || 'Cliente').replace(/[^a-z0-9]/gi, '_');
        const clientFolder = await auditFolder.getDirectoryHandle(year + '-' + clientName, { create: true });
        const blob         = await generateDocxBlob(audit, getViewUrl, options);
        const fileName     = buildFileName(audit);
        const fileHandle   = await clientFolder.getFileHandle(fileName, { create: true });
        const writable     = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return { success: true, path: 'Audit/' + year + '-' + clientName + '/' + fileName, fileName };
    } catch (error) {
        if (error.name === 'AbortError') throw new Error('Salvataggio annullato');
        throw error;
    }
}

export async function exportAuditToWorkspace(audit, fsProvider, getViewUrl = null, options = {}) {
    if (!audit?.metadata) throw new Error('Audit non valido: metadata mancante');
    if (!window.showDirectoryPicker || !fsProvider?.ready()) {
        const fileName = await exportAuditToWord(audit, getViewUrl, options);
        return { success: true, path: 'Download/' + fileName, fileName, fallback: true };
    }
    try {
        const blob      = await generateDocxBlob(audit, getViewUrl, options);
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const client    = (audit.metadata.clientName  || 'Cliente').replace(/[^a-z0-9]/gi, '_');
        const number    = (audit.metadata.auditNumber || 'N-A').replace(/[^a-z0-9]/gi, '_');
        const fileName  = 'Audit_' + number + '_' + client + '_' + timestamp + '.docx';
        const result    = await fsProvider.saveReport(blob, fileName);
        return { success: true, path: result.path, fileName: result.fileName };
    } catch (error) {
        throw new Error('Errore salvataggio report: ' + error.message);
    }
}
