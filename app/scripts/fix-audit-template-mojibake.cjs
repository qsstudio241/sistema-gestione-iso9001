/**
 * Normalizza nel template .docx sequenze mojibake (â€" → –, ConformitÃ → Conformità) anche se spezzate tra più <w:t>.
 * Logica allineata a fixWordXmlMojibake in src/utils/wordExport.js.
 * Uso: node scripts/fix-audit-template-mojibake.cjs
 */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const MOJIBAKE_W_RUN_BRIDGE =
    '(?:</w:t></w:r>(?:<w:proofErr[^>]*/>)*<w:r(?:\\s[^>]*)?>(?:<w:rPr>[\\s\\S]*?</w:rPr>)?<w:t(?:\\s[^>]*)?>)?';

function latin1Utf8PairToChar(lead, trail) {
    const b1 = lead.charCodeAt(0);
    const b2 = trail.charCodeAt(0);
    if ((b1 === 0xC2 || b1 === 0xC3) && b2 >= 0x80 && b2 <= 0xBF) {
        return String.fromCodePoint(((b1 & 0x1F) << 6) | (b2 & 0x3F));
    }
    return lead + trail;
}

function fixItalianAccentMojibake(xml) {
    if (!xml || typeof xml !== 'string') return xml;
    let s = xml;
    const bridge = MOJIBAKE_W_RUN_BRIDGE;
    const fixLead = (lead) => {
        s = s.replace(new RegExp(`${lead}${bridge}([\\u0080-\\u00BF])`, 'g'), (_, b) => latin1Utf8PairToChar(lead, b));
        s = s.replace(new RegExp(`${lead}[\\u0080-\\u00BF]`, 'g'), (m) => latin1Utf8PairToChar(lead, m.charAt(1)));
    };
    fixLead('\u00C3');
    fixLead('\u00C2');
    return s;
}

function fixWordXmlMojibake(xml) {
    if (!xml || typeof xml !== 'string') return xml;
    let s = xml;
    const bridge = MOJIBAKE_W_RUN_BRIDGE;
    s = s.replace(new RegExp(`\\u00E2${bridge}\\u20AC\\u201C`, 'g'), '\u2013');
    s = s.replace(new RegExp(`\\u00E2${bridge}\\u20AC\\u201D`, 'g'), '\u2014');
    s = s.replace(new RegExp(`\\u00E2${bridge}\\u20AC\\u2122`, 'g'), '\u2019');
    s = s.replace(/\u00E2\u20AC\u0153/g, '\u201C');
    s = s.replace(/\u00E2\u20AC\u009D/g, '\u201D');
    s = fixItalianAccentMojibake(s);
    return s;
}

const PART_RE = /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/;
const templatesDir = path.join(__dirname, '../public/templates');

const files = fs
    .readdirSync(templatesDir)
    .filter((n) => n.endsWith('.docx') && !n.endsWith('.bak'))
    .sort();

for (const name of files) {
    const fp = path.join(templatesDir, name);
    const z = new PizZip(fs.readFileSync(fp));
    let n = 0;
    for (const p of Object.keys(z.files)) {
        if (!PART_RE.test(p)) continue;
        const f = z.files[p];
        if (!f || f.dir) continue;
        const t0 = f.asText();
        const t1 = fixWordXmlMojibake(t0);
        if (t1 !== t0) {
            z.file(p, t1);
            n++;
        }
    }
    if (n > 0) {
        fs.writeFileSync(fp, z.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
        console.log('Aggiornato', name, '(' + n + ' parti XML)');
    } else {
        console.log('Nessuna modifica', name);
    }
}
