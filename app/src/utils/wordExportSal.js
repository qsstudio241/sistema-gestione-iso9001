/**
 * wordExportSal.js — Export Word tracker SAL (Stato Avanzamento Lavori)
 * Template programmatico (docx) — separato dal verbale Riesame di Direzione §9.3
 */

import { saveAs } from 'file-saver';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from 'docx';
import { SAL_STATUS_LABEL, SAL_STANDARD_LABEL } from './salConstants';

const STANDARD_COLORS = {
  ISO_9001_2015: '1F4788',
  ISO_14001_2015: '2E7D32',
  ISO_45001_2018: 'C62828',
};

function formatDateIt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function evidenceText(row) {
  const docs = row.evidenceDocuments;
  if (Array.isArray(docs) && docs.length) {
    return docs.map((d) => d.title || `Doc #${d.id}`).join('; ');
  }
  if (Array.isArray(row.evidenceDocumentIds) && row.evidenceDocumentIds.length) {
    return row.evidenceDocumentIds.map((id) => `#${id}`).join(', ');
  }
  return '';
}

function tableHeaderCell(text) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20 })],
      }),
    ],
    shading: { fill: 'E8EEF4' },
  });
}

function tableBodyCell(text, { color } = {}) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || '',
            size: 18,
            ...(color ? { color } : {}),
          }),
        ],
      }),
    ],
  });
}

/**
 * @param {{ companyName: string, standardFilter?: string, rows: object[], summary?: object }} opts
 */
export async function exportSalTrackerDocx({
  companyName,
  standardFilter,
  rows,
  summary,
}) {
  const exportDate = formatDateIt(new Date().toISOString().slice(0, 10));
  const filtered = (rows || []).filter((r) => r.status);

  const legend = new Paragraph({
    spacing: { after: 200 },
    children: [
      new TextRun({ text: 'Legenda standard: ', bold: true }),
      new TextRun({ text: 'ISO 9001', color: STANDARD_COLORS.ISO_9001_2015 }),
      new TextRun({ text: '  |  ' }),
      new TextRun({ text: 'ISO 14001', color: STANDARD_COLORS.ISO_14001_2015 }),
      new TextRun({ text: '  |  ' }),
      new TextRun({ text: 'ISO 45001', color: STANDARD_COLORS.ISO_45001_2018 }),
    ],
  });

  const summaryLine = summary
    ? `Totale: ${summary.total ?? filtered.length} — Completati: ${summary.completed ?? 0} — In corso: ${summary.in_progress ?? 0} — Da validare: ${summary.to_validate ?? 0}`
    : `Righe esportate: ${filtered.length}`;

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      tableHeaderCell('Clausola'),
      tableHeaderCell('Titolo'),
      tableHeaderCell('Standard'),
      tableHeaderCell('Stato'),
      tableHeaderCell('Responsabile'),
      tableHeaderCell('Scadenza'),
      tableHeaderCell('Evidenze (registro documenti)'),
      tableHeaderCell('Note'),
    ],
  });

  const dataRows = filtered.map((row) => {
    const stdLabel = SAL_STANDARD_LABEL[row.standardCode] || row.standardCode || '';
    const stdColor = STANDARD_COLORS[row.standardCode] || '333333';
    return new TableRow({
      children: [
        tableBodyCell(row.clauseRef || ''),
        tableBodyCell(row.clauseTitle || ''),
        tableBodyCell(stdLabel, { color: stdColor }),
        tableBodyCell(SAL_STATUS_LABEL[row.status] || row.status || ''),
        tableBodyCell(row.responsible || ''),
        tableBodyCell(row.dueDate ? formatDateIt(row.dueDate) : ''),
        tableBodyCell(evidenceText(row)),
        tableBodyCell(row.notes || ''),
      ],
    });
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' },
    },
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          text: 'SAL — Stato Avanzamento Lavori',
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
          text: 'Tracker implementazione SGQ (ISO 9001 / 14001 / 45001)',
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        }),
        new Paragraph({ text: `Azienda: ${companyName || '—'}` }),
        new Paragraph({ text: `Data export: ${exportDate}` }),
        new Paragraph({
          text: standardFilter
            ? `Filtro standard: ${SAL_STANDARD_LABEL[standardFilter] || standardFilter}`
            : 'Standard: tutti (9001, 14001, 45001)',
        }),
        new Paragraph({ text: summaryLine, spacing: { after: 200 } }),
        legend,
        table,
        new Paragraph({
          spacing: { before: 400 },
          children: [
            new TextRun({
              text: 'Evidenze collegate al Registro Documenti SGQ (document_registry).',
              italics: true,
              size: 18,
            }),
          ],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (companyName || 'azienda').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  saveAs(blob, `SAL_${safeName}_${exportDate.replace(/\//g, '-')}.docx`);
}
