/**
 * wordExportContractReviewChecklist.js — Export Word checklist Riesame requisiti (ISO §8.2)
 *
 * HITL 02/09/2026 opzione B: voce P1–P10 / F1–F6 con esiti + note dal caso.
 * NON è Riesame di direzione (§9.3). Template programmatico (docx), pattern SAL / riesame tecnico.
 * Gap capacità: appendice sintetica opzionale se lo snapshot è passato.
 */

import * as fileSaverModule from 'file-saver';
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

const saveAs = fileSaverModule.saveAs ?? fileSaverModule.default?.saveAs ?? fileSaverModule.default;

const ANSWER_LABELS = {
  yes: 'Sì',
  no: 'No',
  na: 'N/A',
  partial: 'Parziale',
};

const STATUS_LABELS = {
  ok: 'OK — capacità adeguata',
  gap: 'Gap rispetto alla capacità',
  need_input: 'Dati incompleti',
};

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' },
};

function formatDateIt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateFile(iso) {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return 'export';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sanitizeFilePart(value, fallback = 'caso') {
  const cleaned = String(value || fallback)
    .replace(/[^\w\s.-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return cleaned || fallback;
}

function answerLabel(answer) {
  if (answer == null || answer === '') return 'Non compilato';
  return ANSWER_LABELS[answer] || String(answer);
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

function tableBodyCell(text) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: text == null ? '' : String(text), size: 18 })],
      }),
    ],
  });
}

function sortChecklistItems(items) {
  return [...(items || [])].sort((a, b) => {
    const ra = String(a.item_ref || a.itemRef || '');
    const rb = String(b.item_ref || b.itemRef || '');
    return ra.localeCompare(rb, 'it', { numeric: true });
  });
}

function buildChecklistTable(items) {
  const header = new TableRow({
    tableHeader: true,
    children: [
      tableHeaderCell('Ref'),
      tableHeaderCell('Voce'),
      tableHeaderCell('Esito'),
      tableHeaderCell('Note'),
    ],
  });
  const rows = sortChecklistItems(items).map((item) => {
    const ref = item.item_ref || item.itemRef || '';
    const text = item.item_text || item.itemText || '';
    return new TableRow({
      children: [
        tableBodyCell(ref),
        tableBodyCell(text),
        tableBodyCell(answerLabel(item.answer)),
        tableBodyCell(item.notes || ''),
      ],
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [header, ...rows],
    borders: TABLE_BORDERS,
  });
}

function metaParagraph(label, value) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 20 }),
      new TextRun({ text: value || '—', size: 20 }),
    ],
  });
}

function buildGapAppendix(gapReport) {
  if (!gapReport || typeof gapReport !== 'object') return [];
  const summary = gapReport.summary || {};
  const statusKey = summary.status || '';
  const statusLabel = STATUS_LABELS[statusKey] || statusKey || 'Non definito';
  const gaps = Array.isArray(gapReport.gaps) ? gapReport.gaps : [];
  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 360 },
      children: [new TextRun('Appendice — sintesi gap capacità')],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'Sezione sintetica opzionale (report studio VC-1). Non sostituisce la checklist §8.2.',
          italics: true,
          size: 18,
        }),
      ],
    }),
    metaParagraph('Stato snapshot', statusLabel),
    metaParagraph(
      'Generato il',
      gapReport.generated_at ? formatDateIt(gapReport.generated_at) : '',
    ),
    metaParagraph('Gap segnalati', String(summary.gaps_count ?? gaps.length)),
    metaParagraph('Requisiti usati', String(summary.requirements_count ?? '—')),
  ];
  if (gaps.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [new TextRun({ text: 'Nessun gap elencato nello snapshot.', size: 20 })],
      }),
    );
    return children;
  }
  children.push(
    new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: 'Prime voci gap', bold: true, size: 20 })],
    }),
  );
  gaps.slice(0, 8).forEach((g, idx) => {
    const msg = g.message || g.code || `Gap ${idx + 1}`;
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: `• ${msg}`, size: 18 })],
      }),
    );
  });
  if (gaps.length > 8) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `+ altri ${gaps.length - 8} gap (vedi Report studio in app)`,
            italics: true,
            size: 18,
          }),
        ],
      }),
    );
  }
  return children;
}

/**
 * @param {{ caseMeta?: object, checklist?: object[], gapReport?: object|null }} opts
 */
export function buildContractReviewChecklistFileName({ caseMeta } = {}) {
  const casePart = sanitizeFilePart(
    caseMeta?.title
      || caseMeta?.external_ref
      || (caseMeta?.id != null ? `caso-${caseMeta.id}` : 'caso'),
    'caso',
  );
  return `RiesameRequisiti_Checklist_${casePart}_${formatDateFile()}.docx`;
}

/**
 * @param {{ caseMeta?: object, checklist?: object[], gapReport?: object|null }} opts
 */
export function buildContractReviewChecklistDocx({
  caseMeta = {},
  checklist = [],
  gapReport = null,
} = {}) {
  const items = Array.isArray(checklist) ? checklist : [];
  const preliminary = items.filter((c) => (c.phase || '') === 'preliminary');
  const finalItems = items.filter((c) => (c.phase || '') === 'final');

  if (preliminary.length === 0 && finalItems.length === 0) {
    throw new Error(
      'Checklist assente: genera preliminare e/o finale prima di esportare.',
    );
  }

  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun('Riesame dei requisiti — Checklist')],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: 'ISO 9001:2015 §8.2 (requisiti per le prestazioni) — non è Riesame di direzione (§9.3)',
          italics: true,
          size: 18,
        }),
      ],
    }),
    metaParagraph('Caso', caseMeta.title || (caseMeta.id != null ? `#${caseMeta.id}` : '')),
    metaParagraph('Riferimento esterno', caseMeta.external_ref || ''),
    metaParagraph('Stato caso', caseMeta.status || ''),
    metaParagraph(
      'Cliente commerciale',
      caseMeta.commercial_customer_name || caseMeta.customer_name || '',
    ),
    metaParagraph(
      'Azienda SGQ (capacità)',
      caseMeta.company_name || caseMeta.company_label || '',
    ),
    metaParagraph('Esportato il', formatDateIt(new Date().toISOString())),
  ];

  if (preliminary.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280 },
        children: [new TextRun('Checklist preliminare (P1–P10)')],
      }),
      buildChecklistTable(preliminary),
    );
  } else {
    children.push(
      new Paragraph({
        spacing: { before: 280 },
        children: [
          new TextRun({
            text: 'Checklist preliminare: non generata su questo caso.',
            italics: true,
            size: 20,
          }),
        ],
      }),
    );
  }

  if (finalItems.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280 },
        children: [new TextRun('Checklist finale (F1–F6)')],
      }),
      buildChecklistTable(finalItems),
    );
  } else {
    children.push(
      new Paragraph({
        spacing: { before: 280 },
        children: [
          new TextRun({
            text: 'Checklist finale: non generata su questo caso.',
            italics: true,
            size: 20,
          }),
        ],
      }),
    );
  }

  children.push(...buildGapAppendix(gapReport));

  children.push(
    new Paragraph({
      spacing: { before: 360 },
      children: [
        new TextRun({
          text: 'Documento interno di tracciabilità del riesame requisiti. Le voci coincidono con la checklist compilata sul caso; non inventare requisiti aggiuntivi.',
          italics: true,
          size: 16,
        }),
      ],
    }),
  );

  return new Document({
    sections: [{ properties: {}, children }],
  });
}

export async function generateContractReviewChecklistBlob(opts) {
  return Packer.toBlob(buildContractReviewChecklistDocx(opts));
}

/**
 * @param {{ caseMeta?: object, checklist?: object[], gapReport?: object|null }} opts
 */
export async function exportContractReviewChecklistDocx(opts = {}) {
  const blob = await generateContractReviewChecklistBlob(opts);
  const fileName = buildContractReviewChecklistFileName(opts);
  saveAs(blob, fileName);
  return { blob, fileName };
}
