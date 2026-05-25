/**
 * generateTemplate.js
 * Script Node.js da eseguire UNA VOLTA per creare il template Word ISO 9001.
 *
 * USO:
 *   node scripts/generateTemplate.js
 *
 * OUTPUT:
 *   app/public/templates/ISO9001-audit-report.docx
 *
 * Il file .docx generato contiene:
 *   - Segnaposto {varName}  â†’ riempiti da docxtemplater a runtime
 *   - Marker CHECKLIST_MARKER â†’ sostituito con tabelle colorate via OOXML
 *   - Marker RILIEVI_MARKER   â†’ sostituito con tabella rilievi via OOXML
 *
 * PER UN NUOVO STANDARD (es. ISO 14001):
 *   1. Copia e adatta questo script â†’ generateTemplate14001.js
 *   2. Eseguilo â†’ genera ISO14001-audit-report.docx
 *   3. Apri il .docx in Word, modifica layout/titoli a piacere
 *   4. Aggiungi 'ISO_14001' â†’ '/templates/ISO14001-audit-report.docx' in TEMPLATE_MAP (wordExport.js)
 *   Zero modifiche al codice per il layout!
 */

'use strict';

const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, WidthType, BorderStyle,
    VerticalAlign, PageNumber, TableOfContents, ShadingType, Packer
} = require('docx');
const fs = require('fs');
const path = require('path');

// â”€â”€â”€ Palette â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const C = {
    primary: '2C3E50',
    secondary: '34495E',
    lightGray: 'E5E7EB',
    black: '000000',
    white: 'FFFFFF'
};

// â”€â”€â”€ Micro-helpers docx â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function run(text, opts = {}) {
    return new TextRun({
        text,
        bold: opts.bold || false,
        italic: opts.italic || false,
        size: opts.size || 22,
        color: opts.color || undefined,
        font: 'Arial'
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
    // Header: bordo primario esterno, interno leggero
    const thick = { style: BorderStyle.SINGLE, size: 4, color: C.primary };
    const thin = { style: BorderStyle.SINGLE, size: 2, color: C.lightGray };
    const nil = { style: BorderStyle.NIL };
    const maps = {
        left: { top: thick, bottom: thick, left: thick, right: thin },
        center: { top: thick, bottom: thick, left: nil, right: thin },
        right: { top: thick, bottom: thick, left: nil, right: thick }
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

function valueCell(text, span = 3) {
    return new TableCell({
        children: [para(text, { size: 20 })],
        columnSpan: span,
        margins: { top: 80, bottom: 80, left: 100, right: 100 }
    });
}

// â”€â”€â”€ HEADER (ripetuto su ogni pagina) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createPageHeader() {
    const headerTable = new Table({
        rows: [new TableRow({
            children: [
                // Col 1 â€“ Logo placeholder
                new TableCell({
                    children: [para([run('[LOGO]', { bold: true, size: 18, color: '9CA3AF' })],
                        { align: AlignmentType.CENTER, before: 60, after: 60 })],
                    width: { size: 18, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 60, bottom: 60, left: 120, right: 80 },
                    borders: hdrBorders('left')
                }),
                // Col 2 â€“ Cliente + tipo documento
                new TableCell({
                    children: [
                        para([run('{clientName}', { bold: true, size: 22, color: C.primary })],
                            { before: 40, after: 20 }),
                        para([run('Check-List Interna Audit', { size: 18, color: C.secondary })],
                            { after: 40 })
                    ],
                    width: { size: 55, type: WidthType.PERCENTAGE },
                    verticalAlign: VerticalAlign.CENTER,
                    margins: { top: 60, bottom: 60, left: 160, right: 80 },
                    borders: hdrBorders('center')
                }),
                // Col 3 â€“ Riferimento documento
                new TableCell({
                    children: [
                        para([run('AUDIT REPORT {auditNumber}', { bold: true, size: 18, color: C.primary })],
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

// â”€â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Sommario â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createCoverPage() {
    return [
        new Paragraph({ text: 'Sommario', style: 'Titolo1', spacing: { before: 200, after: 200 } }),
        new TableOfContents('Sommario', { hyperlink: true, headingStyleRange: '1-3' }),
        new Paragraph({ text: '', pageBreakBefore: true })
    ];
}

// â”€â”€â”€ Sezione 1 â€“ Dati Generali â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createSection1() {
    const rows = [
        ['OGGETTO:', '{auditObject}'],
        ['CAMPO APPLICAZIONE:', '{scope}'],
        ['DOCUMENTI:', '{referenceDocuments}'],
        ['DATA AUDIT:', '{auditDate}'],
        ['PROCESSI/FUNZIONI:', '{processes}'],
        ['PROGRAMMA COMUNICATO IL:', '{programCommunicatedDate}'],
        ['VERIFICATORE:', '{auditor}']
    ].map(([label, value]) => new TableRow({ children: [labelCell(label), valueCell(value)] }));

    return [
        new Paragraph({
            text: '1 \u2013 DATI GENERALI',
            style: 'Titolo1',
            spacing: { before: 0, after: 300 }
        }),
        new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: stdBorders(),
            margins: { top: 80, bottom: 80, left: 100, right: 100 }
        }),
        new Paragraph({ text: '', spacing: { after: 400 }, pageBreakBefore: true })
    ];
}

// â”€â”€â”€ Sezione 2 â€“ Obiettivo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createSection2() {
    return [
        new Paragraph({ text: "2 \u2013 OBIETTIVO DELL'AUDIT", style: 'Titolo1', spacing: { before: 0, after: 300 } }),
        // Descrizione obiettivo (testo lungo)
        new Paragraph({ text: '{objectiveDescription}', spacing: { after: 300 } }),

        // Tabella partecipanti â€” loop riga docxtemplater:
        // prima riga header (statica), seconda riga con {#participants}{role}â€¦{/participants}
        new Paragraph({
            children: [run('Presenti per l\'organizzazione:', { bold: true })],
            spacing: { before: 300, after: 150 }
        }),
        new Table({
            rows: [
                // Header riga
                new TableRow({
                    tableHeader: true,
                    children: [
                        new TableCell({
                            children: [para([run('Funzione', { bold: true })], { align: AlignmentType.CENTER })],
                            shading: { fill: C.lightGray, type: ShadingType.CLEAR },
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            margins: { top: 80, bottom: 80, left: 80, right: 80 }
                        }),
                        new TableCell({
                            children: [para([run('Nome e Cognome', { bold: true })], { align: AlignmentType.CENTER })],
                            shading: { fill: C.lightGray, type: ShadingType.CLEAR },
                            width: { size: 70, type: WidthType.PERCENTAGE },
                            margins: { top: 80, bottom: 80, left: 80, right: 80 }
                        })
                    ]
                }),
                // Loop riga docxtemplater: una riga per ogni partecipante
                // {#participants} nell'ultima cella, {/participants} nella prima dell'ultima riga
                new TableRow({
                    children: [
                        new TableCell({
                            children: [para('{#participants}{role}', {})],
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            margins: { top: 80, bottom: 80, left: 80, right: 80 }
                        }),
                        new TableCell({
                            children: [para('{name}{/participants}', {})],
                            width: { size: 70, type: WidthType.PERCENTAGE },
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

// â”€â”€â”€ Marker Checklist (sarÃ  sostituito con OOXML a runtime) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createChecklistMarker() {
    // Il testo "CHECKLIST_MARKER" viene trovato da wordExport.js che lo sostituisce
    // con l'intera sezione checklist colorata generata da buildChecklistSectionOoxml()
    return [
        new Paragraph({
            children: [new TextRun({ text: 'CHECKLIST_MARKER', bold: true, color: 'AAAAAA', size: 18 })],
            spacing: { before: 0, after: 0 }
        })
    ];
}

// â”€â”€â”€ Sezione 11 â€“ Esito â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function createSection11() {
    // Tabella metriche con segnaposto
    const metricsRows = [
        ['Non ConformitÃ  (NC)', '{ncCount}'],
        ['Osservazioni (OSS)', '{ossCount}'],
        ['OpportunitÃ  di Miglioramento (OM)', '{omCount}'],
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
            text: "11 \u2013 ESITO DELL'AUDIT",
            style: 'Titolo1',
            spacing: { before: 0, after: 300 },
            pageBreakBefore: true
        }),

        // RILIEVI â€“ tabella iniettata a runtime
        new Paragraph({ text: 'RILIEVI', style: 'Titolo2', spacing: { before: 300, after: 150 }, alignment: AlignmentType.CENTER }),
        new Paragraph({
            children: [new TextRun({ text: 'RILIEVI_MARKER', bold: true, color: 'AAAAAA', size: 18 })],
            spacing: { before: 0, after: 300 }
        }),

        // Rilievi Emersi â€“ contatori
        new Paragraph({ text: 'Rilievi Emersi', style: 'Titolo2', spacing: { before: 300, after: 150 } }),
        new Table({
            rows: metricsRows,
            width: { size: 60, type: WidthType.PERCENTAGE },
            borders: stdBorders()
        }),
        new Paragraph({ text: '', spacing: { after: 200 } }),
        new Paragraph({ text: '{summaryText}', spacing: { after: 300 } }),

        new Paragraph({ text: 'Conclusioni', style: 'Titolo2', spacing: { before: 300, after: 150 } }),
        new Paragraph({ text: '{conclusions}', spacing: { after: 300 } })
    ];
}

// â”€â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                    // Word IT: "Titolo 1" â€” nome canonico 'heading 1' per TOC
                    id: 'Titolo1', name: 'heading 1', basedOn: 'Normal', next: 'Normal',
                    run: { size: 28, bold: true, color: C.primary, font: 'Arial' },
                    paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 }
                },
                {
                    id: 'Titolo2', name: 'heading 2', basedOn: 'Normal', next: 'Normal',
                    run: { size: 24, bold: true, color: C.secondary, font: 'Arial' },
                    paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 }
                },
                {
                    id: 'Titolo3', name: 'heading 3', basedOn: 'Normal', next: 'Normal',
                    run: { size: 22, bold: true, color: '4B5563', font: 'Arial' },
                    paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 }
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
                ...createCoverPage(),
                ...createSection1(),
                ...createSection2(),
                ...createChecklistMarker(),
                ...createSection11()
            ]
        }]
    });

    const outDir = path.join(__dirname, '..', 'public', 'templates');
    fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, 'ISO9001-audit-report.docx');
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outPath, buffer);

    console.log('âœ… Template ISO 9001 generato:', outPath);
    console.log('');
    console.log('Segnaposto nel template:');
    console.log('  Testo (docxtemplater): {clientName} {auditNumber} {procedureCode} {auditDate}');
    console.log('                         {auditObject} {scope} {referenceDocuments} {processes}');
    console.log('                         {programCommunicatedDate} {auditor}');
    console.log('                         {objectiveDescription} {#participants}{role}{name}{/participants}');
    console.log('                         {conclusions} {ncCount} {ossCount} {omCount} {nvCount} {summaryText}');
    console.log('  OOXML inject:          CHECKLIST_MARKER  RILIEVI_MARKER');
    console.log('');
    console.log('Per ISO 14001: copia questo script â†’ generateTemplate14001.js');
    console.log('  modificalo a piacere (titoli, campi, sezioni), poi esegui.');
}

main().catch(err => {
    console.error('âŒ Errore generazione template:', err);
    process.exit(1);
});
