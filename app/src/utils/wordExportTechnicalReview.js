/**
 * Export Word riesame tecnico ISO 3834-3 §5.3 (programmatico, pattern SAL/WPS).
 */

import { saveAs } from "file-saver";
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
} from "docx";
import { TECHNICAL_REVIEW_ITEMS } from "../data/technicalReviewItems";
import {
  formatTechnicalReviewCompletion,
  getTechnicalReviewCompletion,
  isTechnicalReviewComplete,
  parseTechnicalReviewChecklist,
} from "./technicalReviewChecklist";

function cell(text, { bold = false, fill } = {}) {
  return new TableCell({
    width: { size: 3000, type: WidthType.DXA },
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || "", bold, size: 20 })],
      }),
    ],
    ...(fill ? { shading: { fill } } : {}),
  });
}

export function buildTechnicalReviewDocx({
  projectCode,
  clientName,
  status,
  checklist,
}) {
  const parsed = parseTechnicalReviewChecklist(checklist);
  const complete = isTechnicalReviewComplete(parsed);
  const stamp = getTechnicalReviewCompletion(parsed);
  const stampLine = stamp
    ? formatTechnicalReviewCompletion(stamp)
    : complete
      ? "Checklist completa (timbro al salvataggio)"
      : "Checklist incompleta";

  const rows = [
    new TableRow({
      children: [
        cell("Punto", { bold: true, fill: "E8EEF4" }),
        cell("Esito", { bold: true, fill: "E8EEF4" }),
        cell("Nota", { bold: true, fill: "E8EEF4" }),
      ],
    }),
    ...TECHNICAL_REVIEW_ITEMS.map((item) => {
      const state = parsed[item.key] || {};
      return new TableRow({
        children: [
          cell(item.label),
          cell(state.checked ? "Verificato" : "Da completare"),
          cell(state.note || ""),
        ],
      });
    }),
  ];

  return new Document({
    sections: [
      {
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun("Riesame tecnico ISO 3834-3 §5.3")],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Commessa: ", bold: true }),
              new TextRun(projectCode || "—"),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Cliente: ", bold: true }),
              new TextRun(clientName || "—"),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Stato: ", bold: true }),
              new TextRun(status || "—"),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: stampLine, italics: true })],
          }),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows,
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: "Documento interno di tracciabilità. Non sostituisce la norma.",
                size: 18,
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });
}

export async function generateTechnicalReviewBlob(opts) {
  return Packer.toBlob(buildTechnicalReviewDocx(opts));
}

export async function exportTechnicalReviewDocx(opts) {
  const blob = await generateTechnicalReviewBlob(opts);
  const code = String(opts.projectCode || "commessa").replace(/[^\w.-]+/g, "_");
  saveAs(blob, `Riesame-tecnico-3834-${code}.docx`);
  return blob;
}
