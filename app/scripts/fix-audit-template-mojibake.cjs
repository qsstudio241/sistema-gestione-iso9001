/**

 * Normalizza nel template .docx sequenze mojibake (â€" → –, ConformitÃ/Â° → Conformità) anche se spezzate tra più <w:t>.

 * Logica allineata a fixWordXmlMojibake in src/utils/wordExport.js.

 * Uso: node scripts/fix-audit-template-mojibake.cjs

 */

/* eslint-disable no-console */

const fs = require('fs');

const path = require('path');

const PizZip = require('pizzip');



const MOJIBAKE_W_RUN_BRIDGE =

    '(?:</w:t></w:r>(?:<w:proofErr[^>]*/>)*<w:r(?:\\s[^>]*)?>(?:<w:rPr>[\\s\\S]*?</w:rPr>)?<w:t(?:\\s[^>]*)?>)?';



function latin1Utf8PairToChar(lead, trail, before = '') {

    const b1 = lead.charCodeAt(0);

    const b2 = trail.charCodeAt(0);

    if (lead === '\u00C2' && trail === '\u00B0' && /it$/i.test(before)) {

        return '\u00e0';

    }

    if ((b1 === 0xC2 || b1 === 0xC3) && b2 >= 0x80 && b2 <= 0xBF) {

        return String.fromCodePoint(((b1 & 0x1F) << 6) | (b2 & 0x3F));

    }

    return lead + trail;

}



function fixItalianItaDegreeMojibake(xml) {

    if (!xml || typeof xml !== 'string') return xml;

    let s = xml;

    const bridge = MOJIBAKE_W_RUN_BRIDGE;

    const itaWord = '(Conformit|Opportunit|conformit|opportunit|qualit|Quantit|identit|unit|attivit|priorit|autorit|specialit|generalit|localit|personalit|formalit|legalit|mortalit|neutralit|periodicit|specificit|temperatur|societ)';

    s = s.replace(new RegExp(`${itaWord}\u00c2${bridge}?\u00b0`, 'g'), '$1\u00e0');

    s = s.replace(new RegExp(`${itaWord}\u00b0`, 'g'), '$1\u00e0');

    return s;

}



function fixItalianAccentMojibake(xml) {

    if (!xml || typeof xml !== 'string') return xml;

    let s = xml;

    const bridge = MOJIBAKE_W_RUN_BRIDGE;

    const fixLead = (lead) => {

        s = s.replace(

            new RegExp(`([\\w]{0,24})${lead}${bridge}([\\u0080-\\u00BF])`, 'g'),

            (_, before, b) => before + latin1Utf8PairToChar(lead, b, before)

        );

        s = s.replace(

            new RegExp(`([\\w]{0,24})${lead}([\\u0080-\\u00BF])`, 'g'),

            (_, before, b) => before + latin1Utf8PairToChar(lead, b, before)

        );

    };

    fixLead('\u00C3');

    fixLead('\u00C2');

    s = fixItalianItaDegreeMojibake(s);

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



/** Titolo sezione esito verbale custom: capitolo 3 numerato (non sezione ISO 11). */
function patchVerbaleEsitoHeading(xml) {
    if (!xml || typeof xml !== 'string') return xml;
    let s = xml;
    const enDash = '\u2013';
    const titolo3 = `3 ${enDash} ESITO DELL'AUDIT`;
    s = s.replace(
        /<w:t xml:space="preserve">11 [\u2013\u2014-]{1,2} ESITO DELL'AUDIT<\/w:t>/g,
        `<w:t xml:space="preserve">${titolo3}</w:t>`
    );
    s = s.replace(
        /<w:t xml:space="preserve">11 -- ESITO DELL'AUDIT<\/w:t>/g,
        `<w:t xml:space="preserve">${titolo3}</w:t>`
    );
    s = s.replace(
        /<w:t xml:space="preserve">ESITO DELL'AUDIT<\/w:t>/g,
        `<w:t xml:space="preserve">${titolo3}</w:t>`
    );
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

        let t0 = f.asText();

        let t1 = fixWordXmlMojibake(t0);

        if (name === 'VerbaleVisita-generic.docx' && p === 'word/document.xml') {

            t1 = patchVerbaleEsitoHeading(t1);

        }

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

