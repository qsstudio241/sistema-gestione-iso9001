const db = require('/var/www/sgq-backend/src/config/database');
const fs = require('fs');

(async () => {
  await db.getPool();
  const sql = fs.readFileSync('/tmp/055_ai_feedback.sql', 'utf8');
  await db.query(sql);
  console.log('Migration 055_ai_feedback applied successfully');

  const check = await db.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ai_feedback'"
  );
  console.log('Table exists:', check.recordset.length > 0);
  process.exit(0);
})().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
