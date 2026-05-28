/**
 * Uniforma titoli sezione 3 del verbale custom (VerbaleVisita-generic.docx):
 * 3 ù ESITO, 3.1 ù RILIEVI, 3.2 ù CONCLUSIONI ù stile Titolo 1 come capitoli 1ù2.
 *
 * Uso: node scripts/patch-verbale-visita-headings.cjs
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatesDir = path.join(__dirname, '../public/templates');
const TARGET = 'VerbaleVisita-generic.docx';

const EN_DASH = '\u2013';

function paraText(pXml) {
    const ts = [];
    const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let m;
    while ((m = re.exec(pXml))) ts.push(m[1]);
    return ts.join('');
}

function titolo1(text, { pageBreakBefore = false, spacingBefore = '0', spacingAfter = '300' } = {}) {
    const pageBreak = pageBreakBefore ? '<w:pageBreakBefore/>' : '';
    return (
        `<w:p><w:pPr><w:pStyle w:val="Titolo1"/>${pageBreak}` +
        `<w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}"/></w:pPr>` +
        `<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
    );
}

function boldIntro(text) {
    return (
        `<w:p><w:pPr><w:spacing w:before="300" w:after="150"/></w:pPr>` +
        `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
    );
}

function normalizeVerbaleHeadings(xml) {
    let changed = false;
    const out = xml.replace(/<w:p[\s>][\s\S]*?<\/w:p>/g, (pXml) => {
        const text = paraText(pXml).trim();
        if (/^ESITO DELL'?AUDIT\s*$/i.test(text) || /^\s*3\s*[\u2013\u2014-]\s*ESITO/i.test(text)) {
            changed = true;
            return titolo1(`3 ${EN_DASH} ESITO DELL'AUDIT`, {
                pageBreakBefore: /<w:pageBreakBefore\s*\/>/.test(pXml),
            });
        }
        if (/^RILIEVI\s*$/i.test(text) || /^\s*3\.1\s*[\u2013\u2014-]\s*RILIEVI\s*$/i.test(text)) {
            changed = true;
            return titolo1(`3.1 ${EN_DASH} RILIEVI`, { spacingBefore: '300', spacingAfter: '300' });
        }
        if (/^(Rilievi Emersi|Riepilogo Rilievi)\s*$/i.test(text)) {
            changed = true;
            return boldIntro('Rilievi Emersi');
        }
        if (/^Conclusioni\s*$/i.test(text) || /^\s*3\.2\s*[\u2013\u2014-]\s*CONCLUSIONI\s*$/i.test(text)) {
            changed = true;
            return titolo1(`3.2 ${EN_DASH} CONCLUSIONI`, { spacingBefore: '300', spacingAfter: '300' });
        }
        return pXml;
    });
    return { xml: out, changed };
}

function clearStaleTocCache(xml) {
    return xml.replace(
        /(<w:sdt>[\s\S]*?<w:sdtContent>)([\s\S]*?)(<\/w:sdtContent>[\s\S]*?<\/w:sdt>)/g,
        (full, open, content, close) => {
            if (!/w:instrText[^>]*>\s*TOC /i.test(content)) return full;
            const cleaned = content.replace(/<w:p[\s>][\s\S]*?<\/w:p>/g, (pXml) => {
                if (/w:instrText[^>]*>\s*TOC /i.test(pXml)) return pXml;
                if (/w:hyperlink w:anchor="_Toc/i.test(pXml)) return '';
                return pXml;
            });
            if (cleaned === content) return full;
            return open + cleaned + close;
        }
    );
}

function main() {
    const fp = path.join(templatesDir, TARGET);
    if (!fs.existsSync(fp)) {
        console.error('Mancante:', fp);
        process.exit(1);
    }
    const z = new PizZip(fs.readFileSync(fp));
    const orig = z.files['word/document.xml'].asText();
    let xml = clearStaleTocCache(orig);
    const norm = normalizeVerbaleHeadings(xml);
    xml = norm.xml;
    xml = clearStaleTocCache(xml);

    if (xml === orig && !norm.changed) {
        console.log('[OK]', TARGET, '(giù allineato)');
        return;
    }

    z.file('word/document.xml', xml);
    const tmp = fp + '.tmp';
    const buf = z.generate({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    fs.writeFileSync(tmp, buf);
    for (let i = 0; i < 8; i++) {
        try {
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
            fs.renameSync(tmp, fp);
            console.log('[PATCH]', TARGET);
            return;
        } catch (e) {
            if (i === 7) throw e;
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
        }
    }
}

main();
