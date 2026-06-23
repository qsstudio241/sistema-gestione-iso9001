/**
 * generateManagementReviewTemplate.js
 * Genera il template Word per il Verbale del Riesame di Direzione ISO 9001 §9.3
 *
 * USO:  node scripts/generateManagementReviewTemplate.js
 * OUTPUT: app/public/templates/management-review-verbale.docx
 *
 * Segnaposto docxtemplater usati nel template:
 *   {review_number}  {review_date}  {company_name}  {chairperson}
 *   {period_from}    {period_to}
 *   {status_label}   {participants_text}
 *   {input_previous_actions}  {input_context_changes}
 *   {input_audits}            {input_nc_corrective}
 *   {input_objectives}        {input_process_performance}
 *   {input_customer_satisfaction}  {input_complaints}
 *   {input_suppliers}         {input_resources}
 *   {input_risk_effectiveness} {input_improvements}
 *   {output_improvements}     {output_sgq_changes}   {output_resources}
 *   {notes}
 */

'use strict';

const {
    Document, Paragraph, TextRun, Table, TableRow, TableCell,
    Header, Footer, AlignmentType, WidthType, BorderStyle,
    VerticalAlign, PageNumber, Packer, HeadingLevel,
} = require('docx');
const fs   = require('fs');
const path = require('path');

// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
    primary:   '1A365D',
    accent:    '2B6CB0',
    lightBlue: 'EBF8FF',
    gray:      '718096',
    lightGray: 'F7FAFC',
    black:     '000000',
    white:     'FFFFFF',
    border:    'CBD5E0',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function run(text, opts = {}) {
    return new TextRun({
        text,
        bold:   opts.bold   || false,
        italic: opts.italic || false,
        size:   opts.size   || 20,
        color:  opts.color  || C.black,
        font:   'Arial',
    });
}

function para(children, opts = {}) {
    return new Paragraph({
        children: Array.isArray(children) ? children : [run(children, opts)],
        alignment:      opts.align   || AlignmentType.LEFT,
        heading:        opts.heading || undefined,
        spacing:        { before: opts.before || 0, after: opts.after || 120 },
        pageBreakBefore: opts.pageBreak || false,
    });
}

function thinBorder() {
    const b = { style: BorderStyle.SINGLE, size: 4, color: C.border };
    return { top: b, bottom: b, left: b, right: b };
}

function noBorder() {
    const n = { style: BorderStyle.NIL };
    return { top: n, bottom: n, left: n, right: n };
}

function cell(children, opts = {}) {
    return new TableCell({
        children: Array.isArray(children) ? children : [children],
        shading:  opts.shading ? { type: 'solid', fill: opts.shading } : undefined,
        width:    opts.width   ? { size: opts.width, type: WidthType.DXA } : undefined,
        borders:  opts.noBorder ? noborder() : thinBorder(),
        verticalAlign: VerticalAlign.CENTER,
        margins:  { top: 80, bottom: 80, left: 100, right: 100 },
    });
}

function labelRow(label, placeholder) {
    return new Table({
        width:  { size: 100, type: WidthType.PERCENTAGE },
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        rows: [
            new TableRow({ children: [
                cell(para([run(label, { bold: true, size: 18, color: C.primary })]), { shading: C.lightGray }),
            ]}),
            new TableRow({ children: [
                cell(para([run(placeholder, { italic: true, color: C.gray, size: 20 })])),
            ]}),
        ],
        borders: { top: thinBorder().top, bottom: thinBorder().bottom, left: thinBorder().left, right: thinBorder().right },
    });
}

function sectionTitle(text, level = HeadingLevel.HEADING_2) {
    return new Paragraph({
        text,
        heading: level,
        spacing: { before: 280, after: 80 },
        shading: { type: 'solid', fill: C.lightBlue },
        border:  { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.accent } },
    });
}

// ─── Intestazione riesame ────────────────────────────────────────────────────
function headerTable() {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
            new TableRow({ children: [
                cell([
                    para([run('VERBALE DI RIESAME DELLA DIREZIONE', { bold: true, size: 28, color: C.white })]),
                    para([run('ISO 9001:2015  \u2014  \u00A79.3 Riesame di direzione', { size: 18, color: 'BEE3F8' })]),
                ], { shading: C.primary }),
                cell([
                    para([run('Numero:', { bold: true, size: 18, color: C.gray })]),
                    para([run('{review_number}', { bold: true, size: 22, color: C.primary })]),
                    para([run('Data: {review_date}', { size: 18 })]),
                    para([run('Stato: {status_label}', { size: 18 })]),
                ], { width: 3200 }),
            ]}),
        ],
    });
}

// ─── Documento ──────────────────────────────────────────────────────────────
const INPUT_FIELDS = [
    { label: 'a) Azioni da precedenti riesami  [\u00A79.3.2 a]',
      ph: '{input_previous_actions}' },
    { label: 'b) Cambiamenti nel contesto rilevanti per il SGQ  [\u00A79.3.2 b]',
      ph: '{input_context_changes}' },
    { label: 'c.6) Risultati degli audit interni  [\u00A79.3.2 c.6]',
      ph: '{input_audits}' },
    { label: 'c.4) Non conformit\u00E0 e azioni correttive  [\u00A79.3.2 c.4]',
      ph: '{input_nc_corrective}' },
    { label: 'c.2) Stato degli obiettivi per la qualit\u00E0  [\u00A79.3.2 c.2]',
      ph: '{input_objectives}' },
    { label: 'c.3) Prestazioni dei processi e conformit\u00E0 prodotti/servizi  [\u00A79.3.2 c.3]',
      ph: '{input_process_performance}' },
    { label: 'c.1) Soddisfazione del cliente e feedback parti interessate  [\u00A79.3.2 c.1]',
      ph: '{input_customer_satisfaction}' },
    { label: 'c.1) Reclami dei clienti \u2014 dettaglio  [\u00A79.3.2 c.1]',
      ph: '{input_complaints}' },
    { label: 'c.7) Prestazioni dei fornitori esterni  [\u00A79.3.2 c.7]',
      ph: '{input_suppliers}' },
    { label: 'd) Adeguatezza delle risorse  [\u00A79.3.2 d]',
      ph: '{input_resources}' },
    { label: 'e) Efficacia delle azioni su rischi e opportunit\u00E0  [\u00A79.3.2 e]',
      ph: '{input_risk_effectiveness}' },
    { label: 'f) Opportunit\u00E0 di miglioramento  [\u00A79.3.2 f]',
      ph: '{input_improvements}' },
];

const OUTPUT_FIELDS = [
    { label: 'Opportunit\u00E0 di miglioramento  [\u00A79.3.3 a]',    ph: '{output_improvements}' },
    { label: 'Modifiche al SGQ  [\u00A79.3.3 b]',                     ph: '{output_sgq_changes}' },
    { label: 'Fabbisogno di risorse  [\u00A79.3.3 c]',                ph: '{output_resources}' },
];

const doc = new Document({
    styles: {
        paragraphStyles: [
            {
                id: 'Heading2', name: 'Heading 2',
                run: { size: 24, bold: true, color: C.primary, font: 'Arial' },
            },
            {
                id: 'Heading3', name: 'Heading 3',
                run: { size: 20, bold: true, color: C.accent, font: 'Arial' },
            },
        ],
    },
    sections: [{
        properties: {},
        headers: {
            default: new Header({
                children: [
                    para([
                        run('Riesame di Direzione ', { bold: true, size: 18, color: C.primary }),
                        run('{review_number}  \u2014  {company_name}', { size: 18, color: C.gray }),
                    ], { align: AlignmentType.RIGHT }),
                ],
            }),
        },
        footers: {
            default: new Footer({
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            run('Pagina ', { size: 16, color: C.gray }),
                            new TextRun({ children: [PageNumber.CURRENT], size: 16, color: C.gray }),
                            run(' di ', { size: 16, color: C.gray }),
                            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: C.gray }),
                            run('  \u2014  SGQ ISO 9001:2015', { size: 16, color: C.gray }),
                        ],
                    }),
                ],
            }),
        },
        children: [
            // ── Intestazione ────────────────────────────────────────────
            headerTable(),
            para(''),

            // ── Dati generali ────────────────────────────────────────────
            sectionTitle('1 \u2014 Dati generali'),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({ children: [
                        cell(para([run('Azienda:', { bold: true })])),
                        cell(para([run('{company_name}')])),
                        cell(para([run('Periodo esaminato:', { bold: true })])),
                        cell(para([run('{period_from} \u2013 {period_to}')])),
                    ]}),
                    new TableRow({ children: [
                        cell(para([run('Presidente / Responsabile:', { bold: true })])),
                        cell(para([run('{chairperson}')])),
                        cell(para([run('Data riesame:', { bold: true })])),
                        cell(para([run('{review_date}')])),
                    ]}),
                ],
            }),
            para(''),

            // ── Partecipanti ─────────────────────────────────────────────
            sectionTitle('2 \u2014 Partecipanti'),
            para([run('{participants_text}', { italic: true })]),
            para(''),

            // ── §9.3.2 Input ─────────────────────────────────────────────
            sectionTitle('3 \u2014 \u00A79.3.2 Input del riesame'),
            para([run(
                'Ai sensi di ISO 9001:2015 \u00A79.3.2, il riesame ha preso in esame i seguenti elementi:',
                { size: 18, color: C.gray }
            )]),
            para(''),
            ...INPUT_FIELDS.flatMap(({ label, ph }) => [
                labelRow(label, ph),
                para(''),
            ]),

            // ── §9.3.3 Output ─────────────────────────────────────────────
            sectionTitle('4 \u2014 \u00A79.3.3 Output del riesame'),
            para([run(
                'Le decisioni e le azioni emerse dal riesame sono le seguenti:',
                { size: 18, color: C.gray }
            )]),
            para(''),
            ...OUTPUT_FIELDS.flatMap(({ label, ph }) => [
                labelRow(label, ph),
                para(''),
            ]),

            // ── Note ──────────────────────────────────────────────────────
            sectionTitle('5 \u2014 Note e conclusioni'),
            labelRow('Note generali', '{notes}'),
            para(''),

            // ── Firme ─────────────────────────────────────────────────────
            sectionTitle('6 \u2014 Firme'),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({ children: [
                        cell(para([run('Presidente / Resp. SGQ', { bold: true })])),
                        cell(para([run('Data')])),
                        cell(para([run('Firma')])),
                    ]}),
                    new TableRow({ children: [
                        cell(para([run('{chairperson}')])),
                        cell(para([run('{review_date}')])),
                        cell(para([run('')])),
                    ]}),
                ],
            }),
            para(''),
        ],
    }],
});

// ─── Salva file ──────────────────────────────────────────────────────────────
const outPath = path.resolve(__dirname, '../public/templates/management-review-verbale.docx');
Packer.toBuffer(doc).then((buf) => {
    fs.writeFileSync(outPath, buf);
    console.log('\u2705 Template generato:', outPath);
});
