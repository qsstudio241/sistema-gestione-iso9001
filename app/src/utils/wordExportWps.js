/**
 * wordExportWps.js — WPS Word (ISO 15609-1:2019 Annex A, informativo).
 * Blocchi A/D/E senza bordi; B (schizzo) e C (passate) con bordi.
 * Campi assenti → cella vuota (non inventati). MAG 135/136/138: n.a. su D7/E2/E5.
 * Schizzi: solo immagini fornite (mai disegnati).
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
  HeightRule,
  Header,
  Footer,
  ImageRun,
  PageNumber,
} from 'docx';
import {
  ANNEX_A_RANGE_NOTE,
  annexARunCells,
  formatAnnexPair,
  isMag135Family,
} from './wpsAnnexARanges.js';

const PAGE_W = 10440;
const THIN = { style: BorderStyle.SINGLE, size: 1, color: '666666' };
const NIL = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const BORDERS = {
  top: THIN,
  bottom: THIN,
  left: THIN,
  right: THIN,
  insideHorizontal: THIN,
  insideVertical: THIN,
};
const NO_BORDERS = {
  top: NIL,
  bottom: NIL,
  left: NIL,
  right: NIL,
  insideHorizontal: NIL,
  insideVertical: NIL,
};
const CELL_NIL = { top: NIL, bottom: NIL, left: NIL, right: NIL };

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

/** Enum WPQR/WPS (snake_case o inglese) → etichetta bilingue Annex A. */
const ANNEX_ENUM_LABELS = {
  manual: 'Manuale / Manual',
  partly_mechanized: 'Parzialmente meccanizzata / Partly mechanized',
  fully_mechanized: 'Meccanizzata / Fully mechanized',
  mechanized: 'Meccanizzata / Fully mechanized',
  automatic: 'Automatica / Automatic',
  stringer: 'Cordone diritto / Stringer',
  weave: 'Pendolamento / Weaving',
  weaving: 'Pendolamento / Weaving',
  oscillated: 'Pendolamento / Weaving',
  single: 'Mono-passata / Single run',
  multi: 'Multi-passata / Multi run',
};

export function formatAnnexEnum(value) {
  const raw = s(value).trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[\s-]+/g, '_');
  return ANNEX_ENUM_LABELS[key] || raw;
}

/** Accetta `{ runs }`, `{ data: { runs } }`, array, o `test_runs` sul record. */
export function pickWpqrTestRuns(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const nested = payload.runs
    || payload.test_runs
    || payload.data?.runs
    || payload.data?.test_runs;
  if (Array.isArray(nested)) return nested;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function thicknessRange(wps) {
  const min = wps.thickness_range_min;
  const max = wps.thickness_range_max;
  if (min == null && max == null) return '';
  if (min != null && max != null) return `${min} \u2013 ${max} mm`;
  if (min != null) return `\u2265 ${min} mm`;
  return `\u2264 ${max} mm`;
}

function pipeDiameterRange(wps) {
  const min = wps.pipe_diameter_min;
  const max = wps.pipe_diameter_max != null ? wps.pipe_diameter_max : null;
  if (min == null && max == null) return '';
  if (min != null && max != null && Number(min) !== Number(max)) {
    return `${min} \u2013 ${max} mm`;
  }
  const v = min != null ? min : max;
  return v != null ? `${v} mm` : '';
}

function parentMaterials(wps) {
  const a = s(wps.parent_material_a);
  const b = s(wps.parent_material_b);
  const group = s(wps.material_group);
  let body = '';
  if (a && b && a === b) body = a;
  else if (a && b) body = `${a} / ${b}`;
  else body = a || b;
  if (group) body = body ? `${body} (ISO/TR 15608 ${group})` : `ISO/TR 15608 ${group}`;
  return body;
}

function preparationCleaning(wps) {
  const p = s(wps.joint_preparation);
  const c = s(wps.cleaning_method);
  if (p && c) return `${p} / ${c}`;
  return p || c;
}

function naIfMag(isMag, value) {
  if (isMag) return 'n.a.';
  return s(value);
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

  const position = s(wps.position || wps.welding_positions);
  const process = s(wps.welding_process);
  const mag = isMag135Family(process);
  const runs = options.testRuns || wps.test_runs || [];
  const fillerMake = s(wps.filler_make || (runs[0] && runs[0].filler_make));

  return {
    wpsNo: s(wps.wps_code),
    revision: s(wps.revision),
    manufacturer: s(manufacturer),
    wpqrNo: s(wpqrNo),
    qualificationStandard: s(wps.qualification_standard),
    date: formatDateIt(wps.updated_at || wps.created_at || options.exportDate || new Date().toISOString()),
    materialGroup: s(wps.material_group),
    thickness: thicknessRange(wps),
    pipeDiameter: pipeDiameterRange(wps),
    jointType: s(wps.joint_type),
    weldingProcess: process,
    position,
    fillerMaterial: s(wps.filler_material),
    fillerMake,
    shieldingGas: s(wps.shielding_gas),
    preheatTemp: s(wps.preheat_temp),
    interpassTemp: s(wps.interpass_temp),
    parentMaterialA: s(wps.parent_material_a),
    parentMaterialB: s(wps.parent_material_b),
    parentMaterials: parentMaterials(wps),
    heatInput: s(wps.heat_input || wps.heat_input_note),
    currentRange: s(wps.current_range),
    voltageRange: s(wps.voltage_range),
    metalTransfer: s(wps.metal_transfer),
    pwht: s(wps.pwht),
    notes: s(wps.notes),
    throat: wps.throat_mm != null && wps.throat_mm !== '' ? `${wps.throat_mm} mm` : '',
    depositedWeldMetal: s(wps.deposited_thickness),
    preparationCleaning: preparationCleaning(wps),
    mechanization: formatAnnexEnum(wps.mechanization),
    shieldingGasFlow: formatAnnexPair(
      wps.shielding_gas_flow_l_min_min,
      wps.shielding_gas_flow_l_min_max,
      'l/min'
    ),
    backingGas: s(wps.backing_gas),
    backingGasFlow: s(wps.backing_gas_flow),
    bakingDrying: s(wps.baking_drying),
    tungsten: naIfMag(mag, wps.tungsten_electrode),
    backGouging: s(wps.back_gouging_backing),
    postHeating: s(wps.post_heating),
    preheatMaintenance: s(wps.preheat_maintenance_temp),
    pwhtDetails: s(wps.pwht_details),
    heatingCoolingRates: s(wps.heating_cooling_rates),
    weaving: formatAnnexEnum(wps.bead_technique),
    oscillation: naIfMag(mag, wps.oscillation_details),
    pulseDetails: s(wps.pulse_details),
    contactTube: formatAnnexPair(
      wps.contact_tube_distance_mm_min,
      wps.contact_tube_distance_mm_max,
      'mm'
    ),
    plasma: naIfMag(mag, wps.plasma_details),
    torchAngle: wps.torch_angle_deg != null && wps.torch_angle_deg !== ''
      ? `${wps.torch_angle_deg}\u00B0`
      : '',
    isMag: mag,
  };
}

function p(children, extra = {}) {
  return new Paragraph({
    spacing: { after: 0, line: 240, ...extra.spacing },
    alignment: extra.alignment,
    children,
  });
}

function run(text, opts = {}) {
  return new TextRun({
    text: text == null ? '' : String(text),
    bold: opts.bold || false,
    italics: opts.italics || false,
    size: opts.size || 18,
    color: opts.color,
    superScript: opts.superScript || false,
  });
}

/** Spezza ¹ / ² in apici. */
function markedRuns(text, opts = {}) {
  const src = text == null ? '' : String(text);
  const out = [];
  let buf = '';
  const flush = (superScript) => {
    if (!buf && !superScript) return;
    if (buf) out.push(run(buf, { ...opts, superScript: false }));
    buf = '';
  };
  for (const ch of src) {
    if (ch === '\u00B9' || ch === '\u00B2') {
      flush();
      out.push(run(ch === '\u00B9' ? '1' : '2', { ...opts, superScript: true }));
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(run(buf, opts));
  return out.length ? out : [run('', opts)];
}

function openCell({ width, bordered, fill, align, valign, span, height, children }) {
  return new TableCell({
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    columnSpan: span,
    shading: fill ? { fill } : undefined,
    verticalAlign: valign || VerticalAlign.CENTER,
    borders: bordered ? undefined : CELL_NIL,
    height: height ? { value: height, rule: HeightRule.ATLEAST } : undefined,
    children,
  });
}

function labelValuePair(en, it, value, widths, { bordered = false } = {}) {
  return [
    openCell({
      width: widths[0],
      bordered,
      children: [
        p(markedRuns(en, { bold: true, size: 16 })),
        it ? p(markedRuns(it, { italics: true, size: 14, color: '555555' })) : p([]),
      ],
    }),
    openCell({
      width: widths[1],
      bordered,
      children: [p([run(value, { size: 18 })])],
    }),
  ];
}

function fourColRow(l1en, l1it, v1, l2en, l2it, v2, widths = [2297, 2923, 2297, 2923]) {
  return new TableRow({
    children: [
      ...labelValuePair(l1en, l1it, v1, [widths[0], widths[1]]),
      ...labelValuePair(l2en, l2it, v2, [widths[2], widths[3]]),
    ],
  });
}

function headerCell(text, width) {
  return openCell({
    width,
    bordered: true,
    fill: 'E8EEF4',
    children: [
      p(markedRuns(text, { bold: true, size: 14 }), { alignment: AlignmentType.CENTER }),
    ],
  });
}

function dataCell(text, width) {
  return openCell({
    width,
    bordered: true,
    children: [p([run(text, { size: 14 })], { alignment: AlignmentType.CENTER })],
  });
}

function fitImage(w, h, maxW, maxH) {
  const width = Number(w) || maxW;
  const height = Number(h) || Math.round(maxW * 0.6);
  const scale = Math.min(maxW / width, maxH / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function sketchParagraphs(slot, { maxW, maxH }) {
  if (slot?.data) {
    const dim = fitImage(slot.widthPx || slot.width, slot.heightPx || slot.height, maxW, maxH);
    const kids = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new ImageRun({
            type: slot.type || 'png',
            data: slot.data,
            transformation: dim,
            altText: {
              title: slot.alt || 'Sketch',
              description: slot.caption || 'Weld sketch',
              name: slot.alt || 'sketch',
            },
          }),
        ],
      }),
    ];
    if (slot.caption) {
      kids.push(p(
        [run(slot.caption, { italics: true, size: 14, color: '444444' })],
        { alignment: AlignmentType.CENTER }
      ));
    }
    return kids;
  }
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [
        run('Vedi allegato / see attachment', { italics: true, size: 16, color: '666666' }),
      ],
    }),
  ];
}

function buildSketchTable(sketches = {}) {
  const combined = sketches.combined;
  const joint = sketches.joint || sketches.joint_design;
  const sequence = sketches.sequence || sketches.welding_sequence;
  const colW = PAGE_W / 2;
  const bodyH = 2268;
  const header = new TableRow({
    children: [
      headerCell('Joint design / Disegno del giunto', colW),
      headerCell('Welding sequences / Sequenza di saldatura', colW),
    ],
  });
  let body;
  if (combined?.data && !joint?.data && !sequence?.data) {
    body = new TableRow({
      height: { value: bodyH, rule: HeightRule.ATLEAST },
      children: [
        openCell({
          width: PAGE_W,
          bordered: true,
          span: 2,
          height: bodyH,
          valign: VerticalAlign.CENTER,
          children: sketchParagraphs(combined, { maxW: 620, maxH: 189 }),
        }),
      ],
    });
  } else {
    body = new TableRow({
      height: { value: bodyH, rule: HeightRule.ATLEAST },
      children: [
        openCell({
          width: colW,
          bordered: true,
          height: bodyH,
          valign: VerticalAlign.CENTER,
          children: sketchParagraphs(joint, { maxW: 321, maxH: 189 }),
        }),
        openCell({
          width: colW,
          bordered: true,
          height: bodyH,
          valign: VerticalAlign.CENTER,
          children: sketchParagraphs(sequence, { maxW: 321, maxH: 189 }),
        }),
      ],
    });
  }
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [colW, colW],
    rows: [header, body],
    borders: BORDERS,
  });
}

function buildRunTable(runs = []) {
  const headers = [
    'Run / Passata',
    'Welding process / Processo',
    'Size of filler material / Dimensione materiale d\u2019apporto',
    'Current\u00B2 A / Corrente\u00B2 A',
    'Voltage\u00B2 V / Tensione\u00B2 V',
    'Type of current/polarity / Tipo di corrente/polarit\u00E0',
    'Wire feed speed\u00B2 / Velocit\u00E0 avanzamento filo\u00B2',
    'Run out length\u00B9\u00B2 / travel speed\u00B2 / Lunghezza di deposito\u00B9\u00B2 / velocit\u00E0\u00B2',
    'Arc energy\u00B9\u00B2 / Heat input\u00B9\u00B2 / Energia d\u2019arco\u00B9\u00B2 / Apporto termico\u00B9\u00B2',
  ];
  const keys = ['run', 'process', 'filler', 'current', 'voltage', 'polarity', 'wire', 'speed', 'heat'];
  const widths = [627, 940, 1044, 1044, 1044, 1357, 1357, 1357, 1670];
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => headerCell(h, widths[i])),
  });
  const source = Array.isArray(runs) && runs.length ? runs : [{}, {}, {}, {}];
  const dataRows = source.map((raw) => {
    const cells = annexARunCells(raw);
    return new TableRow({
      children: keys.map((k, i) => dataCell(cells[k], widths[i])),
    });
  });
  return new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
    borders: BORDERS,
  });
}

function captionLine(en, it) {
  return new Paragraph({
    spacing: { before: 160, after: 40 },
    children: [
      ...markedRuns(en, { bold: true, size: 18 }),
      run('  ', { size: 18 }),
      ...markedRuns(it, { italics: true, size: 16, color: '555555' }),
    ],
  });
}

/**
 * Layout Annex A 2019 (blocchi A–F).
 * @param {object} wps
 * @param {{ manufacturer?: string, companyName?: string, wpqrCode?: string, exportDate?: string, testRuns?: object[], sketches?: object }} [options]
 */
export function buildWpsAnnexA2019Document(wps, options = {}) {
  const f = mapWpsToAnnexAFields(wps, options);
  const testRuns = pickWpqrTestRuns(options.testRuns) || [];
  const fromRecord = testRuns.length ? testRuns : pickWpqrTestRuns(wps);

  const headerA = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [2297, 2923, 2297, 2923],
    rows: [
      fourColRow(
        'Welding Procedure Specification:',
        'Specifica di procedura di saldatura (WPS) n.:',
        f.wpsNo,
        'Method of preparation and cleaning:',
        'Metodo di preparazione e pulizia:',
        f.preparationCleaning
      ),
      fourColRow(
        'Revision:',
        'Revisione:',
        f.revision,
        'Date:',
        'Data:',
        f.date
      ),
      fourColRow(
        'WPQR No.:',
        'WPQR n.:',
        f.wpqrNo,
        'Parent material designation(s):',
        'Designazione materiale/i base:',
        f.parentMaterials
      ),
      fourColRow(
        'Manufacturer:',
        'Fabbricante:',
        f.manufacturer,
        'Material thickness (mm)\u00B2:',
        'Spessore materiale (mm)\u00B2:',
        f.thickness
      ),
      fourColRow(
        'Mode(s) of metal transfer:',
        'Modo/i di trasferimento del metallo:',
        f.metalTransfer,
        'Outside diameter (mm)\u00B2:',
        'Diametro esterno (mm)\u00B2:',
        f.pipeDiameter
      ),
      fourColRow(
        'Joint type and weld type:',
        'Tipo di giunto e tipo di saldatura:',
        f.jointType,
        'Degree of mechanization:',
        'Grado di meccanizzazione:',
        f.mechanization
      ),
      fourColRow(
        'Throat thickness (mm)\u00B2:',
        'Spessore di gola (mm)\u00B2:',
        f.throat,
        'Welding position:',
        'Posizione di saldatura:',
        f.position
      ),
      fourColRow(
        'Deposited weld metal',
        'Metallo depositato (spessore, mm)',
        f.depositedWeldMetal,
        '',
        '',
        ''
      ),
    ],
    borders: NO_BORDERS,
  });

  const bodyDE = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [2297, 2923, 2297, 2923],
    rows: [
      fourColRow(
        'Filler material designation and make:',
        'Designazione e marca del materiale d\u2019apporto:',
        [f.fillerMaterial, f.fillerMake].filter(Boolean).join(' / '),
        'Other information\u00B9, e.g.:',
        'Altre informazioni\u00B9, ad es.:',
        ''
      ),
      fourColRow(
        'Any special baking or drying:',
        'Eventuale essiccazione/condizionamento speciale:',
        f.bakingDrying,
        'Weaving (maximum width of run):',
        'Pendolamento (larghezza massima della passata):',
        f.weaving
      ),
      fourColRow(
        'Designation gas/flux: \u2013 shielding:',
        'Designazione gas/flusso: \u2013 protezione:',
        f.shieldingGas,
        'Oscillation: amplitude, frequency, dwell time:',
        'Oscillazione: ampiezza, frequenza, tempo di sosta:',
        f.oscillation
      ),
      fourColRow(
        '\u2013 backing:',
        '\u2013 al rovescio:',
        f.backingGas,
        'Pulse welding details:',
        'Dettagli saldatura pulsata:',
        f.pulseDetails
      ),
      fourColRow(
        'Gas flow rate \u2013 shielding:',
        'Portata gas \u2013 protezione:',
        f.shieldingGasFlow,
        'Distance contact tube/work piece:',
        'Distanza tubo di contatto/pezzo:',
        f.contactTube
      ),
      fourColRow(
        '\u2013 backing:',
        '\u2013 al rovescio:',
        f.backingGasFlow,
        'Plasma welding details:',
        'Dettagli saldatura plasma:',
        f.plasma
      ),
      fourColRow(
        'Tungsten electrode type/size:',
        'Tipo/diametro elettrodo di tungsteno:',
        f.tungsten,
        'Torch angle:',
        'Angolo della torcia:',
        f.torchAngle
      ),
      fourColRow(
        'Details of back gouging/backing:',
        'Dettagli di solcatura al rovescio/sostegno:',
        f.backGouging,
        '',
        '',
        ''
      ),
      fourColRow(
        'Preheating temperature:',
        'Temperatura di preriscaldo:',
        f.preheatTemp,
        '',
        '',
        ''
      ),
      fourColRow(
        'Interpass temperature:',
        'Temperatura di interpass:',
        f.interpassTemp,
        '',
        '',
        ''
      ),
      fourColRow(
        'Postheating:',
        'Post-riscaldo:',
        f.postHeating,
        '',
        '',
        ''
      ),
      fourColRow(
        'Pre-heat maintenance temperature:',
        'Temperatura di mantenimento del preriscaldo:',
        f.preheatMaintenance,
        '',
        '',
        ''
      ),
      fourColRow(
        'Post-weld heat treatment and/or ageing:',
        'Trattamento termico post-saldatura e/o invecchiamento:',
        f.pwht,
        '',
        '',
        ''
      ),
      fourColRow(
        'Time, temperature, method:',
        'Tempo, temperatura, metodo:',
        f.pwhtDetails,
        '',
        '',
        ''
      ),
      fourColRow(
        'Heating and cooling rates\u00B9:',
        'Velocit\u00E0 di riscaldamento e raffreddamento\u00B9:',
        f.heatingCoolingRates,
        '',
        '',
        ''
      ),
    ],
    borders: NO_BORDERS,
  });

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                run(
                  [
                    f.qualificationStandard,
                    f.revision ? `Rev. ${f.revision}` : '',
                    f.date,
                    f.heatInput ? `HI ${f.heatInput}` : '',
                    f.currentRange ? `I ${f.currentRange}` : '',
                    f.voltageRange ? `U ${f.voltageRange}` : '',
                  ].filter(Boolean).join('   \u00B7   ') || 'ISO 15609-1:2019 Annex A',
                  { size: 14, color: '888888', italics: true }
                ),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                run('ISO 15609-1:2019 Annex A (informative) \u2014 SystemGest  ', {
                  italics: true, size: 14, color: '888888',
                }),
                new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '888888' }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [run('Welding Procedure Specification (WPS)', { bold: true, size: 28 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [run('Specifica di procedura di saldatura', { italics: true, size: 20 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [run('ISO 15609-1:2019 Annex A (informative) \u2014 SystemGest', {
            italics: true, size: 14, color: '888888',
          })],
        }),
        headerA,
        captionLine(
          'Weld preparation details (Sketch)\u00B9',
          'Dettagli di preparazione (schizzo)\u00B9'
        ),
        buildSketchTable(options.sketches || wps.sketches || {}),
        captionLine('Welding details', 'Dettagli di saldatura'),
        buildRunTable(fromRecord),
        new Paragraph({
          spacing: { before: 80, after: 80 },
          children: [run(ANNEX_A_RANGE_NOTE, { italics: true, size: 14, color: '555555' })],
        }),
        bodyDE,
        new Paragraph({
          spacing: { before: 280, after: 40 },
          children: [run('.......................................................................', { size: 18 })],
        }),
        new Paragraph({
          spacing: { after: 0 },
          children: [run('Manufacturer / Fabbricante', { bold: true, size: 18 })],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [run('(name, signature, date) / (nome, firma, data)', { italics: true, size: 16 })],
        }),
        new Paragraph({
          spacing: { after: 40 },
          children: [run(f.manufacturer, { size: 18 })],
        }),
        new Paragraph({
          spacing: { before: 80 },
          children: [
            ...markedRuns('\u00B9 If required. / Se richiesto.   ', { size: 14 }),
            ...markedRuns('\u00B2 Range. / Campo.', { size: 14 }),
          ],
        }),
      ],
    }],
  });
}

/** Alias pubblico: il template attivo è Annex A 2019. */
export function buildWpsAnnexADocument(wps, options = {}) {
  return buildWpsAnnexA2019Document(wps, options);
}

export async function generateWpsAnnexABlob(wps, options = {}) {
  const doc = buildWpsAnnexADocument(wps, options);
  return Packer.toBlob(doc);
}

export async function exportWpsAnnexADocx(wps, options = {}) {
  const blob = await generateWpsAnnexABlob(wps, options);
  const code = (wps?.wps_code || 'WPS').replace(/[^\w.-]+/g, '_');
  const rev = wps?.revision != null && wps.revision !== '' ? `_Rev${String(wps.revision).replace(/[^\w.-]+/g, '_')}` : '';
  saveAs(blob, `WPS_${code}${rev}.docx`);
  return blob;
}
