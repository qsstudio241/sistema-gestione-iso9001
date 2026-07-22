#!/usr/bin/env node
/**
 * Genera checklist file-per-file con studio, azienda e azione consigliata.
 * VPS: NODE_ENV=production DB_SERVER=127.0.0.1 node scripts/build-norm-reaudit-checklist-vps.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const { query, getPool, closePool } = require(path.join(backendRoot, 'src/config/database'));

const reportPath = path.join(__dirname, 'reaudit-norms-report.json');

function actionLabel(verdict, item) {
  if (verdict === 'ok') return 'NESSUNA — già allineato';
  if (verdict === 'review') {
    const st = (item.stored?.standard_code || '').replace(/_/g, ' ');
    const ex = (item.extracted?.standard_code || '').replace(/_/g, ' ');
    if (st && ex && st.replace(/\s+/g, ' ').toUpperCase() === ex.replace(/\s+/g, ' ').toUpperCase()) {
      return 'VERIFICA UI — codice equivalente, probabile solo formato';
    }
    return 'VERIFICA — controllare in UI prima di cancellare';
  }
  const st = item.stored?.standard_code || '(vuoto)';
  const ex = item.extracted?.standard_code || '?';
  if (st !== ex && /15608/.test(ex) && /15614/.test(st)) {
    return 'CANCELLA E RICARICA — codice errato (15614 letto come 15608)';
  }
  if (!item.stored?.standard_code) {
    return 'CANCELLA E RICARICA — codice assente nel DB';
  }
  return 'CANCELLA E RICARICA — metadati non allineati alla pipeline attuale';
}

async function main() {
  if (!fs.existsSync(reportPath)) {
    console.error('Report mancante. Eseguire prima: node scripts/reaudit-norms-from-pdf-vps.js');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const byId = new Map(report.items.map((i) => [i.document_id, i]));

  await getPool();

  const meta = await query(`
    SELECT
      dr.id,
      dr.organization_id,
      dr.company_id,
      dr.title,
      dr.parent_id,
      p.title AS cartella,
      p.folder_code,
      ao.name AS studio,
      c.name AS azienda
    FROM document_registry dr
    LEFT JOIN document_registry p ON p.id = dr.parent_id
    LEFT JOIN auditor_orgs ao ON ao.organization_id = dr.organization_id
    LEFT JOIN companies c ON c.id = dr.company_id
    WHERE dr.doc_type = 'norma'
      AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
    ORDER BY ao.name, c.name, dr.id
  `);

  const rows = [];
  for (const m of meta.recordset) {
    const audit = byId.get(m.id);
    if (!audit) continue;
    rows.push({
      document_id: m.id,
      studio: m.studio || `org ${m.organization_id}`,
      azienda: m.azienda || (m.company_id ? `company #${m.company_id}` : '(org-wide / senza azienda)'),
      organization_id: m.organization_id,
      company_id: m.company_id,
      cartella: m.folder_code ? `${m.folder_code} — ${m.cartella || ''}` : (m.cartella || '—'),
      file_name: audit.file_name,
      titolo: m.title,
      verdict: audit.verdict,
      azione: actionLabel(audit.verdict, audit),
      codice_db: audit.stored?.standard_code || null,
      codice_pipeline: audit.extracted?.standard_code || null,
      vigore_db: audit.stored?.validity_status || null,
      vigore_pipeline: audit.extracted?.validity_status || null,
      motivo: audit.reason,
    });
  }

  const needsAction = rows.filter((r) => r.verdict !== 'ok');
  const ok = rows.filter((r) => r.verdict === 'ok');

  console.log('# Checklist norme — re-audit file per file\n');
  console.log(`Generato: ${new Date().toISOString()}`);
  console.log(`Totale: ${rows.length} | Da gestire: ${needsAction.length} | OK: ${ok.length}\n`);

  let currentStudio = '';
  let currentAzienda = '';
  let n = 0;

  for (const r of needsAction) {
    if (r.studio !== currentStudio) {
      currentStudio = r.studio;
      currentAzienda = '';
      console.log(`\n## Studio: ${r.studio} (org ${r.organization_id})\n`);
    }
    if (r.azienda !== currentAzienda) {
      currentAzienda = r.azienda;
      console.log(`### Azienda: ${r.azienda}\n`);
    }
    n += 1;
    console.log(`#### ${n}. #${r.document_id} — ${r.file_name}`);
    console.log(`- **Azione:** ${r.azione}`);
    console.log(`- **Cartella:** ${r.cartella}`);
    console.log(`- **Titolo:** ${r.titolo}`);
    console.log(`- **Codice DB:** ${r.codice_db || '—'}`);
    console.log(`- **Codice pipeline:** ${r.codice_pipeline || '—'}`);
    console.log(`- **Vigore DB → pipeline:** ${r.vigore_db || '—'} → ${r.vigore_pipeline || '—'}`);
    console.log(`- **Motivo:** ${r.motivo}`);
    console.log('');
  }

  if (ok.length) {
    console.log('\n---\n## Già OK (nessuna azione)\n');
    for (const r of ok) {
      console.log(`- #${r.document_id} ${r.file_name} (${r.studio} / ${r.azienda})`);
    }
  }

  const outJson = path.join(__dirname, 'reaudit-norms-checklist.json');
  fs.writeFileSync(outJson, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2), 'utf8');
  console.log(`\nJSON: ${outJson}`);

  await closePool();
}

main().catch(async (e) => {
  console.error('ERRORE:', e.message);
  try { await closePool(); } catch (_) {}
  process.exit(1);
});
