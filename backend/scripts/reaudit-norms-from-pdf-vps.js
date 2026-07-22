#!/usr/bin/env node
/**
 * Re-audit norme esistenti: rilegge il PDF allegato con la pipeline ingest attuale
 * (regole + AI + catalogo UNI) e confronta con i metadati salvati nel DB.
 * Non modifica nulla — produce un report per decidere cosa cancellare e ricaricare.
 *
 * VPS:
 *   NODE_ENV=production DB_SERVER=127.0.0.1 node scripts/reaudit-norms-from-pdf-vps.js
 *   NODE_ENV=production DB_SERVER=127.0.0.1 node scripts/reaudit-norms-from-pdf-vps.js --org=1004
 *   ... --json   (solo JSON su stdout)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '..');
const { query, getPool, closePool } = require(path.join(backendRoot, 'src/config/database'));
const { runDocumentIngest } = require(path.join(backendRoot, 'src/services/documentIngestPipeline.service'));
const { enrichNormFields } = require(path.join(backendRoot, 'src/services/normIngest.service'));
const { parseNormTypeSpecificData } = require(path.join(backendRoot, 'src/services/documentRegistryNorm.service'));
const { normalizeStandardCodeForStorage } = require(path.join(backendRoot, 'src/services/standardCodeNormalizer.service'));

const JSON_ONLY = process.argv.includes('--json');
const orgArg = process.argv.find((a) => a.startsWith('--org='));
const ORG_FILTER = orgArg ? parseInt(orgArg.split('=')[1], 10) : null;

function log(...args) {
  if (!JSON_ONLY) console.log(...args);
}

function normCode(code, year) {
  if (!code) return '';
  return normalizeStandardCodeForStorage(String(code).trim(), year ?? null);
}

function codesMatch(a, b, yearA, yearB) {
  const na = normCode(a, yearA);
  const nb = normCode(b, yearB);
  if (!na || !nb) return false;
  return na === nb;
}

/**
 * @param {object} stored - metadati DB
 * @param {object} extracted - pipeline attuale
 * @returns {'ok'|'reupload'|'review'}
 */
function classify(stored, extracted) {
  const ex = extracted.fields || {};
  const exCode = ex.standard_code;
  const stCode = stored.standard_code;

  if (!extracted.pdfFound) return 'reupload';
  if (!exCode) return 'review';

  const codeOk = codesMatch(stCode, exCode, stored.edition_year, ex.edition_year);
  if (!codeOk) return 'reupload';

  if (extracted.status === 'pending_review' || extracted.needsReview) return 'review';
  if (extracted.warnings?.some((w) => /ambiguo|catalogo non/i.test(w))) return 'review';

  const cat = extracted.catalog_lookup;
  if (cat?.warning) return 'review';

  const storedValidity = stored.validity_status;
  const newValidity = ex.validity_status;
  if (storedValidity && newValidity && storedValidity !== newValidity) {
    if (storedValidity === 'vigente' && newValidity === 'superata') return 'review';
  }

  return 'ok';
}

async function auditOne(row) {
  const stored = parseNormTypeSpecificData(row.type_specific_data);
  const fileName = row.file_name || `${row.title || 'norma'}.pdf`;
  const storagePath = row.storage_path;

  if (!storagePath || !fs.existsSync(storagePath)) {
    return {
      document_id: row.id,
      organization_id: row.organization_id,
      title: row.title,
      file_name: fileName,
      pdfFound: false,
      verdict: 'reupload',
      reason: 'PDF allegato assente o file non trovato su disco',
      stored: {
        standard_code: stored.standard_code || null,
        validity_status: stored.validity_status || null,
      },
      extracted: null,
      warnings: ['File PDF non disponibile sul server'],
    };
  }

  let pdfBuffer;
  try {
    pdfBuffer = fs.readFileSync(storagePath);
  } catch (err) {
    return {
      document_id: row.id,
      organization_id: row.organization_id,
      title: row.title,
      file_name: fileName,
      pdfFound: false,
      verdict: 'reupload',
      reason: `Lettura PDF fallita: ${err.message}`,
      stored: { standard_code: stored.standard_code || null },
      extracted: null,
      warnings: [],
    };
  }

  const pipeline = await runDocumentIngest({
    pdfBuffer,
    docType: 'norma',
    fileName,
    organizationId: row.organization_id,
  });

  const enriched = await enrichNormFields(
    { ...pipeline.fields, _fileName: fileName },
    pipeline.warnings || [],
  );

  const needsReview = enriched.needsReview
    || pipeline.extractionConfidence < 70
    || !enriched.fields?.standard_code;

  const extracted = {
    status: needsReview ? 'pending_review' : 'ready_commit',
    fields: enriched.fields,
    catalog_lookup: enriched.catalog_lookup,
    warnings: enriched.warnings,
    confidence: pipeline.extractionConfidence,
    needsReview,
  };

  const verdict = classify(
    {
      standard_code: stored.standard_code,
      edition_year: stored.edition_year,
      validity_status: stored.validity_status,
    },
    { ...extracted, pdfFound: true },
  );

  let reason = '';
  if (verdict === 'reupload') {
    const st = normCode(stored.standard_code, stored.edition_year);
    const ex = normCode(extracted.fields?.standard_code, extracted.fields?.edition_year);
    if (st !== ex) reason = `Codice DB "${st}" vs pipeline "${ex}"`;
    else reason = 'Metadati o catalogo non allineati alla pipeline attuale';
  } else if (verdict === 'review') {
    reason = 'Match incerto — revisione umana prima del ricaricamento';
  } else {
    reason = 'Allineato alla pipeline attuale';
  }

  return {
    document_id: row.id,
    organization_id: row.organization_id,
    title: row.title,
    file_name: fileName,
    pdfFound: true,
    verdict,
    reason,
    stored: {
      standard_code: stored.standard_code || null,
      edition_year: stored.edition_year ?? null,
      validity_status: stored.validity_status || null,
      validity_check_url: stored.validity_check_url || null,
    },
    extracted: {
      standard_code: extracted.fields?.standard_code || null,
      edition_year: extracted.fields?.edition_year ?? null,
      validity_status: extracted.fields?.validity_status || null,
      catalog_lookup: extracted.catalog_lookup || null,
      confidence: extracted.confidence,
    },
    warnings: extracted.warnings || [],
  };
}

async function main() {
  await getPool();

  const params = {};
  let orgSql = '';
  if (ORG_FILTER) {
    orgSql = ' AND dr.organization_id = @orgId';
    params.orgId = ORG_FILTER;
  }

  const rows = await query(`
    SELECT
      dr.id,
      dr.organization_id,
      dr.title,
      dr.type_specific_data,
      a.file_name,
      a.storage_path,
      a.mime_type
    FROM document_registry dr
    OUTER APPLY (
      SELECT TOP 1 file_name, storage_path, mime_type
      FROM attachments
      WHERE document_id = dr.id
         OR attachment_id = dr.attachment_id
      ORDER BY attachment_id DESC
    ) a
    WHERE dr.doc_type = 'norma'
      AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
      ${orgSql}
    ORDER BY dr.organization_id, dr.id
  `, params);

  log(`=== Re-audit norme da PDF (${rows.recordset.length} record) ===\n`);

  const results = [];
  for (const row of rows.recordset) {
    log(`Analisi #${row.id} (${row.title?.slice(0, 50) || '?'})...`);
    const item = await auditOne(row);
    results.push(item);
    if (!JSON_ONLY) {
      const icon = item.verdict === 'ok' ? 'OK' : item.verdict === 'review' ? 'REVIEW' : 'REUPLOAD';
      log(`  [${icon}] ${item.reason}`);
      if (item.stored?.standard_code !== item.extracted?.standard_code && item.extracted) {
        log(`       DB: ${item.stored.standard_code} -> pipeline: ${item.extracted.standard_code}`);
      }
    }
  }

  const summary = {
    total: results.length,
    ok: results.filter((r) => r.verdict === 'ok').length,
    review: results.filter((r) => r.verdict === 'review').length,
    reupload: results.filter((r) => r.verdict === 'reupload').length,
    generatedAt: new Date().toISOString(),
    orgFilter: ORG_FILTER,
    items: results,
  };

  if (JSON_ONLY) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    log('\n=== Riepilogo ===');
    log(`Totale:    ${summary.total}`);
    log(`OK:        ${summary.ok} (nessuna azione)`);
    log(`REVIEW:    ${summary.review} (controllare a mano)`);
    log(`REUPLOAD:  ${summary.reupload} (cancellare e ricaricare PDF)`);
    log('\n--- Solo REUPLOAD ---');
    for (const r of results.filter((x) => x.verdict === 'reupload')) {
      log(`  #${r.document_id} org=${r.organization_id} | ${r.file_name}`);
      log(`    ${r.reason}`);
    }
    log('\n--- Solo REVIEW ---');
    for (const r of results.filter((x) => x.verdict === 'review')) {
      log(`  #${r.document_id} org=${r.organization_id} | ${r.file_name}`);
      log(`    ${r.reason}`);
    }
    const outPath = path.join(__dirname, `reaudit-norms-report${ORG_FILTER ? `-org${ORG_FILTER}` : ''}.json`);
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
    log(`\nReport JSON: ${outPath}`);
  }

  await closePool();
}

main().catch(async (err) => {
  console.error('ERRORE:', err.message);
  try { await closePool(); } catch (_) {}
  process.exit(1);
});
