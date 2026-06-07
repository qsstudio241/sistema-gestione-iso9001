/**
 * Patch template report audit ISO:
 * 1) Conclusioni come ultima sezione (dopo RILIEVI / Rilievi Emersi / conteggi)
 * 2) Titoli capitolo: apostrofo corretto, trattino en-dash uniforme (N – TITOLO)
 *
 * Uso: node scripts/patch-audit-template-structure.cjs
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const EN_DASH = '\u2013';
const templatesDir = path.join(__dirname, '../public/templates');

const TARGETS = [
    'ISO9001-audit-report.docx',
    'ISO14001-audit-report.docx',
    'ISO45001-audit-report.docx',
    'ISO3834-audit-report.docx',
    'VerbaleVisita-generic.docx',
];

function paraText(pXml) {
    const ts = [];
    const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = re.exec(pXml))) ts.push(m[1]);
    return ts.join('');
}

function normalizeHeadingText(t) {
    let s = t;
    s = s.replace(/&apos;/g, "'");
    s = s.replace(/\u2014/g, EN_DASH); // em dash → en dash
    s = s.replace(/(\d+)\s*[-\u2013\u2014]\s*/g, `$1 ${EN_DASH} `);
    return s;
}

function ensureTitolo1(pXml) {
    if (/<w:pStyle w:val="(?:Titolo1|Heading1)"/.test(pXml)) return pXml;
    if (/<w:pPr[\s>]/.test(pXml)) {
        return pXml.replace(/<w:pPr([^>]*)>/, '<w:pPr$1><w:pStyle w:val="Titolo1"/>');
    }
    return pXml.replace(/<w:p([\s>])/, '<w:p$1<w:pPr><w:pStyle w:val="Titolo1"/></w:pPr>');
}

function normalizeHeadingsInXml(xml) {
    let changed = false;
    const out = xml.replace(/<w:p[\s>][\s\S]*?<\/w:p>/g, (pXml) => {
        const text = paraText(pXml).trim();
        const isChapter = /^\d+\s*[-\u2013\u2014]/.test(text);
        const isNamed = /^(CONCLUS|DATI|ESITO|OBIETTIVO|SCOPO)/i.test(text);
        if (!isChapter && !isNamed) return pXml;

        let next = pXml;
        if (isChapter && /ESITO|VISITA ISPETTIVA/i.test(text)) {
            const withStyle = ensureTitolo1(next);
            if (withStyle !== next) {
                next = withStyle;
                changed = true;
            }
        }

        const normFull = normalizeHeadingText(text);
        if (normFull !== text) {
            changed = true;
            next = next.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (full, inner) => {
                const innerNorm = normalizeHeadingText(inner);
                return innerNorm === inner ? full : full.replace(inner, innerNorm);
            });
        }
        return next;
    });
    return { xml: out, changed };
}

/** Estrae blocchi top-level (w:p | w:tbl) nell'ordine del documento. */
function splitTopLevelBlocks(xml) {
    const blocks = [];
    const re = /<w:p[\s>][\s\S]*?<\/w:p>|<w:tbl[\s>][\s\S]*?<\/w:tbl>/g;
    let m;
    while ((m = re.exec(xml))) blocks.push({ xml: m[0], text: m[0].startsWith('<w:p') ? paraText(m[0]) : '[table]', index: m.index });
    return blocks;
}

function isEsitoHeading(text) {
    return /^\s*11\s/.test(text) && /ESITO|VISITA ISPETTIVA/i.test(text);
}

function isConclusionHeading(text) {
    return /^Conclusioni\s*$/i.test(text.trim());
}

function isConclusionsPlaceholder(text) {
    return /\{conclusions\}/.test(text);
}

function isRilieviHeading(text) {
    return /^RILIEVI\s*$/i.test(text.trim());
}

function isRilieviMarker(text) {
    return text.includes('RILIEVI_MARKER');
}

function isRilieviEmersiHeading(text) {
    return /^(Rilievi Emersi|Riepilogo Rilievi)\s*$/i.test(text.trim());
}

function isSummaryPlaceholder(text) {
    return /\{summaryText\}/.test(text);
}

/**
 * Riordina sezione 11: ESITO → RILIEVI (+ tabella conteggi) → Conclusioni (ultima).
 */
function reorderConclusionsLast(xml) {
    const blocks = splitTopLevelBlocks(xml);
    let esitoIdx = -1;
    for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].text.includes('CHECKLIST_MARKER')) {
            for (let j = i + 1; j < blocks.length; j++) {
                if (isEsitoHeading(blocks[j].text)) {
                    esitoIdx = j;
                    break;
                }
            }
            if (esitoIdx >= 0) break;
        }
    }
    if (esitoIdx < 0) return { xml, changed: false, reason: 'esito non trovato' };

    let concHeadIdx = -1;
    let concBodyIdx = -1;
    let rilStart = -1;
    let sectionEnd = blocks.length;

    for (let i = esitoIdx + 1; i < blocks.length; i++) {
        const t = blocks[i].text;
        if (concHeadIdx < 0 && isConclusionHeading(t)) concHeadIdx = i;
        else if (concHeadIdx >= 0 && concBodyIdx < 0 && isConclusionsPlaceholder(t)) concBodyIdx = i;
        else if (rilStart < 0 && isRilieviHeading(t)) rilStart = i;
    }

    if (concHeadIdx < 0 || concBodyIdx < 0 || rilStart < 0) {
        return { xml, changed: false, reason: 'marker conclusioni/rilievi mancanti' };
    }
    if (rilStart < concBodyIdx) {
        return { xml, changed: false, reason: 'già riordinato' };
    }

    // Fine blocco rilievi: dopo summaryText o ultimo blocco prima di eventuale contenuto extra
    for (let i = rilStart; i < blocks.length; i++) {
        if (isSummaryPlaceholder(blocks[i].text)) {
            sectionEnd = i + 1;
            break;
        }
    }

    const concHeadStart = blocks[concHeadIdx].index;
    const concBodyEnd = blocks[concBodyIdx].index + blocks[concBodyIdx].xml.length;
    const rilStartOff = blocks[rilStart].index;
    const sectionEndOff = blocks[sectionEnd - 1].index + blocks[sectionEnd - 1].xml.length;

    const rebuilt =
        xml.slice(0, concHeadStart) +
        xml.slice(rilStartOff, sectionEndOff) +
        xml.slice(concHeadStart, concBodyEnd) +
        xml.slice(sectionEndOff);

    return { xml: rebuilt, changed: true };
}

function patchDocx(fp) {
    const name = path.basename(fp);
    const z = new PizZip(fs.readFileSync(fp));
    const origXml = z.files['word/document.xml'].asText();
    let xml = origXml;

    const norm = normalizeHeadingsInXml(xml);
    xml = norm.xml;

    xml = xml.replace(/&apos;/g, "'");

    const ord = reorderConclusionsLast(xml);
    if (ord.changed) xml = ord.xml;
    else if (ord.reason && ord.reason !== 'già riordinato') {
        console.warn(`[WARN] ${name}: ${ord.reason}`);
    }

    if (xml === origXml) {
        console.log(`[OK] ${name}`);
        return false;
    }

    z.file('word/document.xml', xml);
    fs.writeFileSync(
        fp,
        z.generate({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
    );
    console.log(`[PATCH] ${name}`);
    return true;
}

function main() {
    let n = 0;
    for (const f of TARGETS) {
        const fp = path.join(templatesDir, f);
        if (!fs.existsSync(fp)) {
            console.warn(`[SKIP] mancante: ${f}`);
            continue;
        }
        if (patchDocx(fp)) n++;
    }
    console.log(`Fatto: ${n} file aggiornati.`);
}

main();
