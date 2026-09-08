/**
 * wordExportWeldingBook.js — Export Word Welding Book (IOF ISO 3834)
 * Template programmatico (docx), pattern analogo a wordExportWps.js.
 * Campi assenti → lasciati vuoti (non inventati). Niente esiti C/NC (ADR-016).
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
  AlignmentType,
  BorderStyle,
  VerticalAlign,
  ImageRun,
} from 'docx';

const saveAs =
  fileSaverModule.saveAs ||
  (fileSaverModule.default && fileSaverModule.default.saveAs) ||
  fileSaverModule.default;

const THIN = { style: BorderStyle.SINGLE, size: 1, color: '666666' };
const BORDERS = {
  top: THIN,
  bottom: THIN,
  left: THIN,
  right: THIN,
  insideHorizontal: THIN,
  insideVertical: THIN,
};

const EQUIPMENT_ROLE_LABELS = {
  welding_source: 'Sorgente saldatura',
  wire_feed: 'Alimentazione filo',
  gas: 'Gas',
  parameter_recorder: 'Registrazione parametri',
  positioner: 'Posizionatore',
  other: 'Altro',
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

function cell(text, opts = {}) {
  const {
    bold = false,
    fill,
    width,
    align = AlignmentType.LEFT,
    fontSize = 16,
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

function resolveEquipmentLabel(row, assetsById = {}) {
  if (row.internal_code || row.asset_name) {
    return [row.internal_code, row.asset_name, row.serial_number].filter(Boolean).join(' — ');
  }
  const asset = assetsById[String(row.asset_id)];
  if (asset) {
    return [asset.internal_code, asset.name, asset.serial_number].filter(Boolean).join(' — ');
  }
  return row.asset_id ? `Asset #${row.asset_id}` : '';
}

function resolveRoleLabel(role) {
  return EQUIPMENT_ROLE_LABELS[role] || s(role);
}

/**
 * Mapping Welding Book (testata + griglie) → campi IOF per Word.
 * @param {object} book
 * @param {{ equipment?: object[], welds?: object[], assetsById?: Record<string, object>, weldPhotosById?: Record<string, object[]>, exportDate?: string }} [options]
 */
export function mapWeldingBookToIofFields(book = {}, options = {}) {
  const equipment = Array.isArray(options.equipment)
    ? options.equipment
    : (Array.isArray(book.equipment) ? book.equipment : []);
  const welds = Array.isArray(options.welds)
    ? options.welds
    : (Array.isArray(book.welds) ? book.welds : []);
  const assetsById = options.assetsById || {};
  const weldPhotosById = options.weldPhotosById || {};

  return {
    bookNumber: s(book.book_number),
    revision: s(book.document_revision),
    status: s(book.status),
    productCode: s(book.product_code),
    productDescription: s(book.product_description),
    jobOrder: s(book.job_order),
    clientName: s(book.client_name || book.company_name),
    drawingRef: s(book.drawing_ref),
    drawingRevision: s(book.drawing_revision),
    wpsCode: s(book.wps_code),
    wpqrCode: s(book.wpqr_code),
    baseMaterial: s(book.base_material),
    fillerMaterial: s(book.filler_material),
    weldingProcess: s(book.welding_process),
    coordinatorName: s(book.coordinator_name),
    notes: s(book.notes),
    exportDate: formatDateIt(options.exportDate || book.updated_at || book.created_at || new Date().toISOString()),
    equipmentRows: equipment
      .filter((row) => row && (row.asset_id || row.internal_code || row.asset_name))
      .map((row) => ({
        label: resolveEquipmentLabel(row, assetsById),
        role: resolveRoleLabel(row.equipment_role),
        notes: s(row.notes),
      })),
    weldRows: welds.map((row, idx) => {
      const params = row.weld_params && typeof row.weld_params === 'object' ? row.weld_params : {};
      const photos = weldPhotosById[String(row.id)] || row.photos || [];
      const photoCount = Array.isArray(photos) ? photos.length : 0;
      return {
        id: row.id || null,
        sequenceNo: s(row.sequence_no) || String(idx + 1),
        jointCode: s(row.joint_code),
        jointDescription: s(row.joint_description),
        welderName: s(row.welder_name),
        weldDate: formatDateIt(row.weld_date),
        currentA: s(params.current_a),
        voltageV: s(params.voltage_v),
        travelSpeed: s(params.travel_speed),
        passes: s(params.passes),
        preheatC: s(params.preheat_c),
        interpassC: s(params.interpass_c),
        filler: s(params.filler || book.filler_material),
        gas: s(params.gas),
        notes: s(row.notes),
        photoCount,
        photoNote: photoCount > 0
          ? `${photoCount} foto`
          : (s(row.photo_note) || (row.notes && /foto/i.test(row.notes) ? s(row.notes) : '')),
        photos: Array.isArray(photos) ? photos : [],
      };
    }),
  };
}

function buildEquipmentTable(rows) {
  const widths = [4200, 2400, 2760];
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell('Attrezzatura', { bold: true, fill: 'E8EEF4', width: widths[0] }),
      cell('Ruolo', { bold: true, fill: 'E8EEF4', width: widths[1] }),
      cell('Note', { bold: true, fill: 'E8EEF4', width: widths[2] }),
    ],
  });
  const body = (rows.length ? rows : [{ label: '', role: '', notes: '' }]).map((row) => new TableRow({
    children: [
      cell(row.label, { width: widths[0] }),
      cell(row.role, { width: widths[1] }),
      cell(row.notes, { width: widths[2] }),
    ],
  }));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [header, ...body],
    borders: BORDERS,
  });
}

function buildWeldsTable(rows) {
  const widths = [700, 1100, 1800, 1400, 1000, 800, 800, 900, 860];
  const headers = ['N°', 'Giunto', 'Descrizione', 'Saldatore', 'Data', 'I (A)', 'U (V)', 'Vel.', 'Foto'];
  const header = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { bold: true, fill: 'E8EEF4', width: widths[i], fontSize: 14 })),
  });
  const body = (rows.length ? rows : [{
    sequenceNo: '', jointCode: '', jointDescription: '', welderName: '', weldDate: '',
    currentA: '', voltageV: '', travelSpeed: '', photoNote: '',
  }]).map((row) => new TableRow({
    children: [
      cell(row.sequenceNo, { width: widths[0], fontSize: 14 }),
      cell(row.jointCode, { width: widths[1], fontSize: 14 }),
      cell(row.jointDescription, { width: widths[2], fontSize: 14 }),
      cell(row.welderName, { width: widths[3], fontSize: 14 }),
      cell(row.weldDate, { width: widths[4], fontSize: 14 }),
      cell(row.currentA, { width: widths[5], fontSize: 14 }),
      cell(row.voltageV, { width: widths[6], fontSize: 14 }),
      cell(row.travelSpeed, { width: widths[7], fontSize: 14 }),
      cell(row.photoNote || '—', { width: widths[8], fontSize: 14 }),
    ],
  }));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [header, ...body],
    borders: BORDERS,
  });
}

function buildParamsDetailTable(rows) {
  const widths = [900, 1400, 1400, 1400, 1400, 2860];
  const headers = ['N°', 'Passate', 'T pre °C', 'T int °C', 'Apporto', 'Gas / note'];
  const header = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { bold: true, fill: 'E8EEF4', width: widths[i], fontSize: 14 })),
  });
  const body = (rows.length ? rows : [{
    sequenceNo: '', passes: '', preheatC: '', interpassC: '', filler: '', gas: '', notes: '',
  }]).map((row) => new TableRow({
    children: [
      cell(row.sequenceNo, { width: widths[0], fontSize: 14 }),
      cell(row.passes, { width: widths[1], fontSize: 14 }),
      cell(row.preheatC, { width: widths[2], fontSize: 14 }),
      cell(row.interpassC, { width: widths[3], fontSize: 14 }),
      cell(row.filler, { width: widths[4], fontSize: 14 }),
      cell([row.gas, row.notes].filter(Boolean).join(' — '), { width: widths[5], fontSize: 14 }),
    ],
  }));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows: [header, ...body],
    borders: BORDERS,
  });
}

function imageTypeFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('gif')) return 'gif';
  if (m.includes('bmp')) return 'bmp';
  return 'jpg';
}

function buildPhotoSectionChildren(weldRows) {
  const withPhotos = (weldRows || []).filter((row) => Array.isArray(row.photos) && row.photos.length > 0);
  if (!withPhotos.length) return [];

  const children = [sectionTitle('6. Foto cordone')];
  for (const row of withPhotos) {
    children.push(new Paragraph({
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({
          text: `Giunto ${row.sequenceNo || ''}${row.jointCode ? ` (${row.jointCode})` : ''} — ${row.photos.length} foto`,
          bold: true,
          size: 18,
        }),
      ],
    }));
    for (const photo of row.photos) {
      if (!photo?.data) continue;
      try {
        children.push(new Paragraph({
          spacing: { after: 80 },
          children: [
            new ImageRun({
              type: imageTypeFromMime(photo.mimeType),
              data: photo.data,
              transformation: { width: 280, height: 210 },
              altText: {
                title: photo.fileName || 'Foto cordone',
                description: 'Foto cordone Welding Book',
                name: photo.fileName || 'foto-cordone',
              },
            }),
          ],
        }));
      } catch {
        children.push(new Paragraph({
          children: [new TextRun({ text: `[Foto non incorporabile: ${photo.fileName || 'n/d'}]`, italics: true, size: 14 })],
        }));
      }
    }
  }
  return children;
}

/**
 * Costruisce il Document docx IOF (senza download).
 */
export function buildWeldingBookDocument(book, options = {}) {
  const f = mapWeldingBookToIofFields(book, options);
  const productLine = [f.productCode, f.productDescription].filter(Boolean).join(' — ');

  const headerTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1800, 2880, 1800, 2880],
    rows: [
      twoPairRow('WB n°', f.bookNumber, 'Revisione', f.revision),
      twoPairRow('Data export', f.exportDate, 'Stato', f.status),
      twoPairRow('Commessa', f.jobOrder, 'Cliente', f.clientName),
      twoPairRow('Disegno', f.drawingRef, 'Rev. disegno', f.drawingRevision),
      twoPairRow('WPS', f.wpsCode, 'WPQR', f.wpqrCode),
    ],
    borders: BORDERS,
  });

  const productTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2400, 6960],
    rows: [
      labelValueRow('Prodotto', productLine),
      labelValueRow('Materiale base', f.baseMaterial),
      labelValueRow('Materiale d\'apporto', f.fillerMaterial),
      labelValueRow('Processo (ISO 4063)', f.weldingProcess),
      labelValueRow('Coordinatore saldatura', f.coordinatorName),
    ],
    borders: BORDERS,
  });

  const signatureTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    rows: [
      new TableRow({
        children: [
          cell('Coordinatore', { bold: true, fill: 'E8EEF4', width: 3120, fontSize: 16 }),
          cell('Data', { bold: true, fill: 'E8EEF4', width: 3120, fontSize: 16 }),
          cell('Firma', { bold: true, fill: 'E8EEF4', width: 3120, fontSize: 16 }),
        ],
      }),
      new TableRow({
        children: [
          cell(f.coordinatorName, { width: 3120 }),
          cell('', { width: 3120 }),
          cell('', { width: 3120 }),
        ],
      }),
    ],
    borders: BORDERS,
  });

  const photoChildren = buildPhotoSectionChildren(f.weldRows);
  const hasPhotos = photoChildren.length > 0;

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
              text: 'WELDING BOOK',
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
              text: 'Istruzione operativa di fabbricazione (IOF) — ISO 3834',
              italics: true,
              size: 18,
            }),
          ],
        }),
        headerTable,
        sectionTitle('1. Prodotto e riferimenti'),
        productTable,
        sectionTitle('2. Attrezzature utilizzate'),
        buildEquipmentTable(f.equipmentRows),
        sectionTitle('3. Sequenza saldature'),
        buildWeldsTable(f.weldRows),
        sectionTitle('4. Parametri essenziali'),
        buildParamsDetailTable(f.weldRows),
        ...(f.notes
          ? [
            sectionTitle('Note generali'),
            new Paragraph({
              spacing: { after: 120 },
              children: [new TextRun({ text: f.notes, size: 18 })],
            }),
          ]
          : []),
        sectionTitle('5. Approvazione'),
        signatureTable,
        ...photoChildren,
        new Paragraph({
          spacing: { before: 280 },
          children: [
            new TextRun({
              text: hasPhotos
                ? 'Nota: foto cordone incorporate dalla sezione allegati per riga. Nessun campo esito/ispezione (IOF, non verbale).'
                : 'Nota: nessuna foto cordone allegata alle righe. Nessun campo esito/ispezione (IOF, non verbale).',
              italics: true,
              size: 14,
              color: '666666',
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 200 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: 'Welding Book IOF — SystemGest',
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
export async function generateWeldingBookBlob(book, options = {}) {
  const doc = buildWeldingBookDocument(book, options);
  return Packer.toBlob(doc);
}

/**
 * Download .docx IOF per un Welding Book.
 */
export async function exportWeldingBookDocx(book, options = {}) {
  const blob = await generateWeldingBookBlob(book, options);
  const code = (book?.book_number || book?.product_code || 'WB').replace(/[^\w.-]+/g, '_');
  const rev = book?.document_revision != null && book.document_revision !== ''
    ? `_Rev${String(book.document_revision).replace(/[^\w.-]+/g, '_')}`
    : '';
  saveAs(blob, `WeldingBook_${code}${rev}.docx`);
  return blob;
}
