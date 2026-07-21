/**
 * wordExportHelpers.js
 * Genera stringhe OOXML raw per le sezioni dinamiche del report audit.
 *
 * COSA MODIFICARE QUI (senza toccare il template Word):
 *   - Colori celle per stato: STATUS_CFG
 *   - Struttura tabella checklist: buildClauseTableOoxml()
 *   - Struttura tabella riepilogo: buildRileviSummaryOoxml()
 *
 * COSA MODIFICARE NEL TEMPLATE .docx (senza toccare il codice):
 *   - Header: logo, nome azienda, stile
 *   - Footer: numeri di pagina, testo legale
 *   - Font, colori testo, margini, stili titoli
 *   => Apri app/public/templates/ISO9001-audit-report.docx in Word
 */

// Nomi leggibili dei standard — aggiungere qui nuovi standard
const STANDARD_LABELS = {
    ISO_9001:        'ISO 9001:2015 - Sistema di Gestione per la Qualit\u00e0',
    ISO_9001_2015:   'ISO 9001:2015 - Sistema di Gestione per la Qualit\u00e0',
    ISO_14001:       'ISO 14001:2015 - Sistema di Gestione Ambientale',
    ISO_14001_2015:  'ISO 14001:2015 - Sistema di Gestione Ambientale',
    ISO_45001:       'ISO 45001:2018 - Sistema di Gestione per la Salute e Sicurezza',
    ISO_45001_2018:  'ISO 45001:2018 - Sistema di Gestione per la Salute e Sicurezza',
    ISO_3834_2:      'ISO 3834-2 - Checklist Audit Fornitori in Campo',
    ISO_3834_2_2021: 'ISO 3834-2 - Checklist Audit Fornitori in Campo',
    RDP_MSN:         'ISO 3834-2:2021 - Rapporto di Prova (Audit di sistema Mason)',
};

/**
 * Estrae il numero di sezione dalla chiave della clausola.
 * "14001_s4" → "4",  "clause4" → "4",  "section_10" → "10", "9001_p2" → "2"
 */
function extractSectionNum(key) {
    const afterMarker = key.match(/[_-][a-z](\d+)$/i);      // es. _s4, _p2
    if (afterMarker) return afterMarker[1];
    const nums = key.match(/\d+/g);
    if (nums && nums.length >= 2) return nums[nums.length - 1]; // es. 14001_4 → "4"
    return nums ? nums[0] : key;
}

export const STATUS_CFG = {
    C:           { label: 'Conforme',           fill: 'D1FAE5', text: '065F46' },
    NC:          { label: 'Non Conforme',        fill: 'FEE2E2', text: '991B1B' },
    OSS:         { label: 'Osservazione',        fill: 'FEF3C7', text: '92400E' },
    OM:          { label: 'Opp. Miglioramento',  fill: 'DBEAFE', text: '1E40AF' },
    NA:          { label: 'Non Applicabile',     fill: 'E5E7EB', text: '374151' },
    NV:          { label: 'Non Valutato',        fill: 'F3E8FF', text: '6B21A8' },
    NOT_ANSWERED:{ label: '-',             fill: 'FFFFFF', text: '000000' },
};

/** Escape obbligatorio per inserire testo in XML */
export function escXml(val) {
    if (val == null) return '';
    // XML 1.0 non accetta alcuni control chars: rimuovili per evitare DOCX corrotti.
    const cleaned = String(val).replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, '');
    return cleaned
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Contatori NC/C/OSS/OM/NA/NV/totali */
export function calculateMetrics(checklist) {
    const m = { totalC:0, totalNC:0, totalOSS:0, totalOM:0, totalNA:0, totalNV:0,
                totalNotAnswered:0, total:0, answered:0 };
    if (!checklist) return m;
    Object.values(checklist).forEach(normData => {
        if (!normData || typeof normData !== 'object') return;
        Object.values(normData).forEach(clause => {
            if (!clause?.questions) return;
            clause.questions.forEach(q => {
                m.total++;
                switch (q.status) {
                    case 'C':   m.totalC++;   m.answered++; break;
                    case 'NC':  m.totalNC++;  m.answered++; break;
                    case 'OSS': m.totalOSS++; m.answered++; break;
                    case 'OM':  m.totalOM++;  m.answered++; break;
                    case 'NA':  m.totalNA++;  m.answered++; break;
                    case 'NV':  m.totalNV++;  m.answered++; break;
                    default:    m.totalNotAnswered++;
                }
            });
        });
    });
    return m;
}

// ─── Micro-helpers OOXML ───────────────────────────────────────────────────────
function xmlRun(text, opts = {}) {
    const b  = opts.bold  ? '<w:b/>'  : '';
    const i  = opts.ital  ? '<w:i/>'  : '';
    const c  = opts.color ? `<w:color w:val="${opts.color}"/>` : '';
    const sz = opts.size  ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : '';
    const rPr = (b||i||c||sz) ? `<w:rPr>${b}${i}${c}${sz}</w:rPr>` : '';
    const t   = String(text ?? '');
    const sp  = (t.startsWith(' ') || t.endsWith(' ')) ? ' xml:space="preserve"' : '';
    return `<w:r>${rPr}<w:t${sp}>${escXml(t)}</w:t></w:r>`;
}

function xmlPara(content, opts = {}) {
    const style = opts.style    ? `<w:pStyle w:val="${opts.style}"/>` : '';
    const jc    = opts.align    ? `<w:jc w:val="${opts.align}"/>` : '';
    const sp    = (opts.sb != null || opts.sa != null)
        ? `<w:spacing w:before="${opts.sb ?? 0}" w:after="${opts.sa ?? 160}"/>` : '';
    const pb    = opts.pageBreak ? '<w:pageBreakBefore/>' : '';
    const pPr   = (style||jc||sp||pb) ? `<w:pPr>${style}${jc}${sp}${pb}</w:pPr>` : '';
    const body  = Array.isArray(content)
        ? content.join('')
        : (typeof content === 'string' && content.startsWith('<w:'))
            ? content
            : xmlRun(content, opts);
    return `<w:p>${pPr}${body}</w:p>`;
}

function xmlCell(content, opts = {}) {
    const span = opts.span ? `<w:gridSpan w:val="${opts.span}"/>` : '';
    const w    = opts.dxa  ? `<w:tcW w:w="${opts.dxa}" w:type="dxa"/>` :
                 opts.pct  ? `<w:tcW w:w="${opts.pct * 50}" w:type="pct"/>` : '';
    const fill = opts.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${opts.fill}"/>` : '';
    const va   = `<w:vAlign w:val="${opts.va ?? 'center'}"/>`;
    const ml   = opts.ml ?? 100, mr = opts.mr ?? 100;
    const mar  = `<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="${ml}" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="${mr}" w:type="dxa"/></w:tcMar>`;
    const tcPr = `<w:tcPr>${span}${w}${fill}${va}${mar}</w:tcPr>`;
    const body = (typeof content === 'string' && content.startsWith('<w:')) ? content : xmlPara(content);
    return `<w:tc>${tcPr}${body}</w:tc>`;
}

function xmlRow(cells, opts = {}) {
    const trPr = opts.header ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
    return `<w:tr w:rsidR="00AA0000">${trPr}${cells.join('')}</w:tr>`;
}

const STD_BORDERS = [
    '<w:tblBorders>',
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>',
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>',
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>',
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>',
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>',
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>',
    '</w:tblBorders>',
].join('');

function xmlTable(rows, colWidths = [], pct = 100, useDxa = false) {
    if (useDxa) {
        const totalDxa = colWidths.reduce((s, w) => s + w, 0);
        const grid = colWidths.length
            ? `<w:tblGrid>${colWidths.map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
            : '<w:tblGrid/>';
        return `<w:tbl><w:tblPr><w:tblW w:w="${totalDxa}" w:type="dxa"/>${STD_BORDERS}<w:tblLayout w:type="fixed"/></w:tblPr>${grid}${rows.join('')}</w:tbl>`;
    }
    const grid = colWidths.length
        ? `<w:tblGrid>${colWidths.map(p => `<w:gridCol w:w="${p * 50}"/>`).join('')}</w:tblGrid>`
        : '<w:tblGrid/>';
    return `<w:tbl><w:tblPr><w:tblW w:w="${pct * 50}" w:type="pct"/>${STD_BORDERS}</w:tblPr>${grid}${rows.join('')}</w:tbl>`;
}

// ─── Rilievi pendenti ──────────────────────────────────────────────────────────
// Mostra TUTTI i rilievi con relativo stato di risoluzione (risolto/persiste/in corso/aperto).
// I rilievi risolti sono mostrati in verde per dare visibilita' al lavoro svolto nel re-audit.
function buildPendingIssuesOoxml(pendingIssues = []) {
    const all = pendingIssues || [];
    if (!all.length)
        return xmlPara('Nessun rilievo pendente da audit precedenti.', { ital: true, sa: 400 });

    const S = {
        open:        { label: 'Aperto',      fill: 'FEE2E2', text: '991B1B' },
        in_progress: { label: 'In corso',    fill: 'FEF3C7', text: '92400E' },
        persists:    { label: 'Persiste',    fill: 'FEE2E2', text: '991B1B' },
        resolved:    { label: 'Risolto',     fill: 'D1FAE5', text: '065F46' },
    };
    // Colonne: Rif. | Descrizione | Rilievo orig. | Audit sorg. | Stato risoluzione
    const PCT = [8, 38, 10, 24, 20];

    const headerRow = xmlRow([
        xmlCell(xmlPara(xmlRun('Rif.',              { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[0] }),
        xmlCell(xmlPara(xmlRun('Descrizione',       { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[1] }),
        xmlCell(xmlPara(xmlRun('Tipo',              { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[2] }),
        xmlCell(xmlPara(xmlRun('Audit precedente',  { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[3] }),
        xmlCell(xmlPara(xmlRun('Stato risoluzione', { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[4] }),
    ], { header: true });

    const dataRows = all.map(pi => {
        const rawStatus = pi.issue_status || pi.status || 'open';
        const sCfg      = S[rawStatus] || S.open;
        const origType  = pi.original_status || pi.conformity_status || '';
        const refNote   = pi.resolution_notes || pi.follow_up_notes || pi.resolutionNotes || '';
        const sourceRef = pi.originAuditNumber || pi.source_audit_number ||
                          (pi.source_audit_id ? 'Audit ID ' + pi.source_audit_id : '-');

        const descBody  = xmlPara(escXml(
            pi.question_text || pi.description || pi.nc_description || 'N/D'
        )) + (refNote
            ? xmlPara(xmlRun('\u21b3 ' + refNote, { ital: true, color: '6B7280' }), { sb: 60, sa: 0 })
            : '');

        return xmlRow([
            xmlCell(xmlPara(escXml(pi.section_code || pi.clause || '-'), { align: 'center' }), { pct: PCT[0] }),
            xmlCell(descBody, { pct: PCT[1] }),
            xmlCell(xmlPara(escXml(origType), { align: 'center' }), { pct: PCT[2] }),
            xmlCell(xmlPara(escXml(sourceRef), { align: 'center' }), { pct: PCT[3] }),
            xmlCell(
                xmlPara(xmlRun(sCfg.label, { bold: true, color: sCfg.text }), { align: 'center' }),
                { fill: sCfg.fill, pct: PCT[4] }
            ),
        ]);
    });

    return xmlTable([headerRow, ...dataRows], PCT);
}

// ─── Hyperlink cliccabile in Word (fldSimple — non richiede modifica rels) ────
// Produce: <w:p>...<w:fldSimple w:instr=" HYPERLINK "url" ">..link testo..</w:fldSimple></w:p>
export function xmlHyperlinkPara(url, displayText, opts = {}) {
    const color = opts.color || '1E40AF';
    const sz = opts.size ? `<w:sz w:val="${opts.size}"/><w:szCs w:val="${opts.size}"/>` : '';
    const escapedUrl = escXml(url);
    return (
        `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr>` +
        `<w:fldSimple w:instr=" HYPERLINK &quot;${escapedUrl}&quot; ">` +
        `<w:r><w:rPr><w:color w:val="${color}"/><w:u w:val="single"/>${sz}</w:rPr>` +
        `<w:t xml:space="preserve">${escXml(displayText)}</w:t></w:r>` +
        `</w:fldSimple></w:p>`
    );
}

// ─── Helpers immagini embedded ────────────────────────────────────────────────
// Nota compatibilita Word: WEBP puo causare documenti corrotti/non apribili in alcune versioni.
// Embed consentito solo per formati stabili (jpg/png/gif). WEBP resta disponibile come link.
const IMAGE_EXTS = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif' };
const IMAGE_MIME_TYPES = new Set(Object.keys(IMAGE_EXTS));

function normalizeMimeType(mimeType) {
    return String(mimeType || '').split(';')[0].trim().toLowerCase();
}

/** Estensione media Word da Content-Type (solo formati embeddabili in modo affidabile). */
export function wordEmbeddableExtFromMime(mime) {
    if (!mime) return null;
    const m = String(mime).split(';')[0].trim().toLowerCase();
    return IMAGE_EXTS[m] || null;
}

/** Run OOXML con immagine inline (stesso schema delle foto in checklist). */
export function buildWordInlineImageRun(rId, imgId, widthEmu = 1905000, heightEmu = 1428750) {
    return xmlImageOoxml(rId, imgId, widthEmu, heightEmu);
}

// Max display size allegati checklist in Word (~5.3 cm larghezza, altezza fino ~11 cm per portrait)
const CHECKLIST_IMAGE_MAX_W_EMU = 1905000;
const CHECKLIST_IMAGE_MAX_H_EMU = 4286250;

function stripDataUrlBase64(imageBase64) {
    if (!imageBase64 || typeof imageBase64 !== 'string') return '';
    return imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
}

/**
 * Legge dimensioni pixel da base64 di immagine PNG o JPEG (sincrono, senza DOM).
 * Ritorna { w, h } o null se formato non riconosciuto.
 */
export function getImagePixelDimensions(base64Data, mime) {
    try {
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const m = String(mime || '').split(';')[0].trim().toLowerCase();

        if (m === 'image/png') {
            if (bytes.length < 24) return null;
            const w = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
            const h = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
            return { w: w >>> 0, h: h >>> 0 };
        }
        if (m === 'image/jpeg' || m === 'image/jpg') {
            let i = 0;
            while (i < bytes.length - 10) {
                if (bytes[i] !== 0xFF) { i++; continue; }
                const marker = bytes[i + 1];
                if (marker >= 0xC0 && marker <= 0xC3) {
                    return { w: (bytes[i + 7] << 8) | bytes[i + 8], h: (bytes[i + 5] << 8) | bytes[i + 6] };
                }
                if (marker === 0xD8 || marker === 0xFF) { i++; continue; }
                const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
                i += 2 + (segLen > 0 ? segLen : 1);
            }
            return null;
        }
        return null;
    } catch { return null; }
}

/**
 * Legge tag EXIF Orientation (1-8) da JPEG. Ritorna 1 se assente o non JPEG.
 */
export function getJpegExifOrientation(base64Data, mime) {
    try {
        const m = String(mime || '').split(';')[0].trim().toLowerCase();
        if (m !== 'image/jpeg' && m !== 'image/jpg') return 1;
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        let i = 2;
        while (i < bytes.length - 4) {
            if (bytes[i] !== 0xFF) { i++; continue; }
            const marker = bytes[i + 1];
            if (marker === 0xDA) break;
            if (marker === 0xE1) {
                const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
                if (segLen >= 8
                    && bytes[i + 4] === 0x45 && bytes[i + 5] === 0x78
                    && bytes[i + 6] === 0x69 && bytes[i + 7] === 0x66
                    && bytes[i + 8] === 0 && bytes[i + 9] === 0) {
                    const tiffStart = i + 10;
                    const le = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
                    const be = bytes[tiffStart] === 0x4D && bytes[tiffStart + 1] === 0x4D;
                    if (!le && !be) return 1;
                    const u16 = (o) => (le
                        ? bytes[tiffStart + o] | (bytes[tiffStart + o + 1] << 8)
                        : (bytes[tiffStart + o] << 8) | bytes[tiffStart + o + 1]);
                    const u32 = (o) => (le
                        ? bytes[tiffStart + o]
                            | (bytes[tiffStart + o + 1] << 8)
                            | (bytes[tiffStart + o + 2] << 16)
                            | (bytes[tiffStart + o + 3] << 24)
                        : (bytes[tiffStart + o] << 24)
                            | (bytes[tiffStart + o + 1] << 16)
                            | (bytes[tiffStart + o + 2] << 8)
                            | bytes[tiffStart + o + 3]);
                    const ifd0 = tiffStart + u32(4);
                    if (ifd0 + 2 > bytes.length) return 1;
                    const nTags = u16(ifd0 - tiffStart);
                    for (let t = 0; t < nTags; t++) {
                        const tagOff = ifd0 - tiffStart + 2 + t * 12;
                        if (tagOff + 10 > bytes.length) break;
                        if (u16(tagOff) === 0x0112) {
                            const val = u16(tagOff + 8);
                            return val >= 1 && val <= 8 ? val : 1;
                        }
                    }
                    return 1;
                }
                i += 2 + segLen;
                continue;
            }
            if (marker === 0xD8 || marker === 0xFF) { i++; continue; }
            const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
            i += 2 + (segLen > 0 ? segLen : 1);
        }
        return 1;
    } catch { return 1; }
}

/** Dimensioni pixel effettive per layout (scambia w/h se EXIF richiede rotazione 90°). */
export function getDisplayImagePixelDimensions(base64Data, mime) {
    const dims = getImagePixelDimensions(base64Data, mime);
    if (!dims) return null;
    const orientation = getJpegExifOrientation(base64Data, mime);
    if (orientation >= 5 && orientation <= 8) {
        return { w: dims.h, h: dims.w };
    }
    return dims;
}

/** true se JPEG ha tag EXIF Orientation diverso da 1 (Word non lo applica). */
export function jpegNeedsExifNormalization(base64Data, mime) {
    const m = normalizeMimeType(mime);
    if (m !== 'image/jpeg' && m !== 'image/jpg') return false;
    return getJpegExifOrientation(base64Data, mime) !== 1;
}

/** Matrice canvas per ogni valore EXIF Orientation (1-8). */
function applyExifTransformToCanvas(ctx, orientation, width, height) {
    switch (orientation) {
        case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
        case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
        case 7: ctx.transform(0, -1, -1, 0, height, width); break;
        case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
        default: break;
    }
}

function canvasToDataUrl(canvas, mime) {
    const outMime = mime === 'image/png' ? 'image/png' : 'image/jpeg';
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        }, outMime, 0.92);
    });
}

/**
 * Ruota/riflette i pixel JPEG secondo EXIF e restituisce data URL orientation=1.
 * Word embedded ignora EXIF: senza questo passaggio le foto smartphone appaiono "sdraiate".
 */
export async function normalizeImageDataUrlForWordEmbed(dataUrl, mimeType) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        return dataUrl;
    }
    const mime = normalizeMimeType(mimeType || dataUrl.split(';')[0].replace('data:', ''));
    const b64 = stripDataUrlBase64(dataUrl);
    const orientation = getJpegExifOrientation(b64, mime);
    if (orientation === 1 || typeof document === 'undefined') return dataUrl;

    try {
        const rawDims = getImagePixelDimensions(b64, mime);
        const blob = await fetch(dataUrl).then((r) => r.blob());

        if (typeof createImageBitmap === 'function') {
            const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                bitmap.close?.();
                return dataUrl;
            }
            ctx.drawImage(bitmap, 0, 0);
            bitmap.close?.();
            const normalized = await canvasToDataUrl(canvas, mime);
            return normalized || dataUrl;
        }

        const objectUrl = URL.createObjectURL(blob);
        try {
            const img = await new Promise((resolve, reject) => {
                const el = new Image();
                el.onload = () => resolve(el);
                el.onerror = reject;
                el.src = objectUrl;
            });
            const rawW = rawDims?.w || img.naturalWidth;
            const rawH = rawDims?.h || img.naturalHeight;
            const swap = orientation >= 5 && orientation <= 8;
            const canvas = document.createElement('canvas');
            canvas.width = swap ? rawH : rawW;
            canvas.height = swap ? rawW : rawH;
            const ctx = canvas.getContext('2d');
            if (!ctx) return dataUrl;
            applyExifTransformToCanvas(ctx, orientation, rawW, rawH);
            ctx.drawImage(img, 0, 0, rawW, rawH);
            const normalized = await canvasToDataUrl(canvas, mime);
            return normalized || dataUrl;
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    } catch {
        return dataUrl;
    }
}

function embeddedImageEmuFromBase64(imageBase64, mimeType) {
    const b64 = stripDataUrlBase64(imageBase64);
    const mime = normalizeMimeType(mimeType);
    const dims = getDisplayImagePixelDimensions(b64, mime);
    return scaleImageToMaxEmu(
        dims?.w, dims?.h, CHECKLIST_IMAGE_MAX_W_EMU, CHECKLIST_IMAGE_MAX_H_EMU
    );
}

/**
 * Scala EMU mantenendo le proporzioni originali entro maxWidthEmu e maxHeightEmu.
 * Se le dimensioni reali non sono disponibili usa il fallback (rapporto 4:3).
 */
export function scaleImageToMaxEmu(pixW, pixH, maxWidthEmu, maxHeightEmu) {
    if (!pixW || !pixH || pixW <= 0 || pixH <= 0) {
        const cy = Math.min(Math.round(maxWidthEmu * 0.75), maxHeightEmu);
        return { cx: maxWidthEmu, cy };
    }
    const ratio = pixH / pixW;
    let cx = maxWidthEmu;
    let cy = Math.round(cx * ratio);
    if (cy > maxHeightEmu) {
        cy = maxHeightEmu;
        cx = Math.round(cy / ratio);
    }
    return { cx, cy };
}

/** Genera OOXML per un'immagine embedded con dimensioni EMU esplicite. */
function xmlImageOoxml(rId, imgId, widthEmu = 1905000, heightEmu = 1428750) {
    const name = `img${imgId}`;
    // cNvPr id deve essere univoco nel documento: usare imgId (non 0 fisso).
    return `<w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:docPr id="${imgId}" name="${name}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${imgId}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

// ─── Tabella singola clausola ──────────────────────────────────────────────────
// Larghezze colonne in DXA (1cm ≈ 567 DXA) con margini stretti 1.27cm:
//   Col1: 3.70cm = 2098 DXA  |  Col2: 2.70cm = 1531 DXA  |  Col3: 12.07cm = 6844 DXA
const CLAUSE_COL_DXA = [2098, 1531, 6844];

// ─── Mini-parser Markdown per norm_excerpt ────────────────────────────────────
/**
 * Converte testo con mini-markup in OOXML.
 * Supporta:
 *   | col | col |   → riga tabella (prima riga = header, riga |---|---| ignorata)
 *   - testo         → punto elenco
 *   **testo**       → grassetto inline
 *   testo normale   → paragrafo corsivo
 */

/** Converte "**a** normale **b**" in serie di xmlRun */
function parseInlineMarkdown(text, baseOpts = {}) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
        i % 2 === 0
            ? xmlRun(escXml(part), { ital: true,  color: '2D6A4F', size: 18, ...baseOpts })
            : xmlRun(escXml(part), { bold: true,  color: '1E5C30', size: 18 })
    ).join('');
}

/** Riga separatore Markdown: |---|---| */
function isTableSeparator(line) {
    return /^\|[\s\-:|]+\|$/.test(line.trim());
}

/** Converti blocco di righe tabella Markdown in xmlTable OOXML */
function buildMarkdownTableOoxml(tableLines) {
    const rows = tableLines.filter(l => !isTableSeparator(l));
    if (!rows.length) return '';

    // Calcola numero colonne dalla prima riga
    const parseCells = (line) =>
        line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());

    const numCols  = parseCells(rows[0]).length;
    const pct      = Math.floor(100 / numCols);
    const colPcts  = Array(numCols).fill(pct);

    const ooxmlRows = rows.map((line, rowIdx) => {
        const cells = parseCells(line);
        const isHdr = rowIdx === 0;
        return xmlRow(
            cells.map(cell =>
                xmlCell(
                    xmlPara(
                        isHdr
                            ? xmlRun(escXml(cell), { bold: true, size: 18, color: '1E5C30' })
                            : parseInlineMarkdown(cell),
                        { align: 'center', sa: 0, sb: 0 }
                    ),
                    { fill: isHdr ? 'C8E6C9' : 'FFFFFF', pct }
                )
            ),
            { header: isHdr }
        );
    });

    return xmlTable(ooxmlRows, colPcts);
}

/** Costruisce il contenuto OOXML dello stralcio, interpretando il mini-markup */
function parseNormExcerptContent(text) {
    const lines  = text.split('\n');
    let result   = '';
    let i        = 0;
    let firstBlock = true;

    while (i < lines.length) {
        const line = lines[i];

        // Riga tabella Markdown
        if (line.trim().startsWith('|')) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            if (firstBlock) {
                // Prima del blocco di tabella aggiungi etichetta
                result += xmlPara(
                    xmlRun('\uD83D\uDCCB Rif. normativo:', { bold: true, color: '1E6B31', size: 18 }),
                    { sb: 80, sa: 60 }
                );
                firstBlock = false;
            }
            result += buildMarkdownTableOoxml(tableLines);
            result += xmlPara('', { sa: 60 }); // spazio dopo tabella
            continue;
        }

        // Riga separatore (ignorata se fuori tabella)
        if (isTableSeparator(line)) { i++; continue; }

        // Punto elenco: "- testo" o "• testo"
        if (/^[-•]\s/.test(line.trim())) {
            const content = line.trim().replace(/^[-•]\s/, '');
            const prefix  = firstBlock
                ? xmlRun('\uD83D\uDCCB Rif. normativo:  ', { bold: true, color: '1E6B31', size: 18 })
                : '';
            result += xmlPara(
                [prefix, parseInlineMarkdown(content)].join(''),
                { sb: firstBlock ? 80 : 30, sa: 30 }
            );
            firstBlock = false;
            i++;
            continue;
        }

        // Riga vuota → salta
        if (!line.trim()) { i++; continue; }

        // Testo normale
        const prefix = firstBlock
            ? xmlRun('\uD83D\uDCCB Rif. normativo:  ', { bold: true, color: '1E6B31', size: 18 })
            : '';
        result += xmlPara(
            [prefix, parseInlineMarkdown(line.trim())].join(''),
            { sb: firstBlock ? 80 : 30, sa: 30 }
        );
        firstBlock = false;
        i++;
    }

    return result || xmlPara(
        xmlRun('- stralcio non disponibile', { ital: true, color: '9CA3AF', size: 18 }),
        { sb: 80, sa: 80 }
    );
}

/**
 * Riga "stralcio normativo" a larghezza piena con mini-Markdown.
 * Sfondo verde chiaro (EDF9F0).
 */
function buildNormExcerptRow(excerptText, colWidths) {
    const totalDxa = colWidths.reduce((s, w) => s + w, 0);
    return xmlRow([
        xmlCell(parseNormExcerptContent(excerptText), {
            span: 3, fill: 'EDF9F0', ml: 150, mr: 100, dxa: totalDxa
        })
    ]);
}

function buildClauseTableOoxml(questions = [], auditAttachments = [], getViewUrl = null, options = {}, imageRegistry = null, normExcerpts = {}) {
    const C = CLAUSE_COL_DXA;

    const headerRow = xmlRow([
        xmlCell(xmlPara(xmlRun('Attivit\u00e0/processo',                     { bold: true }), { align: 'center' }), { fill: 'E5E7EB', dxa: C[0] }),
        xmlCell(xmlPara(xmlRun('Valutazione di efficacia',                    { bold: true }), { align: 'center' }), { fill: 'E5E7EB', dxa: C[1] }),
        xmlCell(xmlPara(xmlRun('Dettaglio attivit\u00e0 operative auditate', { bold: true }), { align: 'center' }), { fill: 'E5E7EB', dxa: C[2] }),
    ], { header: true });

    if (!questions.length) {
        return xmlTable([
            headerRow,
            xmlRow([xmlCell(xmlPara('Nessuna domanda presente.', { ital: true }), { span: 3 })]),
        ], C, 100, true);
    }

    const usePreview = options.photoMode === 'preview';
    const allRows = [headerRow];

    questions.forEach(q => {
        const cfg   = STATUS_CFG[q.status] || STATUS_CFG.NOT_ANSWERED;
        const qRef  = q.clauseRef || '';
        const qTxt  = q.question || q.text || 'Domanda non definita';
        const full  = escXml(qRef ? qRef + ' - ' + qTxt : qTxt);
        const notes = (q.notes && q.notes.trim()) ? escXml(q.notes.trim()) : '-';

        const satNote = q.satisfied_by_standard
            ? escXml(`[SAT ${q.satisfied_by_standard}${q.satisfied_by_clause ? ' \u00A7' + q.satisfied_by_clause : ''}${q.satisfied_by_doc_ref ? ' - ' + q.satisfied_by_doc_ref : ''}]`)
            : '';

        const notesContent = satNote
            ? (notes !== '-' ? satNote + '\n' + notes : satNote)
            : notes;

        allRows.push(xmlRow([
            xmlCell(xmlPara(full,  { sa: 0 }), { dxa: C[0], va: 'top' }),
            xmlCell(xmlPara(xmlRun(cfg.label, { bold: true, color: cfg.text }), { align: 'center' }),
                { fill: cfg.fill, dxa: C[1] }),
            xmlCell(xmlPara(notesContent, { sa: 0 }), { dxa: C[2], va: 'top' }),
        ]));

        // Stralcio normativo (solo se presente nel DB — tipico ISO 14001)
        const qId = q.questionId != null ? q.questionId : q.id;
        const excerpt = normExcerpts && qId != null ? (normExcerpts[Number(qId)] || normExcerpts[String(qId)]) : null;
        if (excerpt && excerpt.trim()) {
            allRows.push(buildNormExcerptRow(excerpt.trim(), C));
        }

        const qAtts = qId != null
            ? (auditAttachments || []).filter(a => Number(a.questionId) === Number(qId))
            : [];

        if (qAtts.length) {
            qAtts.forEach(a => {
                const name = a.fileName || a.name || 'File';
                // Priorità ID server: link Word e preload immagini richiedono attachment_id numerico API
                const aId  = a.serverAttachmentId ?? a.attachment_id ?? a.id;
                const url  = (getViewUrl && aId) ? getViewUrl(aId) : null;

                // Usa imageMimeType (verificato dal server) se disponibile, fallback a mimeType
                const effectiveMime = normalizeMimeType(a.imageMimeType || a.mimeType || '');
                // Verifica doppia: tipo MIME è immagine E i dati base64 iniziano con data:image/
                const hasValidImage = IMAGE_MIME_TYPES.has(effectiveMime)
                    && typeof a.imageBase64 === 'string'
                    && a.imageBase64.startsWith('data:image/');

                if (usePreview && hasValidImage) {
                    // Modalità anteprima: immagine embedded + link cliccabile sotto
                    const imgIdx = imageRegistry.length;
                    const rId   = `rId${100 + imgIdx}`;
                    const imgId = 100 + imgIdx;
                    const ext   = IMAGE_EXTS[effectiveMime] || 'jpg';
                    imageRegistry.push({ rId, imgId, base64: a.imageBase64, mimeType: effectiveMime, ext });

                    const { cx, cy } = embeddedImageEmuFromBase64(a.imageBase64, effectiveMime);
                    const imgXml  = xmlImageOoxml(rId, imgId, cx, cy);
                    const linkRow = url
                        ? xmlHyperlinkPara(url, '\uD83D\uDD17 ' + name, { color: '1E40AF', size: 18 })
                        : xmlPara(xmlRun(escXml('\uD83D\uDD17 ' + name), { color: '1E40AF', size: 18 }), { sa: 0 });
                    allRows.push(xmlRow([
                        xmlCell(
                            `<w:p><w:pPr><w:jc w:val="left"/></w:pPr>${imgXml}</w:p>` + linkRow,
                            { span: 3, fill: 'EFF6FF', ml: 150 }
                        ),
                    ]));
                } else {
                    // Modalità solo link (o allegato non-immagine): hyperlink cliccabile
                    const attContent = url
                        ? xmlHyperlinkPara(url, '\uD83D\uDCCE ' + name, { color: '1E40AF', size: 18 })
                        : xmlPara(xmlRun(escXml('\uD83D\uDCCE ' + name), { color: '1E40AF', size: 18 }), { sa: 0 });
                    allRows.push(xmlRow([
                        xmlCell(attContent, { span: 3, fill: 'EFF6FF', ml: 150 }),
                    ]));
                }
            });
        }
    });

    return xmlTable(allRows, C, 100, true);
}

// ─── Rilievi ente certificatore (sezione 1.4) ─────────────────────────────────
function buildCertFindingsOoxml(certFindings = []) {
    if (!certFindings || !certFindings.length)
        return xmlPara('Nessun rilievo dell\'ente certificatore registrato.', { ital: true, sa: 400 });

    const TYPE_COLOR = { NC: 'DC2626', OBS: 'D97706', RIM: '7C3AED' };
    const STATUS_CFG = {
        open:        { label: 'Aperto',   fill: 'FEE2E2', text: '991B1B' },
        in_progress: { label: 'In Corso', fill: 'FEF3C7', text: '92400E' },
        closed:      { label: 'Chiuso',   fill: 'DCFCE7', text: '166534' },
    };
    const PCT = [8, 8, 10, 32, 14, 12, 16];

    const headerRow = xmlRow([
        xmlCell(xmlPara(xmlRun('N°',       { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[0] }),
        xmlCell(xmlPara(xmlRun('Tipo',     { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[1] }),
        xmlCell(xmlPara(xmlRun('Punto',    { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[2] }),
        xmlCell(xmlPara(xmlRun('Descrizione / Azione Correttiva', { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[3] }),
        xmlCell(xmlPara(xmlRun('Ente',     { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[4] }),
        xmlCell(xmlPara(xmlRun('Scadenza', { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[5] }),
        xmlCell(xmlPara(xmlRun('Stato',    { bold: true }), { align: 'center' }), { fill: 'E5E7EB', pct: PCT[6] }),
    ], { header: true });

    const dataRows = certFindings.map(f => {
        const sCfg = STATUS_CFG[f.status] || STATUS_CFG.open;
        const tColor = TYPE_COLOR[f.finding_type] || 'DC2626';
        const descBody = xmlPara(escXml(f.description || '-'))
            + (f.corrective_action
                ? xmlPara(xmlRun('↳ AC: ' + f.corrective_action, { ital: true, color: '1D4ED8' }), { sb: 60, sa: 0 })
                : '');
        const dueDate = f.due_date
            ? new Date(f.due_date).toLocaleDateString('it-IT')
            : '-';
        return xmlRow([
            xmlCell(xmlPara(escXml(f.finding_number || '-'), { align: 'center' }), { pct: PCT[0] }),
            xmlCell(xmlPara(xmlRun(f.finding_type || 'NC', { bold: true, color: tColor }), { align: 'center' }), { pct: PCT[1] }),
            xmlCell(xmlPara(escXml(f.clause_ref || '-'), { align: 'center' }), { pct: PCT[2] }),
            xmlCell(descBody, { pct: PCT[3] }),
            xmlCell(xmlPara(escXml(f.certifying_body || '-'), { align: 'center' }), { pct: PCT[4] }),
            xmlCell(xmlPara(escXml(dueDate), { align: 'center' }), { pct: PCT[5] }),
            xmlCell(xmlPara(xmlRun(sCfg.label, { bold: true, color: sCfg.text }), { align: 'center' }),
                { fill: sCfg.fill, pct: PCT[6] }),
        ]);
    });

    return xmlTable([headerRow, ...dataRows], PCT);
}

// ─── Sezione checklist ISO 14001 (Titolo2 per domanda + tabella singola) ─────
/**
 * Rendering specifico ISO 14001 (stili Word italiano: Titolo1/Titolo2):
 *  - Titolo1 per ogni sezione legislativa (numerazione sequenziale a partire da 4)
 *  - Titolo2 per ogni singola domanda (numerazione globale a partire da 2, con 1=AP rilievi)
 *  - Tabella a riga singola + stralcio normativo sotto ogni domanda
 */
function buildISO14001Ooxml(normData, auditAttachments, pendingIssues, getViewUrl, options, imageRegistry, certFindings, normExcerpts) {
    let xml = '';

    // ── Cap. 3: Rilievi Precedenti ──────────────────────────────────────────
    xml += xmlPara(
        xmlRun('3 - RILIEVI PRECEDENTI', { bold: true, size: 24, color: '1D4ED8' }),
        { style: 'Titolo1', pageBreak: true, sb: 0, sa: 200 }
    );
    // Titolo2 per il sotto-punto "AP"
    xml += xmlPara(
        xmlRun('1.\u2002AP - Rilievi emersi dai precedenti Audit Interni-Esterni', { bold: true, size: 22, color: '1D4ED8' }),
        { style: 'Titolo2', sb: 100, sa: 100 }
    );
    xml += buildPendingIssuesOoxml(pendingIssues);

    // Rilievi ente certificatore (se presenti, mostrati in fondo a cap. 3)
    if (certFindings && certFindings.length) {
        xml += xmlPara(
            xmlRun('Rilievi dell\'ente certificatore', { bold: true, size: 20, color: '1D4ED8' }),
            { sb: 200, sa: 100 }
        );
        xml += buildCertFindingsOoxml(certFindings);
    }

    // ── Sezioni legislative (cap. 4, 5, …) ──────────────────────────────────
    const sortedSections = Object.entries(normData)
        .sort(([a], [b]) =>
            (parseInt(extractSectionNum(a), 10) || 0) -
            (parseInt(extractSectionNum(b), 10) || 0)
        );

    let sectionNum   = 4;  // sezioni 1-3 già usate
    let questionNum  = 2;  // 1 = AP rilievi

    sortedSections.forEach(([, clause]) => {
        if (!clause || typeof clause !== 'object') return;
        const sectionTitle = (clause.title || '').replace(/^\d+\.?\s*[-–]\s*/, '').toUpperCase();

        xml += xmlPara(
            xmlRun(`${sectionNum} - ${sectionTitle}`, { bold: true, size: 24, color: '1D4ED8' }),
            { style: 'Titolo1', pageBreak: false, sb: 400, sa: 200 }
        );
        sectionNum++;

        (clause.questions || []).forEach((q) => {
            const qTitle = escXml((q.title || q.text || q.question || 'Domanda').toUpperCase());

            // Titolo2 per la singola domanda (compare nel sommario Word)
            xml += xmlPara(
                xmlRun(`${questionNum}.\u2002${qTitle}`, { bold: true, size: 22, color: '1D4ED8' }),
                { style: 'Titolo2', sb: 200, sa: 80 }
            );
            questionNum++;

            // Tabella a riga singola (header + 1 domanda + eventuale stralcio)
            xml += buildClauseTableOoxml([q], auditAttachments, getViewUrl, options, imageRegistry, normExcerpts);
            xml += xmlPara('', { sa: 160 });
        });
    });

    return xml;
}

// ─── Sezione checklist completa (iniettata in CHECKLIST_MARKER) ───────────────
export function buildChecklistSectionOoxml(checklist, auditAttachments = [], pendingIssues = [], getViewUrl = null, options = {}, imageRegistry = null, certFindings = [], normExcerpts = {}) {
    let xml = '';

    if (!checklist || !Object.keys(checklist).length) {
        // Nessuna checklist: almeno i rilievi pendenti
        xml += xmlPara(
            xmlRun('3 - RILIEVI PENDENTI', { bold: true, size: 24, color: '1D4ED8' }),
            { style: 'Titolo1', pageBreak: true, sb: 0, sa: 200 }
        );
        xml += buildPendingIssuesOoxml(pendingIssues);
        return xml;
    }

    Object.entries(checklist).forEach(([stdKey, normData]) => {
        if (!normData || typeof normData !== 'object') return;

        // ── Rendering ISO 14001: Titolo2 per ogni domanda ────────────────────
        if (stdKey.includes('14001')) {
            xml += buildISO14001Ooxml(normData, auditAttachments, pendingIssues, getViewUrl, options, imageRegistry, certFindings, normExcerpts);
            return; // già gestito dentro buildISO14001Ooxml
        }

        // ── Rendering standard (ISO 9001, ISO 45001, ecc.) ───────────────────
        // Prima volta: aggiungi cap. 3 Rilievi Pendenti
        if (!xml.includes('RILIEVI PENDENTI') && !xml.includes('RILIEVI PRECEDENTI')) {
            xml += xmlPara(
                xmlRun('3 - RILIEVI PENDENTI', { bold: true, size: 24, color: '1D4ED8' }),
                { style: 'Titolo1', pageBreak: true, sb: 0, sa: 200 }
            );
            xml += buildPendingIssuesOoxml(pendingIssues);
            xml += xmlPara(
                xmlRun('3.1 - RILIEVI DELL\'ENTE CERTIFICATORE', { bold: true, size: 22, color: '1D4ED8' }),
                { style: 'Titolo2', sb: 200, sa: 200 }
            );
            xml += buildCertFindingsOoxml(certFindings);
        }

        Object.entries(normData)
            .sort(([a], [b]) =>
                (parseInt(extractSectionNum(a), 10) || 0) -
                (parseInt(extractSectionNum(b), 10) || 0)
            )
            .forEach(([clauseKey, clause]) => {
                if (!clause || typeof clause !== 'object') return;
                const num   = extractSectionNum(clauseKey);
                const title = (clause.title || '').replace(/^\d+\.?\s*[-–]\s*/, '');
                xml += xmlPara(
                    xmlRun(num + ' - ' + title.toUpperCase(), { bold: true, size: 24, color: '1D4ED8' }),
                    { style: 'Titolo1', pageBreak: false, sb: 400, sa: 200 }
                );
                xml += buildClauseTableOoxml(clause.questions || [], auditAttachments, getViewUrl, options, imageRegistry, normExcerpts);
                xml += xmlPara('', { sa: 300 });
            });
    });

    return xml;
}

// ─── Tabella sintesi rilievi (iniettata in RILIEVI_MARKER) ────────────────────
export function buildRileviSummaryOoxml(checklist, pendingIssues = []) {
    if (!checklist || !Object.keys(checklist).length)
        return xmlPara('Checklist non disponibile.', { ital: true });

    const FILL = { CONF: 'D1FAE5', NC: 'FEE2E2', OSS: 'FEF3C7', OM: 'DBEAFE', 'N.A.': 'E5E7EB', NV: 'EDE9FE' };
    const PCT  = [34, 11, 11, 11, 11, 11, 11];

    // La riga AP va in NC solo se almeno un rilievo "persiste" (carry-forward nel prossimo re-audit).
    // Rilievi in_progress o open non ancora valutati non contano come NC definitiva.
    const hasOpenPending = (pendingIssues || []).some((pi) => {
        const st = pi.issue_status || pi.status || 'open';
        return st === 'persists';
    });

    const headerRow = xmlRow(
        ['Elemento / Processo della norma', 'CONF', 'NC', 'OSS', 'OM', 'N.A.', 'NV'].map((h, i) =>
            xmlCell(xmlPara(xmlRun(h, { bold: true, size: 18 }), { align: 'center' }),
                { fill: 'E5E7EB', pct: PCT[i] })
        ),
        { header: true }
    );

    // Riga AP: senza pending storici → X su CONF (comportamento legacy); con pending aperti → X su NC
    const apRow = xmlRow([
        xmlCell('AP  Azioni pendenti da audit precedenti', { pct: PCT[0] }),
        hasOpenPending
            ? xmlCell(xmlPara(''), { pct: PCT[1] })
            : xmlCell(xmlPara(xmlRun('X', { bold: true }), { align: 'center' }), { fill: FILL.CONF, pct: PCT[1] }),
        hasOpenPending
            ? xmlCell(xmlPara(xmlRun('X', { bold: true }), { align: 'center' }), { fill: FILL.NC, pct: PCT[2] })
            : xmlCell(xmlPara(''), { pct: PCT[2] }),
        xmlCell(xmlPara(''), { pct: PCT[3] }),
        xmlCell(xmlPara(''), { pct: PCT[4] }),
        xmlCell(xmlPara(''), { pct: PCT[5] }),
        xmlCell(xmlPara(''), { pct: PCT[6] }),
    ]);

    const rows = [headerRow, apRow];

    Object.entries(checklist).forEach(([stdKey, normData]) => {
        if (!normData || typeof normData !== 'object') return;

        // Riga separatore per standard (in blu chiaro, a tutta larghezza)
        const stdLabel = STANDARD_LABELS[stdKey] || stdKey;
        rows.push(xmlRow([
            xmlCell(
                xmlPara(xmlRun(stdLabel, { bold: true, size: 18 }), { align: 'center' }),
                { span: 7, fill: 'DBEAFE', pct: 100 }
            ),
        ]));

        Object.entries(normData)
            .sort(([a], [b]) =>
                (parseInt(extractSectionNum(a), 10) || 0) -
                (parseInt(extractSectionNum(b), 10) || 0)
            )
            .forEach(([, clause]) => {
                if (!clause?.questions) return;
                clause.questions.forEach(q => {
                    let col = '';
                    if      (q.status === 'C')                       col = 'CONF';
                    else if (q.status === 'NC')                      col = 'NC';
                    else if (q.status === 'OSS')                     col = 'OSS';
                    else if (q.status === 'OM')                      col = 'OM';
                    else if (q.status === 'NA')                      col = 'N.A.';
                    else if (q.status === 'NV')                      col = 'NV';

                    const ref   = q.clauseRef || q.id || '';
                    const title = (q.title || q.text || '').replace(/^\d+\.?\d*\.?\d*\s*-?\s*/, '');
                    const satPrefix = q.satisfied_by_standard
                        ? '[SAT ' + escXml(q.satisfied_by_standard) + '] '
                        : '';
                    const label = satPrefix + escXml([ref, title].filter(Boolean).join(' - '));

                    rows.push(xmlRow([
                        xmlCell(label, { pct: PCT[0] }),
                        ...['CONF', 'NC', 'OSS', 'OM', 'N.A.', 'NV'].map((k, i) =>
                            col === k
                                ? xmlCell(xmlPara(xmlRun('X', { bold: true }), { align: 'center' }),
                                    { fill: FILL[k], pct: PCT[i + 1] })
                                : xmlCell(xmlPara(''), { pct: PCT[i + 1] })
                        ),
                    ]));
                });
            });
    });

    return xmlTable(rows, PCT);
}

// ─── Checklist custom (Phase 7) ─────────────────────────────────────────────────
/** Indice allegati per id server (attachment_id / serverAttachmentId / id). */
function attachmentMapByServerId(auditAttachments) {
    const map = new Map();
    (auditAttachments || []).forEach((a) => {
        const sid = a?.serverAttachmentId ?? a?.attachment_id ?? a?.id;
        if (sid == null) return;
        map.set(Number(sid), a);
    });
    return map;
}

/** ID numerico allegato lato server (per link Word / preload immagini). */
function serverAttachmentIdOf(att) {
    const sid = att?.serverAttachmentId ?? att?.attachment_id ?? att?.id;
    return sid != null ? Number(sid) : null;
}

/**
 * Allegati caricati da AttachmentSection su item custom: hanno custom_item_id (server)
 * o questionId locale = id voce. L'export Word custom leggeva solo evidence_blocks.attachment_id.
 */
function attachmentsForCustomItem(auditAttachments, itemId) {
    const idNum = Number(itemId);
    if (!Number.isFinite(idNum)) return [];
    return (auditAttachments || []).filter((a) => {
        const customId = a.customItemId ?? a.custom_item_id;
        const qId = a.questionId ?? a.question_id;
        return (customId != null && Number(customId) === idNum)
            || (qId != null && Number(qId) === idNum);
    });
}

/** OOXML per un allegato in checklist custom (link o embed come ISO). */
function customItemAttachmentOoxml(att, getViewUrl, options, imageRegistry) {
    const usePreview = options.photoMode === 'preview';
    const attId = serverAttachmentIdOf(att);
    const viewId = attId;
    const url = getViewUrl && viewId != null ? getViewUrl(viewId) : null;
    const fnameBase = att?.fileName || att?.name || 'Allegato';
    const mimeType = normalizeMimeType(att?.imageMimeType || att?.mimeType || '');

    if (usePreview && imageRegistry && IMAGE_MIME_TYPES.has(mimeType) && att?.imageBase64?.startsWith('data:image/')) {
        const imgIdx = imageRegistry.length;
        const imgId = 30000 + imgIdx;
        const rId = `rId${imgId}`;
        const ext = IMAGE_EXTS[mimeType] || 'jpg';
        imageRegistry.push({ rId, imgId, base64: att.imageBase64, mimeType, ext });
        const { cx, cy } = embeddedImageEmuFromBase64(att.imageBase64, mimeType);
        let fragment = xmlPara(xmlImageOoxml(rId, imgId, cx, cy), { sa: 60, sb: 60 });
        if (url) {
            fragment += xmlHyperlinkPara(url, '\uD83D\uDD17 ' + fnameBase, { color: '1E40AF', size: 18 });
        }
        return fragment;
    }
    if (url) {
        return xmlHyperlinkPara(url, '\uD83D\uDCCE ' + fnameBase, { color: '1E40AF', size: 18 });
    }
    const fname = escXml(fnameBase);
    return xmlPara(
        xmlRun('\uD83D\uDCCE ' + fname, { size: 18, ital: true, color: '64748B' }),
        { sa: 40 }
    );
}

/**
 * Costruisce OOXML per checklist personalizzata: sezioni, voci, evidence_blocks.
 * @param {Object} customChecklist - { sections: [{ id, code, title, items: [{ id, code, title }] }] }
 * @param {Object} customResponses - { custom_item_id: evidence_blocks[] }
 * @param {Array} auditAttachments - allegati con custom_item_id
 * @param {Function} getViewUrl
 * @param {Object} options
 * @param {Array|null} imageRegistry
 */
export function buildCustomChecklistSectionOoxml(customChecklist, customResponses = {}, auditAttachments = [], getViewUrl = null, options = {}, imageRegistry = null, customStatuses = {}) {
    if (!customChecklist?.sections?.length) {
        return xmlPara(xmlRun('Nessuna sezione nella checklist.', { ital: true }), { sa: 160 });
    }

    const hasOutcomeButtons = Boolean(customChecklist?.has_outcome_buttons);
    const STATUS_COLORS = { C: '166534', NC: '991B1B', OSS: '92400E', OM: '1E40AF', NV: '6B21A8', NA: '374151' };
    const STATUS_BG    = { C: 'D1FAE5', NC: 'FEE2E2', OSS: 'FEF3C7', OM: 'DBEAFE', NV: 'F3E8FF', NA: 'E5E7EB' };

    // Layout: un'unica tabella Word continua (no tabelle separate per sezione).
    // - 4 colonne in griglia
    // - Riga sezione: col1 codice sezione, col2+3+4 unite (titolo sezione)
    // - Riga evidenza: col1 codice voce, col2 testo/foto, col3-4 vuote
    const C = [900, 6400, 1400, 1400]; // DXA
    const secSpanDxa = C[1] + C[2] + C[3];
    const usePreview = options.photoMode === 'preview';

    const attById = attachmentMapByServerId(auditAttachments);

    /**
     * Converte una singola riga in sequenza di w:r (senza w:p).
     * - Coppie **grassetto** classiche
     * - Riga che inizia con ** senza seconda ** (es. "**1- testo") → tutto il resto in grassetto
     * - Asterischi Unicode tipici da mobile/copia-incolla → *
     */
    const lineToRichRuns = (line) => {
        const t = String(line || '')
            .replace(/\u2217/g, '*')
            .replace(/\uFE61/g, '*')
            .replace(/\uFF0A/g, '*');
        const trimmed = t.trimEnd();
        const secondStar = trimmed.indexOf('**', 2);
        const startsWithBoldMarker = /^\s*\*\*/.test(trimmed);
        if (startsWithBoldMarker && secondStar === -1) {
            const rest = trimmed.replace(/^\s*\*\*/, '').trim();
            return xmlRun(escXml(rest), { bold: true, size: 18 });
        }
        const parts = trimmed.split(/\*\*(.*?)\*\*/g);
        return parts.map((p, i) =>
            i % 2 === 0
                ? xmlRun(escXml(p), { size: 18 })
                : xmlRun(escXml(p), { bold: true, size: 18 })
        ).join('');
    };

    const textToRichParagraphs = (text) => {
        const raw = String(text || '').replace(/\r\n/g, '\n');
        const lines = raw.split('\n');
        let out = '';
        for (const line of lines) {
            if (!line.trim()) {
                out += xmlPara('', { sa: 20, sb: 20 });
                continue;
            }
            out += xmlPara(lineToRichRuns(line), { sa: 40, sb: 40 });
        }
        return out;
    };

    const sectionHeaderRow = (sec) => xmlRow([
        xmlCell(
            xmlPara(xmlRun(String(sec.code || '').trim() || '-', { bold: true, size: 20 }), { align: 'center' }),
            { dxa: C[0], fill: 'D9D9D9', va: 'center' }
        ),
        xmlCell(
            xmlPara(xmlRun(String(sec.title || '').trim() || 'SEZIONE', { bold: true, size: 20 }), { align: 'left' }),
            { span: 3, dxa: secSpanDxa, fill: 'D9D9D9', va: 'center', ml: 120 }
        ),
    ]);

    const emptyCell = (idx) => xmlCell(xmlPara(''), { dxa: C[idx], va: 'top' });

    const allRows = [];

    customChecklist.sections
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .forEach((sec) => {
            allRows.push(sectionHeaderRow(sec));
            const items = (sec.items || []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

            if (!items.length) {
                allRows.push(xmlRow([
                    xmlCell(xmlPara('-', { align: 'center' }), { dxa: C[0] }),
                    xmlCell(xmlPara(xmlRun('Nessuna sotto-sezione disponibile.', { ital: true })), { dxa: C[1] }),
                    emptyCell(2),
                    emptyCell(3),
                ]));
            }

            items.forEach((item) => {
                const blocks = Array.isArray(customResponses[item.id]) ? customResponses[item.id] : [];
                const itemCode = String(item.code || '').trim() || '-';
                const itemTitle = String(item.title || '').trim();
                const itemAtts = attachmentsForCustomItem(auditAttachments, item.id);
                const referencedAttIds = new Set(
                    blocks
                        .map((b) => (b?.attachment_id != null ? Number(b.attachment_id) : null))
                        .filter((id) => Number.isFinite(id))
                );
                const orphanAtts = itemAtts.filter((a) => {
                    const sid = serverAttachmentIdOf(a);
                    return sid == null || !referencedAttIds.has(sid);
                });

                const itemStatus = hasOutcomeButtons ? (customStatuses[item.id] || null) : null;
                const badgeRun = itemStatus
                    ? xmlRun(
                        ' [' + itemStatus + ']',
                        { bold: true, size: 18, color: STATUS_COLORS[itemStatus] || '374151' }
                      )
                    : '';

                if (blocks.length === 0 && orphanAtts.length === 0) {
                    const titleContent = [
                        xmlRun(itemTitle || 'Voce checklist', { bold: true, size: 18 }),
                        badgeRun,
                        xmlRun('\n- Nessuna evidenza compilata.', { ital: true, size: 18 }),
                    ].join('');
                    const badgeCellFill = (itemStatus && STATUS_BG[itemStatus]) ? STATUS_BG[itemStatus] : undefined;
                    allRows.push(xmlRow([
                        xmlCell(xmlPara(itemCode, { align: 'center' }), { dxa: C[0], va: 'top', ...(badgeCellFill ? { fill: badgeCellFill } : {}) }),
                        xmlCell(xmlPara(titleContent), { dxa: C[1], va: 'top', ml: 120 }),
                        emptyCell(2),
                        emptyCell(3),
                    ]));
                    return;
                }

                if (blocks.length === 0 && orphanAtts.length > 0) {
                    const badgeCellFill = (itemStatus && STATUS_BG[itemStatus]) ? STATUS_BG[itemStatus] : undefined;
                    let detail = '';
                    if (itemTitle) {
                        detail += xmlPara(
                            xmlRun(itemTitle, { bold: true, size: 18 }) + badgeRun,
                            { sa: 50, sb: 40 }
                        );
                    }
                    orphanAtts.forEach((att, i) => {
                        if (i > 0) detail += xmlPara('', { sa: 100, sb: 40 });
                        detail += customItemAttachmentOoxml(att, getViewUrl, options, imageRegistry);
                    });
                    allRows.push(xmlRow([
                        xmlCell(xmlPara(itemCode, { align: 'center' }), { dxa: C[0], va: 'top', ...(badgeCellFill ? { fill: badgeCellFill } : {}) }),
                        xmlCell(detail, { dxa: C[1], va: 'top', ml: 120 }),
                        emptyCell(2),
                        emptyCell(3),
                    ]));
                    return;
                }

                // Una sola riga per voce: colonna codice sempre itemCode (no 1.1.2, 1.1.3).
                const badgeCellFill = (itemStatus && STATUS_BG[itemStatus]) ? STATUS_BG[itemStatus] : undefined;
                let detail = '';
                if (itemTitle) {
                    detail += xmlPara(
                        xmlRun(itemTitle, { bold: true, size: 18 }) + badgeRun,
                        { sa: 50, sb: 40 }
                    );
                }

                blocks.forEach((blk, i) => {
                    if (i > 0) {
                        detail += xmlPara('', { sa: 100, sb: 40 });
                    }
                    const text = String(blk?.text || '').trim();
                    const attId = blk?.attachment_id ? Number(blk.attachment_id) : null;
                    const att = attId != null ? attById.get(attId) : null;
                    const mimeType = att?.imageMimeType || att?.mimeType || '';

                    let fragment = '';
                    if (text) {
                        fragment += textToRichParagraphs(text);
                    }

                    if (attId != null) {
                        const viewId = att?.serverAttachmentId ?? att?.attachment_id ?? att?.id ?? attId;
                        const url = getViewUrl && viewId != null ? getViewUrl(viewId) : null;
                        const fnameBase = att?.fileName || att?.name || 'Allegato';

                        if (usePreview && imageRegistry && IMAGE_MIME_TYPES.has(mimeType) && att?.imageBase64?.startsWith('data:image/')) {
                            const imgIdx = imageRegistry.length;
                            const imgId = 30000 + imgIdx;
                            const rId = `rId${imgId}`;
                            const ext = IMAGE_EXTS[mimeType] || 'jpg';
                            imageRegistry.push({ rId, imgId, base64: att.imageBase64, mimeType, ext });
                            const { cx, cy } = embeddedImageEmuFromBase64(att.imageBase64, mimeType);
                            fragment += xmlPara(xmlImageOoxml(rId, imgId, cx, cy), { sa: 60, sb: 60 });
                            if (url) {
                                fragment += xmlHyperlinkPara(url, '\uD83D\uDD17 ' + fnameBase, { color: '1E40AF', size: 18 });
                            }
                        } else if (url) {
                            fragment += xmlHyperlinkPara(url, '\uD83D\uDCCE ' + fnameBase, { color: '1E40AF', size: 18 });
                        } else {
                            const fname = escXml(fnameBase);
                            fragment += xmlPara(
                                xmlRun('\uD83D\uDCCE ' + fname, { size: 18, ital: true, color: '64748B' }),
                                { sa: 40 }
                            );
                        }
                    }

                    if (!fragment) {
                        fragment = xmlPara(xmlRun('- Evidenza senza contenuto testuale.', { ital: true, size: 18 }));
                    }
                    detail += fragment;
                });

                if (orphanAtts.length > 0) {
                    detail += xmlPara('', { sa: 100, sb: 40 });
                    orphanAtts.forEach((att, i) => {
                        if (i > 0) detail += xmlPara('', { sa: 60, sb: 40 });
                        detail += customItemAttachmentOoxml(att, getViewUrl, options, imageRegistry);
                    });
                }

                allRows.push(xmlRow([
                    xmlCell(xmlPara(itemCode, { align: 'center' }), { dxa: C[0], va: 'top', ...(badgeCellFill ? { fill: badgeCellFill } : {}) }),
                    xmlCell(detail, { dxa: C[1], va: 'top', ml: 120 }),
                    emptyCell(2),
                    emptyCell(3),
                ]));
            });
        });

    return xmlTable(allRows, C, 100, true);
}

/**
 * Riepilogo per checklist custom (sostituisce RILIEVI_MARKER).
 * Se has_outcome_buttons è attivo genera tabella riepilogo NC/OSS/OM per item.
 * Altrimenti restituisce stringa vuota (riepilogo non applicabile).
 */
export function buildCustomRileviSummaryOoxml(customChecklist, customResponses = {}, customStatuses = {}) {
    const hasOutcomeButtons = Boolean(customChecklist?.has_outcome_buttons);

    if (!hasOutcomeButtons) {
        // Nessun riepilogo per checklist senza pulsanti esito: paragrafo vuoto
        return xmlPara('', { sa: 0 });
    }

    // Colonne: label + C + NC + OSS + OM + N.A. + NV (tot 7, somma 100%)
    const FILL = { C: 'D1FAE5', NC: 'FEE2E2', OSS: 'FEF3C7', OM: 'DBEAFE', 'N.A.': 'E5E7EB', NV: 'EDE9FE' };
    const COLS = ['C', 'NC', 'OSS', 'OM', 'N.A.', 'NV'];
    const PCT  = [46, 9, 9, 9, 9, 9, 9]; // 46+9*6=100

    const headerRow = xmlRow(
        ['Voce / Domanda', ...COLS].map((h, i) =>
            xmlCell(xmlPara(xmlRun(h, { bold: true, size: 18 }), { align: 'center' }),
                { fill: 'E5E7EB', pct: PCT[i] })
        ),
        { header: true }
    );

    const rows = [headerRow];

    // Raccoglie tutti gli item con status valorizzato
    (customChecklist?.sections || []).forEach((sec) => {
        (sec.items || []).forEach((item) => {
            const st = customStatuses[item.id] || null;
            if (!st) return; // salta item senza valutazione
            let col = '';
            if      (st === 'C')   col = 'C';
            else if (st === 'NC')  col = 'NC';
            else if (st === 'OSS') col = 'OSS';
            else if (st === 'OM')  col = 'OM';
            else if (st === 'NA')  col = 'N.A.';
            else if (st === 'NV')  col = 'NV';

            const label = escXml([item.code, item.title].filter(Boolean).join(' - '));
            rows.push(xmlRow([
                xmlCell(label, { pct: PCT[0] }),
                ...COLS.map((k, i) =>
                    col === k
                        ? xmlCell(xmlPara(xmlRun('X', { bold: true }), { align: 'center' }),
                            { fill: FILL[k], pct: PCT[i + 1] })
                        : xmlCell(xmlPara(''), { pct: PCT[i + 1] })
                ),
            ]));
        });
    });

    if (rows.length === 1) {
        // Solo header, nessun item valutato
        rows.push(xmlRow([
            xmlCell(xmlPara(xmlRun('Nessuna domanda valutata.', { ital: true })), { span: 7, pct: 100 }),
        ]));
    }

    return xmlTable(rows, PCT);
}
