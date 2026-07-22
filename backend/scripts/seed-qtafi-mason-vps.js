#!/usr/bin/env node
/**
 * Seed idempotente checklist QTAFI_VIS001 per Mason (org 1003).
 * Uso sul VPS:
 *   node /var/www/sgq-backend/scripts/seed-qtafi-mason-vps.js
 *   node /var/www/sgq-backend/scripts/seed-qtafi-mason-vps.js --org 1003
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const customChecklistService = require('../src/services/customChecklist.service');

const MASON_ORG_ID = 1003;

async function main() {
  const orgArg = process.argv.find((a) => a.startsWith('--org='));
  const organizationId = orgArg ? parseInt(orgArg.split('=')[1], 10) : MASON_ORG_ID;

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    console.error('organization_id non valido');
    process.exit(1);
  }

  const reqUser = {
    organization_id: organizationId,
    role: 'admin',
    auditor_org_id: null,
  };

  const result = await customChecklistService.seedQtafiVis001Checklist(reqUser);
  console.log(
    JSON.stringify(
      {
        created: result.created,
        checklistId: result.data?.id,
        name: result.data?.name,
        sections: result.data?.sections?.length ?? 0,
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
