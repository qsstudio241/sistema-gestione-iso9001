/**
 * wordExportWps.js — Export Word WPS (ISO 15609-1 Annex A, informativo)
 * Template programmatico (docx), pattern analogo a wordExportSal.js.
 * Campi assenti → lasciati vuoti (non inventati).
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
  AlignmentType,
  BorderStyle,
  VerticalAlign,
} from 'docx';

const THIN = { style: BorderStyle.SINGLE, size: 1, color: '666666' };
const BORDERS = {
  top: THIN,
  bottom: THIN,
  left: THIN,
  right: THIN,
  insideHorizontal: THIN,
  insideVertical: THIN,
};

function formatDateIt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function s(value) {
  if (value == null || value === '') return '';
  return String(value);
}

function thicknessRange(wps) {
  const min = wps.thickness_range_min;
  const max = wps.thickness_range_max;
  if (min == null && max == null) return '';
  if (min != null && max != null) return `${min} – ${max} mm`;
  if (min != null) return `≥ ${min} mm`;
  return `≤ ${max} mm`;
}

/**
 * Mapping record welding_procedures → etichette Annex A.
 * Solo valori presenti; niente parametri inventati.
 */
export function mapWpsToAnnexAFields(wps = {}, options = {}) {
  const manufacturer =
    options.manufacturer
    || wps.company_name
    || options.companyName
    || '';

  const wpqrNo =
    options.wpqrCode
    || wps.wpqr_ref
    || (Array.isArray(wps.wpqr_records) && wps.wpqr_records[0]?.wpqr_code)
    || '';

  return {
    wpsNo: s(wps.wps_code),
    revision: s(wps.revision),
    manufacturer: s(manufacturer),
    wpqrNo: s(wpqrNo),
    qualificationStandard: s(wps.qualification_standard),
    date: formatDateIt(wps.updated_at || wps.created_at || options.exportDate || new Date().toISOString()),
    materialGroup: s(wps.material_group),
    thickness: thicknessRange(wps),
    pipeDiameter: wps.pipe_diameter_min != null ? `${wps.pipe_diameter_min} mm` : '',
    jointType: s(wps.joint_type),
    weldingProcess: s(wps.welding_process),
    position: s(wps.position),
    fillerMaterial: s(wps.filler_material),
    shieldingGas: s(wps.shielding_gas),
    preheatTemp: s(wps.preheat_temp),
    interpassTemp: s(wps.interpass_temp),
    heatInput: s(wps.heat_input || wps.heat_input_note),
    currentRange: s(wps.current_range || wps.current_type),
    voltageRange: s(wps.voltage_range),
    pwht: s(wps.pwht),
    notes: s(wps.notes),
  };
}

function cell(text, opts = {}) {
  const {
    bold = false,
    fill,
    width,
    align = AlignmentType.LEFT,
    fontSize = 18,
  } = opts;
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: fill ? { fill } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: text == null ? '' : String(text),
            bold,
            size: fontSize,
          }),
        ],
      }),
    ],
  });
}

function labelValueRow(label, value, colWidths = [2400, 6960]) {
  return new TableRow({
    children: [
      cell(label, { bold: true, fill: 'E8EEF4', width: colWidths[0] }),
      cell(value, { width: colWidths[1] }),
    ],
  });
}

function twoPairRow(l1, v1, l2, v2) {
  return new TableRow({
    children: [
      cell(l1, { bold: true, fill: 'E8EEF4', width: 1800 }),
      cell(v1, { width: 2880 }),
      cell(l2, { bold: true, fill: 'E8EEF4', width: 1800 }),
      cell(v2, { width: 2880 }),
    ],
  });
}

function sectionTitle(text) {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22 })],
  });
}

function emptyRunTable() {
  const headers = ['Passata', 'Processo', 'Ø filo / elettrodo', 'Corrente (A)', 'Tensione (V)', 'Velocità', 'Heat input'];
  const widths = [900, 1200, 1800, 1200, 1200, 1200, 1860];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { bold: true, fill: 'E8EEF4', width: widths[i], fontSize: 16 })),
  });
  const emptyRows = [1, 2, 3, 4].map(() => new TableRow({
    children: widths.map((w) => cell('', { width: w, fontSize: 16 })),
  }));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...emptyRows],
    borders: BORDERS,
  });
}

/**
 * Costruisce il Document docx Annex A (senza download).
 * @param {object} wps — record welding_procedures (+ opz. company_name, wpqr_records)
 * @param {{ manufacturer?: string, companyName?: string, wpqrCode?: string, exportDate?: string }} [options]
 */
export function buildWpsAnnexADocument(wps, options = {}) {
  const f = mapWpsToAnnexAFields(wps, options);
  const wpqrDisplay = f.wpqrNo
    || (f.qualificationStandard ? `(rif. ${f.qualificationStandard})` : '');

  const headerTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 2880, 1800, 2880],
    rows: [
      twoPairRow('WPS n°', f.wpsNo, 'Revisione', f.revision),
      twoPairRow('WPQR n°', wpqrDisplay, 'Data', f.date),
      twoPairRow('Produttore', f.manufacturer, 'Norma qualifica', f.qualificationStandard),
    ],
    borders: BORDERS,
  });

  const materialsTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: [
      labelValueRow('Gruppo materiale (ISO/TR 15608)', f.materialGroup),
      labelValueRow('Spessore (range)', f.thickness),
      labelValueRow('Diametro tubo (min)', f.pipeDiameter),
      labelValueRow('Tipo giunto', f.jointType),
    ],
    borders: BORDERS,
  });

  const processTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: [
      labelValueRow('Processo di saldatura (ISO 4063)', f.weldingProcess),
      labelValueRow('Posizione (ISO 6947)', f.position),
      labelValueRow('Materiale d\'apporto', f.fillerMaterial),
      labelValueRow('Gas di protezione (ISO 14175)', f.shieldingGas),
    ],
    borders: BORDERS,
  });

  const thermalTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 2880, 1800, 2880],
    rows: [
      twoPairRow('Tp (preriscaldo)', f.preheatTemp, 'Ti (interpass)', f.interpassTemp),
      twoPairRow('Heat input', f.heatInput, 'PWHT', f.pwht),
      twoPairRow('Corrente', f.currentRange, 'Tensione', f.voltageRange),
    ],
    borders: BORDERS,
  });

  const sketchBox = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9360, type: WidthType.DXA },
            borders: BORDERS,
            children: [
              new Paragraph({
                spacing: { before: 200, after: 200 },
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Sketch giunto / sequenza passate — (da allegare)',
                    italics: true,
                    size: 18,
                    color: '666666',
                  }),
                ],
              }),
              new Paragraph({ spacing: { after: 400 }, children: [] }),
              new Paragraph({ spacing: { after: 400 }, children: [] }),
            ],
          }),
        ],
      }),
    ],
    borders: BORDERS,
  });

  const signatureTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    rows: [
      new TableRow({
        children: [
          cell('Nome produttore / coordinatore', { bold: true, fill: 'E8EEF4', width: 3120, fontSize: 16 }),
          cell('Data', { bold: true, fill: 'E8EEF4', width: 3120, fontSize: 16 }),
          cell('Firma', { bold: true, fill: 'E8EEF4', width: 3120, fontSize: 16 }),
        ],
      }),
      new TableRow({
        children: [
          cell(f.manufacturer, { width: 3120 }),
          cell('', { width: 3120 }),
          cell('', { width: 3120 }),
        ],
      }),
    ],
    borders: BORDERS,
  });

  return new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: 'SPECIFICA DI PROCEDURA DI SALDATURA (WPS)',
              bold: true,
              size: 28,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: 'Modulo ispirato a ISO 15609-1:2019 Annex A (informativo)',
              italics: true,
              size: 18,
            }),
          ],
        }),
        headerTable,
        sectionTitle('1. Materiali e giunto'),
        materialsTable,
        sectionTitle('2. Processo e consumabili'),
        processTable,
        sectionTitle('3. Temperature e parametri elettrici'),
        thermalTable,
        sectionTitle('4. Sketch giunto / sequenza passate'),
        sketchBox,
        sectionTitle('5. Tabella passate'),
        emptyRunTable(),
        ...(f.notes
          ? [
            sectionTitle('Note'),
            new Paragraph({
              spacing: { after: 120 },
              children: [new TextRun({ text: f.notes, size: 18 })],
            }),
          ]
          : []),
        sectionTitle('6. Approvazione produttore'),
        signatureTable,
        new Paragraph({
          spacing: { before: 360 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'Modulo ispirato a ISO 15609-1 Annex A (informativo) — SystemGest',
              italics: true,
              size: 14,
              color: '888888',
            }),
          ],
        }),
      ],
    }],
  });
}

/**
 * Genera blob .docx (per test L1 e download).
 */
export async function generateWpsAnnexABlob(wps, options = {}) {
  const doc = buildWpsAnnexADocument(wps, options);
  return Packer.toBlob(doc);
}

/**
 * Download .docx Annex A per una WPS.
 */
export async function exportWpsAnnexADocx(wps, options = {}) {
  const blob = await generateWpsAnnexABlob(wps, options);
  const code = (wps?.wps_code || 'WPS').replace(/[^\w.-]+/g, '_');
  const rev = wps?.revision != null && wps.revision !== '' ? `_Rev${String(wps.revision).replace(/[^\w.-]+/g, '_')}` : '';
  saveAs(blob, `WPS_${code}${rev}.docx`);
  return blob;
}
