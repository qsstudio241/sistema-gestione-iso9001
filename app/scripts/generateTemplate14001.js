/**
 * generateTemplate14001.js
 * Genera il template Word per Report Audit Conformita' Legislativa ISO 14001.
 *
 * USO:
 *   node scripts/generateTemplate14001.js
 *
 * OUTPUT:
 *   app/public/templates/ISO14001-audit-report.docx
 */

'use strict';

const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, WidthType, BorderStyle,
    VerticalAlign, PageNumber, TableOfContents, ShadingType, Packer
} = require('docx');
const fs   = require('fs');
const path = require('path');

const C = {
    primary:   '1A5276', // blu scuro (ISO 14001 -> verde/blu ambiente)
    secondary: '1F618D',
    accent:    '1E8449', // verde scuro per accenti ISO 14001
    lightGray: 'E5E7EB',
    black:     '000000',
    white:     'FFFFFF'
};

function run(text, opts = {}) {
    return new TextRun({ text, bold: opts.bold || false, italic: opts.italic || false,
        size: opts.size || 22, color: opts.color || undefined, font: 'Arial' });
}

function para(children, opts = {}) {
    return new Paragraph({
        children: Array.isArray(children) ? children : [run(children, opts)],
        alignment: opts.align || AlignmentType.LEFT,
        heading: opts.heading || undefined,
        spacing: { before: opts.before || 0, after: opts.after || 160 },
        pageBreakBefore: opts.pageBreak || false
    });
}

function stdBorders() {
    const b = { style: BorderStyle.SINGLE, size: 1, color: C.black };
    return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

function hdrBorders(pos) {
    const thick = { style: BorderStyle.SINGLE, size: 4, color: C.primary };
    const thin  = { style: BorderStyle.SINGLE, size: 2, color: C.lightGray };
    const nil   = { style: BorderStyle.NIL };
    const maps  = {
        left:   { top: thick, bottom: thick, left: thick, right: thin },
        center: { top: thick, bottom: thick, left: nil,   right: thin },
        right:  { top: thick, bottom: thick, left: nil,   right: thick }
    };
    return maps[pos];
}

function labelCell(text) {
    return new TableCell({
        children: [para([run(text, { bold: true, size: 20 })], {})],
        shading: { fill: C.lightGray, type: ShadingType.CLEAR },
        width: { size: 30, type: WidthType.PERCENTAGE },
        margins: { top: 80, bottom: 80, left: 100, right: 100 }
    });
}

function valueCell(text) {
    return new TableCell({
        children: [para(text, { size: 20 })],
        columnSpan: 3,
        margins: { top: 80, bottom: 80, left: 100, right: 100 }
    });
}

// --- HEADER ------------------------------------------------------------------
function createPageHeader() {
    const headerTable = new Table({
        rows: [new TableRow({
            children: [
                new TableCell({
                    children: [para([run('[LOGO]', { bold: true, size: 18, color: '9CA3AF' })],
                        { align: AlignmentType.CENTER, before: 60, after: 60 })],
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 60, bottom: 60, left: 120, right: 80 },
                    borders: hdrBorders('left')
                }),
                new TableCell({
                    children: [
                        para([run('{clientName}', { bold: true, size: 22, color: C.primary })],
                            { before: 40, after: 20 }),
                        para([run('Audit Conformit\u00e0 Legislativa ISO 14001', { size: 18, color: C.secondary })],
                            { after: 40 })
                    ],
                    width: { size: 55, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 60, bottom: 60, left: 160, right: 80 },
                    borders: hdrBorders('center')
                }),
                new TableCell({
                    children: [
                        para([run('REPORT {auditNumber}', { bold: true, size: 18, color: C.primary })],
                            { align: AlignmentType.CENTER, before: 30, after: 10 }),
                        para([run('{procedureCode}', { size: 16 })], { align: AlignmentType.CENTER, after: 0 }),
                        para([run('Rev.0', { size: 16 })], { align: AlignmentType.CENTER, after: 0 }),
                        para([run('{auditDate}', { size: 16 })], { align: AlignmentType.CENTER, before: 0, after: 30 })
                    ],
                    width: { size: 27, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 60, bottom: 60, left: 80, right: 120 },
                    borders: hdrBorders('right')
                })
            ]
        })],
        width: { size: 100, type: WidthType.PERCENTAGE }
    });
    return new Header({ children: [headerTable] });
}

function createFooter() {
    return {
        default: new Footer({
            children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun('Pag. '),
                    new TextRun({ children: [PageNumber.CURRENT] }),
                    new TextRun(' di '),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES] })
                ]
            })]
        })
    };
}

function createCoverPage() {
    return [
        new Paragraph({ text: 'Sommario', style: 'Titolo1', spacing: { before: 200, after: 200 } }),
        new TableOfContents('Sommario', { hyperlink: true, headingStyleRange: '1-3' }),
        new Paragraph({ text: '', pageBreakBefore: true })
    ];
}

// --- Sezione 1: Dati Generali ------------------------------------------------
function createSection1() {
    const rows = [
        ['OGGETTO:',                  '{auditObject}'],
        ['CAMPO APPLICAZIONE:',       '{scope}'],
        ['DOCUMENTI DI RIFERIMENTO:', '{referenceDocuments}'],
        ['DATA AUDIT:',               '{auditDate}'],
        ['ATTIVIT\u00c0/PROCESSI:',   '{processes}'],
        ['PROGRAMMA COMUNICATO IL:',  '{programCommunicatedDate}'],
        ['VERIFICATORE:',             '{auditor}']
    ].map(([label, value]) => new TableRow({ children: [labelCell(label), valueCell(value)] }));

    return [
        new Paragraph({ text: '1 \u2013 DATI GENERALI', style: 'Titolo1', spacing: { before: 0, after: 300 } }),
        new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: stdBorders(),
            margins: { top: 80, bottom: 80, left: 100, right: 100 } }),
        new Paragraph({ text: '', spacing: { after: 400 }, pageBreakBefore: true })
    ];
}

// --- Sezione 2: Obiettivo ----------------------------------------------------
function createSection2() {
    return [
        new Paragraph({ text: "2 \u2013 OBIETTIVO DELL'AUDIT", style: 'Titolo1', spacing: { before: 0, after: 300 } }),
        new Paragraph({ text: '{objectiveDescription}', spacing: { after: 300 } }),
        new Paragraph({ children: [run('Presenti per l\'organizzazione:', { bold: true })],
            spacing: { before: 300, after: 150 } }),
        new Table({
            rows: [
                new TableRow({ tableHeader: true, children: [
                    new TableCell({ children: [para([run('Funzione', { bold: true })], { align: AlignmentType.CENTER })],
                        shading: { fill: C.lightGray, type: ShadingType.CLEAR },
                        width: { size: 30, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 80, right: 80 } }),
                    new TableCell({ children: [para([run('Nome e Cognome', { bold: true })], { align: AlignmentType.CENTER })],
                        shading: { fill: C.lightGray, type: ShadingType.CLEAR },
                        width: { size: 70, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 80, right: 80 } })
                ]}),
                new TableRow({ children: [
                    new TableCell({ children: [para('{#participants}{role}', {})],
                        width: { size: 30, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 80, right: 80 } }),
                    new TableCell({ children: [para('{name}{/participants}', {})],
                        width: { size: 70, type: WidthType.PERCENTAGE }, margins: { top: 80, bottom: 80, left: 80, right: 80 } })
                ]})
            ],
            width: { size: 100, type: WidthType.PERCENTAGE }, borders: stdBorders()
        }),
        new Paragraph({ text: '', spacing: { after: 400 }, pageBreakBefore: true })
    ];
}

// --- Marker Checklist --------------------------------------------------------
function createChecklistMarker() {
    return [
        new Paragraph({
            children: [new TextRun({ text: 'CHECKLIST_MARKER', bold: true, color: 'AAAAAA', size: 18 })],
            spacing: { before: 0, after: 0 }
        })
    ];
}

// --- Sezione 11: Esito -------------------------------------------------------
function createSection11() {
    const metricsRows = [
        ['Non Conformit\u00e0 (NC)',              '{ncCount}'],
        ['Osservazioni (OSS)',               '{ossCount}'],
        ['Opportunit\u00e0 di Miglioramento (OM)','{omCount}'],
        ['Non Valutato (NV)',                '{nvCount}']
    ].map(([label, count]) => new TableRow({ children: [
        new TableCell({ children: [para([run(label, { bold: true })], {})],
            margins: { top: 80, bottom: 80, left: 100, right: 100 } }),
        new TableCell({ children: [para([run(count, { bold: true, size: 28 })], { align: AlignmentType.CENTER })],
            verticalAlign: VerticalAlign.CENTER, width: { size: 15, type: WidthType.PERCENTAGE } })
    ]}));

    return [
        new Paragraph({ text: "11 \u2013 ESITO DELL'AUDIT", style: 'Titolo1',
            spacing: { before: 0, after: 300 }, pageBreakBefore: true }),
        new Paragraph({ text: 'RILIEVI', style: 'Titolo2',
            spacing: { before: 300, after: 150 }, alignment: AlignmentType.CENTER }),
        new Paragraph({
            children: [new TextRun({ text: 'RILIEVI_MARKER', bold: true, color: 'AAAAAA', size: 18 })],
            spacing: { before: 0, after: 300 }
        }),
        new Paragraph({ text: 'Rilievi Emersi', style: 'Titolo2', spacing: { before: 300, after: 150 } }),
        new Table({ rows: metricsRows, width: { size: 60, type: WidthType.PERCENTAGE }, borders: stdBorders() }),
        new Paragraph({ text: '', spacing: { after: 200 } }),
        new Paragraph({ text: '{summaryText}', spacing: { after: 300 } }),
        new Paragraph({ text: 'Conclusioni', style: 'Titolo2', spacing: { before: 300, after: 150 } }),
        new Paragraph({ text: '{conclusions}', spacing: { after: 300 } })
    ];
}

// --- Main --------------------------------------------------------------------
async function main() {
    const doc = new Document({
        styles: {
            default: {
                document: { run: { font: 'Arial', size: 22 }, paragraph: { spacing: { line: 276, before: 0, after: 160 } } }
            },
            paragraphStyles: [
                { id: 'Titolo1', name: 'heading 1', basedOn: 'Normal', next: 'Normal',
                  run: { size: 28, bold: true, color: C.primary, font: 'Arial' },
                  paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
                { id: 'Titolo2', name: 'heading 2', basedOn: 'Normal', next: 'Normal',
                  run: { size: 24, bold: true, color: C.secondary, font: 'Arial' },
                  paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
                { id: 'Titolo3', name: 'heading 3', basedOn: 'Normal', next: 'Normal',
                  run: { size: 22, bold: true, color: '4B5563', font: 'Arial' },
                  paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } }
            ]
        },
        sections: [{
            properties: { page: { margin: { top: 2200, right: 1440, bottom: 1440, left: 1440, header: 400 } } },
            headers: { default: createPageHeader() },
            footers: createFooter(),
            children: [
                ...createCoverPage(),
                ...createSection1(),
                ...createSection2(),
                ...createChecklistMarker(),
                ...createSection11()
            ]
        }]
    });

    const outDir  = path.join(__dirname, '..', 'public', 'templates');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'ISO14001-audit-report.docx');
    const buffer  = await Packer.toBuffer(doc);
    fs.writeFileSync(outPath, buffer);

    console.log('Template ISO 14001 generato:', outPath);
}

main().catch(err => { console.error('Errore:', err); process.exit(1); });
