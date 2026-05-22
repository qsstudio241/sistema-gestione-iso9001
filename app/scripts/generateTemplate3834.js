/**
 * generateTemplate3834.js
 * Script Node.js da eseguire UNA VOLTA per creare il template Word ISO 3834-2.
 *
 * USO:
 *   cd app && node scripts/generateTemplate3834.js
 *
 * OUTPUT:
 *   app/public/templates/ISO3834-audit-report.docx
 */

'use strict';

const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, WidthType, BorderStyle,
    VerticalAlign, PageNumber, ShadingType, Packer
} = require('docx');
const fs = require('fs');
const path = require('path');

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
    primary:   '1A3A5C',   // blu acciaio (richiama saldatura)
    secondary: '2C5F8A',
    accent:    'D97706',   // arancio sicurezza
    lightGray: 'E5E7EB',
    black:     '000000',
    white:     'FFFFFF'
};

// ─── Micro-helpers docx ───────────────────────────────────────────────────────
function run(text, opts = {}) {
    return new TextRun({
        text, bold: opts.bold || false, italic: opts.italic || false,
        size: opts.size || 22, color: opts.color || undefined, font: 'Arial'
    });
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
    return {
        left:   { top: thick, bottom: thick, left: thick, right: thin },
        center: { top: thick, bottom: thick, left: nil,   right: thin },
        right:  { top: thick, bottom: thick, left: nil,   right: thick }
    }[pos];
}

function labelCell(text, pct = 35) {
    return new TableCell({
        children: [para([run(text, { bold: true, size: 20 })], {})],
        shading: { fill: C.lightGray, type: ShadingType.CLEAR },
        width: { size: pct, type: WidthType.PERCENTAGE },
        margins: { top: 80, bottom: 80, left: 100, right: 100 }
    });
}

function valueCell(text, span = 2) {
    return new TableCell({
        children: [para(text, { size: 20 })],
        columnSpan: span,
        margins: { top: 80, bottom: 80, left: 100, right: 100 }
    });
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function createPageHeader() {
    const headerTable = new Table({
        rows: [new TableRow({
            children: [
                // Col 1 – Logo azienda auditata (placeholder)
                new TableCell({
                    children: [para([run('[LOGO]', { bold: true, size: 18, color: '9CA3AF' })],
                        { align: AlignmentType.CENTER, before: 60, after: 60 })],
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 60, bottom: 60, left: 120, right: 80 },
                    borders: hdrBorders('left')
                }),
                // Col 2 – Azienda + tipo documento
                new TableCell({
                    children: [
                        para([run('{clientName}', { bold: true, size: 22, color: C.primary })],
                            { before: 40, after: 10 }),
                        para([run('Visita Ispettiva ISO 3834-2', { size: 17, color: C.secondary })],
                            { after: 10 }),
                        para([run('{auditObject}', { size: 16, color: '6B7280', italic: true })],
                            { after: 40 })
                    ],
                    width: { size: 55, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 60, bottom: 60, left: 160, right: 80 },
                    borders: hdrBorders('center')
                }),
                // Col 3 – Numero rapporto + data
                new TableCell({
                    children: [
                        para([run('RAPPORTO N. {auditNumber}', { bold: true, size: 18, color: C.primary })],
                            { align: AlignmentType.CENTER, before: 30, after: 10 }),
                        para([run('{procedureCode}', { size: 16 })],
                            { align: AlignmentType.CENTER, after: 0 }),
                        para([run('Rev. 0', { size: 16 })],
                            { align: AlignmentType.CENTER, after: 0 }),
                        para([run('{auditDate}', { size: 16 })],
                            { align: AlignmentType.CENTER, before: 0, after: 30 })
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

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function createFooter() {
    return {
        default: new Footer({
            children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({ text: 'ISO 3834-2 | ', color: '9CA3AF', size: 18 }),
                    new TextRun({ text: 'Pag. ', size: 18 }),
                    new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                    new TextRun({ text: ' di ', size: 18 }),
                    new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 })
                ]
            })]
        })
    };
}

// ─── Sezione 1 – Dati Fornitore ───────────────────────────────────────────────
function createSection1() {
    const rows = [
        ['RAGIONE SOCIALE:', '{clientName}'],
        ['INDIRIZZO:', '{scope}'],
        ['PERSONA DI RIFERIMENTO:', '{auditor}'],
        ['DATA VISITA ISPETTIVA:', '{auditDate}'],
        ['TIPOLOGIA ELEMENTO SALDATO:', '{auditObject}'],
        ['DISEGNI/SPECIFICHE DI RIFERIMENTO:', '{referenceDocuments}'],
        ['ISPETTORE:', '{processes}'],
    ].map(([label, value]) => new TableRow({ children: [labelCell(label), valueCell(value)] }));

    return [
        new Paragraph({
            text: '1 – DATI FORNITORE',
            heading: 'Heading1',
            spacing: { before: 0, after: 300 }
        }),
        new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: stdBorders(),
            margins: { top: 80, bottom: 80, left: 100, right: 100 }
        }),
        new Paragraph({ text: '', spacing: { after: 400 } })
    ];
}

// ─── Sezione 2 – Scopo e Obiettivo ────────────────────────────────────────────
function createSection2() {
    return [
        new Paragraph({
            text: '2 - SCOPO DELLA VISITA ISPETTIVA',
            heading: 'Heading1',
            spacing: { before: 0, after: 300 }
        }),
        new Paragraph({ text: '{objectiveDescription}', spacing: { after: 200 } }),
        new Paragraph({
            children: [run('Presenti per il fornitore:', { bold: true })],
            spacing: { before: 300, after: 150 }
        }),
        new Table({
            rows: [
                new TableRow({
                    tableHeader: true,
                    children: [
                        new TableCell({
                            children: [para([run('Funzione / Ruolo', { bold: true })], { align: AlignmentType.CENTER })],
                            shading: { fill: C.lightGray, type: ShadingType.CLEAR },
                            width: { size: 35, type: WidthType.PERCENTAGE },
                            margins: { top: 80, bottom: 80, left: 80, right: 80 }
                        }),
                        new TableCell({
                            children: [para([run('Nome e Cognome', { bold: true })], { align: AlignmentType.CENTER })],
                            shading: { fill: C.lightGray, type: ShadingType.CLEAR },
                            width: { size: 65, type: WidthType.PERCENTAGE },
                            margins: { top: 80, bottom: 80, left: 80, right: 80 }
                        })
                    ]
                }),
                new TableRow({
                    children: [
                        new TableCell({
                            children: [para('{#participants}{role}', {})],
                            width: { size: 35, type: WidthType.PERCENTAGE },
                            margins: { top: 80, bottom: 80, left: 80, right: 80 }
                        }),
                        new TableCell({
                            children: [para('{name}{/participants}', {})],
                            width: { size: 65, type: WidthType.PERCENTAGE },
                            margins: { top: 80, bottom: 80, left: 80, right: 80 }
                        })
                    ]
                })
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: stdBorders()
        }),
        new Paragraph({ text: '', spacing: { after: 400 }, pageBreakBefore: true })
    ];
}

// ─── Marker Checklist ─────────────────────────────────────────────────────────
function createChecklistMarker() {
    return [
        new Paragraph({
            children: [new TextRun({ text: 'CHECKLIST_MARKER', bold: true, color: 'AAAAAA', size: 18 })],
            spacing: { before: 0, after: 0 }
        })
    ];
}

// ─── Sezione 11 – Esito ───────────────────────────────────────────────────────
function createSection11() {
    const metricsRows = [
        ['Non Conformità (NC)', '{ncCount}'],
        ['Osservazioni (OSS)', '{ossCount}'],
        ['Opportunità di Miglioramento (OM)', '{omCount}'],
        ['Non Valutato (NV)', '{nvCount}']
    ].map(([label, count]) => new TableRow({
        children: [
            new TableCell({
                children: [para([run(label, { bold: true })], {})],
                margins: { top: 80, bottom: 80, left: 100, right: 100 }
            }),
            new TableCell({
                children: [para([run(count, { bold: true, size: 28 })], { align: AlignmentType.CENTER })],
                verticalAlign: VerticalAlign.CENTER,
                width: { size: 15, type: WidthType.PERCENTAGE }
            })
        ]
    }));

    return [
        new Paragraph({
            text: '11 \u2013 ESITO DELLA VISITA ISPETTIVA',
            heading: 'Heading1',
            spacing: { before: 0, after: 300 },
            pageBreakBefore: true
        }),
        new Paragraph({
            text: 'RILIEVI',
            heading: 'Heading2',
            spacing: { before: 300, after: 150 },
            alignment: AlignmentType.CENTER
        }),
        new Paragraph({
            children: [new TextRun({ text: 'RILIEVI_MARKER', bold: true, color: 'AAAAAA', size: 18 })],
            spacing: { before: 0, after: 300 }
        }),
        new Paragraph({ text: 'Riepilogo Rilievi', heading: 'Heading2', spacing: { before: 300, after: 150 } }),
        new Table({
            rows: metricsRows,
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: stdBorders()
        }),
        new Paragraph({ text: '', spacing: { after: 200 } }),
        new Paragraph({ text: '{summaryText}', spacing: { after: 300 } }),
        new Paragraph({ text: 'Conclusioni', heading: 'Heading2', spacing: { before: 300, after: 150 } }),
        new Paragraph({ text: '{conclusions}', spacing: { after: 300 } })
    ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: 'Arial', size: 22 },
                    paragraph: { spacing: { line: 276, before: 0, after: 160 } }
                }
            },
            paragraphStyles: [
                {
                    id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
                    run: { size: 28, bold: true, color: C.primary, font: 'Arial' },
                    paragraph: { spacing: { before: 400, after: 200 } }
                },
                {
                    id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
                    run: { size: 24, bold: true, color: C.secondary, font: 'Arial' },
                    paragraph: { spacing: { before: 300, after: 150 } }
                },
                {
                    id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
                    run: { size: 22, bold: true, color: '4B5563', font: 'Arial' },
                    paragraph: { spacing: { before: 200, after: 100 } }
                }
            ]
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 2200, right: 1440, bottom: 1440, left: 1440, header: 400 }
                }
            },
            headers: { default: createPageHeader() },
            footers: createFooter(),
            children: [
                ...createSection1(),
                ...createSection2(),
                ...createChecklistMarker(),
                ...createSection11()
            ]
        }]
    });

    const outDir = path.join(__dirname, '..', 'public', 'templates');
    fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, 'ISO3834-audit-report.docx');
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outPath, buffer);

    console.log('✅ Template ISO 3834-2 generato:', outPath);
    console.log('');
    console.log('Mappatura campi:');
    console.log('  {clientName}            → Ragione Sociale azienda auditata');
    console.log('  {scope}                 → Indirizzo');
    console.log('  {auditor}               → Persona di riferimento');
    console.log('  {auditDate}             → Data visita');
    console.log('  {auditObject}           → Tipologia elemento saldato');
    console.log('  {referenceDocuments}    → Disegni/Specifiche di riferimento');
    console.log('  {processes}             → Nome ispettore');
    console.log('  {auditNumber}           → Numero rapporto');
    console.log('  {procedureCode}         → Codice procedura');
    console.log('  {objectiveDescription}  → Scopo della visita');
    console.log('  CHECKLIST_MARKER        → 4 sezioni ISO 3834 iniettate a runtime');
    console.log('  RILIEVI_MARKER          → Tabella rilievi iniettata a runtime');
}

main().catch(err => {
    console.error('❌ Errore generazione template:', err);
    process.exit(1);
});
