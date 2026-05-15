const db = require('/var/www/sgq-backend/src/config/database');
(async () => {
  await db.getPool();
  const r = await db.query(
    "SELECT standard_code, COUNT(*) as cnt FROM norm_requirements WHERE is_current = 1 GROUP BY standard_code"
  );
  console.log(JSON.stringify(r.recordset, null, 2));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
