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
    ISO_9001:        'ISO 9001:2015 \u2014 Sistema di Gestione per la Qualit\u00e0',
    ISO_9001_2015:   'ISO 9001:2015 \u2014 Sistema di Gestione per la Qualit\u00e0',
    ISO_14001:       'ISO 14001:2015 \u2014 Sistema di Gestione Ambientale',
    ISO_14001_2015:  'ISO 14001:2015 \u2014 Sistema di Gestione Ambientale',
    ISO_45001:       'ISO 45001:2018 \u2014 Sistema di Gestione per la Salute e Sicurezza',
    ISO_45001_2018:  'ISO 45001:2018 \u2014 Sistema di Gestione per la Salute e Sicurezza',
    ISO_3834_2:      'ISO 3834-2 \u2014 Checklist Audit Fornitori in Campo',
    ISO_3834_2_2021: 'ISO 3834-2 \u2014 Checklist Audit Fornitori in Campo',
    RDP_MSN:         'ISO 3834-2:2021 \u2014 Requisiti di qualit\u00e0 per la saldatura per fusione (Audit di sistema)',
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
    NOT_ANSWERED:{ label: '\u2014',             fill: 'FFFFFF', text: '000000' },
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
                          (pi.source_audit_id ? 'Audit ID ' + pi.source_audit_id : '\u2014');

        const descBody  = xmlPara(escXml(
            pi.question_text || pi.description || pi.nc_description || 'N/D'
        )) + (refNote
            ? xmlPara(xmlRun('\u21b3 ' + refNote, { ital: true, color: '6B7280' }), { sb: 60, sa: 0 })
            : '');

        return xmlRow([
            xmlCell(xmlPara(escXml(pi.section_code || pi.clause || '\u2014'), { align: 'center' }), { pct: PCT[0] }),
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
function xmlHyperlinkPara(url, displayText, opts = {}) {
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

/** Genera OOXML per un'immagine embedded (200x150px → 1905000x1428750 EMU) */
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
        xmlRun('— stralcio non disponibile', { ital: true, color: '9CA3AF', size: 18 }),
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
        const notes = (q.notes && q.notes.trim()) ? escXml(q.notes.trim()) : '\u2014';

        allRows.push(xmlRow([
            xmlCell(xmlPara(full,  { sa: 0 }), { dxa: C[0], va: 'top' }),
            xmlCell(xmlPara(xmlRun(cfg.label, { bold: true, color: cfg.text }), { align: 'center' }),
                { fill: cfg.fill, dxa: C[1] }),
            xmlCell(xmlPara(notes, { sa: 0 }), { dxa: C[2], va: 'top' }),
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

                    const imgXml  = xmlImageOoxml(rId, imgId);
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
        const descBody = xmlPara(escXml(f.description || '—'))
            + (f.corrective_action
                ? xmlPara(xmlRun('↳ AC: ' + f.corrective_action, { ital: true, color: '1D4ED8' }), { sb: 60, sa: 0 })
                : '');
        const dueDate = f.due_date
            ? new Date(f.due_date).toLocaleDateString('it-IT')
            : '—';
        return xmlRow([
            xmlCell(xmlPara(escXml(f.finding_number || '—'), { align: 'center' }), { pct: PCT[0] }),
            xmlCell(xmlPara(xmlRun(f.finding_type || 'NC', { bold: true, color: tColor }), { align: 'center' }), { pct: PCT[1] }),
            xmlCell(xmlPara(escXml(f.clause_ref || '—'), { align: 'center' }), { pct: PCT[2] }),
            xmlCell(descBody, { pct: PCT[3] }),
            xmlCell(xmlPara(escXml(f.certifying_body || '—'), { align: 'center' }), { pct: PCT[4] }),
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
        xmlRun('3 \u2014 RILIEVI PRECEDENTI', { bold: true, size: 24, color: '1D4ED8' }),
        { style: 'Titolo1', pageBreak: true, sb: 0, sa: 200 }
    );
    // Titolo2 per il sotto-punto "AP"
    xml += xmlPara(
        xmlRun('1.\u2002AP \u2014 Rilievi emersi dai precedenti Audit Interni-Esterni', { bold: true, size: 22, color: '1D4ED8' }),
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
            xmlRun(`${sectionNum} \u2014 ${sectionTitle}`, { bold: true, size: 24, color: '1D4ED8' }),
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
            xmlRun('3 \u2014 RILIEVI PENDENTI', { bold: true, size: 24, color: '1D4ED8' }),
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
                xmlRun('3 \u2014 RILIEVI PENDENTI', { bold: true, size: 24, color: '1D4ED8' }),
                { style: 'Titolo1', pageBreak: true, sb: 0, sa: 200 }
            );
            xml += buildPendingIssuesOoxml(pendingIssues);
            xml += xmlPara(
                xmlRun('3.1 \u2014 RILIEVI DELL\'ENTE CERTIFICATORE', { bold: true, size: 22, color: '1D4ED8' }),
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
                    xmlRun(num + ' \u2014 ' + title.toUpperCase(), { bold: true, size: 24, color: '1D4ED8' }),
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
                    const label = escXml([ref, title].filter(Boolean).join('  '));

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
            xmlPara(xmlRun(String(sec.code || '').trim() || '\u2014', { bold: true, size: 20 }), { align: 'center' }),
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
                    xmlCell(xmlPara('\u2014', { align: 'center' }), { dxa: C[0] }),
                    xmlCell(xmlPara(xmlRun('Nessuna sotto-sezione disponibile.', { ital: true })), { dxa: C[1] }),
                    emptyCell(2),
                    emptyCell(3),
                ]));
            }

            items.forEach((item) => {
                const blocks = Array.isArray(customResponses[item.id]) ? customResponses[item.id] : [];
                const itemCode = String(item.code || '').trim() || '\u2014';
                const itemTitle = String(item.title || '').trim();

                const itemStatus = hasOutcomeButtons ? (customStatuses[item.id] || null) : null;
                const badgeRun = itemStatus
                    ? xmlRun(
                        ' [' + itemStatus + ']',
                        { bold: true, size: 18, color: STATUS_COLORS[itemStatus] || '374151' }
                      )
                    : '';

                if (blocks.length === 0) {
                    const titleContent = [
                        xmlRun(itemTitle || 'Voce checklist', { bold: true, size: 18 }),
                        badgeRun,
                        xmlRun('\n\u2014 Nessuna evidenza compilata.', { ital: true, size: 18 }),
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
                            fragment += xmlPara(xmlImageOoxml(rId, imgId), { sa: 60, sb: 60 });
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
                        fragment = xmlPara(xmlRun('\u2014 Evidenza senza contenuto testuale.', { ital: true, size: 18 }));
                    }
                    detail += fragment;
                });

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

            const label = escXml([item.code, item.title].filter(Boolean).join('  '));
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
