/**
 * generateNcTemplate.js
 * Genera il template Word per export scheda singola NC (ISO 9001 par. 10.2).
 *
 * USO:
 *   node scripts/generateNcTemplate.js
 *
 * OUTPUT:
 *   app/public/templates/NC-scheda.docx
 */

'use strict';

const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell,
    Footer, AlignmentType, WidthType, BorderStyle,
    PageNumber, ShadingType, Packer,
} = require('docx');
const fs = require('fs');
const path = require('path');

const C = {
    primary: '2C3E50',
    secondary: '34495E',
    lightGray: 'E5E7EB',
    black: '000000',
};

function run(text, opts = {}) {
    return new TextRun({
        text,
        bold: opts.bold || false,
        italic: opts.italic || false,
        size: opts.size || 22,
        color: opts.color || undefined,
        font: 'Arial',
    });
}

function para(children, opts = {}) {
    return new Paragraph({
        children: Array.isArray(children) ? children : [run(children, opts)],
        alignment: opts.align || AlignmentType.LEFT,
        heading: opts.heading || undefined,
        spacing: { before: opts.before || 0, after: opts.after || 160 },
        pageBreakBefore: opts.pageBreak || false,
    });
}

function stdBorders() {
    const b = { style: BorderStyle.SINGLE, size: 1, color: C.black };
    return { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b };
}

function labelCell(text) {
    return new TableCell({
        children: [para([run(text, { bold: true, size: 20 })])],
        shading: { fill: C.lightGray, type: ShadingType.CLEAR },
        width: { size: 32, type: WidthType.PERCENTAGE },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
    });
}

function valueCell(text) {
    return new TableCell({
        children: [para(text, { size: 20 })],
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
    });
}

function metaRow(label, placeholder) {
    return new TableRow({
        children: [labelCell(label), valueCell(placeholder)],
    });
}

function sectionTitle(text) {
    return para(text, { bold: true, size: 24, color: C.secondary, before: 280, after: 120 });
}

function bodyBlock(placeholder) {
    return para(placeholder, { after: 240 });
}

function createFooter() {
    return {
        default: new Footer({
            children: [
                para(
                    [
                        run('Scheda NC ', { size: 18, color: '6B7280' }),
                        run('{ncNumber}', { size: 18, color: '6B7280' }),
                        run(' - Pag. ', { size: 18, color: '6B7280' }),
                        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '6B7280' }),
                    ],
                    { align: AlignmentType.CENTER, before: 0, after: 0 },
                ),
            ],
        }),
    };
}

async function main() {
    const metaTable = new Table({
        rows: [
            metaRow('Numero NC', '{ncNumber}'),
            metaRow('Cliente', '{clientName}'),
            metaRow('Audit', '{auditNumber}'),
            metaRow('Data audit', '{auditDate}'),
            metaRow('Sezione norma', '{sectionTitle}'),
            metaRow('Origine', '{sourceTypeLabel}'),
            metaRow('Severita', '{severityLabel}'),
            metaRow('Stato', '{statusLabel}'),
            metaRow('Scadenza NC', '{dueDate}'),
            metaRow('Data risoluzione', '{resolutionDate}'),
            metaRow('Responsabile NC', '{responsiblePerson}'),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: stdBorders(),
    });

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: 'Arial', size: 22 },
                    paragraph: { spacing: { line: 276, before: 0, after: 160 } },
                },
            },
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
                },
            },
            footers: createFooter(),
            children: [
                para('SCHEDA NON CONFORMITA', {
                    bold: true,
                    size: 32,
                    color: C.primary,
                    align: AlignmentType.CENTER,
                    after: 80,
                }),
                para('ISO 9001:2015 - Punto 10.2', {
                    size: 22,
                    color: C.secondary,
                    align: AlignmentType.CENTER,
                    after: 360,
                }),
                sectionTitle('1. Identificazione'),
                metaTable,
                sectionTitle('2. Descrizione'),
                bodyBlock('{description}'),
                sectionTitle('3. Analisi delle cause e valutazione'),
                bodyBlock('{rootCause}'),
                para('Necessit\u00E0 azione correttiva: {correctiveActionNeeded}', { size: 20, after: 60 }),
                para('Motivazione: {correctiveActionEvalNotes}', { size: 20, after: 120 }),
                sectionTitle('4. Correzione (ISO 10.2.1a)'),
                para('{#noCorrections}Nessuna correzione registrata.{/noCorrections}', { after: 120 }),
                para('{#corrections}', { after: 40 }),
                para('{actionIndex}. Immediata - {statusLabel}', { bold: true, size: 20, after: 60 }),
                para('Responsabile: {responsible}', { size: 20, after: 40 }),
                para('Scadenza: {dueDate}', { size: 20, after: 40 }),
                para('Completata il: {completedAt}', { size: 20, after: 40 }),
                para('{actionDescription}', { size: 20, after: 80 }),
                para('Verifica: {verificationNote}', { size: 20, after: 160 }),
                para('{/corrections}', { after: 0 }),
                sectionTitle('5. Azioni correttive / preventive'),
                para('{#noActions}Nessuna azione correttiva/preventiva registrata.{/noActions}', { after: 120 }),
                para('{#actions}', { after: 40 }),
                para('{actionIndex}. {typeLabel} - {statusLabel}', { bold: true, size: 20, after: 60 }),
                para('Responsabile: {responsible}', { size: 20, after: 40 }),
                para('Scadenza: {dueDate}', { size: 20, after: 40 }),
                para('Completata il: {completedAt}', { size: 20, after: 40 }),
                para('{actionDescription}', { size: 20, after: 80 }),
                para('Verifica: {verificationNote}', { size: 20, after: 160 }),
                para('{/actions}', { after: 0 }),
                sectionTitle('6. Verifica efficacia'),
                bodyBlock('{verificationNotes}'),
                para('Responsabile verifica: {verificationResponsible}', { after: 120 }),
                sectionTitle('7. Chiusura e approvazione'),
                para('Approvata da: {approvedByName}', { after: 60 }),
                para('Approvata il: {approvedAt}', { after: 120 }),
                sectionTitle('8. Evidenze allegate'),
                para('Totale allegati: {attachmentsCount}', { after: 120 }),
                para('NC_ATTACHMENTS_MARKER', { after: 0 }),
                para('', { before: 400, after: 0 }),
                para('Documento generato il {generatedAt}', {
                    italic: true,
                    size: 18,
                    color: '6B7280',
                    align: AlignmentType.RIGHT,
                }),
            ],
        }],
    });

    const outDir = path.join(__dirname, '..', 'public', 'templates');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'NC-scheda.docx');
    fs.writeFileSync(outPath, await Packer.toBuffer(doc));

    console.log('Template NC generato:', outPath);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
