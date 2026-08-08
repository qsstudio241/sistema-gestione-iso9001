/**
 * Genera Word stampabile della checklist smoke copertura WPQR + visione.
 *
 * Uso (da root repo):
 *   node backend/scripts/generate-smoke-checklist-docx.js
 *
 * Output:
 *   docs/testing/SMOKE_COPERTURA_WPQR_VISIONE_CHECKLIST.docx
 *   /opt/cursor/artifacts/SMOKE_COPERTURA_WPQR_VISIONE_CHECKLIST.docx (se esiste la cartella)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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
  HeadingLevel,
} from '../../app/node_modules/docx/build/index.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const THIN = { style: BorderStyle.SINGLE, size: 1, color: '999999' };
const BORDERS = {
  top: THIN, bottom: THIN, left: THIN, right: THIN,
  insideHorizontal: THIN, insideVertical: THIN,
};

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    ...opts,
    children: [
      new TextRun({
        text: text || '',
        size: opts.size || 20,
        bold: !!opts.bold,
        italics: !!opts.italics,
      }),
    ],
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: level === HeadingLevel.HEADING_1 ? 28 : 24 })],
  });
}

function cell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || '', size: 18, bold: !!opts.bold })],
      }),
    ],
  });
}

function checkTable(headers, rows) {
  const widths = [600, 4200, 4200, 800];
  const headerRow = new TableRow({
    children: headers.map((h, i) => cell(h, widths[i], { bold: true })),
  });
  const body = rows.map(
    (r) => new TableRow({
      children: r.map((c, i) => cell(c, widths[i])),
    }),
  );
  return new Table({
    width: { size: 9800, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...body],
  });
}

async function main() {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Smoke test — Copertura WPQR + idoneità visiva',
                bold: true,
                size: 32,
              }),
            ],
          }),
          p('Destinatari: Studio Mason / Mauro Franciosi (ERAM) · Durata ~15 min · Produzione systemgest.netlify.app', { italics: true, size: 18 }),
          p('Data smoke: _______________    Eseguito da: _______________', { size: 18 }),

          heading('Contesto (prima → ora)', HeadingLevel.HEADING_2),
          p('Prima: WPS senza legame chiaro alle estensioni WPQR; assistente poteva rispondere senza tutti i dati; idoneità visiva fuori dal riesame; acuità e Ishihara come due documenti.'),
          p('Ora: un solo certificato oculistico; alert se manca per NDT; l’assistente chiede i dati mancanti poi verifica le WPQR; nel riesame due box informativi (WPQR + visione) senza bloccare il flusso.'),

          heading('Passo 1 — Qualifiche: idoneità visiva', HeadingLevel.HEADING_2),
          checkTable(
            ['#', 'Azione', 'Esito atteso', 'OK'],
            [
              ['1.1', 'Login utente ERAM', 'Accesso riuscito', '☐'],
              ['1.2', 'Qualifiche → tab NDT', 'Elenco patentini NDT', '☐'],
              ['1.3', 'Osservare banner', 'Banner se manca/scaduta visione (es. La Forgia)', '☐'],
              ['1.4', 'Salute mansione → Nuova', 'Un solo tipo: Certificato idoneità visiva (acuità + Ishihara)', '☐'],
            ],
          ),
          p('Note: ________________________________________________', { size: 18 }),

          heading('Passo 2 — Assistente: domande prima del verdetto', HeadingLevel.HEADING_2),
          checkTable(
            ['#', 'Azione', 'Esito atteso', 'OK'],
            [
              ['2.1', 'Aprire AskAi / Assistente', 'Chat disponibile', '☐'],
              ['2.2', '«Genera WPS FW, 10 mm e 5 mm, usando le WPQR» (senza materiali)', 'Chiede materiali/gruppi — non inventa', '☐'],
              ['2.3', 'Rispondere «S355 e S235»', 'Esito coperto / parziale / non realizzabile', '☐'],
              ['2.4', '(Opz.) Chip Mason completo', 'Check diretto se dati completi', '☐'],
            ],
          ),
          p('Note: ________________________________________________', { size: 18 }),

          heading('Passo 3 — Riesame: copertura informativa', HeadingLevel.HEADING_2),
          checkTable(
            ['#', 'Azione', 'Esito atteso', 'OK'],
            [
              ['3.1', 'Aprire Riesame + commessa ERAM', 'Caso aperto', '☐'],
              ['3.2', 'Verifica Copertura Saldatori → Verifica', 'Tabella saldatori ↔ WPS', '☐'],
              ['3.3', 'Box Copertura procedure (WPQR)', 'Coperto / dati incompleti / estensioni', '☐'],
              ['3.4', 'Box Idoneità visiva (NDT/VT)', 'Gap visione se certificato assente', '☐'],
              ['3.5', 'Verificare «solo informativo»', 'Semaforo saldatori non rosso solo per visione', '☐'],
            ],
          ),
          p('Note: ________________________________________________', { size: 18 }),

          heading('Passo 4 — (Opzionale) Chiusura cerchio visione', HeadingLevel.HEADING_2),
          checkTable(
            ['#', 'Azione', 'Esito atteso', 'OK'],
            [
              ['4.1', 'Caricare certificato idoneità visiva (scadenza futura)', 'Record in Salute mansione', '☐'],
              ['4.2', 'Riaprire NDT e riesame', 'Gap visione ridotto o assente', '☐'],
            ],
          ),

          heading('Domande di chiusura', HeadingLevel.HEADING_2),
          checkTable(
            ['#', 'Domanda', 'Risposta (sì/no/note)', 'OK'],
            [
              ['Q1', 'Hai capito subito chi non ha l’idoneità visiva?', '', '☐'],
              ['Q2', 'L’assistente ha inventato i materiali?', '', '☐'],
              ['Q3', 'Il riesame ti ha bloccato per la visione?', '', '☐'],
              ['Q4', 'Ti è chiaro che la procedura dipende dalle WPQR?', '', '☐'],
            ],
          ),

          heading('Esito complessivo', HeadingLevel.HEADING_2),
          p('☐ TEST OK    ☐ PARZIALE    ☐ KO'),
          p('Dettagli: ________________________________________________'),
          p('Firma / data: _______________________ / _______________'),
          p('ProgettoISO — smoke P3/P4/P5 (WPQR + visione) · 04/08/2026', { italics: true, size: 16 }),
        ],
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  const outDocs = path.join(__dirname, '../../docs/testing/SMOKE_COPERTURA_WPQR_VISIONE_CHECKLIST.docx');
  fs.mkdirSync(path.dirname(outDocs), { recursive: true });
  fs.writeFileSync(outDocs, buf);
  console.log('OK', outDocs);

  const artDir = '/opt/cursor/artifacts';
  if (fs.existsSync(artDir)) {
    const art = path.join(artDir, 'SMOKE_COPERTURA_WPQR_VISIONE_CHECKLIST.docx');
    fs.writeFileSync(art, buf);
    console.log('OK', art);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
