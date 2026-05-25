process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const db = require('/var/www/sgq-backend/src/config/database');
(async () => {
  const p = await db.getPool();
  const modules = JSON.stringify([
    "audit","documents","qualifiche","nc","rischi","reclami",
    "notifications","sal","saldatura","ai_import","ai_assist",
    "ai_norms","ai_review","ai_chat"
  ]);
  await p.request()
    .input('org_id', 1003)
    .input('modules', modules)
    .query("UPDATE organizations SET licensed_modules = @modules WHERE organization_id = @org_id");
  const r = await p.request()
    .input('org_id', 1003)
    .query("SELECT organization_id, organization_name, licensed_modules FROM organizations WHERE organization_id = @org_id");
  console.log('Updated MASON_Srl:', JSON.stringify(r.recordset[0], null, 2));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
