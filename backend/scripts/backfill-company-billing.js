'use strict';

/**
 * Backfill company_billing per aziende pre-esistenti (migration 082).
 *
 * Uso:
 *   node backend/scripts/backfill-company-billing.js
 *   node backend/scripts/backfill-company-billing.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { query } = require('../src/config/database');
const { logBillingEvent } = require('../src/services/billing.service');

const dryRun = process.argv.includes('--dry-run');

const stats = {
  created: 0,
  skipped: 0,
  errors: 0,
};

async function fetchCompaniesWithoutBilling() {
  const result = await query(`
    SELECT
      c.id AS company_id,
      c.name AS company_name,
      c.is_active,
      c.created_at,
      c.auditor_org_id,
      ao.organization_id
    FROM companies c
    INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
    LEFT JOIN company_billing cb ON cb.company_id = c.id
    WHERE cb.id IS NULL
    ORDER BY c.id
  `, {});

  return result.recordset || [];
}

async function backfillCompany(row) {
  const companyId = row.company_id;
  const isActive = row.is_active === true || row.is_active === 1;
  const status = isActive ? 'active' : 'suspended';
  const activatedAt = row.created_at || new Date();
  const deactivatedAt = isActive ? null : new Date();
  const eventType = isActive ? 'company_activated' : 'company_backfilled';

  if (!row.organization_id || !row.auditor_org_id) {
    console.error(`  ERRORE company ${companyId}: organization_id o auditor_org_id mancante`);
    stats.errors += 1;
    return;
  }

  const existing = await query(
    `SELECT id FROM company_billing WHERE company_id = @company_id`,
    { company_id: companyId }
  );
  if (existing.recordset.length) {
    stats.skipped += 1;
    return;
  }

  if (dryRun) {
    console.log(
      `  [DRY-RUN] company ${companyId} (${row.company_name || '?'}) ? status=${status}, event=${eventType}`
    );
    stats.created += 1;
    return;
  }

  await query(`
    INSERT INTO company_billing (
      company_id, organization_id, auditor_org_id,
      status, billing_plan, activated_at, deactivated_at, created_at, updated_at
    )
    VALUES (
      @company_id, @organization_id, @auditor_org_id,
      @status, 'base', @activated_at, @deactivated_at, GETDATE(), GETDATE()
    )
  `, {
    company_id: companyId,
    organization_id: row.organization_id,
    auditor_org_id: row.auditor_org_id,
    status,
    activated_at: activatedAt,
    deactivated_at: deactivatedAt,
  });

  await logBillingEvent({
    organizationId: row.organization_id,
    companyId,
    auditorOrgId: row.auditor_org_id,
    eventType,
    payload: {
      source: 'backfill_script',
      billing_status: status,
      company_is_active: isActive,
    },
    createdBy: null,
  });

  stats.created += 1;
}

async function main() {
  console.log(`Backfill company_billing avviato${dryRun ? ' (DRY-RUN � nessuna scrittura)' : ''}...`);

  try {
    const rows = await fetchCompaniesWithoutBilling();
    console.log(`Trovate ${rows.length} aziende senza record company_billing.`);

    for (const row of rows) {
      try {
        await backfillCompany(row);
      } catch (err) {
        stats.errors += 1;
        console.error(`  ERRORE company ${row.company_id}: ${err.message}`);
      }
    }

    console.log('\nRiepilogo:');
    console.log(`  Creati:   ${stats.created}${dryRun ? ' (simulati)' : ''}`);
    console.log(`  Skippati: ${stats.skipped}`);
    console.log(`  Errori:   ${stats.errors}`);

    if (dryRun) {
      console.log('\nNessuna modifica applicata (dry-run). Rimuovere --dry-run per eseguire.');
    }

    process.exit(stats.errors > 0 ? 1 : 0);
  } catch (err) {
    console.error('Errore fatale:', err.message);
    process.exit(1);
  }
}

main();
