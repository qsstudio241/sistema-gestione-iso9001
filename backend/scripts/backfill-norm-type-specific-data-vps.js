/**
 * backfill-norm-type-specific-data-vps.js — Slice R6
 * Copia metadati norma da norm_document_sources ? document_registry.type_specific_data
 * per righe pre-R3 con JSON vuoto o incompleto. Idempotente: non sovrascrive campi già presenti.
 *
 * Uso VPS:
 *   scp -P 1122 backend/scripts/backfill-norm-type-specific-data-vps.js spascarella@www.fr-busato.it:/tmp/
 *   ssh -p 1122 spascarella@www.fr-busato.it "node /tmp/backfill-norm-type-specific-data-vps.js"
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');
const {
  mergeMissingNormTypeSpecificData,
  serializeNormTypeSpecificData,
} = require('/var/www/sgq-backend/src/services/documentRegistryNorm.service');

async function main() {
  const pool = await getPool();
  const dryRun = process.argv.includes('--dry-run');

  console.log(`[R6 backfill] Avvio${dryRun ? ' (DRY-RUN)' : ''}...`);

  const result = await pool.request().query(`
    SELECT
      nds.id AS nds_id,
      nds.document_id,
      nds.organization_id,
      nds.standard_code,
      nds.norm_title,
      nds.edition_year,
      nds.issuing_body,
      nds.validity_status,
      nds.last_validity_check,
      nds.validity_check_url,
      dr.id AS dr_id,
      dr.doc_type,
      dr.type_specific_data
    FROM norm_document_sources nds
    LEFT JOIN document_registry dr ON dr.id = nds.document_id
    ORDER BY nds.id
  `);

  const stats = {
    total: result.recordset.length,
    updated: 0,
    already_ok: 0,
    skipped_no_code: 0,
    orphans: 0,
    registry_not_norma: 0,
    registry_missing: 0,
  };

  for (const row of result.recordset) {
    if (!row.document_id) {
      stats.orphans += 1;
      console.log(`  [orphan] nds_id=${row.nds_id} senza document_id`);
      continue;
    }

    if (!row.dr_id) {
      stats.registry_missing += 1;
      console.log(`  [missing] nds_id=${row.nds_id} document_id=${row.document_id} non trovato in registro`);
      continue;
    }

    if (row.doc_type && row.doc_type !== 'norma') {
      stats.registry_not_norma += 1;
      continue;
    }

    const sourceRaw = {
      standard_code: row.standard_code,
      norm_title: row.norm_title,
      edition_year: row.edition_year,
      issuing_body: row.issuing_body,
      validity_status: row.validity_status,
      last_validity_check: row.last_validity_check
        ? row.last_validity_check.toISOString()
        : null,
      validity_check_url: row.validity_check_url,
    };

    if (!sourceRaw.standard_code) {
      stats.skipped_no_code += 1;
      continue;
    }

    const { merged, changed } = mergeMissingNormTypeSpecificData(
      row.type_specific_data,
      sourceRaw,
    );

    if (!changed) {
      stats.already_ok += 1;
      continue;
    }

    const json = serializeNormTypeSpecificData(merged);
    if (!json) {
      stats.skipped_no_code += 1;
      continue;
    }

    if (!dryRun) {
      await pool.request()
        .input('json', json)
        .input('drId', row.dr_id)
        .query(`
          UPDATE document_registry
          SET type_specific_data = @json,
              updated_at = GETDATE()
          WHERE id = @drId
        `);
    }

    stats.updated += 1;
    console.log(`  [updated] dr_id=${row.dr_id} nds_id=${row.nds_id} code=${sourceRaw.standard_code}`);
  }

  console.log('\n[R6 backfill] Report:');
  console.log(JSON.stringify(stats, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('[R6 backfill] ERRORE:', err.message);
  process.exit(1);
});
