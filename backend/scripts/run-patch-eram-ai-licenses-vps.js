/**
 * Hotfix idempotente: aggiunge moduli AI a ERAM (org 1004) se mancanti.
 * Uso Cloud Agent: scp su VPS, poi node /tmp/run-patch-eram-ai-licenses-vps.js
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const ERAM_ORG_ID = 1004;
const AI_MODULE_KEYS = ['ai_assist', 'ai_norms', 'ai_review', 'ai_chat'];

async function main() {
  let svc;
  try {
    svc = require('/var/www/sgq-backend/src/services/moduleLicense.service');
  } catch (_) {
    svc = null;
  }

  const db = require('/var/www/sgq-backend/src/config/database');
  const pool = await db.getPool();

  const before = await pool.request()
    .input('org_id', ERAM_ORG_ID)
    .query(`
      SELECT organization_id, organization_name, licensed_modules
      FROM organizations WHERE organization_id = @org_id
    `);

  if (!before.recordset.length) {
    console.error('[ERAM-AI] Organizzazione 1004 non trovata');
    process.exit(1);
  }

  const row = before.recordset[0];
  console.log('[ERAM-AI] Prima:', JSON.stringify(row, null, 2));

  if (svc?.appendLicensedModulesForOrg) {
    const updated = await svc.appendLicensedModulesForOrg(ERAM_ORG_ID, AI_MODULE_KEYS);
    console.log('[ERAM-AI] Moduli effettivi dopo append:', JSON.stringify(updated));
  } else {
    const raw = row.licensed_modules;
    if (raw == null || String(raw).trim() === '') {
      console.log('[ERAM-AI] licensed_modules NULL — tutti i moduli già attivi, nessuna modifica');
    } else {
      let current = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) current = parsed.map(String);
      } catch (_) { /* ignore */ }

      const merged = [...new Set([...current, ...AI_MODULE_KEYS, 'audit'])];
      const json = JSON.stringify(merged);
      await pool.request()
        .input('org_id', ERAM_ORG_ID)
        .input('modules', json)
        .query('UPDATE organizations SET licensed_modules = @modules WHERE organization_id = @org_id');
      console.log('[ERAM-AI] Fallback merge applicato:', json);
    }
  }

  const after = await pool.request()
    .input('org_id', ERAM_ORG_ID)
    .query(`
      SELECT organization_id, organization_name, licensed_modules
      FROM organizations WHERE organization_id = @org_id
    `);

  const finalRaw = after.recordset[0]?.licensed_modules;
  let hasAiAssist = false;
  if (finalRaw == null || String(finalRaw).trim() === '') {
    hasAiAssist = true;
  } else {
    try {
      const mods = JSON.parse(finalRaw);
      hasAiAssist = Array.isArray(mods) && mods.includes('ai_assist');
    } catch (_) { /* ignore */ }
  }

  console.log('[ERAM-AI] Dopo:', JSON.stringify(after.recordset[0], null, 2));
  console.log(hasAiAssist ? '[ERAM-AI] OK — ai_assist presente' : '[ERAM-AI] ERRORE — ai_assist ancora assente');
  await pool.close();
  process.exit(hasAiAssist ? 0 : 1);
}

main().catch((err) => {
  console.error('[ERAM-AI] ERRORE:', err.message);
  process.exit(1);
});
