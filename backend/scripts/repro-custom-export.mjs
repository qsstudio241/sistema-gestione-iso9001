/**
 * Export Word di prova per audit `2026-06` (checklist custom).
 *
 * IMPORTANTE (vedi docs/DATABASE.md + backend/config/database.json):
 * - `NODE_ENV=test` → SQL su localhost:1433 (spesso assente in locale → errore ESOCKET).
 * - `NODE_ENV=development` → stesso host/porta del DB di lavoro documentato (es. busato.selfip.com:11043).
 * Cursor/terminal possono avere NODE_ENV=test: qui lo normalizziamo a development prima di caricare il pool.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { generateAuditDocxBlobForTesting } from '../../app/src/utils/wordExport.js';

const require = createRequire(import.meta.url);
if (process.env.NODE_ENV === 'test') {
  process.env.NODE_ENV = 'development';
  console.warn('[repro] NODE_ENV era "test" (localhost:1433) → impostato "development" per usare database.json come da docs/DATABASE.md');
}
const { getPool, closePool } = require('../src/config/database');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

global.fetch = async (url) => {
  if (String(url).startsWith('/templates/')) {
    const p = path.join(root, 'app', 'public', String(url).replace(/^\//, ''));
    const b = fs.readFileSync(p);
    return { ok: true, status: 200, arrayBuffer: async () => toArrayBuffer(b) };
  }
  return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
};

async function run() {
  const pool = await getPool();
  const audit = (
    await pool.request().query(`
      SELECT TOP 1 audit_id, audit_uuid, audit_number, client_name, auditor_name, audit_date, project_year, custom_checklist_id
      FROM audits
      WHERE audit_number = '2026-06'
    `)
  ).recordset[0];

  if (!audit) {
    throw new Error('Audit 2026-06 non trovato');
  }

  const sectionsRows = (
    await pool.request().query(`
      SELECT s.id section_id, s.code section_code, s.title section_title, s.display_order,
             i.id item_id, i.code item_code, i.title item_title, i.display_order item_order
      FROM custom_checklist_sections s
      LEFT JOIN custom_checklist_items i ON i.section_id = s.id
      WHERE s.custom_checklist_id = ${audit.custom_checklist_id}
      ORDER BY s.display_order, i.display_order
    `)
  ).recordset;

  const responsesRows = (
    await pool.request().query(`
      SELECT custom_item_id, evidence_blocks
      FROM audit_custom_checklist_responses
      WHERE audit_id = ${audit.audit_id}
    `)
  ).recordset;

  const attsRows = (
    await pool.request().query(`
      SELECT attachment_id, custom_item_id, file_name, mime_type, file_size
      FROM attachments
      WHERE audit_id = ${audit.audit_id}
      ORDER BY attachment_id
    `)
  ).recordset;

  const sectionMap = new Map();
  for (const r of sectionsRows) {
    if (!sectionMap.has(r.section_id)) {
      sectionMap.set(r.section_id, {
        id: r.section_id,
        code: r.section_code,
        title: r.section_title,
        display_order: r.display_order,
        items: [],
      });
    }
    if (r.item_id) {
      sectionMap.get(r.section_id).items.push({
        id: r.item_id,
        code: r.item_code,
        title: r.item_title,
        display_order: r.item_order,
      });
    }
  }

  const customChecklist = {
    id: audit.custom_checklist_id,
    sections: Array.from(sectionMap.values()),
  };

  const customResponses = {};
  for (const r of responsesRows) {
    try {
      customResponses[r.custom_item_id] =
        typeof r.evidence_blocks === 'string'
          ? JSON.parse(r.evidence_blocks || '[]')
          : (r.evidence_blocks || []);
    } catch {
      customResponses[r.custom_item_id] = [];
    }
  }

  const attachments = attsRows.map((x) => ({
    id: x.attachment_id,
    serverAttachmentId: x.attachment_id,
    customItemId: x.custom_item_id,
    fileName: x.file_name,
    name: x.file_name,
    mimeType: x.mime_type,
    fileSize: x.file_size,
  }));

  const auditForExport = {
    metadata: {
      id: audit.audit_uuid,
      auditId: audit.audit_id,
      auditNumber: audit.audit_number,
      clientName: audit.client_name,
      auditorName: audit.auditor_name,
      auditDate: audit.audit_date,
      projectYear: audit.project_year,
      customChecklistId: audit.custom_checklist_id,
      selectedStandards: [],
    },
    custom_checklist_id: audit.custom_checklist_id,
    customChecklist,
    customResponses,
    attachments,
    checklist: {},
  };

  const blob = await generateAuditDocxBlobForTesting(
    auditForExport,
    (id) => `https://dummy.local/attachments/${id}/view`,
    {
      customChecklistId: audit.custom_checklist_id,
      // Allineato a ExportPanel: embedding immagini (fetch fallisce → solo link testuale, ma stesso percorso codice).
      photoMode: 'preview',
    }
  );

  const out = path.join(root, 'app', 'tmp-audit-2026-06-repro.docx');
  fs.writeFileSync(out, Buffer.from(await blob.arrayBuffer()));
  console.log('GENERATED', out);

  // Stesso tipo di controllo usato in app/scripts/verify-template-repair.js (bilancio w:p).
  try {
    const PizZip = require(path.join(root, 'app', 'node_modules', 'pizzip'));
    const z2 = new PizZip(fs.readFileSync(out));
    const dx = z2.files['word/document.xml']?.asText() || '';
    const openP = (dx.match(/<w:p(?=[ \/>])/g) || []).length;
    const closeP = (dx.match(/<\/w:p>/g) || []).length;
    const nested = /<w:p[^>]*>\s*<w:p(?=[\s/>])/.test(dx);
    console.log(
      '[VALIDATE] word/document.xml w:p open=',
      openP,
      'close=',
      closeP,
      openP === closeP ? 'OK' : '!!! ERR BILANCIAMENTO'
    );
    console.log('[VALIDATE] pattern w:p annidato:', nested ? '!!! SI' : 'no');
    const ct = z2.files['[Content_Types].xml']?.asText() || '';
    const hasJpg = /Extension="jpg"/i.test(ct);
    console.log('[VALIDATE] [Content_Types] Default jpg:', hasJpg ? 'OK' : 'manca (fix solo dopo embed immagini)');
  } catch (e) {
    console.warn('[VALIDATE] skip (pizzip):', e.message);
  }
  await closePool();
  process.exit(0);
}

run().catch(async (e) => {
  console.error(e);
  await closePool().catch(() => {});
  process.exit(1);
});

