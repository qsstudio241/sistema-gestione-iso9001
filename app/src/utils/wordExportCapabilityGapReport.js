/**
 * wordExportCapabilityGapReport.js — Export Word report studio (gap capacità)
 * Template programmatico (docx), pattern analogo a wordExportSal.js / wordExportTechnicalReview.js.
 * Sorgente: snapshot persistito capability_gap_report (VC-1), non ricalcolo live.
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

const STATUS_LABELS = {
  ok: 'OK — capacità adeguata',
  gap: 'Gap rispetto alla capacità',
  need_input: 'Dati incompleti',
};

const SEVERITY_LABELS = {
  gap: 'Gap',
  need_input: 'Dati incompleti',
};

function formatDateIt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
        children: [new TextRun({ text: text || '', size: 18 })],
      }),
    ],
  });
}

const TABLE_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' },
  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'EEEEEE' },
};

/**
 * @param {{ report: object, caseTitle?: string, companyLabel?: string }} opts
 */
export function buildCapabilityGapReportFileName({ report, caseTitle } = {}) {
  const casePart = sanitizeFilePart(
    caseTitle || (report && report.case_id != null ? `caso-${report.case_id}` : 'caso'),
    'caso',
  );
  const datePart = formatDateFile(report?.generated_at);
  return `ReportStudio_GapCapacita_${casePart}_${datePart}.docx`;
}

/**
 * Costruisce il Document docx dallo snapshot (senza download).
 * @param {{ report: object, caseTitle?: string, companyLabel?: string }} opts
 */
export function buildCapabilityGapReportDocx({ report, caseTitle, companyLabel } = {}) {
  if (!report || typeof report !== 'object') {
    throw new Error('Snapshot report studio assente: genera il report prima di esportare.');
  }

  const summary = report.summary || {};
  const statusKey = summary.status || '';
  const statusLabel = STATUS_LABELS[statusKey] || statusKey || 'Non definito';
  const gaps = Array.isArray(report.gaps) ? report.gaps : [];
  const coverageRows = Array.isArray(report.coverage?.rows) ? report.coverage.rows : [];

  const metaLines = [
    new Paragraph({
      text: 'Report studio — gap capacità',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: 'Requisiti cliente × capacità azienda appaltatrice (snapshot persistito)',
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
    new Paragraph({ text: `Caso: ${caseTitle || `ID ${report.case_id ?? '—'}`}` }),
    new Paragraph({
      text: `Azienda capacità (company_id): ${
        companyLabel || (report.company_id != null ? String(report.company_id) : '—')
      }`,
    }),
    new Paragraph({ text: `Generato il: ${formatDateIt(report.generated_at) || '—'}` }),
    new Paragraph({
      text: `Esito: ${statusLabel}`,
      spacing: { after: 120 },
    }),
    new Paragraph({
      text:
        `Gap segnalati: ${summary.gaps_count ?? gaps.length}` +
        ` — Requisiti usati: ${summary.requirements_count ?? 0}` +
        (summary.coverage
          ? ` — WPS: ${summary.coverage.covered ?? 0}/${summary.coverage.total ?? 0}` +
            (summary.coverage.uncovered != null
              ? ` (${summary.coverage.uncovered} scoperte)`
              : '')
          : ''),
      spacing: { after: 200 },
    }),
  ];

  const gapHeader = new TableRow({
    tableHeader: true,
    children: [
      tableHeaderCell('Codice'),
      tableHeaderCell('Severità'),
      tableHeaderCell('Fonte'),
      tableHeaderCell('Messaggio'),
    ],
  });

  const gapDataRows =
    gaps.length > 0
      ? gaps.map(
          (g) =>
            new TableRow({
              children: [
                tableBodyCell(g.code || ''),
                tableBodyCell(SEVERITY_LABELS[g.severity] || g.severity || ''),
                tableBodyCell(g.source || ''),
                tableBodyCell(g.message || ''),
              ],
            }),
        )
      : [
          new TableRow({
            children: [
              tableBodyCell('—'),
              tableBodyCell('—'),
              tableBodyCell('—'),
              tableBodyCell('Nessun gap nello snapshot'),
            ],
          }),
        ];

  const gapsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [gapHeader, ...gapDataRows],
    borders: TABLE_BORDERS,
  });

  const children = [
    ...metaLines,
    new Paragraph({
      text: 'Elenco gap',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
    }),
    gapsTable,
  ];

  if (coverageRows.length > 0) {
    const covHeader = new TableRow({
      tableHeader: true,
      children: [
        tableHeaderCell('WPS'),
        tableHeaderCell('Processo'),
        tableHeaderCell('Esito'),
        tableHeaderCell('Saldatori qualificati'),
      ],
    });
    const covRows = coverageRows.map(
      (row) =>
        new TableRow({
          children: [
            tableBodyCell(row.wps_code || String(row.wps_id || '')),
            tableBodyCell(row.welding_process || ''),
            tableBodyCell(row.esito || ''),
            tableBodyCell(
              row.qualified_count != null ? String(row.qualified_count) : '',
            ),
          ],
        }),
    );
    children.push(
      new Paragraph({
        text: 'Copertura WPS (snapshot)',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 120 },
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [covHeader, ...covRows],
        borders: TABLE_BORDERS,
      }),
    );
  }

  children.push(
    new Paragraph({
      spacing: { before: 400 },
      children: [
        new TextRun({
          text:
            'Documento generato dallo snapshot persistito sul caso (non è la verifica live). ' +
            'Uso interno studio di consulenza.',
          italics: true,
          size: 18,
        }),
      ],
    }),
  );

  return new Document({
    sections: [{ properties: {}, children }],
  });
}

/**
 * Genera blob .docx (per test L1 e download).
 */
export async function generateCapabilityGapReportBlob(opts) {
  return Packer.toBlob(buildCapabilityGapReportDocx(opts));
}

/**
 * Download .docx da snapshot già in memoria.
 */
export async function exportCapabilityGapReportDocx(opts) {
  const blob = await generateCapabilityGapReportBlob(opts);
  const fileName = buildCapabilityGapReportFileName(opts);
  saveAs(blob, fileName);
  return fileName;
}

/**
 * Pattern NC: fetch snapshot via API poi download Word.
 * @param {number|string} caseId
 * @param {{ getCapabilityGapReport: Function }} apiService
 * @param {{ caseTitle?: string, companyLabel?: string }} meta
 */
export async function exportCapabilityGapReportFromApi(caseId, apiService, meta = {}) {
  if (!apiService || typeof apiService.getCapabilityGapReport !== 'function') {
    throw new Error('apiService.getCapabilityGapReport non disponibile');
  }
  const data = await apiService.getCapabilityGapReport(caseId);
  const report = data?.report ?? null;
  if (!report) {
    throw new Error('Nessuno snapshot report studio salvato: genera il report prima di esportare.');
  }
  return exportCapabilityGapReportDocx({
    report,
    caseTitle: meta.caseTitle,
    companyLabel: meta.companyLabel,
  });
}
